-- Atomically swaps the (working_day_id, period_slot_id) of two timetable_entries rows.
-- A plain two-step UPDATE would transiently violate the table's own unique constraints
-- mid-swap (row A briefly taking row B's still-current slot); delete+reinsert inside one
-- statement-level function call avoids that without needing deferrable constraints.
-- SECURITY INVOKER (the default): runs as the calling user, so the existing
-- "school managers write timetable_entries" RLS policy still applies.
create or replace function public.swap_timetable_entries(p_entry_a uuid, p_entry_b uuid)
returns void language plpgsql as $$
declare a public.timetable_entries; b public.timetable_entries;
begin
  select * into a from public.timetable_entries where id = p_entry_a for update;
  select * into b from public.timetable_entries where id = p_entry_b for update;
  if a.id is null or b.id is null then raise exception 'Entry not found'; end if;
  if a.timetable_id <> b.timetable_id then raise exception 'Entries belong to different timetables'; end if;
  if a.is_locked or b.is_locked then raise exception 'Cannot move a locked lesson'; end if;

  delete from public.timetable_entries where id in (p_entry_a, p_entry_b);
  insert into public.timetable_entries(id, school_id, timetable_id, assignment_id, teacher_id, subject_id, class_section_id, working_day_id, period_slot_id, duration_slots, is_locked)
  values
    (a.id, a.school_id, a.timetable_id, a.assignment_id, a.teacher_id, a.subject_id, a.class_section_id, b.working_day_id, b.period_slot_id, a.duration_slots, a.is_locked),
    (b.id, b.school_id, b.timetable_id, b.assignment_id, b.teacher_id, b.subject_id, b.class_section_id, a.working_day_id, a.period_slot_id, b.duration_slots, b.is_locked);
end $$;

grant execute on function public.swap_timetable_entries to authenticated;
