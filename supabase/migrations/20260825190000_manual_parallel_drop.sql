-- Manual timetable edits must respect explicit teacher availability, and making
-- two lessons parallel must save the level pairing and move the lesson atomically.

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
  select * into entry from public.timetable_entries where id = p_entry_id for update;
  if entry.id is null then raise exception 'Entry not found' using errcode = 'P0002'; end if;
  if entry.is_locked then raise exception 'Cannot move a locked lesson' using errcode = '23514'; end if;
  if not public.can_manage_school(entry.school_id) then raise exception 'Not authorized to move this lesson' using errcode = '42501'; end if;

  if not exists (
    select 1 from public.timetables timetable
    join public.working_days working_day
      on working_day.id = p_working_day_id
     and working_day.school_id = timetable.school_id
     and working_day.academic_year_id = timetable.academic_year_id
     and working_day.is_active = true
    join public.period_slots period_slot
      on period_slot.id = p_period_slot_id
     and period_slot.school_id = timetable.school_id
     and period_slot.academic_year_id = timetable.academic_year_id
     and period_slot.kind = 'lesson'
    where timetable.id = entry.timetable_id
  ) then
    raise exception 'The destination is not an active lesson slot for this timetable' using errcode = '23514';
  end if;

  if exists (
    select 1 from public.timetables timetable
    join public.teacher_availability availability
      on availability.school_id = timetable.school_id
     and availability.academic_year_id = timetable.academic_year_id
     and availability.teacher_id = entry.teacher_id
     and availability.working_day_id = p_working_day_id
     and availability.period_slot_id = p_period_slot_id
     and availability.is_available = false
    where timetable.id = entry.timetable_id
  ) then
    raise exception 'This teacher is unavailable at the destination slot' using errcode = '23514';
  end if;

  update public.timetable_entries
  set working_day_id = p_working_day_id, period_slot_id = p_period_slot_id
  where id = p_entry_id;

  update public.timetables set status = 'draft', published_at = null, published_by = null
  where id = entry.timetable_id;
end;
$$;

revoke all on function public.move_timetable_entry(uuid, uuid, uuid) from public;
grant execute on function public.move_timetable_entry(uuid, uuid, uuid) to authenticated;

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
  perform 1 from public.timetable_entries where id in (p_entry_a, p_entry_b) order by id for update;
  select * into a from public.timetable_entries where id = p_entry_a;
  select * into b from public.timetable_entries where id = p_entry_b;
  if a.id is null or b.id is null then raise exception 'Entry not found' using errcode = 'P0002'; end if;
  if a.timetable_id <> b.timetable_id then raise exception 'Entries belong to different timetables' using errcode = '23514'; end if;
  if a.is_locked or b.is_locked then raise exception 'Cannot move a locked lesson' using errcode = '23514'; end if;
  if not public.can_manage_school(a.school_id) then raise exception 'Not authorized to swap these lessons' using errcode = '42501'; end if;

  if exists (
    select 1 from public.timetables timetable
    join public.teacher_availability availability
      on availability.school_id = timetable.school_id
     and availability.academic_year_id = timetable.academic_year_id
     and availability.is_available = false
    where timetable.id = a.timetable_id
      and ((availability.teacher_id = a.teacher_id and availability.working_day_id = b.working_day_id and availability.period_slot_id = b.period_slot_id)
        or (availability.teacher_id = b.teacher_id and availability.working_day_id = a.working_day_id and availability.period_slot_id = a.period_slot_id))
  ) then
    raise exception 'One of the teachers is unavailable at the destination slot' using errcode = '23514';
  end if;

  delete from public.timetable_entries where id in (p_entry_a, p_entry_b);
  insert into public.timetable_entries(
    id, school_id, timetable_id, assignment_id, teacher_id, subject_id,
    class_section_id, working_day_id, period_slot_id, duration_slots, is_locked
  ) values
    (a.id, a.school_id, a.timetable_id, a.assignment_id, a.teacher_id, a.subject_id, a.class_section_id, b.working_day_id, b.period_slot_id, a.duration_slots, a.is_locked),
    (b.id, b.school_id, b.timetable_id, b.assignment_id, b.teacher_id, b.subject_id, b.class_section_id, a.working_day_id, a.period_slot_id, b.duration_slots, b.is_locked);

  update public.timetables set status = 'draft', published_at = null, published_by = null
  where id = a.timetable_id;
end;
$$;

revoke all on function public.swap_timetable_entries(uuid, uuid) from public;
grant execute on function public.swap_timetable_entries(uuid, uuid) to authenticated;

create or replace function public.make_timetable_entries_parallel(
  p_dragged_entry_id uuid,
  p_target_entry_id uuid
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  dragged public.timetable_entries;
  target public.timetable_entries;
  target_level_id uuid;
  dragged_level_subject_id uuid;
  target_level_subject_id uuid;
  target_group_id uuid;
  dragged_subject_name text;
  target_subject_name text;
  destination_occupants integer;
begin
  perform 1 from public.timetable_entries
  where id in (p_dragged_entry_id, p_target_entry_id)
  order by id for update;
  select * into dragged from public.timetable_entries where id = p_dragged_entry_id;
  select * into target from public.timetable_entries where id = p_target_entry_id;

  if dragged.id is null or target.id is null then raise exception 'Entry not found' using errcode = 'P0002'; end if;
  if dragged.id = target.id then raise exception 'Choose two different lessons' using errcode = '23514'; end if;
  if dragged.timetable_id <> target.timetable_id or dragged.class_section_id <> target.class_section_id then
    raise exception 'Parallel lessons must belong to the same class timetable' using errcode = '23514';
  end if;
  if dragged.is_locked then raise exception 'Cannot move a locked lesson' using errcode = '23514'; end if;
  if dragged.subject_id = target.subject_id then raise exception 'A subject cannot run in parallel with itself' using errcode = '23514'; end if;
  if not public.can_manage_school(dragged.school_id) then raise exception 'Not authorized to edit this timetable' using errcode = '42501'; end if;

  select count(*) into destination_occupants
  from public.timetable_entries
  where timetable_id = target.timetable_id
    and class_section_id = target.class_section_id
    and working_day_id = target.working_day_id
    and period_slot_id = target.period_slot_id
    and id <> dragged.id;
  if destination_occupants > 1 then
    raise exception 'This slot already has two parallel lessons' using errcode = '23514';
  end if;

  if exists (
    select 1 from public.timetables timetable
    join public.teacher_availability availability
      on availability.school_id = timetable.school_id
     and availability.academic_year_id = timetable.academic_year_id
     and availability.teacher_id = dragged.teacher_id
     and availability.working_day_id = target.working_day_id
     and availability.period_slot_id = target.period_slot_id
     and availability.is_available = false
    where timetable.id = dragged.timetable_id
  ) then
    raise exception 'The dragged lesson''s teacher is unavailable at this slot' using errcode = '23514';
  end if;

  if exists (
    select 1 from public.timetable_entries entry
    where entry.timetable_id = dragged.timetable_id
      and entry.teacher_id = dragged.teacher_id
      and entry.working_day_id = target.working_day_id
      and entry.period_slot_id = target.period_slot_id
      and entry.id <> dragged.id
  ) then
    raise exception 'The dragged lesson''s teacher is already teaching at this slot' using errcode = '23505';
  end if;

  select class_section.level_id into target_level_id
  from public.class_sections class_section
  where class_section.id = dragged.class_section_id
    and class_section.school_id = dragged.school_id;

  select level_subject.id, subject.name into dragged_level_subject_id, dragged_subject_name
  from public.level_subjects level_subject
  join public.subjects subject on subject.id = level_subject.subject_id
  where level_subject.level_id = target_level_id and level_subject.subject_id = dragged.subject_id;

  select level_subject.id, subject.name into target_level_subject_id, target_subject_name
  from public.level_subjects level_subject
  join public.subjects subject on subject.id = level_subject.subject_id
  where level_subject.level_id = target_level_id and level_subject.subject_id = target.subject_id;

  if dragged_level_subject_id is null or target_level_subject_id is null then
    raise exception 'Both subjects must be configured for this class level' using errcode = '23514';
  end if;

  select first_membership.parallel_group_id into target_group_id
  from public.level_subject_parallel_groups first_membership
  join public.level_subject_parallel_groups second_membership
    on second_membership.parallel_group_id = first_membership.parallel_group_id
  where first_membership.level_subject_id = dragged_level_subject_id
    and second_membership.level_subject_id = target_level_subject_id
  limit 1;

  if target_group_id is null then
    insert into public.parallel_subject_groups (school_id, level_id, name)
    values (dragged.school_id, target_level_id, dragged_subject_name || ' / ' || target_subject_name)
    returning id into target_group_id;

    insert into public.level_subject_parallel_groups (level_subject_id, parallel_group_id)
    values (dragged_level_subject_id, target_group_id), (target_level_subject_id, target_group_id);
  end if;

  update public.timetable_entries
  set working_day_id = target.working_day_id, period_slot_id = target.period_slot_id
  where id = dragged.id;

  update public.timetables set status = 'draft', published_at = null, published_by = null
  where id = dragged.timetable_id;

  return target_group_id;
end;
$$;

revoke all on function public.make_timetable_entries_parallel(uuid, uuid) from public;
grant execute on function public.make_timetable_entries_parallel(uuid, uuid) to authenticated;
