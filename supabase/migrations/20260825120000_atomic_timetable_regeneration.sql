-- Replace every unlocked lesson in a timetable as one transaction. If validation,
-- deletion, or insertion fails, PostgreSQL rolls the whole function call back.
create or replace function public.replace_unlocked_timetable_entries(
  p_timetable_id uuid,
  p_entries jsonb
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  target_school_id uuid;
  target_academic_year_id uuid;
  expected_count integer;
  inserted_count integer;
begin
  if jsonb_typeof(coalesce(p_entries, '[]'::jsonb)) <> 'array' then
    raise exception 'p_entries must be a JSON array' using errcode = '22023';
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
    raise exception 'Not authorized to regenerate this timetable' using errcode = '42501';
  end if;

  expected_count := jsonb_array_length(coalesce(p_entries, '[]'::jsonb));

  delete from public.timetable_entries
  where timetable_id = p_timetable_id
    and is_locked = false;

  insert into public.timetable_entries (
    school_id,
    timetable_id,
    assignment_id,
    teacher_id,
    subject_id,
    class_section_id,
    working_day_id,
    period_slot_id,
    duration_slots,
    is_locked
  )
  select
    target_school_id,
    p_timetable_id,
    entry.assignment_id,
    entry.teacher_id,
    entry.subject_id,
    entry.class_section_id,
    entry.working_day_id,
    entry.period_slot_id,
    1,
    false
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
   and assignment.class_section_id = entry.class_section_id
  join public.working_days working_day
    on working_day.id = entry.working_day_id
   and working_day.school_id = target_school_id
   and working_day.academic_year_id = target_academic_year_id
  join public.period_slots period_slot
    on period_slot.id = entry.period_slot_id
   and period_slot.school_id = target_school_id
   and period_slot.academic_year_id = target_academic_year_id;

  get diagnostics inserted_count = row_count;

  if inserted_count <> expected_count then
    raise exception 'One or more generated timetable entries are invalid' using errcode = '22023';
  end if;
end;
$$;

revoke all on function public.replace_unlocked_timetable_entries(uuid, jsonb) from public;
grant execute on function public.replace_unlocked_timetable_entries(uuid, jsonb) to authenticated;
