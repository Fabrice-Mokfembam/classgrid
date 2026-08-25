-- Change the teacher for one scheduled lesson without changing its curriculum
-- assignment. Availability, clashes, and teacher workload limits remain hard rules.
create or replace function public.change_timetable_entry_teacher(
  p_entry_id uuid,
  p_teacher_id uuid
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  entry public.timetable_entries;
  replacement public.teachers;
  teacher_day_periods integer;
  teacher_period_orders integer[];
  period_order integer;
  max_consecutive integer;
  current_run integer := 0;
  longest_run integer := 0;
  previous_order integer;
begin
  select * into entry from public.timetable_entries where id = p_entry_id for update;
  if entry.id is null then raise exception 'Lesson not found' using errcode = 'P0002'; end if;
  if entry.teacher_id = p_teacher_id then return; end if;
  if not public.can_manage_school(entry.school_id) then raise exception 'Not authorized to change this lesson' using errcode = '42501'; end if;

  select * into replacement from public.teachers
  where id = p_teacher_id and school_id = entry.school_id and status = 'active';
  if replacement.id is null then raise exception 'Choose an active teacher from this school' using errcode = '23514'; end if;

  if exists (
    select 1 from public.timetables timetable
    join public.teacher_availability availability
      on availability.school_id = timetable.school_id
     and availability.academic_year_id = timetable.academic_year_id
     and availability.teacher_id = p_teacher_id
     and availability.working_day_id = entry.working_day_id
     and availability.period_slot_id = entry.period_slot_id
     and availability.is_available = false
    where timetable.id = entry.timetable_id
  ) then
    raise exception '% is unavailable at this lesson time', replacement.full_name using errcode = '23514';
  end if;

  if exists (
    select 1 from public.timetable_entries existing
    where existing.timetable_id = entry.timetable_id
      and existing.teacher_id = p_teacher_id
      and existing.working_day_id = entry.working_day_id
      and existing.period_slot_id = entry.period_slot_id
      and existing.id <> entry.id
  ) then
    raise exception '% is already teaching another class at this time', replacement.full_name using errcode = '23505';
  end if;

  select count(*)::integer into teacher_day_periods
  from public.timetable_entries existing
  where existing.timetable_id = entry.timetable_id
    and existing.teacher_id = p_teacher_id
    and existing.working_day_id = entry.working_day_id
    and existing.id <> entry.id;

  if replacement.max_periods_per_day is not null
     and teacher_day_periods + 1 > replacement.max_periods_per_day then
    raise exception '% would exceed the daily lesson limit', replacement.full_name using errcode = '23514';
  end if;

  select slot.sort_order into period_order
  from public.period_slots slot where slot.id = entry.period_slot_id;

  select coalesce(array_agg(candidate.sort_order order by candidate.sort_order), '{}'::integer[])
    into teacher_period_orders
  from (
    select slot.sort_order
    from public.timetable_entries existing
    join public.period_slots slot on slot.id = existing.period_slot_id
    where existing.timetable_id = entry.timetable_id
      and existing.teacher_id = p_teacher_id
      and existing.working_day_id = entry.working_day_id
      and existing.id <> entry.id
    union all
    select period_order
  ) candidate;

  foreach period_order in array teacher_period_orders loop
    if previous_order is null or period_order <> previous_order + 1 then current_run := 1;
    else current_run := current_run + 1;
    end if;
    longest_run := greatest(longest_run, current_run);
    previous_order := period_order;
  end loop;

  max_consecutive := coalesce(replacement.max_consecutive_periods, 4);
  if longest_run > max_consecutive then
    raise exception '% would exceed the consecutive lesson limit', replacement.full_name using errcode = '23514';
  end if;

  update public.timetable_entries set teacher_id = p_teacher_id where id = entry.id;
  update public.timetables set status = 'draft', published_at = null, published_by = null
  where id = entry.timetable_id;
end;
$$;

revoke all on function public.change_timetable_entry_teacher(uuid, uuid) from public;
grant execute on function public.change_timetable_entry_teacher(uuid, uuid) to authenticated;
