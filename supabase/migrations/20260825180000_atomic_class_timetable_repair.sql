-- Replace only one class's unlocked lessons while preserving every other class
-- and the selected class's locked lessons. The run, issues, score, and draft
-- status change in the same transaction as the timetable entries.
create or replace function public.complete_class_timetable_repair(
  p_timetable_id uuid,
  p_class_section_id uuid,
  p_entries jsonb,
  p_issues jsonb,
  p_quality_score integer
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  target_school_id uuid;
  target_academic_year_id uuid;
  new_generation_run_id uuid;
  expected_count integer;
  inserted_count integer;
begin
  if jsonb_typeof(coalesce(p_entries, '[]'::jsonb)) <> 'array'
     or jsonb_typeof(coalesce(p_issues, '[]'::jsonb)) <> 'array' then
    raise exception 'Entries and issues must be JSON arrays' using errcode = '22023';
  end if;

  if p_quality_score is null or p_quality_score < 0 or p_quality_score > 100 then
    raise exception 'Quality score must be between 0 and 100' using errcode = '22023';
  end if;

  select school_id, academic_year_id
    into target_school_id, target_academic_year_id
  from public.timetables
  where id = p_timetable_id
  for update;

  if target_school_id is null then
    raise exception 'Timetable not found' using errcode = 'P0002';
  end if;

  if not public.can_manage_school(target_school_id) then
    raise exception 'Not authorized to repair this timetable' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.class_sections
    where id = p_class_section_id
      and school_id = target_school_id
      and academic_year_id = target_academic_year_id
      and status = 'active'
  ) then
    raise exception 'Class not found' using errcode = 'P0002';
  end if;

  insert into public.generation_runs (
    school_id, academic_year_id, timetable_id, status, progress,
    started_at, completed_at, created_by
  ) values (
    target_school_id, target_academic_year_id, p_timetable_id, 'completed', 100,
    now(), now(), auth.uid()
  )
  returning id into new_generation_run_id;

  delete from public.timetable_entries
  where timetable_id = p_timetable_id
    and class_section_id = p_class_section_id
    and is_locked = false;

  expected_count := jsonb_array_length(coalesce(p_entries, '[]'::jsonb));

  insert into public.timetable_entries (
    school_id, timetable_id, assignment_id, teacher_id, subject_id,
    class_section_id, working_day_id, period_slot_id, duration_slots, is_locked
  )
  select
    target_school_id, p_timetable_id, entry.assignment_id, entry.teacher_id,
    entry.subject_id, p_class_section_id, entry.working_day_id,
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
   and assignment.school_id = target_school_id
   and assignment.academic_year_id = target_academic_year_id
   and assignment.teacher_id = entry.teacher_id
   and assignment.subject_id = entry.subject_id
   and assignment.class_section_id = p_class_section_id
   and entry.class_section_id = p_class_section_id
   and assignment.status = 'active'
  join public.working_days working_day
    on working_day.id = entry.working_day_id
   and working_day.school_id = target_school_id
   and working_day.academic_year_id = target_academic_year_id
   and working_day.is_active = true
  join public.period_slots period_slot
    on period_slot.id = entry.period_slot_id
   and period_slot.school_id = target_school_id
   and period_slot.academic_year_id = target_academic_year_id
   and period_slot.kind = 'lesson';

  get diagnostics inserted_count = row_count;
  if inserted_count <> expected_count then
    raise exception 'One or more repaired timetable entries are invalid' using errcode = '22023';
  end if;

  expected_count := jsonb_array_length(coalesce(p_issues, '[]'::jsonb));

  insert into public.constraint_issues (
    school_id, generation_run_id, severity, code, title, explanation, context
  )
  select
    target_school_id, new_generation_run_id,
    issue.severity::public.constraint_severity, issue.code, issue.title,
    issue.explanation, coalesce(issue.context, '{}'::jsonb)
  from jsonb_to_recordset(coalesce(p_issues, '[]'::jsonb)) as issue(
    severity text,
    code text,
    title text,
    explanation text,
    context jsonb
  );

  get diagnostics inserted_count = row_count;
  if inserted_count <> expected_count then
    raise exception 'One or more repair issues are invalid' using errcode = '22023';
  end if;

  update public.timetables
  set quality_score = p_quality_score,
      status = 'draft',
      published_at = null,
      published_by = null
  where id = p_timetable_id;

  return new_generation_run_id;
end;
$$;

revoke all on function public.complete_class_timetable_repair(uuid, uuid, jsonb, jsonb, integer) from public;
grant execute on function public.complete_class_timetable_repair(uuid, uuid, jsonb, jsonb, integer) to authenticated;
