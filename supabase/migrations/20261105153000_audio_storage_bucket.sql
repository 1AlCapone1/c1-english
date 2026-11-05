-- Public bucket for listening audio (learning material, not personal data). Only admins can upload/change files.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('audio', 'audio', true, 52428800, array['audio/mpeg','audio/mp4','audio/ogg','audio/wav','audio/webm'])
on conflict (id) do update set public = true;
create policy audio_read on storage.objects for select to authenticated using (bucket_id = 'audio');
create policy audio_admin_insert on storage.objects for insert to authenticated with check (bucket_id = 'audio' and (select public.is_admin()));
create policy audio_admin_update on storage.objects for update to authenticated using (bucket_id = 'audio' and (select public.is_admin()));
create policy audio_admin_delete on storage.objects for delete to authenticated using (bucket_id = 'audio' and (select public.is_admin()));
