-- Phase 1 of CURRICULUM_STRUCTURE_PLAN.md: subjects scoped to a level (with the
-- level's own weekly period count) and the "parallel-compatible subjects" mechanism
-- behind the COM/CSC case (two subjects legitimately sharing one class's slot because
-- the school treats them as mutually exclusive electives).

-- Groups first, since level_subjects.parallel_group_id references it.
create table public.parallel_subject_groups (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  level_id uuid not null references public.levels(id) on delete cascade,
  name text,
  created_at timestamptz not null default now()
);

create table public.level_subjects (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  level_id uuid not null references public.levels(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  periods_per_week smallint not null check (periods_per_week > 0),
  stream_label text,
  parallel_group_id uuid references public.parallel_subject_groups(id) on delete set null,
  created_at timestamptz not null default now(),
  unique(level_id, subject_id)
);

create index on public.level_subjects(school_id);
create index on public.parallel_subject_groups(school_id, level_id);

-- A subject's parallel group must belong to the same level as the subject itself —
-- otherwise the generator could be told two subjects from different levels "overlap",
-- which is meaningless (levels don't share a timetable grid).
create or replace function public.check_level_subject_parallel_group()
returns trigger language plpgsql as $$
begin
  if new.parallel_group_id is not null and not exists (
    select 1 from public.parallel_subject_groups g
    where g.id = new.parallel_group_id and g.level_id = new.level_id
  ) then
    raise exception 'parallel_group_id must belong to the same level as this level_subjects row';
  end if;
  return new;
end $$;

create trigger level_subjects_parallel_group_check
before insert or update on public.level_subjects
for each row execute function public.check_level_subject_parallel_group();

-- Backfill: for every (level, subject) pair that already has real teaching_assignments
-- rows, create the matching level_subjects row so nothing breaks once subject pickers
-- start filtering by this table. Uses the most common periods_per_week among existing
-- assignments for that pair when they disagree.
insert into public.level_subjects (school_id, level_id, subject_id, periods_per_week)
select cs.school_id, cs.level_id, ta.subject_id,
       mode() within group (order by ta.periods_per_week)::smallint
from public.teaching_assignments ta
join public.class_sections cs on cs.id = ta.class_section_id
group by cs.school_id, cs.level_id, ta.subject_id
on conflict (level_id, subject_id) do nothing;

alter table public.level_subjects enable row level security;
alter table public.parallel_subject_groups enable row level security;

do $$ declare t text; begin
  foreach t in array array['level_subjects','parallel_subject_groups']
  loop
    execute format('create policy "school members read %1$s" on public.%1$I for select using (public.is_school_member(school_id))',t);
    execute format('create policy "school managers write %1$s" on public.%1$I for all using (public.can_manage_school(school_id)) with check (public.can_manage_school(school_id))',t);
  end loop;
end $$;

-- Replace timetable_entries' flat "one lesson per class per slot" uniqueness with a
-- trigger that allows a second entry in the same (class, day, period) only when its
-- subject shares a parallel_group_id with every other subject already sitting there.
-- The constraint name isn't known (Postgres auto-generated it in the init migration
-- and may have truncated it), so find it by its column set rather than guessing.
do $$
declare cname text;
begin
  select c.conname into cname
  from pg_constraint c
  where c.conrelid = 'public.timetable_entries'::regclass
    and c.contype = 'u'
    and (
      select array_agg(a.attname::text order by a.attname)
      from unnest(c.conkey) k
      join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k
    ) = array['class_section_id','period_slot_id','timetable_id','working_day_id']
  limit 1;

  if cname is not null then
    execute format('alter table public.timetable_entries drop constraint %I', cname);
  end if;
end $$;

create or replace function public.check_timetable_entry_class_slot()
returns trigger language plpgsql as $$
declare
  new_group uuid;
  conflicting record;
  conflicting_group uuid;
begin
  select ls.parallel_group_id into new_group
  from public.class_sections cs
  join public.level_subjects ls on ls.level_id = cs.level_id and ls.subject_id = new.subject_id
  where cs.id = new.class_section_id;

  for conflicting in
    select id, subject_id from public.timetable_entries
    where timetable_id = new.timetable_id
      and class_section_id = new.class_section_id
      and working_day_id = new.working_day_id
      and period_slot_id = new.period_slot_id
      and id <> new.id
  loop
    select ls.parallel_group_id into conflicting_group
    from public.class_sections cs
    join public.level_subjects ls on ls.level_id = cs.level_id and ls.subject_id = conflicting.subject_id
    where cs.id = new.class_section_id;

    if new_group is null or conflicting_group is null or new_group <> conflicting_group then
      raise exception 'Class already has a non-parallel lesson at this slot (subject % is not parallel-compatible with subject %)', new.subject_id, conflicting.subject_id
        using errcode = '23505';
    end if;
  end loop;

  return new;
end $$;

create trigger timetable_entries_class_slot_check
before insert or update on public.timetable_entries
for each row execute function public.check_timetable_entry_class_slot();
