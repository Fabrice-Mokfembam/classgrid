-- Follow-up to 20260819120000_level_subject_parallel_groups.sql: the school administrator
-- confirmed (CURRICULUM_STRUCTURE_PLAN.md open question #2) that a subject can belong to
-- MORE than one parallel group at a level — e.g. Physics can pair with Geography in one
-- group and with History in another, without Geography and History being interchangeable
-- with each other. A single nullable `parallel_group_id` column on `level_subjects` can't
-- express that; it needs a many-to-many join table instead.

create table public.level_subject_parallel_groups (
  level_subject_id uuid not null references public.level_subjects(id) on delete cascade,
  parallel_group_id uuid not null references public.parallel_subject_groups(id) on delete cascade,
  primary key (level_subject_id, parallel_group_id)
);

create index on public.level_subject_parallel_groups(parallel_group_id);

-- Backfill existing single-group memberships before dropping the column.
insert into public.level_subject_parallel_groups (level_subject_id, parallel_group_id)
select id, parallel_group_id from public.level_subjects where parallel_group_id is not null;

drop trigger level_subjects_parallel_group_check on public.level_subjects;
drop function public.check_level_subject_parallel_group();
alter table public.level_subjects drop column parallel_group_id;

-- Same integrity guard as before (a group must belong to the same level as the subject
-- it's applied to), now enforced on the join table instead of the dropped column.
create or replace function public.check_level_subject_parallel_group_member()
returns trigger language plpgsql as $$
begin
  if not exists (
    select 1 from public.level_subjects ls
    join public.parallel_subject_groups g on g.id = new.parallel_group_id
    where ls.id = new.level_subject_id and g.level_id = ls.level_id
  ) then
    raise exception 'parallel_group_id must belong to the same level as this level_subjects row';
  end if;
  return new;
end $$;

create trigger level_subject_parallel_groups_check
before insert or update on public.level_subject_parallel_groups
for each row execute function public.check_level_subject_parallel_group_member();

alter table public.level_subject_parallel_groups enable row level security;

create policy "school members read level_subject_parallel_groups" on public.level_subject_parallel_groups for select using (
  exists (select 1 from public.level_subjects ls where ls.id = level_subject_id and public.is_school_member(ls.school_id))
);
create policy "school managers write level_subject_parallel_groups" on public.level_subject_parallel_groups for all using (
  exists (select 1 from public.level_subjects ls where ls.id = level_subject_id and public.can_manage_school(ls.school_id))
) with check (
  exists (select 1 from public.level_subjects ls where ls.id = level_subject_id and public.can_manage_school(ls.school_id))
);

-- Rewrite the class/slot check: two entries may now share a slot if their level_subjects
-- share ANY common group, not just an equal single column value.
create or replace function public.check_timetable_entry_class_slot()
returns trigger language plpgsql as $$
declare
  new_level_subject uuid;
  conflicting record;
  conflicting_level_subject uuid;
  shares_group boolean;
begin
  select ls.id into new_level_subject
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
    select ls.id into conflicting_level_subject
    from public.class_sections cs
    join public.level_subjects ls on ls.level_id = cs.level_id and ls.subject_id = conflicting.subject_id
    where cs.id = new.class_section_id;

    shares_group := new_level_subject is not null and conflicting_level_subject is not null and exists (
      select 1 from public.level_subject_parallel_groups a
      join public.level_subject_parallel_groups b on a.parallel_group_id = b.parallel_group_id
      where a.level_subject_id = new_level_subject and b.level_subject_id = conflicting_level_subject
    );

    if not shares_group then
      raise exception 'Class already has a non-parallel lesson at this slot (subject % is not parallel-compatible with subject %)', new.subject_id, conflicting.subject_id
        using errcode = '23505';
    end if;
  end loop;

  return new;
end $$;
