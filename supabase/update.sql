-- Territorial Quest — aggiornamento: dati del territorio, luoghi importati, contributi sui punti esistenti.
-- Per un database già installato. Supabase → SQL Editor → New query → incolla tutto → Run.
-- Generato da scripts/build-setup.mjs: non modificarlo a mano.

-- ================================================================ 20261117000200_public.sql
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
      'data', x.data, 'lng', x.lng, 'lat', x.lat, 'display_name', x.display_name, 'created_at', x.created_at,
      'place_id', to_jsonb(x) -> 'place_id', 'dataset_id', to_jsonb(x) -> 'dataset_id', 'row_index', to_jsonb(x) -> 'row_index')
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


-- ================================================================ 20261118000000_organizers.sql
-- Territorial Quest — accesso di regia separato.
-- Solo chi è «regia» crea campagne. Si diventa regia registrandosi da /regia con il codice di regia,
-- che il proprietario del progetto imposta dall'SQL Editor:
--   select public.set_organizer_code('la-tua-parola-segreta');
-- Idempotente: si può rieseguire senza errori.

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

create table if not exists public.organizers (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);
-- Impostazioni del progetto: una sola riga.
create table if not exists public.settings (
  id integer primary key default 1 check (id = 1),
  organizer_code_hash text
);
insert into public.settings (id) values (1) on conflict (id) do nothing;
create table if not exists public.organizer_attempts (
  user_id uuid primary key references auth.users (id) on delete cascade,
  failures integer not null default 0,
  locked_until timestamptz
);

alter table public.organizers enable row level security;
alter table public.settings enable row level security;
alter table public.organizer_attempts enable row level security;
revoke all on public.settings, public.organizer_attempts from anon, authenticated;
drop policy if exists organizers_read on public.organizers;
create policy organizers_read on public.organizers for select to authenticated using (user_id = auth.uid());
grant select on public.organizers to authenticated;

-- Chi ha già creato campagne è regia.
insert into public.organizers (user_id)
select distinct owner_id from public.campaigns
on conflict (user_id) do nothing;

create or replace function public.is_organizer()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from organizers where user_id = auth.uid());
$$;

-- Solo dall'SQL Editor (nessun ruolo dell'app può chiamarla).
create or replace function public.set_organizer_code(code text)
returns text language plpgsql security definer set search_path = public, extensions as $$
begin
  if length(btrim(coalesce(code, ''))) < 8 then raise exception 'Il codice di regia deve avere almeno 8 caratteri'; end if;
  update settings set organizer_code_hash = extensions.crypt(btrim(code), extensions.gen_salt('bf')) where id = 1;
  return 'Codice di regia impostato';
end $$;
revoke all on function public.set_organizer_code(text) from public, anon, authenticated;

-- Con il codice giusto, chi ha effettuato l'accesso diventa regia. 5 errori: blocco di 15 minuti.
create or replace function public.claim_organizer(code text)
returns boolean language plpgsql security definer set search_path = public, extensions as $$
declare h text; a organizer_attempts;
begin
  if auth.uid() is null then raise exception 'Accesso richiesto'; end if;
  if exists (select 1 from organizers where user_id = auth.uid()) then return true; end if;
  select organizer_code_hash into h from settings where id = 1;
  if h is null then raise exception 'Il codice di regia non è ancora stato impostato nel progetto'; end if;
  select * into a from organizer_attempts where user_id = auth.uid();
  if a.locked_until is not null and a.locked_until > now() then
    raise exception 'Troppi tentativi: riprova tra % minuti', ceil(extract(epoch from (a.locked_until - now())) / 60);
  end if;
  if h <> extensions.crypt(btrim(coalesce(code, '')), h) then
    insert into organizer_attempts (user_id, failures) values (auth.uid(), 1)
    on conflict (user_id) do update set failures = organizer_attempts.failures + 1,
      locked_until = case when organizer_attempts.failures + 1 >= 5 then now() + interval '15 minutes' else null end;
    return false;
  end if;
  insert into profiles (id, display_name)
  select u.id, coalesce(nullif(u.raw_user_meta_data ->> 'display_name', ''), split_part(u.email, '@', 1), 'Senza nome')
  from auth.users u where u.id = auth.uid() on conflict (id) do nothing;
  insert into organizers (user_id) values (auth.uid()) on conflict (user_id) do nothing;
  delete from organizer_attempts where user_id = auth.uid();
  return true;
end $$;

revoke all on function public.is_organizer() from public, anon;
revoke all on function public.claim_organizer(text) from public, anon;
grant execute on function public.is_organizer() to authenticated;
grant execute on function public.claim_organizer(text) to authenticated;

-- Le campagne le crea solo la regia.
drop policy if exists campaigns_insert on public.campaigns;
create policy campaigns_insert on public.campaigns for insert to authenticated
  with check (owner_id = auth.uid() and public.is_organizer());

notify pgrst, 'reload schema';


-- ================================================================ 20261123000000_datasets.sql
-- Territorial Quest — dati del territorio: indicatori, strati di punti e linee, tabelle, luoghi importati.
-- Idempotente: si può rieseguire senza errori.

create table if not exists public.datasets (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  name text not null,
  -- indicatori: righe per Comune (o altra chiave), eventualmente nel tempo
  -- punti: strato di riferimento con coordinate · linee: tracciati · tabella: scheda descrittiva
  kind text not null check (kind in ('indicatori', 'punti', 'linee', 'tabella')),
  source text not null default '',
  licence text not null default '',
  note text not null default '',
  key_column text,       -- es. comune
  time_column text,      -- es. anno
  category_column text,  -- es. tipo, classe
  label_column text,     -- es. nome
  columns jsonb not null default '[]'::jsonb, -- [{ key, label, type: numero|testo, unit }]
  rows jsonb not null default '[]'::jsonb,    -- righe del file; per «punti» con lng e lat; per «linee» una FeatureCollection
  color text not null default '#d6993e',
  public boolean not null default true,       -- visibile sulla mappa pubblica
  created_at timestamptz not null default now()
);
create index if not exists datasets_campaign_idx on public.datasets (campaign_id);

alter table public.datasets enable row level security;
drop policy if exists datasets_read on public.datasets;
create policy datasets_read on public.datasets for select to authenticated using (public.is_member(campaign_id));
drop policy if exists datasets_insert on public.datasets;
create policy datasets_insert on public.datasets for insert to authenticated with check (public.is_staff(campaign_id));
drop policy if exists datasets_update on public.datasets;
create policy datasets_update on public.datasets for update to authenticated using (public.is_staff(campaign_id)) with check (public.is_staff(campaign_id));
drop policy if exists datasets_delete on public.datasets;
create policy datasets_delete on public.datasets for delete to authenticated using (public.is_staff(campaign_id));
grant select, insert, update, delete on public.datasets to authenticated;

-- Luoghi importati: provenienza, attributi originali, posizione da confermare.
alter table public.places add column if not exists source text not null default '';
alter table public.places add column if not exists attributes jsonb not null default '{}'::jsonb;
alter table public.places add column if not exists placed boolean not null default true;
alter table public.places drop constraint if exists places_category_check;
alter table public.places add constraint places_category_check
  check (category in ('storico', 'naturalistico', 'culturale', 'sociale', 'paesaggio', 'ospitalita', 'altro'));

-- Un luogo da posizionare non si raggiunge.
create or replace function public.check_in(p uuid, lng double precision, lat double precision)
returns jsonb language plpgsql security definer set search_path = public as $$
declare pl places; me memberships; d double precision; already boolean;
begin
  select * into pl from places where id = p;
  if pl.id is null or not pl.placed then raise exception 'Luogo non trovato'; end if;
  if not public.can_collect(pl.campaign_id) then raise exception 'La raccolta è chiusa in questo momento'; end if;
  select * into me from memberships where campaign_id = pl.campaign_id and user_id = auth.uid();
  d := public.meters_between(lng, lat, pl.lng, pl.lat);
  if d > pl.radius_m + 25 then
    raise exception 'Sei a % m: avvicinati ancora (raggio %)', round(d), pl.radius_m;
  end if;
  select exists (
    select 1 from visits v
    where v.place_id = p and coalesce(v.team_id::text, v.user_id::text) = coalesce(me.team_id::text, auth.uid()::text)
  ) into already;
  insert into visits (campaign_id, place_id, user_id, team_id, distance_m)
  values (pl.campaign_id, p, auth.uid(), me.team_id, round(d))
  on conflict (place_id, user_id) do nothing;
  return jsonb_build_object('distance', round(d), 'first_for_team', not already);
end $$;

-- Mappa pubblica: aggiunge i dati del territorio pubblicabili e nasconde i luoghi da posizionare.
create or replace function public.public_datasets(c uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(to_jsonb(d) - 'campaign_id' order by d.created_at), '[]')
  from datasets d join campaigns k on k.id = d.campaign_id
  where d.campaign_id = c and d.public and (k.public_map or k.contributions_open or public.is_member(c));
$$;
revoke all on function public.public_datasets(uuid) from public;
grant execute on function public.public_datasets(uuid) to anon, authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'datasets') then
    alter publication supabase_realtime add table public.datasets;
  end if;
exception when others then
  raise warning 'Tempo reale per i dati del territorio non attivato (%).', sqlerrm;
end $$;

notify pgrst, 'reload schema';


-- ================================================================ 20261124000000_point_contributions.sql
-- Territorial Quest — contributi su punti già inseriti: foto, informazioni, dati e correzioni
-- su un luogo del gioco o su un punto di uno strato di dati. Sempre rivisti dalla regia.
-- Idempotente: si può rieseguire senza errori.

alter table public.contributions add column if not exists place_id uuid references public.places (id) on delete cascade;
alter table public.contributions add column if not exists dataset_id uuid references public.datasets (id) on delete cascade;
alter table public.contributions add column if not exists row_index integer;
create index if not exists contributions_target_idx on public.contributions (campaign_id, place_id, dataset_id, row_index);

-- nuova forma: la correzione di un valore del file (data = { column, old, new })
alter table public.contributions drop constraint if exists contributions_form_check;
alter table public.contributions add constraint contributions_form_check
  check (form in ('immagine', 'percezione', 'dato', 'informazione', 'idea', 'correzione'));

-- Chi partecipa alla campagna può arricchire i punti anche quando i contributi pubblici sono chiusi.
create or replace function public.can_contribute(c uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
      select 1 from campaigns k where k.id = c and k.status <> 'closed' and (k.contributions_open or public.is_member(c))
    )
    and (select count(*) from contributions x where x.campaign_id = c and x.user_id = auth.uid() and x.status = 'pending') < 20;
$$;

-- I membri vedono i contributi approvati (per le schede dei punti sul campo), oltre ai propri.
drop policy if exists contributions_read on public.contributions;
create policy contributions_read on public.contributions for select to authenticated
  using (user_id = auth.uid() or public.is_staff(campaign_id) or (status = 'approved' and public.is_member(campaign_id)));

notify pgrst, 'reload schema';


-- ================================================================ esito
select case when count(*) = 5 then 'Aggiornamento completato: apri /stato sul sito'
            else 'Aggiornamento incompleto: mancano ' || (5 - count(*)) || ' parti' end as esito
from (select table_name from information_schema.tables where table_schema = 'public' and table_name in ('organizers', 'settings', 'organizer_attempts', 'datasets')
      union all select column_name from information_schema.columns where table_schema = 'public' and table_name = 'contributions' and column_name = 'row_index') x;
