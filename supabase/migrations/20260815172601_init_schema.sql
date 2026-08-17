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

