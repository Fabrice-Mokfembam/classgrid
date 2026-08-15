-- Extends the onboarding RPC: generates the school slug internally instead of
-- requiring the client to compute one, supports a 5- or 6-day teaching week,
-- and creates the school's initial levels in the same atomic transaction.
-- (The original create_school_workspace(...) took a `school_slug` param and
-- never touched `levels` or a variable week length — this replaces it.)

create or replace function public.slugify(input text) returns text
language sql immutable as $$
  select trim(both '-' from regexp_replace(lower(coalesce(input, '')), '[^a-z0-9]+', '-', 'g'));
$$;

drop function if exists public.create_school_workspace(
  text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text
);

create or replace function public.create_school_workspace(
  school_name text, school_type text, country text, region text, city text,
  address text, school_phone text, school_email text, school_website text, timezone text,
  curriculum text, estimated_students text, admin_full_name text, admin_phone text, admin_job_title text,
  academic_year_name text, working_days_count int default 5, levels text[] default '{}'
) returns uuid language plpgsql security definer set search_path=public as $$
declare
  new_school uuid;
  new_year uuid;
  new_slug text;
  weekday_names text[] := array['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  d integer;
  lvl text;
  lvl_order smallint := 0;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if working_days_count < 1 or working_days_count > 6 then
    raise exception 'working_days_count must be between 1 and 6';
  end if;

  insert into public.profiles(id,full_name,phone) values(auth.uid(),admin_full_name,admin_phone)
    on conflict(id) do update set full_name=excluded.full_name,phone=excluded.phone;

  new_slug := coalesce(nullif(public.slugify(school_name), ''), 'school')
    || '-' || substr(md5(random()::text || clock_timestamp()::text), 1, 6);

  insert into public.schools(name,slug,school_type,country,region,city,address,phone,email,website,timezone,curriculum,estimated_students)
    values(school_name,new_slug,school_type,country,region,city,address,school_phone,school_email,school_website,timezone,curriculum,estimated_students)
    returning id into new_school;

  insert into public.school_memberships(school_id,user_id,role,job_title) values(new_school,auth.uid(),'owner',admin_job_title);

  insert into public.academic_years(school_id,name,is_current) values(new_school,academic_year_name,true) returning id into new_year;

  for d in 1..working_days_count loop
    insert into public.working_days(school_id,academic_year_id,weekday,name,sort_order)
      values(new_school,new_year,d,weekday_names[d],d);
  end loop;

  foreach lvl in array levels loop
    lvl_order := lvl_order + 1;
    insert into public.levels(school_id,academic_year_id,name,sort_order) values(new_school,new_year,lvl,lvl_order);
  end loop;

  return new_school;
end $$;

grant execute on function public.create_school_workspace to authenticated;
