-- ClassGrid MVP database schema
-- Run this entire file once in Supabase Dashboard > SQL Editor.

create extension if not exists "pgcrypto";

create type public.school_role as enum ('owner','admin','timetable_manager','viewer');
create type public.record_status as enum ('active','inactive');
create type public.slot_kind as enum ('lesson','break','fixed_activity');
create type public.lesson_pattern as enum ('singles','double','mixed');
create type public.timetable_status as enum ('draft','published','archived');
create type public.run_status as enum ('queued','running','completed','failed');
create type public.constraint_severity as enum ('hard','soft');

create table public.schools (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  legal_name text,
  slug text not null unique,
  logo_url text,
  school_type text not null,
  curriculum text,
  country text not null default 'Cameroon',
  region text,
  city text,
  address text,
  phone text,
  email text,
  website text,
  timezone text not null default 'Africa/Douala',
  estimated_students text,
  account_status text not null default 'trial' check (account_status in ('trial','active','suspended','cancelled')),
  trial_ends_at timestamptz default (now() + interval '30 days'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  phone text,
  platform_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.school_memberships (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.school_role not null default 'admin',
  job_title text,
  created_at timestamptz not null default now(),
  unique(school_id,user_id)
);

create table public.academic_years (
  id uuid primary key default gen_random_uuid(), school_id uuid not null references public.schools(id) on delete cascade,
  name text not null, starts_on date, ends_on date, is_current boolean not null default false, created_at timestamptz not null default now(),
  unique(school_id,name)
);

create table public.working_days (
  id uuid primary key default gen_random_uuid(), school_id uuid not null references public.schools(id) on delete cascade,
  academic_year_id uuid not null references public.academic_years(id) on delete cascade,
  weekday smallint not null check (weekday between 1 and 7), name text not null, sort_order smallint not null, is_active boolean not null default true,
  unique(academic_year_id,weekday)
);

create table public.period_slots (
  id uuid primary key default gen_random_uuid(), school_id uuid not null references public.schools(id) on delete cascade,
  academic_year_id uuid not null references public.academic_years(id) on delete cascade,
  name text not null, kind public.slot_kind not null default 'lesson', start_time time not null, end_time time not null,
  period_number smallint, sort_order smallint not null, day_block text check (day_block in ('morning','afternoon')),
  unique(academic_year_id,sort_order), check (end_time > start_time)
);

create table public.levels (
  id uuid primary key default gen_random_uuid(), school_id uuid not null references public.schools(id) on delete cascade,
  academic_year_id uuid not null references public.academic_years(id) on delete cascade,
  name text not null, sort_order smallint not null default 0, status public.record_status not null default 'active', unique(academic_year_id,name)
);

create table public.class_sections (
  id uuid primary key default gen_random_uuid(), school_id uuid not null references public.schools(id) on delete cascade,
  academic_year_id uuid not null references public.academic_years(id) on delete cascade,
  level_id uuid not null references public.levels(id) on delete restrict, name text not null, student_count integer,
  status public.record_status not null default 'active', created_at timestamptz not null default now(), unique(academic_year_id,name)
);

create table public.subjects (
  id uuid primary key default gen_random_uuid(), school_id uuid not null references public.schools(id) on delete cascade,
  name text not null, code text, color text not null default '#3b82f6', status public.record_status not null default 'active',
  created_at timestamptz not null default now(), unique(school_id,name)
);

create table public.teachers (
  id uuid primary key default gen_random_uuid(), school_id uuid not null references public.schools(id) on delete cascade,
  full_name text not null, teacher_code text, email text, phone text, color text,
  max_periods_per_day smallint, max_consecutive_periods smallint default 4, status public.record_status not null default 'active',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(school_id,teacher_code)
);

create table public.teacher_subjects (
  teacher_id uuid not null references public.teachers(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  school_id uuid not null references public.schools(id) on delete cascade,
  primary key(teacher_id,subject_id)
);

create table public.teacher_availability (
  id uuid primary key default gen_random_uuid(), school_id uuid not null references public.schools(id) on delete cascade,
  academic_year_id uuid not null references public.academic_years(id) on delete cascade,
  teacher_id uuid not null references public.teachers(id) on delete cascade,
  working_day_id uuid not null references public.working_days(id) on delete cascade,
  period_slot_id uuid not null references public.period_slots(id) on delete cascade,
  is_available boolean not null default true,
  unique(academic_year_id,teacher_id,working_day_id,period_slot_id)
);

create table public.teaching_assignments (
  id uuid primary key default gen_random_uuid(), school_id uuid not null references public.schools(id) on delete cascade,
  academic_year_id uuid not null references public.academic_years(id) on delete cascade,
  teacher_id uuid not null references public.teachers(id) on delete restrict,
  subject_id uuid not null references public.subjects(id) on delete restrict,
  class_section_id uuid not null references public.class_sections(id) on delete cascade,
  periods_per_week smallint not null check (periods_per_week > 0), pattern public.lesson_pattern not null default 'singles',
  double_period_count smallint not null default 0, max_per_day smallint not null default 1,
  prefer_morning boolean not null default false, status public.record_status not null default 'active',
  created_at timestamptz not null default now(), unique(academic_year_id,teacher_id,subject_id,class_section_id)
);

create table public.timetables (
  id uuid primary key default gen_random_uuid(), school_id uuid not null references public.schools(id) on delete cascade,
  academic_year_id uuid not null references public.academic_years(id) on delete cascade,
  name text not null, version integer not null default 1, status public.timetable_status not null default 'draft',
  quality_score integer, published_at timestamptz, published_by uuid references auth.users(id),
  created_by uuid references auth.users(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.timetable_entries (
  id uuid primary key default gen_random_uuid(), school_id uuid not null references public.schools(id) on delete cascade,
  timetable_id uuid not null references public.timetables(id) on delete cascade,
  assignment_id uuid references public.teaching_assignments(id) on delete restrict,
  teacher_id uuid not null references public.teachers(id) on delete restrict,
  subject_id uuid not null references public.subjects(id) on delete restrict,
  class_section_id uuid not null references public.class_sections(id) on delete cascade,
  working_day_id uuid not null references public.working_days(id) on delete restrict,
  period_slot_id uuid not null references public.period_slots(id) on delete restrict,
  duration_slots smallint not null default 1 check (duration_slots > 0), is_locked boolean not null default false,
  created_at timestamptz not null default now(),
  unique(timetable_id,class_section_id,working_day_id,period_slot_id),
  unique(timetable_id,teacher_id,working_day_id,period_slot_id)
);

create table public.generation_runs (
  id uuid primary key default gen_random_uuid(), school_id uuid not null references public.schools(id) on delete cascade,
  academic_year_id uuid not null references public.academic_years(id) on delete cascade,
  timetable_id uuid references public.timetables(id) on delete set null,
  status public.run_status not null default 'queued', progress smallint not null default 0, settings jsonb not null default '{}',
  error_message text, started_at timestamptz, completed_at timestamptz, created_by uuid references auth.users(id), created_at timestamptz not null default now()
);

create table public.constraint_issues (
  id uuid primary key default gen_random_uuid(), school_id uuid not null references public.schools(id) on delete cascade,
  generation_run_id uuid not null references public.generation_runs(id) on delete cascade,
  severity public.constraint_severity not null, code text not null, title text not null, explanation text not null,
  suggestion text, context jsonb not null default '{}', created_at timestamptz not null default now()
);

create index on public.school_memberships(user_id);
create index on public.teachers(school_id);
create index on public.class_sections(school_id,academic_year_id);
create index on public.teaching_assignments(school_id,academic_year_id);
create index on public.timetable_entries(timetable_id,working_day_id,period_slot_id);
create index on public.generation_runs(school_id,created_at desc);

create or replace function public.set_updated_at() returns trigger language plpgsql as $$ begin new.updated_at=now(); return new; end $$;
create trigger schools_updated before update on public.schools for each row execute function public.set_updated_at();
create trigger profiles_updated before update on public.profiles for each row execute function public.set_updated_at();
create trigger teachers_updated before update on public.teachers for each row execute function public.set_updated_at();
create trigger timetables_updated before update on public.timetables for each row execute function public.set_updated_at();

create or replace function public.is_school_member(target_school uuid) returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.school_memberships m where m.school_id=target_school and m.user_id=auth.uid());
$$;
create or replace function public.can_manage_school(target_school uuid) returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.school_memberships m where m.school_id=target_school and m.user_id=auth.uid() and m.role in ('owner','admin','timetable_manager'));
$$;

alter table public.schools enable row level security;
alter table public.profiles enable row level security;
alter table public.school_memberships enable row level security;
alter table public.academic_years enable row level security;
alter table public.working_days enable row level security;
alter table public.period_slots enable row level security;
alter table public.levels enable row level security;
alter table public.class_sections enable row level security;
alter table public.subjects enable row level security;
alter table public.teachers enable row level security;
alter table public.teacher_subjects enable row level security;
alter table public.teacher_availability enable row level security;
alter table public.teaching_assignments enable row level security;
alter table public.timetables enable row level security;
alter table public.timetable_entries enable row level security;
alter table public.generation_runs enable row level security;
alter table public.constraint_issues enable row level security;

create policy "profiles own select" on public.profiles for select using (id=auth.uid());
create policy "profiles own update" on public.profiles for update using (id=auth.uid());
create policy "members see schools" on public.schools for select using (public.is_school_member(id));
create policy "owners update schools" on public.schools for update using (public.can_manage_school(id));
create policy "members see memberships" on public.school_memberships for select using (public.is_school_member(school_id));
create policy "owners manage memberships" on public.school_memberships for all using (public.can_manage_school(school_id)) with check (public.can_manage_school(school_id));

do $$ declare t text; begin
  foreach t in array array['academic_years','working_days','period_slots','levels','class_sections','subjects','teachers','teacher_subjects','teacher_availability','teaching_assignments','timetables','timetable_entries','generation_runs','constraint_issues']
  loop
    execute format('create policy "school members read %1$s" on public.%1$I for select using (public.is_school_member(school_id))',t);
    execute format('create policy "school managers write %1$s" on public.%1$I for all using (public.can_manage_school(school_id)) with check (public.can_manage_school(school_id))',t);
  end loop;
end $$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('school-logos', 'school-logos', true, 2097152, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.logo_object_school_id(object_name text)
returns uuid language sql immutable set search_path=public,storage as $$
  select case
    when (storage.foldername(object_name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then ((storage.foldername(object_name))[1])::uuid
    else null
  end;
$$;

create policy "school logo members read" on storage.objects for select using (bucket_id='school-logos' and public.is_school_member(public.logo_object_school_id(name)));
create policy "school logo managers upload" on storage.objects for insert with check (bucket_id='school-logos' and public.can_manage_school(public.logo_object_school_id(name)));
create policy "school logo managers update" on storage.objects for update using (bucket_id='school-logos' and public.can_manage_school(public.logo_object_school_id(name))) with check (bucket_id='school-logos' and public.can_manage_school(public.logo_object_school_id(name)));
create policy "school logo managers delete" on storage.objects for delete using (bucket_id='school-logos' and public.can_manage_school(public.logo_object_school_id(name)));

-- Atomic onboarding: call after Supabase Auth sign-up has created the user.
create or replace function public.create_school_workspace(
  school_name text, school_slug text, school_type text, country text, region text, city text,
  address text, school_phone text, school_email text, school_website text, timezone text,
  curriculum text, estimated_students text, admin_full_name text, admin_phone text, admin_job_title text,
  academic_year_name text
) returns uuid language plpgsql security definer set search_path=public as $$
declare new_school uuid; new_year uuid; d integer;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  insert into public.profiles(id,full_name,phone) values(auth.uid(),admin_full_name,admin_phone)
    on conflict(id) do update set full_name=excluded.full_name,phone=excluded.phone;
  insert into public.schools(name,slug,school_type,country,region,city,address,phone,email,website,timezone,curriculum,estimated_students)
    values(school_name,school_slug,school_type,country,region,city,address,school_phone,school_email,school_website,timezone,curriculum,estimated_students) returning id into new_school;
  insert into public.school_memberships(school_id,user_id,role,job_title) values(new_school,auth.uid(),'owner',admin_job_title);
  insert into public.academic_years(school_id,name,is_current) values(new_school,academic_year_name,true) returning id into new_year;
  for d in 1..5 loop insert into public.working_days(school_id,academic_year_id,weekday,name,sort_order) values(new_school,new_year,d,(array['Monday','Tuesday','Wednesday','Thursday','Friday'])[d],d); end loop;
  return new_school;
end $$;

grant execute on function public.create_school_workspace to authenticated;

-- Create profile rows for any Auth users created outside the onboarding RPC.
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path=public as $$
begin insert into public.profiles(id,full_name) values(new.id,coalesce(new.raw_user_meta_data->>'full_name','New user')) on conflict do nothing; return new; end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- Atomically swaps the (working_day_id, period_slot_id) of two timetable_entries rows.
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

-- Replace every unlocked lesson in a timetable as one transaction. If validation,
-- deletion, or insertion fails, PostgreSQL rolls the whole function call back.
create or replace function public.replace_unlocked_timetable_entries(
  p_timetable_id uuid,
  p_entries jsonb
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  target_school_id uuid;
  target_academic_year_id uuid;
  expected_count integer;
  inserted_count integer;
begin
  if jsonb_typeof(coalesce(p_entries, '[]'::jsonb)) <> 'array' then
    raise exception 'p_entries must be a JSON array' using errcode = '22023';
  end if;

  select school_id, academic_year_id
    into target_school_id, target_academic_year_id
  from public.timetables
  where id = p_timetable_id
  for update;

  if target_school_id is null then
    raise exception 'Timetable not found' using errcode = 'P0002';
  end if;

  if not public.can_manage_school(target_school_id) then
    raise exception 'Not authorized to regenerate this timetable' using errcode = '42501';
  end if;

  expected_count := jsonb_array_length(coalesce(p_entries, '[]'::jsonb));

  delete from public.timetable_entries
  where timetable_id = p_timetable_id
    and is_locked = false;

  insert into public.timetable_entries (
    school_id,
    timetable_id,
    assignment_id,
    teacher_id,
    subject_id,
    class_section_id,
    working_day_id,
    period_slot_id,
    duration_slots,
    is_locked
  )
  select
    target_school_id,
    p_timetable_id,
    entry.assignment_id,
    entry.teacher_id,
    entry.subject_id,
    entry.class_section_id,
    entry.working_day_id,
    entry.period_slot_id,
    1,
    false
  from jsonb_to_recordset(coalesce(p_entries, '[]'::jsonb)) as entry(
    assignment_id uuid,
    teacher_id uuid,
    subject_id uuid,
    class_section_id uuid,
    working_day_id uuid,
    period_slot_id uuid
  )
  join public.teaching_assignments assignment
    on assignment.id = entry.assignment_id
   and assignment.school_id = target_school_id
   and assignment.academic_year_id = target_academic_year_id
   and assignment.teacher_id = entry.teacher_id
   and assignment.subject_id = entry.subject_id
   and assignment.class_section_id = entry.class_section_id
  join public.working_days working_day
    on working_day.id = entry.working_day_id
   and working_day.school_id = target_school_id
   and working_day.academic_year_id = target_academic_year_id
  join public.period_slots period_slot
    on period_slot.id = entry.period_slot_id
   and period_slot.school_id = target_school_id
   and period_slot.academic_year_id = target_academic_year_id;

  get diagnostics inserted_count = row_count;

  if inserted_count <> expected_count then
    raise exception 'One or more generated timetable entries are invalid' using errcode = '22023';
  end if;
end;
$$;

revoke all on function public.replace_unlocked_timetable_entries(uuid, jsonb) from public;
grant execute on function public.replace_unlocked_timetable_entries(uuid, jsonb) to authenticated;

-- Persist a newly generated timetable and all of its supporting records as one
-- transaction. Any invalid row or insert failure rolls the entire creation back.
create or replace function public.create_generated_timetable(
  p_school_id uuid,
  p_academic_year_id uuid,
  p_entries jsonb,
  p_issues jsonb,
  p_quality_score integer
)
returns table(timetable_id uuid, generation_run_id uuid)
language plpgsql
security invoker
set search_path = public
as $$
declare
  new_timetable_id uuid;
  new_generation_run_id uuid;
  next_version integer;
  expected_count integer;
  inserted_count integer;
begin
  if jsonb_typeof(coalesce(p_entries, '[]'::jsonb)) <> 'array'
     or jsonb_typeof(coalesce(p_issues, '[]'::jsonb)) <> 'array' then
    raise exception 'Entries and issues must be JSON arrays' using errcode = '22023';
  end if;

  if p_quality_score < 0 or p_quality_score > 100 then
    raise exception 'Quality score must be between 0 and 100' using errcode = '22023';
  end if;

  perform 1
  from public.academic_years
  where id = p_academic_year_id
    and school_id = p_school_id
  for update;

  if not found then
    raise exception 'Academic year not found' using errcode = 'P0002';
  end if;

  if not public.can_manage_school(p_school_id) then
    raise exception 'Not authorized to generate a timetable' using errcode = '42501';
  end if;

  select coalesce(max(version), 0) + 1
    into next_version
  from public.timetables
  where school_id = p_school_id
    and academic_year_id = p_academic_year_id;

  insert into public.timetables (
    school_id, academic_year_id, name, version, status, quality_score, created_by
  ) values (
    p_school_id, p_academic_year_id, 'Version ' || next_version, next_version,
    'draft', p_quality_score, auth.uid()
  )
  returning id into new_timetable_id;

  insert into public.generation_runs (
    school_id, academic_year_id, timetable_id, status, progress,
    started_at, completed_at, created_by
  ) values (
    p_school_id, p_academic_year_id, new_timetable_id, 'completed', 100,
    now(), now(), auth.uid()
  )
  returning id into new_generation_run_id;

  expected_count := jsonb_array_length(coalesce(p_entries, '[]'::jsonb));

  insert into public.timetable_entries (
    school_id, timetable_id, assignment_id, teacher_id, subject_id,
    class_section_id, working_day_id, period_slot_id, duration_slots, is_locked
  )
  select
    p_school_id, new_timetable_id, entry.assignment_id, entry.teacher_id,
    entry.subject_id, entry.class_section_id, entry.working_day_id,
    entry.period_slot_id, 1, false
  from jsonb_to_recordset(coalesce(p_entries, '[]'::jsonb)) as entry(
    assignment_id uuid,
    teacher_id uuid,
    subject_id uuid,
    class_section_id uuid,
    working_day_id uuid,
    period_slot_id uuid
  )
  join public.teaching_assignments assignment
    on assignment.id = entry.assignment_id
   and assignment.school_id = p_school_id
   and assignment.academic_year_id = p_academic_year_id
   and assignment.teacher_id = entry.teacher_id
   and assignment.subject_id = entry.subject_id
   and assignment.class_section_id = entry.class_section_id
   and assignment.status = 'active'
  join public.working_days working_day
    on working_day.id = entry.working_day_id
   and working_day.school_id = p_school_id
   and working_day.academic_year_id = p_academic_year_id
   and working_day.is_active = true
  join public.period_slots period_slot
    on period_slot.id = entry.period_slot_id
   and period_slot.school_id = p_school_id
   and period_slot.academic_year_id = p_academic_year_id
   and period_slot.kind = 'lesson';

  get diagnostics inserted_count = row_count;
  if inserted_count <> expected_count then
    raise exception 'One or more generated timetable entries are invalid' using errcode = '22023';
  end if;

  expected_count := jsonb_array_length(coalesce(p_issues, '[]'::jsonb));

  insert into public.constraint_issues (
    school_id, generation_run_id, severity, code, title, explanation, context
  )
  select
    p_school_id, new_generation_run_id, issue.severity::public.constraint_severity,
    issue.code, issue.title, issue.explanation, coalesce(issue.context, '{}'::jsonb)
  from jsonb_to_recordset(coalesce(p_issues, '[]'::jsonb)) as issue(
    severity text,
    code text,
    title text,
    explanation text,
    context jsonb
  );

  get diagnostics inserted_count = row_count;
  if inserted_count <> expected_count then
    raise exception 'One or more generation issues are invalid' using errcode = '22023';
  end if;

  return query select new_timetable_id, new_generation_run_id;
end;
$$;

revoke all on function public.create_generated_timetable(uuid, uuid, jsonb, jsonb, integer) from public;
grant execute on function public.create_generated_timetable(uuid, uuid, jsonb, jsonb, integer) to authenticated;

-- Complete an in-place regeneration as one transaction: run, entries, issues,
-- quality score, draft status, and publication fields either all change or none do.
create or replace function public.complete_timetable_regeneration(
  p_timetable_id uuid,
  p_entries jsonb,
  p_issues jsonb,
  p_quality_score integer
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  target_school_id uuid;
  target_academic_year_id uuid;
  new_generation_run_id uuid;
  expected_count integer;
  inserted_count integer;
begin
  if jsonb_typeof(coalesce(p_entries, '[]'::jsonb)) <> 'array'
     or jsonb_typeof(coalesce(p_issues, '[]'::jsonb)) <> 'array' then
    raise exception 'Entries and issues must be JSON arrays' using errcode = '22023';
  end if;

  if p_quality_score is null or p_quality_score < 0 or p_quality_score > 100 then
    raise exception 'Quality score must be between 0 and 100' using errcode = '22023';
  end if;

  select school_id, academic_year_id
    into target_school_id, target_academic_year_id
  from public.timetables
  where id = p_timetable_id
  for update;

  if target_school_id is null then
    raise exception 'Timetable not found' using errcode = 'P0002';
  end if;

  if not public.can_manage_school(target_school_id) then
    raise exception 'Not authorized to regenerate this timetable' using errcode = '42501';
  end if;

  insert into public.generation_runs (
    school_id, academic_year_id, timetable_id, status, progress,
    started_at, completed_at, created_by
  ) values (
    target_school_id, target_academic_year_id, p_timetable_id, 'completed', 100,
    now(), now(), auth.uid()
  )
  returning id into new_generation_run_id;

  delete from public.timetable_entries
  where timetable_id = p_timetable_id
    and is_locked = false;

  expected_count := jsonb_array_length(coalesce(p_entries, '[]'::jsonb));

  insert into public.timetable_entries (
    school_id, timetable_id, assignment_id, teacher_id, subject_id,
    class_section_id, working_day_id, period_slot_id, duration_slots, is_locked
  )
  select
    target_school_id, p_timetable_id, entry.assignment_id, entry.teacher_id,
    entry.subject_id, entry.class_section_id, entry.working_day_id,
    entry.period_slot_id, 1, false
  from jsonb_to_recordset(coalesce(p_entries, '[]'::jsonb)) as entry(
    assignment_id uuid,
    teacher_id uuid,
    subject_id uuid,
    class_section_id uuid,
    working_day_id uuid,
    period_slot_id uuid
  )
  join public.teaching_assignments assignment
    on assignment.id = entry.assignment_id
   and assignment.school_id = target_school_id
   and assignment.academic_year_id = target_academic_year_id
   and assignment.teacher_id = entry.teacher_id
   and assignment.subject_id = entry.subject_id
   and assignment.class_section_id = entry.class_section_id
   and assignment.status = 'active'
  join public.working_days working_day
    on working_day.id = entry.working_day_id
   and working_day.school_id = target_school_id
   and working_day.academic_year_id = target_academic_year_id
   and working_day.is_active = true
  join public.period_slots period_slot
    on period_slot.id = entry.period_slot_id
   and period_slot.school_id = target_school_id
   and period_slot.academic_year_id = target_academic_year_id
   and period_slot.kind = 'lesson';

  get diagnostics inserted_count = row_count;
  if inserted_count <> expected_count then
    raise exception 'One or more generated timetable entries are invalid' using errcode = '22023';
  end if;

  expected_count := jsonb_array_length(coalesce(p_issues, '[]'::jsonb));

  insert into public.constraint_issues (
    school_id, generation_run_id, severity, code, title, explanation, context
  )
  select
    target_school_id, new_generation_run_id,
    issue.severity::public.constraint_severity, issue.code, issue.title,
    issue.explanation, coalesce(issue.context, '{}'::jsonb)
  from jsonb_to_recordset(coalesce(p_issues, '[]'::jsonb)) as issue(
    severity text,
    code text,
    title text,
    explanation text,
    context jsonb
  );

  get diagnostics inserted_count = row_count;
  if inserted_count <> expected_count then
    raise exception 'One or more generation issues are invalid' using errcode = '22023';
  end if;

  update public.timetables
  set quality_score = p_quality_score,
      status = 'draft',
      published_at = null,
      published_by = null
  where id = p_timetable_id;

  return new_generation_run_id;
end;
$$;

revoke all on function public.complete_timetable_regeneration(uuid, jsonb, jsonb, integer) from public;
grant execute on function public.complete_timetable_regeneration(uuid, jsonb, jsonb, integer) to authenticated;
revoke all on function public.replace_unlocked_timetable_entries(uuid, jsonb) from authenticated;

-- Repair one class atomically while preserving every other class and all locked lessons.
create or replace function public.complete_class_timetable_repair(
  p_timetable_id uuid,
  p_class_section_id uuid,
  p_entries jsonb,
  p_issues jsonb,
  p_quality_score integer
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  target_school_id uuid;
  target_academic_year_id uuid;
  new_generation_run_id uuid;
  expected_count integer;
  inserted_count integer;
begin
  if jsonb_typeof(coalesce(p_entries, '[]'::jsonb)) <> 'array'
     or jsonb_typeof(coalesce(p_issues, '[]'::jsonb)) <> 'array' then
    raise exception 'Entries and issues must be JSON arrays' using errcode = '22023';
  end if;
  if p_quality_score is null or p_quality_score < 0 or p_quality_score > 100 then
    raise exception 'Quality score must be between 0 and 100' using errcode = '22023';
  end if;

  select school_id, academic_year_id into target_school_id, target_academic_year_id
  from public.timetables where id = p_timetable_id for update;
  if target_school_id is null then raise exception 'Timetable not found' using errcode = 'P0002'; end if;
  if not public.can_manage_school(target_school_id) then
    raise exception 'Not authorized to repair this timetable' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.class_sections
    where id = p_class_section_id and school_id = target_school_id
      and academic_year_id = target_academic_year_id and status = 'active'
  ) then
    raise exception 'Class not found' using errcode = 'P0002';
  end if;

  insert into public.generation_runs (
    school_id, academic_year_id, timetable_id, status, progress,
    started_at, completed_at, created_by
  ) values (
    target_school_id, target_academic_year_id, p_timetable_id, 'completed', 100,
    now(), now(), auth.uid()
  ) returning id into new_generation_run_id;

  delete from public.timetable_entries
  where timetable_id = p_timetable_id and class_section_id = p_class_section_id and is_locked = false;

  expected_count := jsonb_array_length(coalesce(p_entries, '[]'::jsonb));
  insert into public.timetable_entries (
    school_id, timetable_id, assignment_id, teacher_id, subject_id,
    class_section_id, working_day_id, period_slot_id, duration_slots, is_locked
  )
  select target_school_id, p_timetable_id, entry.assignment_id, entry.teacher_id,
    entry.subject_id, p_class_section_id, entry.working_day_id, entry.period_slot_id, 1, false
  from jsonb_to_recordset(coalesce(p_entries, '[]'::jsonb)) as entry(
    assignment_id uuid, teacher_id uuid, subject_id uuid, class_section_id uuid,
    working_day_id uuid, period_slot_id uuid
  )
  join public.teaching_assignments assignment
    on assignment.id = entry.assignment_id and assignment.school_id = target_school_id
   and assignment.academic_year_id = target_academic_year_id and assignment.teacher_id = entry.teacher_id
   and assignment.subject_id = entry.subject_id and assignment.class_section_id = p_class_section_id
   and entry.class_section_id = p_class_section_id and assignment.status = 'active'
  join public.working_days working_day
    on working_day.id = entry.working_day_id and working_day.school_id = target_school_id
   and working_day.academic_year_id = target_academic_year_id and working_day.is_active = true
  join public.period_slots period_slot
    on period_slot.id = entry.period_slot_id and period_slot.school_id = target_school_id
   and period_slot.academic_year_id = target_academic_year_id and period_slot.kind = 'lesson';

  get diagnostics inserted_count = row_count;
  if inserted_count <> expected_count then
    raise exception 'One or more repaired timetable entries are invalid' using errcode = '22023';
  end if;

  expected_count := jsonb_array_length(coalesce(p_issues, '[]'::jsonb));
  insert into public.constraint_issues (
    school_id, generation_run_id, severity, code, title, explanation, context
  )
  select target_school_id, new_generation_run_id, issue.severity::public.constraint_severity,
    issue.code, issue.title, issue.explanation, coalesce(issue.context, '{}'::jsonb)
  from jsonb_to_recordset(coalesce(p_issues, '[]'::jsonb)) as issue(
    severity text, code text, title text, explanation text, context jsonb
  );
  get diagnostics inserted_count = row_count;
  if inserted_count <> expected_count then
    raise exception 'One or more repair issues are invalid' using errcode = '22023';
  end if;

  update public.timetables set quality_score = p_quality_score, status = 'draft',
    published_at = null, published_by = null where id = p_timetable_id;
  return new_generation_run_id;
end;
$$;

revoke all on function public.complete_class_timetable_repair(uuid, uuid, jsonb, jsonb, integer) from public;
grant execute on function public.complete_class_timetable_repair(uuid, uuid, jsonb, jsonb, integer) to authenticated;

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
  select school_id, academic_year_id into target_school_id, target_academic_year_id
  from public.timetables where id = p_timetable_id;
  if target_school_id is null then raise exception 'Timetable not found' using errcode = 'P0002'; end if;
  if not public.can_manage_school(target_school_id) then raise exception 'Not authorized to publish this timetable' using errcode = '42501'; end if;

  perform 1 from public.academic_years
  where id = target_academic_year_id and school_id = target_school_id for update;

  if exists (
    select 1 from public.teaching_assignments assignment
    left join (
      select assignment_id, count(*)::integer as actual_periods
      from public.timetable_entries
      where timetable_id = p_timetable_id and assignment_id is not null
      group by assignment_id
    ) scheduled on scheduled.assignment_id = assignment.id
    where assignment.school_id = target_school_id
      and assignment.academic_year_id = target_academic_year_id
      and assignment.status = 'active'
      and coalesce(scheduled.actual_periods, 0) <> assignment.periods_per_week
  ) then
    raise exception 'Validate the timetable and fix all assignment period issues before publishing' using errcode = '23514';
  end if;

  update public.timetables set status = 'archived'
  where school_id = target_school_id and academic_year_id = target_academic_year_id
    and status = 'published' and id <> p_timetable_id;
  update public.timetables
  set status = 'published', published_at = published_time, published_by = auth.uid()
  where id = p_timetable_id;
  return published_time;
end;
$$;

revoke all on function public.publish_timetable(uuid) from public;
grant execute on function public.publish_timetable(uuid) to authenticated;

create or replace function public.move_timetable_entry(p_entry_id uuid, p_working_day_id uuid, p_period_slot_id uuid)
returns void language plpgsql security invoker set search_path = public as $$
declare entry public.timetable_entries;
begin
  select * into entry from public.timetable_entries where id = p_entry_id for update;
  if entry.id is null then raise exception 'Entry not found' using errcode = 'P0002'; end if;
  if entry.is_locked then raise exception 'Cannot move a locked lesson' using errcode = '23514'; end if;
  update public.timetable_entries set working_day_id = p_working_day_id, period_slot_id = p_period_slot_id where id = p_entry_id;
  update public.timetables set status = 'draft', published_at = null, published_by = null where id = entry.timetable_id;
end;
$$;

revoke all on function public.move_timetable_entry(uuid, uuid, uuid) from public;
grant execute on function public.move_timetable_entry(uuid, uuid, uuid) to authenticated;

create or replace function public.swap_timetable_entries(p_entry_a uuid, p_entry_b uuid)
returns void language plpgsql security invoker set search_path = public as $$
declare a public.timetable_entries; b public.timetable_entries;
begin
  select * into a from public.timetable_entries where id = p_entry_a for update;
  select * into b from public.timetable_entries where id = p_entry_b for update;
  if a.id is null or b.id is null then raise exception 'Entry not found' using errcode = 'P0002'; end if;
  if a.timetable_id <> b.timetable_id then raise exception 'Entries belong to different timetables' using errcode = '23514'; end if;
  if a.is_locked or b.is_locked then raise exception 'Cannot move a locked lesson' using errcode = '23514'; end if;
  delete from public.timetable_entries where id in (p_entry_a, p_entry_b);
  insert into public.timetable_entries(id, school_id, timetable_id, assignment_id, teacher_id, subject_id, class_section_id, working_day_id, period_slot_id, duration_slots, is_locked)
  values
    (a.id, a.school_id, a.timetable_id, a.assignment_id, a.teacher_id, a.subject_id, a.class_section_id, b.working_day_id, b.period_slot_id, a.duration_slots, a.is_locked),
    (b.id, b.school_id, b.timetable_id, b.assignment_id, b.teacher_id, b.subject_id, b.class_section_id, a.working_day_id, a.period_slot_id, b.duration_slots, b.is_locked);
  update public.timetables set status = 'draft', published_at = null, published_by = null where id = a.timetable_id;
end;
$$;

revoke all on function public.swap_timetable_entries(uuid, uuid) from public;
grant execute on function public.swap_timetable_entries(uuid, uuid) to authenticated;

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
  if not public.can_manage_school(p_school_id) then raise exception 'Not authorized to save teachers for this school' using errcode = '42501'; end if;
  if nullif(btrim(p_full_name), '') is null then raise exception 'Teacher name is required' using errcode = '23514'; end if;

  if exists (
    select 1 from unnest(subject_ids) selected_subject_id
    where not exists (
      select 1 from public.subjects subject
      where subject.id = selected_subject_id and subject.school_id = p_school_id and subject.status = 'active'
    )
  ) then raise exception 'One or more selected subjects are invalid' using errcode = '22023'; end if;

  if cardinality(class_section_ids) > 0 and p_academic_year_id is null then raise exception 'An academic year is required when selecting classes' using errcode = '22023'; end if;
  if p_academic_year_id is not null and not exists (
    select 1 from public.academic_years academic_year
    where academic_year.id = p_academic_year_id and academic_year.school_id = p_school_id
  ) then raise exception 'Academic year not found' using errcode = 'P0002'; end if;

  if exists (
    select 1 from unnest(class_section_ids) selected_class_id
    where not exists (
      select 1 from public.class_sections class_section
      where class_section.id = selected_class_id and class_section.school_id = p_school_id
        and class_section.academic_year_id = p_academic_year_id and class_section.status = 'active'
    )
  ) then raise exception 'One or more selected classes are invalid' using errcode = '22023'; end if;

  if p_teacher_id is null then
    insert into public.teachers (school_id, full_name, teacher_code, email, phone)
    values (p_school_id, btrim(p_full_name), nullif(btrim(p_teacher_code), ''), nullif(btrim(p_email), ''), nullif(btrim(p_phone), ''))
    returning id into saved_teacher_id;
  else
    update public.teachers
    set full_name = btrim(p_full_name), teacher_code = nullif(btrim(p_teacher_code), ''),
        email = nullif(btrim(p_email), ''), phone = nullif(btrim(p_phone), '')
    where id = p_teacher_id and school_id = p_school_id returning id into saved_teacher_id;
    if saved_teacher_id is null then raise exception 'Teacher not found' using errcode = 'P0002'; end if;
  end if;

  delete from public.teacher_subjects where teacher_id = saved_teacher_id;
  insert into public.teacher_subjects (teacher_id, subject_id, school_id)
  select saved_teacher_id, selected_subject_id, p_school_id
  from (select distinct unnest(subject_ids) as selected_subject_id) selected;

  if p_academic_year_id is not null and cardinality(class_section_ids) > 0 and cardinality(subject_ids) > 0 then
    insert into public.teaching_assignments (school_id, academic_year_id, teacher_id, subject_id, class_section_id, periods_per_week)
    select p_school_id, p_academic_year_id, saved_teacher_id, level_subject.subject_id, class_section.id, level_subject.periods_per_week
    from public.class_sections class_section
    join public.level_subjects level_subject
      on level_subject.level_id = class_section.level_id and level_subject.school_id = p_school_id
     and level_subject.subject_id = any(subject_ids)
    where class_section.id = any(class_section_ids) and class_section.school_id = p_school_id
      and class_section.academic_year_id = p_academic_year_id
    on conflict (academic_year_id, teacher_id, subject_id, class_section_id) do nothing;
  end if;
  return saved_teacher_id;
end;
$$;

revoke all on function public.save_teacher_with_relationships(uuid, uuid, uuid, text, text, text, text, uuid[], uuid[]) from public;
grant execute on function public.save_teacher_with_relationships(uuid, uuid, uuid, text, text, text, text, uuid[], uuid[]) to authenticated;

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

-- Manual timetable edits respect teacher availability. Parallel drops create or
-- reuse a level pairing and move the lesson in the same transaction.
create or replace function public.move_timetable_entry(p_entry_id uuid, p_working_day_id uuid, p_period_slot_id uuid)
returns void language plpgsql security invoker set search_path = public as $$
declare entry public.timetable_entries;
begin
  select * into entry from public.timetable_entries where id = p_entry_id for update;
  if entry.id is null then raise exception 'Entry not found' using errcode = 'P0002'; end if;
  if entry.is_locked then raise exception 'Cannot move a locked lesson' using errcode = '23514'; end if;
  if not public.can_manage_school(entry.school_id) then raise exception 'Not authorized to move this lesson' using errcode = '42501'; end if;
  if not exists (
    select 1 from public.timetables timetable
    join public.working_days working_day on working_day.id = p_working_day_id and working_day.school_id = timetable.school_id and working_day.academic_year_id = timetable.academic_year_id and working_day.is_active = true
    join public.period_slots period_slot on period_slot.id = p_period_slot_id and period_slot.school_id = timetable.school_id and period_slot.academic_year_id = timetable.academic_year_id and period_slot.kind = 'lesson'
    where timetable.id = entry.timetable_id
  ) then raise exception 'The destination is not an active lesson slot for this timetable' using errcode = '23514'; end if;
  if exists (
    select 1 from public.timetables timetable
    join public.teacher_availability availability on availability.school_id = timetable.school_id and availability.academic_year_id = timetable.academic_year_id
      and availability.teacher_id = entry.teacher_id and availability.working_day_id = p_working_day_id and availability.period_slot_id = p_period_slot_id and availability.is_available = false
    where timetable.id = entry.timetable_id
  ) then raise exception 'This teacher is unavailable at the destination slot' using errcode = '23514'; end if;
  update public.timetable_entries set working_day_id = p_working_day_id, period_slot_id = p_period_slot_id where id = p_entry_id;
  update public.timetables set status = 'draft', published_at = null, published_by = null where id = entry.timetable_id;
end;
$$;
revoke all on function public.move_timetable_entry(uuid, uuid, uuid) from public;
grant execute on function public.move_timetable_entry(uuid, uuid, uuid) to authenticated;

create or replace function public.swap_timetable_entries(p_entry_a uuid, p_entry_b uuid)
returns void language plpgsql security invoker set search_path = public as $$
declare a public.timetable_entries; b public.timetable_entries;
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
    join public.teacher_availability availability on availability.school_id = timetable.school_id and availability.academic_year_id = timetable.academic_year_id and availability.is_available = false
    where timetable.id = a.timetable_id and (
      (availability.teacher_id = a.teacher_id and availability.working_day_id = b.working_day_id and availability.period_slot_id = b.period_slot_id)
      or (availability.teacher_id = b.teacher_id and availability.working_day_id = a.working_day_id and availability.period_slot_id = a.period_slot_id)
    )
  ) then raise exception 'One of the teachers is unavailable at the destination slot' using errcode = '23514'; end if;
  delete from public.timetable_entries where id in (p_entry_a, p_entry_b);
  insert into public.timetable_entries(id, school_id, timetable_id, assignment_id, teacher_id, subject_id, class_section_id, working_day_id, period_slot_id, duration_slots, is_locked)
  values
    (a.id, a.school_id, a.timetable_id, a.assignment_id, a.teacher_id, a.subject_id, a.class_section_id, b.working_day_id, b.period_slot_id, a.duration_slots, a.is_locked),
    (b.id, b.school_id, b.timetable_id, b.assignment_id, b.teacher_id, b.subject_id, b.class_section_id, a.working_day_id, a.period_slot_id, b.duration_slots, b.is_locked);
  update public.timetables set status = 'draft', published_at = null, published_by = null where id = a.timetable_id;
end;
$$;
revoke all on function public.swap_timetable_entries(uuid, uuid) from public;
grant execute on function public.swap_timetable_entries(uuid, uuid) to authenticated;

create or replace function public.make_timetable_entries_parallel(p_dragged_entry_id uuid, p_target_entry_id uuid)
returns uuid language plpgsql security invoker set search_path = public as $$
declare
  dragged public.timetable_entries; target public.timetable_entries; target_level_id uuid;
  dragged_level_subject_id uuid; target_level_subject_id uuid; target_group_id uuid;
  dragged_subject_name text; target_subject_name text; destination_occupants integer;
begin
  perform 1 from public.timetable_entries where id in (p_dragged_entry_id, p_target_entry_id) order by id for update;
  select * into dragged from public.timetable_entries where id = p_dragged_entry_id;
  select * into target from public.timetable_entries where id = p_target_entry_id;
  if dragged.id is null or target.id is null then raise exception 'Entry not found' using errcode = 'P0002'; end if;
  if dragged.id = target.id then raise exception 'Choose two different lessons' using errcode = '23514'; end if;
  if dragged.timetable_id <> target.timetable_id or dragged.class_section_id <> target.class_section_id then raise exception 'Parallel lessons must belong to the same class timetable' using errcode = '23514'; end if;
  if dragged.is_locked then raise exception 'Cannot move a locked lesson' using errcode = '23514'; end if;
  if dragged.subject_id = target.subject_id then raise exception 'A subject cannot run in parallel with itself' using errcode = '23514'; end if;
  if not public.can_manage_school(dragged.school_id) then raise exception 'Not authorized to edit this timetable' using errcode = '42501'; end if;
  select count(*) into destination_occupants from public.timetable_entries
  where timetable_id = target.timetable_id and class_section_id = target.class_section_id
    and working_day_id = target.working_day_id and period_slot_id = target.period_slot_id and id <> dragged.id;
  if destination_occupants > 1 then raise exception 'This slot already has two parallel lessons' using errcode = '23514'; end if;
  if exists (
    select 1 from public.timetables timetable
    join public.teacher_availability availability on availability.school_id = timetable.school_id and availability.academic_year_id = timetable.academic_year_id
      and availability.teacher_id = dragged.teacher_id and availability.working_day_id = target.working_day_id
      and availability.period_slot_id = target.period_slot_id and availability.is_available = false
    where timetable.id = dragged.timetable_id
  ) then raise exception 'The dragged lesson''s teacher is unavailable at this slot' using errcode = '23514'; end if;
  if exists (
    select 1 from public.timetable_entries entry where entry.timetable_id = dragged.timetable_id and entry.teacher_id = dragged.teacher_id
      and entry.working_day_id = target.working_day_id and entry.period_slot_id = target.period_slot_id and entry.id <> dragged.id
  ) then raise exception 'The dragged lesson''s teacher is already teaching at this slot' using errcode = '23505'; end if;
  select class_section.level_id into target_level_id from public.class_sections class_section
  where class_section.id = dragged.class_section_id and class_section.school_id = dragged.school_id;
  select level_subject.id, subject.name into dragged_level_subject_id, dragged_subject_name
  from public.level_subjects level_subject join public.subjects subject on subject.id = level_subject.subject_id
  where level_subject.level_id = target_level_id and level_subject.subject_id = dragged.subject_id;
  select level_subject.id, subject.name into target_level_subject_id, target_subject_name
  from public.level_subjects level_subject join public.subjects subject on subject.id = level_subject.subject_id
  where level_subject.level_id = target_level_id and level_subject.subject_id = target.subject_id;
  if dragged_level_subject_id is null or target_level_subject_id is null then raise exception 'Both subjects must be configured for this class level' using errcode = '23514'; end if;
  select first_membership.parallel_group_id into target_group_id
  from public.level_subject_parallel_groups first_membership
  join public.level_subject_parallel_groups second_membership on second_membership.parallel_group_id = first_membership.parallel_group_id
  where first_membership.level_subject_id = dragged_level_subject_id and second_membership.level_subject_id = target_level_subject_id limit 1;
  if target_group_id is null then
    insert into public.parallel_subject_groups(school_id, level_id, name)
    values (dragged.school_id, target_level_id, dragged_subject_name || ' / ' || target_subject_name) returning id into target_group_id;
    insert into public.level_subject_parallel_groups(level_subject_id, parallel_group_id)
    values (dragged_level_subject_id, target_group_id), (target_level_subject_id, target_group_id);
  end if;
  update public.timetable_entries set working_day_id = target.working_day_id, period_slot_id = target.period_slot_id where id = dragged.id;
  update public.timetables set status = 'draft', published_at = null, published_by = null where id = dragged.timetable_id;
  return target_group_id;
end;
$$;
revoke all on function public.make_timetable_entries_parallel(uuid, uuid) from public;
grant execute on function public.make_timetable_entries_parallel(uuid, uuid) to authenticated;

-- Substitute the teacher for one scheduled period without changing its assignment.
create or replace function public.change_timetable_entry_teacher(p_entry_id uuid, p_teacher_id uuid)
returns void language plpgsql security invoker set search_path = public as $$
declare
  entry public.timetable_entries; replacement public.teachers; teacher_day_periods integer;
  teacher_period_orders integer[]; period_order integer; max_consecutive integer;
  current_run integer := 0; longest_run integer := 0; previous_order integer;
begin
  select * into entry from public.timetable_entries where id = p_entry_id for update;
  if entry.id is null then raise exception 'Lesson not found' using errcode = 'P0002'; end if;
  if entry.teacher_id = p_teacher_id then return; end if;
  if not public.can_manage_school(entry.school_id) then raise exception 'Not authorized to change this lesson' using errcode = '42501'; end if;
  select * into replacement from public.teachers where id = p_teacher_id and school_id = entry.school_id and status = 'active';
  if replacement.id is null then raise exception 'Choose an active teacher from this school' using errcode = '23514'; end if;
  if exists (
    select 1 from public.timetables timetable
    join public.teacher_availability availability on availability.school_id = timetable.school_id and availability.academic_year_id = timetable.academic_year_id
      and availability.teacher_id = p_teacher_id and availability.working_day_id = entry.working_day_id
      and availability.period_slot_id = entry.period_slot_id and availability.is_available = false
    where timetable.id = entry.timetable_id
  ) then raise exception '% is unavailable at this lesson time', replacement.full_name using errcode = '23514'; end if;
  if exists (
    select 1 from public.timetable_entries existing where existing.timetable_id = entry.timetable_id and existing.teacher_id = p_teacher_id
      and existing.working_day_id = entry.working_day_id and existing.period_slot_id = entry.period_slot_id and existing.id <> entry.id
  ) then raise exception '% is already teaching another class at this time', replacement.full_name using errcode = '23505'; end if;
  select count(*)::integer into teacher_day_periods from public.timetable_entries existing
  where existing.timetable_id = entry.timetable_id and existing.teacher_id = p_teacher_id
    and existing.working_day_id = entry.working_day_id and existing.id <> entry.id;
  if replacement.max_periods_per_day is not null and teacher_day_periods + 1 > replacement.max_periods_per_day then
    raise exception '% would exceed the daily lesson limit', replacement.full_name using errcode = '23514';
  end if;
  select slot.sort_order into period_order from public.period_slots slot where slot.id = entry.period_slot_id;
  select coalesce(array_agg(candidate.sort_order order by candidate.sort_order), '{}'::integer[]) into teacher_period_orders
  from (
    select slot.sort_order from public.timetable_entries existing
    join public.period_slots slot on slot.id = existing.period_slot_id
    where existing.timetable_id = entry.timetable_id and existing.teacher_id = p_teacher_id
      and existing.working_day_id = entry.working_day_id and existing.id <> entry.id
    union all select period_order
  ) candidate;
  foreach period_order in array teacher_period_orders loop
    if previous_order is null or period_order <> previous_order + 1 then current_run := 1; else current_run := current_run + 1; end if;
    longest_run := greatest(longest_run, current_run); previous_order := period_order;
  end loop;
  max_consecutive := coalesce(replacement.max_consecutive_periods, 4);
  if longest_run > max_consecutive then raise exception '% would exceed the consecutive lesson limit', replacement.full_name using errcode = '23514'; end if;
  update public.timetable_entries set teacher_id = p_teacher_id where id = entry.id;
  update public.timetables set status = 'draft', published_at = null, published_by = null where id = entry.timetable_id;
end;
$$;
revoke all on function public.change_timetable_entry_teacher(uuid, uuid) from public;
grant execute on function public.change_timetable_entry_teacher(uuid, uuid) to authenticated;
