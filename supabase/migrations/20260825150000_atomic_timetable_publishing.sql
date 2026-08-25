-- Publish one timetable as the official version for its academic year. Archiving
-- the previous version and publishing the selected version happen together.
create or replace function public.publish_timetable(p_timetable_id uuid)
returns timestamptz
language plpgsql
security invoker
set search_path = public
as $$
declare
  target_school_id uuid;
  target_academic_year_id uuid;
  published_time timestamptz := now();
begin
  select school_id, academic_year_id
    into target_school_id, target_academic_year_id
  from public.timetables
  where id = p_timetable_id;

  if target_school_id is null then
    raise exception 'Timetable not found' using errcode = 'P0002';
  end if;

  if not public.can_manage_school(target_school_id) then
    raise exception 'Not authorized to publish this timetable' using errcode = '42501';
  end if;

  -- Serialize publication for this academic year before locking timetable rows.
  perform 1
  from public.academic_years
  where id = target_academic_year_id
    and school_id = target_school_id
  for update;

  if exists (
    select 1
    from public.teaching_assignments assignment
    left join (
      select assignment_id, count(*)::integer as actual_periods
      from public.timetable_entries
      where timetable_id = p_timetable_id
        and assignment_id is not null
      group by assignment_id
    ) scheduled on scheduled.assignment_id = assignment.id
    where assignment.school_id = target_school_id
      and assignment.academic_year_id = target_academic_year_id
      and assignment.status = 'active'
      and coalesce(scheduled.actual_periods, 0) <> assignment.periods_per_week
  ) then
    raise exception 'Validate the timetable and fix all assignment period issues before publishing' using errcode = '23514';
  end if;

  update public.timetables
  set status = 'archived'
  where school_id = target_school_id
    and academic_year_id = target_academic_year_id
    and status = 'published'
    and id <> p_timetable_id;

  update public.timetables
  set status = 'published',
      published_at = published_time,
      published_by = auth.uid()
  where id = p_timetable_id;

  return published_time;
end;
$$;

revoke all on function public.publish_timetable(uuid) from public;
grant execute on function public.publish_timetable(uuid) to authenticated;

-- Move a lesson and invalidate publication in the same transaction.
create or replace function public.move_timetable_entry(
  p_entry_id uuid,
  p_working_day_id uuid,
  p_period_slot_id uuid
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  entry public.timetable_entries;
begin
  select * into entry
  from public.timetable_entries
  where id = p_entry_id
  for update;

  if entry.id is null then raise exception 'Entry not found' using errcode = 'P0002'; end if;
  if entry.is_locked then raise exception 'Cannot move a locked lesson' using errcode = '23514'; end if;

  update public.timetable_entries
  set working_day_id = p_working_day_id,
      period_slot_id = p_period_slot_id
  where id = p_entry_id;

  update public.timetables
  set status = 'draft', published_at = null, published_by = null
  where id = entry.timetable_id;
end;
$$;

revoke all on function public.move_timetable_entry(uuid, uuid, uuid) from public;
grant execute on function public.move_timetable_entry(uuid, uuid, uuid) to authenticated;

-- Keep swaps atomic and invalidate publication as part of the same operation.
create or replace function public.swap_timetable_entries(p_entry_a uuid, p_entry_b uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  a public.timetable_entries;
  b public.timetable_entries;
begin
  select * into a from public.timetable_entries where id = p_entry_a for update;
  select * into b from public.timetable_entries where id = p_entry_b for update;
  if a.id is null or b.id is null then raise exception 'Entry not found' using errcode = 'P0002'; end if;
  if a.timetable_id <> b.timetable_id then raise exception 'Entries belong to different timetables' using errcode = '23514'; end if;
  if a.is_locked or b.is_locked then raise exception 'Cannot move a locked lesson' using errcode = '23514'; end if;

  delete from public.timetable_entries where id in (p_entry_a, p_entry_b);
  insert into public.timetable_entries(
    id, school_id, timetable_id, assignment_id, teacher_id, subject_id,
    class_section_id, working_day_id, period_slot_id, duration_slots, is_locked
  ) values
    (a.id, a.school_id, a.timetable_id, a.assignment_id, a.teacher_id, a.subject_id, a.class_section_id, b.working_day_id, b.period_slot_id, a.duration_slots, a.is_locked),
    (b.id, b.school_id, b.timetable_id, b.assignment_id, b.teacher_id, b.subject_id, b.class_section_id, a.working_day_id, a.period_slot_id, b.duration_slots, b.is_locked);

  update public.timetables
  set status = 'draft', published_at = null, published_by = null
  where id = a.timetable_id;
end;
$$;

revoke all on function public.swap_timetable_entries(uuid, uuid) from public;
grant execute on function public.swap_timetable_entries(uuid, uuid) to authenticated;
