-- Persist a newly generated timetable and all of its supporting records as one
-- transaction. Any invalid row or insert failure rolls the entire creation back.
create or replace function public.create_generated_timetable(
  p_school_id uuid,
  p_academic_year_id uuid,
  p_entries jsonb,
  p_issues jsonb,
  p_quality_score integer
)
returns table(timetable_id uuid, generation_run_id uuid)
language plpgsql
security invoker
set search_path = public
as $$
declare
  new_timetable_id uuid;
  new_generation_run_id uuid;
  next_version integer;
  expected_count integer;
  inserted_count integer;
begin
  if jsonb_typeof(coalesce(p_entries, '[]'::jsonb)) <> 'array'
     or jsonb_typeof(coalesce(p_issues, '[]'::jsonb)) <> 'array' then
    raise exception 'Entries and issues must be JSON arrays' using errcode = '22023';
  end if;

  if p_quality_score < 0 or p_quality_score > 100 then
    raise exception 'Quality score must be between 0 and 100' using errcode = '22023';
  end if;

  -- This row lock serializes version allocation for one school year.
  perform 1
  from public.academic_years
  where id = p_academic_year_id
    and school_id = p_school_id
  for update;

  if not found then
    raise exception 'Academic year not found' using errcode = 'P0002';
  end if;

  if not public.can_manage_school(p_school_id) then
    raise exception 'Not authorized to generate a timetable' using errcode = '42501';
  end if;

  select coalesce(max(version), 0) + 1
    into next_version
  from public.timetables
  where school_id = p_school_id
    and academic_year_id = p_academic_year_id;

  insert into public.timetables (
    school_id, academic_year_id, name, version, status, quality_score, created_by
  ) values (
    p_school_id, p_academic_year_id, 'Version ' || next_version, next_version,
    'draft', p_quality_score, auth.uid()
  )
  returning id into new_timetable_id;

  insert into public.generation_runs (
    school_id, academic_year_id, timetable_id, status, progress,
    started_at, completed_at, created_by
  ) values (
    p_school_id, p_academic_year_id, new_timetable_id, 'completed', 100,
    now(), now(), auth.uid()
  )
  returning id into new_generation_run_id;

  expected_count := jsonb_array_length(coalesce(p_entries, '[]'::jsonb));

  insert into public.timetable_entries (
    school_id, timetable_id, assignment_id, teacher_id, subject_id,
    class_section_id, working_day_id, period_slot_id, duration_slots, is_locked
  )
  select
    p_school_id, new_timetable_id, entry.assignment_id, entry.teacher_id,
    entry.subject_id, entry.class_section_id, entry.working_day_id,
    entry.period_slot_id, 1, false
  from jsonb_to_recordset(coalesce(p_entries, '[]'::jsonb)) as entry(
    assignment_id uuid,
    teacher_id uuid,
    subject_id uuid,
    class_section_id uuid,
    working_day_id uuid,
    period_slot_id uuid
  )
  join public.teaching_assignments assignment
    on assignment.id = entry.assignment_id
   and assignment.school_id = p_school_id
   and assignment.academic_year_id = p_academic_year_id
   and assignment.teacher_id = entry.teacher_id
   and assignment.subject_id = entry.subject_id
   and assignment.class_section_id = entry.class_section_id
   and assignment.status = 'active'
  join public.working_days working_day
    on working_day.id = entry.working_day_id
   and working_day.school_id = p_school_id
   and working_day.academic_year_id = p_academic_year_id
   and working_day.is_active = true
  join public.period_slots period_slot
    on period_slot.id = entry.period_slot_id
   and period_slot.school_id = p_school_id
   and period_slot.academic_year_id = p_academic_year_id
   and period_slot.kind = 'lesson';

  get diagnostics inserted_count = row_count;
  if inserted_count <> expected_count then
    raise exception 'One or more generated timetable entries are invalid' using errcode = '22023';
  end if;

  expected_count := jsonb_array_length(coalesce(p_issues, '[]'::jsonb));

  insert into public.constraint_issues (
    school_id, generation_run_id, severity, code, title, explanation, context
  )
  select
    p_school_id, new_generation_run_id, issue.severity::public.constraint_severity,
    issue.code, issue.title, issue.explanation, coalesce(issue.context, '{}'::jsonb)
  from jsonb_to_recordset(coalesce(p_issues, '[]'::jsonb)) as issue(
    severity text,
    code text,
    title text,
    explanation text,
    context jsonb
  );

  get diagnostics inserted_count = row_count;
  if inserted_count <> expected_count then
    raise exception 'One or more generation issues are invalid' using errcode = '22023';
  end if;

  return query select new_timetable_id, new_generation_run_id;
end;
$$;

revoke all on function public.create_generated_timetable(uuid, uuid, jsonb, jsonb, integer) from public;
grant execute on function public.create_generated_timetable(uuid, uuid, jsonb, jsonb, integer) to authenticated;
