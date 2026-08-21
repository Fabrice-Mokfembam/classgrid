-- Simple Bilingual College treats Form 5 Physics and Literature in English as
-- mutually exclusive streams that may share a timetable slot.
do $$
declare
  target_school_id uuid;
  target_level_id uuid;
  target_group_id uuid;
  member_count integer;
begin
  select id into strict target_school_id
  from public.schools
  where slug = 'simple-bilingual-college-69f4ad';

  select id into strict target_level_id
  from public.levels
  where school_id = target_school_id
    and name = 'Form 5';

  select id into target_group_id
  from public.parallel_subject_groups
  where school_id = target_school_id
    and level_id = target_level_id
    and name = 'Physics / Literature in English'
  order by created_at
  limit 1;

  if target_group_id is null then
    insert into public.parallel_subject_groups (school_id, level_id, name)
    values (target_school_id, target_level_id, 'Physics / Literature in English')
    returning id into target_group_id;
  end if;

  insert into public.level_subject_parallel_groups (level_subject_id, parallel_group_id)
  select ls.id, target_group_id
  from public.level_subjects ls
  join public.subjects s on s.id = ls.subject_id
  where ls.school_id = target_school_id
    and ls.level_id = target_level_id
    and s.name in ('Physics', 'Literature in English')
  on conflict do nothing;

  select count(*) into member_count
  from public.level_subject_parallel_groups lspg
  where lspg.parallel_group_id = target_group_id;

  if member_count <> 2 then
    raise exception 'Expected Physics and Literature in English in the Form 5 parallel group, found % members', member_count;
  end if;
end $$;
