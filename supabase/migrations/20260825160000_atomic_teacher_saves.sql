-- Save the teacher profile, replace subject links, and add requested teaching
-- assignments as one transaction so a later failure cannot leave partial data.
create or replace function public.save_teacher_with_relationships(
  p_school_id uuid,
  p_academic_year_id uuid,
  p_teacher_id uuid,
  p_full_name text,
  p_teacher_code text,
  p_email text,
  p_phone text,
  p_subject_ids uuid[],
  p_class_section_ids uuid[]
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  saved_teacher_id uuid;
  subject_ids uuid[] := coalesce(p_subject_ids, '{}'::uuid[]);
  class_section_ids uuid[] := coalesce(p_class_section_ids, '{}'::uuid[]);
begin
  if not public.can_manage_school(p_school_id) then
    raise exception 'Not authorized to save teachers for this school' using errcode = '42501';
  end if;

  if nullif(btrim(p_full_name), '') is null then
    raise exception 'Teacher name is required' using errcode = '23514';
  end if;

  if exists (
    select 1
    from unnest(subject_ids) selected_subject_id
    where not exists (
      select 1 from public.subjects subject
      where subject.id = selected_subject_id
        and subject.school_id = p_school_id
        and subject.status = 'active'
    )
  ) then
    raise exception 'One or more selected subjects are invalid' using errcode = '22023';
  end if;

  if cardinality(class_section_ids) > 0 and p_academic_year_id is null then
    raise exception 'An academic year is required when selecting classes' using errcode = '22023';
  end if;

  if p_academic_year_id is not null and not exists (
    select 1 from public.academic_years academic_year
    where academic_year.id = p_academic_year_id
      and academic_year.school_id = p_school_id
  ) then
    raise exception 'Academic year not found' using errcode = 'P0002';
  end if;

  if exists (
    select 1
    from unnest(class_section_ids) selected_class_id
    where not exists (
      select 1 from public.class_sections class_section
      where class_section.id = selected_class_id
        and class_section.school_id = p_school_id
        and class_section.academic_year_id = p_academic_year_id
        and class_section.status = 'active'
    )
  ) then
    raise exception 'One or more selected classes are invalid' using errcode = '22023';
  end if;

  if p_teacher_id is null then
    insert into public.teachers (school_id, full_name, teacher_code, email, phone)
    values (
      p_school_id,
      btrim(p_full_name),
      nullif(btrim(p_teacher_code), ''),
      nullif(btrim(p_email), ''),
      nullif(btrim(p_phone), '')
    )
    returning id into saved_teacher_id;
  else
    update public.teachers
    set full_name = btrim(p_full_name),
        teacher_code = nullif(btrim(p_teacher_code), ''),
        email = nullif(btrim(p_email), ''),
        phone = nullif(btrim(p_phone), '')
    where id = p_teacher_id
      and school_id = p_school_id
    returning id into saved_teacher_id;

    if saved_teacher_id is null then
      raise exception 'Teacher not found' using errcode = 'P0002';
    end if;
  end if;

  delete from public.teacher_subjects
  where teacher_id = saved_teacher_id;

  insert into public.teacher_subjects (teacher_id, subject_id, school_id)
  select saved_teacher_id, selected_subject_id, p_school_id
  from (select distinct unnest(subject_ids) as selected_subject_id) selected;

  if p_academic_year_id is not null
     and cardinality(class_section_ids) > 0
     and cardinality(subject_ids) > 0 then
    insert into public.teaching_assignments (
      school_id, academic_year_id, teacher_id, subject_id,
      class_section_id, periods_per_week
    )
    select
      p_school_id,
      p_academic_year_id,
      saved_teacher_id,
      level_subject.subject_id,
      class_section.id,
      level_subject.periods_per_week
    from public.class_sections class_section
    join public.level_subjects level_subject
      on level_subject.level_id = class_section.level_id
     and level_subject.school_id = p_school_id
     and level_subject.subject_id = any(subject_ids)
    where class_section.id = any(class_section_ids)
      and class_section.school_id = p_school_id
      and class_section.academic_year_id = p_academic_year_id
    on conflict (academic_year_id, teacher_id, subject_id, class_section_id) do nothing;
  end if;

  return saved_teacher_id;
end;
$$;

revoke all on function public.save_teacher_with_relationships(uuid, uuid, uuid, text, text, text, text, uuid[], uuid[]) from public;
grant execute on function public.save_teacher_with_relationships(uuid, uuid, uuid, text, text, text, text, uuid[], uuid[]) to authenticated;
