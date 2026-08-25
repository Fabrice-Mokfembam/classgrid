-- Keep teaching assignments synchronized with the level-subject configuration,
-- which is the school-facing source of truth for taught subjects and weekly periods.
create or replace function public.sync_level_subject_teaching_assignments()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    update public.teaching_assignments assignment
    set status = 'inactive'
    from public.class_sections class_section
    where assignment.class_section_id = class_section.id
      and class_section.level_id = old.level_id
      and assignment.subject_id = old.subject_id
      and assignment.school_id = old.school_id;
    return old;
  end if;

  update public.teaching_assignments assignment
  set periods_per_week = new.periods_per_week,
      status = case when tg_op = 'INSERT' then 'active'::public.record_status else assignment.status end
  from public.class_sections class_section
  where assignment.class_section_id = class_section.id
    and class_section.level_id = new.level_id
    and assignment.subject_id = new.subject_id
    and assignment.school_id = new.school_id;

  return new;
end;
$$;

create trigger level_subject_assignment_sync_upsert
after insert or update of periods_per_week on public.level_subjects
for each row execute function public.sync_level_subject_teaching_assignments();

create trigger level_subject_assignment_sync_delete
after delete on public.level_subjects
for each row execute function public.sync_level_subject_teaching_assignments();
