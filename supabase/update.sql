-- Territorial Quest — aggiornamento: luoghi e percorsi, indagini sul sito, recupero password, mappa pubblica.
-- Per un database già installato. Supabase → SQL Editor → New query → incolla tutto → Run.
-- Generato da scripts/build-setup.mjs: non modificarlo a mano.

-- ================================================================ 20261117000000_places_routes.sql
-- Territorial Quest — luoghi di interesse, indagini sul sito, percorsi di esplorazione e arrivi.
-- Idempotente: si può rieseguire senza errori.

-- Luoghi: punti di interesse da raggiungere, creati dalla regia.
create table if not exists public.places (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  name text not null,
  description text not null default '',
  -- che cosa raccogliere una volta arrivati
  prompt text not null default '',
  category text not null default 'storico'
    check (category in ('storico', 'naturalistico', 'culturale', 'sociale', 'paesaggio', 'altro')),
  lng double precision not null,
  lat double precision not null,
  -- distanza entro cui si è «arrivati»
  radius_m integer not null default 40 check (radius_m between 10 and 500),
  -- punti per team: metà all'arrivo, metà al primo rilievo confermato sul posto
  points integer not null default 30 check (points between 0 and 1000),
  images jsonb not null default '[]'::jsonb, -- percorsi nello Storage, la prima è la copertina
  created_at timestamptz not null default now()
);
-- Scheda d'indagine sul sito (scala micro): domande che i team compilano sul posto.
alter table public.places add column if not exists survey jsonb not null default '[]'::jsonb;
create index if not exists places_campaign_idx on public.places (campaign_id);

-- Percorsi: sequenze ordinate di luoghi.
create table if not exists public.routes (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  name text not null,
  description text not null default '',
  color text not null default '#e8a81c',
  stops jsonb not null default '[]'::jsonb, -- id dei luoghi, in ordine
  created_at timestamptz not null default now()
);
create index if not exists routes_campaign_idx on public.routes (campaign_id);

-- Arrivi: una persona ha raggiunto un luogo. Si registrano solo tramite check_in().
create table if not exists public.visits (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  place_id uuid not null references public.places (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  team_id uuid references public.teams (id) on delete set null,
  distance_m integer not null default 0,
  created_at timestamptz not null default now(),
  unique (place_id, user_id)
);
create index if not exists visits_campaign_idx on public.visits (campaign_id);

-- Un rilievo può essere raccolto presso un luogo.
alter table public.observations add column if not exists place_id uuid references public.places (id) on delete set null;

-- Nuova forma di raccolta: l'indagine sul sito.
alter table public.observations drop constraint if exists observations_form_check;
alter table public.observations add constraint observations_form_check
  check (form in ('immagine', 'flusso', 'percezione', 'dato', 'informazione', 'idea', 'indagine'));

-- Distanza in metri tra due punti (formula dell'emisenoverso).
create or replace function public.meters_between(lng1 double precision, lat1 double precision, lng2 double precision, lat2 double precision)
returns double precision language sql immutable as $$
  select 2 * 6371000 * asin(sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2) +
    cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)
  ));
$$;

-- Arrivo a un luogo: il database verifica la distanza dalla posizione dichiarata.
-- Restituisce { distance, first_for_team }; l'arrivo vale una volta per persona.
create or replace function public.check_in(p uuid, lng double precision, lat double precision)
returns jsonb language plpgsql security definer set search_path = public as $$
declare pl places; me memberships; d double precision; already boolean;
begin
  select * into pl from places where id = p;
  if pl.id is null then raise exception 'Luogo non trovato'; end if;
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

-- ------------------------------------------------------------------ RLS
alter table public.places enable row level security;
alter table public.routes enable row level security;
alter table public.visits enable row level security;

do $$
declare t text;
begin
  foreach t in array array['places', 'routes'] loop
    execute format('drop policy if exists %1$s_read on public.%1$s', t);
    execute format('create policy %1$s_read on public.%1$s for select to authenticated using (public.is_member(campaign_id))', t);
    execute format('drop policy if exists %1$s_insert on public.%1$s', t);
    execute format('create policy %1$s_insert on public.%1$s for insert to authenticated with check (public.is_staff(campaign_id))', t);
    execute format('drop policy if exists %1$s_update on public.%1$s', t);
    execute format('create policy %1$s_update on public.%1$s for update to authenticated using (public.is_staff(campaign_id)) with check (public.is_staff(campaign_id))', t);
    execute format('drop policy if exists %1$s_delete on public.%1$s', t);
    execute format('create policy %1$s_delete on public.%1$s for delete to authenticated using (public.is_staff(campaign_id))', t);
  end loop;
end $$;

drop policy if exists visits_read on public.visits;
create policy visits_read on public.visits for select to authenticated using (public.is_member(campaign_id));
drop policy if exists visits_delete on public.visits;
create policy visits_delete on public.visits for delete to authenticated using (public.is_staff(campaign_id));
-- nessuna policy di inserimento: gli arrivi passano solo da check_in()

grant select, insert, update, delete on public.places, public.routes to authenticated;
grant select, delete on public.visits to authenticated;
revoke all on function public.check_in(uuid, double precision, double precision) from public, anon;
grant execute on function public.check_in(uuid, double precision, double precision) to authenticated;

do $$
declare t text;
begin
  foreach t in array array['places', 'routes', 'visits'] loop
    if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
       and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
exception when others then
  raise warning 'Tempo reale per luoghi e percorsi non attivato (%).', sqlerrm;
end $$;

notify pgrst, 'reload schema';


-- ================================================================ 20261117000100_recovery.sql
-- Territorial Quest — recupero della password con domanda segreta.
-- Le risposte sono salvate cifrate (bcrypt), confrontate senza badare a maiuscole,
-- spazi e accenti; dopo 5 errori il recupero si blocca per 15 minuti.
-- Idempotente: si può rieseguire senza errori.

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

create table if not exists public.recovery (
  user_id uuid primary key references auth.users (id) on delete cascade,
  question text not null,
  answer_hash text not null,
  failures integer not null default 0,
  locked_until timestamptz,
  updated_at timestamptz not null default now()
);
-- Nessuna regola di accesso: la tabella si usa solo tramite le funzioni qui sotto.
alter table public.recovery enable row level security;
revoke all on public.recovery from anon, authenticated;

create or replace function public.normalize_answer(a text)
returns text language sql immutable as $$
  select translate(lower(regexp_replace(btrim(coalesce(a, '')), '\s+', ' ', 'g')), 'àáâäèéêëìíîïòóôöùúûü', 'aaaaeeeeiiiioooouuuu');
$$;

-- Imposta o cambia la domanda segreta di chi ha effettuato l'accesso.
create or replace function public.set_recovery(question text, answer text)
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  if auth.uid() is null then raise exception 'Accesso richiesto'; end if;
  if length(btrim(coalesce(question, ''))) < 5 then raise exception 'Scrivi una domanda più lunga'; end if;
  if length(public.normalize_answer(answer)) < 3 then raise exception 'La risposta deve avere almeno 3 caratteri'; end if;
  insert into recovery (user_id, question, answer_hash)
  values (auth.uid(), btrim(question), extensions.crypt(public.normalize_answer(answer), extensions.gen_salt('bf')))
  on conflict (user_id) do update
    set question = excluded.question, answer_hash = excluded.answer_hash, failures = 0, locked_until = null, updated_at = now();
end $$;

create or replace function public.has_recovery()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from recovery where user_id = auth.uid());
$$;

-- Domanda associata a un'email (null se l'email non ha una domanda impostata).
create or replace function public.recovery_question(email text)
returns text language sql stable security definer set search_path = public as $$
  select r.question from recovery r join auth.users u on u.id = r.user_id
  where lower(u.email) = lower(btrim(recovery_question.email)) limit 1;
$$;

-- Nuova password se la risposta è corretta.
create or replace function public.reset_password(email text, answer text, new_password text)
returns boolean language plpgsql security definer set search_path = public, extensions as $$
declare r recovery; uid uuid;
begin
  select u.id into uid from auth.users u where lower(u.email) = lower(btrim(reset_password.email)) limit 1;
  select * into r from recovery where user_id = uid;
  if uid is null or r.user_id is null then raise exception 'Per questa email non è impostata una domanda segreta'; end if;
  if r.locked_until is not null and r.locked_until > now() then
    raise exception 'Troppi tentativi: riprova tra % minuti', ceil(extract(epoch from (r.locked_until - now())) / 60);
  end if;
  if r.answer_hash <> extensions.crypt(public.normalize_answer(answer), r.answer_hash) then
    update recovery set failures = failures + 1,
      locked_until = case when failures + 1 >= 5 then now() + interval '15 minutes' else null end
    where user_id = uid;
    -- l'aggiornamento dei tentativi deve restare anche se segnaliamo l'errore
    return false;
  end if;
  if length(coalesce(new_password, '')) < 8 then raise exception 'La nuova password deve avere almeno 8 caratteri'; end if;
  update auth.users set encrypted_password = extensions.crypt(new_password, extensions.gen_salt('bf')), updated_at = now() where id = uid;
  update recovery set failures = 0, locked_until = null where user_id = uid;
  return true;
end $$;

revoke all on function public.set_recovery(text, text) from public, anon;
revoke all on function public.has_recovery() from public, anon;
revoke all on function public.recovery_question(text) from public;
revoke all on function public.reset_password(text, text, text) from public;
grant execute on function public.set_recovery(text, text) to authenticated;
grant execute on function public.has_recovery() to authenticated;
grant execute on function public.recovery_question(text) to anon, authenticated;
grant execute on function public.reset_password(text, text, text) to anon, authenticated;

notify pgrst, 'reload schema';


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
    'places', coalesce((select jsonb_agg(to_jsonb(p) - 'campaign_id') from places p where p.campaign_id = c), '[]'),
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


-- ================================================================ esito
select case when count(*) = 4 then 'Aggiornamento completato: apri /stato sul sito'
            else 'Aggiornamento incompleto: mancano ' || (4 - count(*)) || ' tabelle' end as esito
from information_schema.tables where table_schema = 'public' and table_name in ('places', 'routes', 'visits', 'contributions');
