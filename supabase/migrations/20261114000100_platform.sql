-- Territorial Quest — integrazione con i servizi Supabase (Storage e Realtime).
-- Separato dallo schema perché dipende da oggetti gestiti dalla piattaforma.

-- Profili per gli utenti già registrati prima dell'installazione.
insert into public.profiles (id, display_name)
select u.id, coalesce(nullif(u.raw_user_meta_data ->> 'display_name', ''), split_part(u.email, '@', 1), 'Senza nome')
from auth.users u
on conflict (id) do nothing;

-- Media delle osservazioni: lettura pubblica, caricamento per chi ha effettuato l'accesso.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media', 'media', true, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'audio/mpeg', 'audio/mp4', 'audio/webm'])
on conflict (id) do nothing;

drop policy if exists media_read on storage.objects;
create policy media_read on storage.objects for select using (bucket_id = 'media');
drop policy if exists media_insert on storage.objects;
create policy media_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'media' and owner = auth.uid());
drop policy if exists media_delete on storage.objects;
create policy media_delete on storage.objects for delete to authenticated
  using (bucket_id = 'media' and owner = auth.uid());

-- Aggiornamenti in tempo reale per pannello di controllo e app di rilievo.
do $$
declare t text;
begin
  foreach t in array array['campaigns', 'teams', 'memberships', 'areas', 'missions', 'observations', 'announcements'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
