-- Bring existing assignments in line with the level-subject source of truth now;
-- the trigger in the preceding migration keeps future changes synchronized.
update public.teaching_assignments assignment
set periods_per_week = level_subject.periods_per_week
from public.class_sections class_section
join public.level_subjects level_subject
  on level_subject.level_id = class_section.level_id
where assignment.class_section_id = class_section.id
  and assignment.subject_id = level_subject.subject_id
  and assignment.school_id = level_subject.school_id
  and assignment.periods_per_week <> level_subject.periods_per_week;

update public.teaching_assignments assignment
set status = 'inactive'
from public.class_sections class_section
where assignment.class_section_id = class_section.id
  and assignment.status = 'active'
  and not exists (
    select 1
    from public.level_subjects level_subject
    where level_subject.level_id = class_section.level_id
      and level_subject.subject_id = assignment.subject_id
      and level_subject.school_id = assignment.school_id
  );
