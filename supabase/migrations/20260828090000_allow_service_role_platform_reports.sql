create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce(current_setting('request.jwt.claim.role', true), '') = 'service_role'
    or (
      auth.uid() is not null
      and (
        exists (
          select 1
          from public.platform_admins admin
          where admin.user_id = auth.uid()
            or lower(admin.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
        )
        or exists (
          select 1
          from public.profiles profile
          where profile.id = auth.uid()
            and profile.platform_admin = true
        )
      )
    );
$$;
