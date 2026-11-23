-- Territorial Quest — mappa pubblica e contributi individuali moderati dalla regia.
-- Idempotente: si può rieseguire senza errori.

alter table public.campaigns add column if not exists public_map boolean not null default false;
alter table public.campaigns add column if not exists contributions_open boolean not null default false;
alter table public.campaigns add column if not exists public_intro text not null default '';

-- Contributi individuali: chiunque abbia un profilo, anche senza team. Pubblicati solo se approvati.
create table if not exists public.contributions (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  display_name text not null default 'Anonimo', -- come compare sulla mappa pubblica
  form text not null default 'informazione' check (form in ('immagine', 'percezione', 'dato', 'informazione', 'idea')),
  title text not null check (length(btrim(title)) between 2 and 120),
  note text not null default '',
  feeling text,
  media_path text,
  data jsonb not null default '{}'::jsonb,
  lng double precision not null,
  lat double precision not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  review_note text,
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists contributions_campaign_idx on public.contributions (campaign_id, status, created_at desc);

-- Si contribuisce solo a campagne aperte ai contributi, con un massimo di 20 proposte in attesa a testa.
create or replace function public.can_contribute(c uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from campaigns k where k.id = c and k.contributions_open and k.status <> 'closed')
     and (select count(*) from contributions x where x.campaign_id = c and x.user_id = auth.uid() and x.status = 'pending') < 20;
$$;

alter table public.contributions enable row level security;
drop policy if exists contributions_read on public.contributions;
create policy contributions_read on public.contributions for select to authenticated
  using (user_id = auth.uid() or public.is_staff(campaign_id));
drop policy if exists contributions_insert on public.contributions;
create policy contributions_insert on public.contributions for insert to authenticated
  with check (user_id = auth.uid() and status = 'pending' and reviewed_by is null and public.can_contribute(campaign_id));
drop policy if exists contributions_update on public.contributions;
create policy contributions_update on public.contributions for update to authenticated
  using (public.is_staff(campaign_id)) with check (public.is_staff(campaign_id));
drop policy if exists contributions_delete on public.contributions;
create policy contributions_delete on public.contributions for delete to authenticated
  using (public.is_staff(campaign_id) or (user_id = auth.uid() and status = 'pending'));
grant select, insert, update, delete on public.contributions to authenticated;

-- Una campagna vista da fuori: solo ciò che è validato, mai i nomi delle persone.
-- Se la mappa non è pubblica la vedono solo i membri.
create or replace function public.public_map(c uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare k campaigns; visible boolean;
begin
  select * into k from campaigns where id = c;
  visible := k.public_map or public.is_member(c);
  -- campagna aperta ai contributi ma non pubblica: si vedono territorio e luoghi, non i dati raccolti
  if k.id is null or not (visible or k.contributions_open) then return null; end if;
  return jsonb_build_object(
    'campaign', jsonb_build_object(
      'id', k.id, 'name', k.name, 'description', k.description, 'public_intro', k.public_intro,
      'starts_at', k.starts_at, 'ends_at', k.ends_at, 'center_lng', k.center_lng, 'center_lat', k.center_lat, 'zoom', k.zoom,
      'basemap', k.basemap, 'basemap_url', k.basemap_url, 'basemap_opacity', k.basemap_opacity, 'overlay', k.overlay,
      'public_map', k.public_map, 'contributions_open', k.contributions_open),
    'areas', coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'name', a.name, 'color', a.color, 'geometry', a.geometry,
      'environment', a.environment, 'terrain', a.terrain)) from areas a where a.campaign_id = c), '[]'),
    'themes', coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'name', t.name, 'color', t.color) order by t.sort) from themes t where t.campaign_id = c), '[]'),
    'teams', coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'name', t.name, 'color', t.color)) from teams t where t.campaign_id = c), '[]'),
    'places', coalesce((select jsonb_agg(to_jsonb(p) - 'campaign_id') from places p where p.campaign_id = c and coalesce((to_jsonb(p) ->> 'placed')::boolean, true)), '[]'),
    'routes', coalesce((select jsonb_agg(to_jsonb(r) - 'campaign_id') from routes r where r.campaign_id = c), '[]'),
    'observations', coalesce((select jsonb_agg(jsonb_build_object(
      'id', o.id, 'form', o.form, 'kind', o.kind, 'lens', o.lens, 'title', o.title, 'note', o.note, 'feeling', o.feeling,
      'source_url', o.source_url, 'media_path', o.media_path, 'lng', o.lng, 'lat', o.lat, 'path', o.path, 'data', o.data,
      'cell', o.cell, 'theme_id', o.theme_id, 'team_id', o.team_id, 'place_id', o.place_id, 'quality', o.quality, 'created_at', o.created_at)
      order by o.created_at desc) from observations o where visible and o.campaign_id = c and o.status = 'validated'), '[]'),
    'contributions', coalesce((select jsonb_agg(jsonb_build_object(
      'id', x.id, 'form', x.form, 'title', x.title, 'note', x.note, 'feeling', x.feeling, 'media_path', x.media_path,
      'data', x.data, 'lng', x.lng, 'lat', x.lat, 'display_name', x.display_name, 'created_at', x.created_at)
      order by x.created_at desc) from contributions x where visible and x.campaign_id = c and x.status = 'approved'), '[]'),
    'stats', jsonb_build_object(
      'walked_m', coalesce((select sum(distance_m) from walks w where w.campaign_id = c), 0),
      'visits', (select count(*) from visits v where v.campaign_id = c),
      'teams', (select count(*) from teams t where t.campaign_id = c))
  );
end $$;
revoke all on function public.public_map(uuid) from public;
grant execute on function public.public_map(uuid) to anon, authenticated;
revoke all on function public.can_contribute(uuid) from public, anon;
grant execute on function public.can_contribute(uuid) to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'contributions') then
    alter publication supabase_realtime add table public.contributions;
  end if;
exception when others then
  raise warning 'Tempo reale per i contributi non attivato (%).', sqlerrm;
end $$;

-- Profilo garantito anche se il collegamento su auth.users non è stato possibile.
create or replace function public.ensure_profile()
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return; end if;
  insert into profiles (id, display_name)
  select u.id, coalesce(nullif(u.raw_user_meta_data ->> 'display_name', ''), split_part(u.email, '@', 1), 'Senza nome')
  from auth.users u where u.id = auth.uid()
  on conflict (id) do nothing;
end $$;
revoke all on function public.ensure_profile() from public, anon;
grant execute on function public.ensure_profile() to authenticated;

notify pgrst, 'reload schema';
