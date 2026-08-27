-- Superadmin foundation for platform-owner visibility.

create table if not exists public.platform_admins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  email text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  constraint platform_admin_identity check (user_id is not null or email is not null)
);

create unique index if not exists platform_admins_user_id_key
  on public.platform_admins(user_id)
  where user_id is not null;

create unique index if not exists platform_admins_email_key
  on public.platform_admins(lower(email))
  where email is not null;

alter table public.platform_admins enable row level security;

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select coalesce(
    auth.uid() is not null and (
      exists (
        select 1
        from public.platform_admins admin
        where admin.user_id = auth.uid()
          or lower(admin.email) = lower(coalesce(auth.jwt()->>'email', ''))
      )
      or exists (
        select 1
        from public.profiles profile
        where profile.id = auth.uid()
          and profile.platform_admin = true
      )
    ),
    false
  );
$$;

create policy "platform admins read platform_admins"
on public.platform_admins
for select
using (public.is_platform_admin());

create policy "platform admins manage platform_admins"
on public.platform_admins
for all
using (public.is_platform_admin())
with check (public.is_platform_admin());

create or replace function public.get_platform_overview()
returns jsonb
language sql
stable
security definer
set search_path=public
as $$
  select case
    when not public.is_platform_admin() then
      jsonb_build_object('error', 'not_authorized')
    else jsonb_build_object(
      'schools', (select count(*) from public.schools),
      'active_schools', (select count(*) from public.schools where account_status in ('trial','active')),
      'suspended_schools', (select count(*) from public.schools where account_status = 'suspended'),
      'users', (select count(distinct user_id) from public.school_memberships),
      'teachers', (select count(*) from public.teachers),
      'classes', (select count(*) from public.class_sections),
      'subjects', (select count(*) from public.subjects),
      'timetables', (select count(*) from public.timetables),
      'published_timetables', (select count(*) from public.timetables where status = 'published'),
      'latest_generation_runs', coalesce((
        select jsonb_agg(to_jsonb(run_item) order by run_item.created_at desc)
        from (
          select
            gr.id,
            gr.status,
            gr.progress,
            gr.error_message,
            gr.created_at,
            gr.completed_at,
            s.name as school_name,
            s.slug as school_slug
          from public.generation_runs gr
          join public.schools s on s.id = gr.school_id
          order by gr.created_at desc
          limit 8
        ) run_item
      ), '[]'::jsonb)
    )
  end;
$$;

create or replace function public.list_platform_schools()
returns jsonb
language sql
stable
security definer
set search_path=public
as $$
  select case
    when not public.is_platform_admin() then
      jsonb_build_object('error', 'not_authorized')
    else coalesce((
      select jsonb_agg(to_jsonb(school_item) order by school_item.created_at desc)
      from (
        select
          s.id,
          s.name,
          s.slug,
          s.logo_url,
          s.account_status,
          s.school_type,
          s.curriculum,
          s.country,
          s.region,
          s.city,
          s.created_at,
          s.updated_at,
          ay.name as current_academic_year,
          owner_profile.full_name as owner_name,
          owner_user.email as owner_email,
          count(distinct sm.user_id) as members_count,
          count(distinct t.id) as teachers_count,
          count(distinct cs.id) as classes_count,
          count(distinct sub.id) as subjects_count,
          count(distinct tt.id) as timetables_count,
          max(gr.created_at) as last_generation_at
        from public.schools s
        left join public.academic_years ay on ay.school_id = s.id and ay.is_current = true
        left join public.school_memberships owner_membership on owner_membership.school_id = s.id and owner_membership.role = 'owner'
        left join public.profiles owner_profile on owner_profile.id = owner_membership.user_id
        left join auth.users owner_user on owner_user.id = owner_membership.user_id
        left join public.school_memberships sm on sm.school_id = s.id
        left join public.teachers t on t.school_id = s.id
        left join public.class_sections cs on cs.school_id = s.id
        left join public.subjects sub on sub.school_id = s.id
        left join public.timetables tt on tt.school_id = s.id
        left join public.generation_runs gr on gr.school_id = s.id
        group by s.id, ay.name, owner_profile.full_name, owner_user.email
        order by s.created_at desc
      ) school_item
    ), '[]'::jsonb)
  end;
$$;

create or replace function public.get_platform_school_detail(p_school_id uuid)
returns jsonb
language sql
stable
security definer
set search_path=public
as $$
  select case
    when not public.is_platform_admin() then
      jsonb_build_object('error', 'not_authorized')
    else coalesce((
      select jsonb_build_object(
        'school', to_jsonb(s),
        'academic_years', coalesce((select jsonb_agg(to_jsonb(ay) order by ay.created_at desc) from public.academic_years ay where ay.school_id = s.id), '[]'::jsonb),
        'members', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', sm.id,
            'user_id', sm.user_id,
            'role', sm.role,
            'job_title', sm.job_title,
            'created_at', sm.created_at,
            'full_name', p.full_name,
            'phone', p.phone,
            'email', u.email,
            'email_confirmed_at', u.email_confirmed_at,
            'last_sign_in_at', u.last_sign_in_at
          ) order by sm.created_at)
          from public.school_memberships sm
          left join public.profiles p on p.id = sm.user_id
          left join auth.users u on u.id = sm.user_id
          where sm.school_id = s.id
        ), '[]'::jsonb),
        'counts', jsonb_build_object(
          'teachers', (select count(*) from public.teachers where school_id = s.id),
          'classes', (select count(*) from public.class_sections where school_id = s.id),
          'levels', (select count(*) from public.levels where school_id = s.id),
          'subjects', (select count(*) from public.subjects where school_id = s.id),
          'assignments', (select count(*) from public.teaching_assignments where school_id = s.id),
          'timetables', (select count(*) from public.timetables where school_id = s.id),
          'published_timetables', (select count(*) from public.timetables where school_id = s.id and status = 'published')
        ),
        'latest_timetables', coalesce((
          select jsonb_agg(to_jsonb(tt_item) order by tt_item.created_at desc)
          from (
            select id, name, version, status, quality_score, published_at, created_at
            from public.timetables
            where school_id = s.id
            order by created_at desc
            limit 8
          ) tt_item
        ), '[]'::jsonb),
        'latest_runs', coalesce((
          select jsonb_agg(to_jsonb(run_item) order by run_item.created_at desc)
          from (
            select id, status, progress, error_message, started_at, completed_at, created_at
            from public.generation_runs
            where school_id = s.id
            order by created_at desc
            limit 8
          ) run_item
        ), '[]'::jsonb)
      )
      from public.schools s
      where s.id = p_school_id
    ), jsonb_build_object('error', 'not_found'))
  end;
$$;

insert into public.platform_admins(email)
values ('simplebolo237@gmail.com'), ('info.staruth.tech@gmail.com')
on conflict do nothing;

grant execute on function public.is_platform_admin() to authenticated;
grant execute on function public.get_platform_overview() to authenticated;
grant execute on function public.list_platform_schools() to authenticated;
grant execute on function public.get_platform_school_detail(uuid) to authenticated;
