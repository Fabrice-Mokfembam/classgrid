-- School logo storage bucket and access policies.
-- Logos are stored as: <school_id>/logo.<ext>

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'school-logos',
  'school-logos',
  true,
  2097152,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.logo_object_school_id(object_name text)
returns uuid
language sql
immutable
set search_path = public, storage
as $$
  select case
    when (storage.foldername(object_name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then ((storage.foldername(object_name))[1])::uuid
    else null
  end;
$$;

create policy "school logo members read"
on storage.objects for select
using (
  bucket_id = 'school-logos'
  and public.is_school_member(public.logo_object_school_id(name))
);

create policy "school logo managers upload"
on storage.objects for insert
with check (
  bucket_id = 'school-logos'
  and public.can_manage_school(public.logo_object_school_id(name))
);

create policy "school logo managers update"
on storage.objects for update
using (
  bucket_id = 'school-logos'
  and public.can_manage_school(public.logo_object_school_id(name))
)
with check (
  bucket_id = 'school-logos'
  and public.can_manage_school(public.logo_object_school_id(name))
);

create policy "school logo managers delete"
on storage.objects for delete
using (
  bucket_id = 'school-logos'
  and public.can_manage_school(public.logo_object_school_id(name))
);
