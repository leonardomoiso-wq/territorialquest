-- Territorial Quest — installazione completa in un solo file.
-- Supabase → SQL Editor → New query → incolla tutto → Run. Si può rieseguire senza danni.
-- Generato da scripts/build-setup.mjs a partire da supabase/migrations: non modificarlo a mano.

-- ================================================================ 20261114000000_init.sql
-- Territorial Quest — schema iniziale
-- Campagne, team, aree, tempi, missioni, osservazioni, messaggi.
-- Idempotente: si può rieseguire senza errori.

-- ---------------------------------------------------------------- profili
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default 'Senza nome',
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), split_part(new.email, '@', 1), 'Senza nome')
  )
  on conflict (id) do nothing;
  return new;
end $$;

-- Senza «drop»: nei progetti Supabase recenti modificare auth.users può non essere permesso,
-- e un errore qui annullerebbe tutta l'installazione.
do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'on_auth_user_created' and tgrelid = 'auth.users'::regclass) then
    create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();
  end if;
exception when others then
  raise warning 'Collegamento ai nuovi utenti non creato (%): i profili vengono creati al primo accesso.', sqlerrm;
end $$;

-- --------------------------------------------------------------- campagne
create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  description text not null default '',
  join_code text not null unique,
  status text not null default 'draft' check (status in ('draft', 'live', 'paused', 'closed')),
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null default now() + interval '90 days',
  center_lng double precision not null default 7.6869,
  center_lat double precision not null default 45.0703,
  zoom double precision not null default 12.5,
  rules jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  name text not null,
  color text not null default '#1F8A5B',
  created_at timestamptz not null default now()
);

create table if not exists public.memberships (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  team_id uuid references public.teams (id) on delete set null,
  role text not null default 'player' check (role in ('master', 'tutor', 'player')),
  field_role text check (field_role in ('esploratore', 'verificatore', 'cartografo', 'narratore')),
  status text not null default 'active' check (status in ('active', 'suspended')),
  joined_at timestamptz not null default now(),
  last_seen_at timestamptz,
  last_lng double precision,
  last_lat double precision,
  unique (campaign_id, user_id)
);

create table if not exists public.areas (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  team_id uuid references public.teams (id) on delete set null,
  name text not null,
  color text not null default '#1F8A5B',
  geometry jsonb not null, -- GeoJSON Polygon (EPSG:4326)
  opens_at timestamptz,
  closes_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.themes (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  name text not null,
  color text not null default '#1F8A5B',
  sort int not null default 0
);

create table if not exists public.missions (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  title text not null,
  description text not null default '',
  kind text not null default 'observations' check (kind in ('observations', 'coverage', 'validation', 'exchange')),
  target numeric not null default 10,
  theme_id uuid references public.themes (id) on delete set null,
  area_id uuid references public.areas (id) on delete set null,
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null default now() + interval '14 days',
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create table if not exists public.observations (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  team_id uuid references public.teams (id) on delete set null,
  area_id uuid references public.areas (id) on delete set null,
  theme_id uuid references public.themes (id) on delete set null,
  kind text not null check (kind in ('field', 'desk', 'feel')),
  title text not null,
  note text not null default '',
  feeling text,
  source_url text,
  media_path text,
  lng double precision not null,
  lat double precision not null,
  cell text not null default '', -- indice H3 usato per copertura e novità
  status text not null default 'pending' check (status in ('pending', 'validated', 'flagged')),
  quality smallint check (quality between 1 and 3),
  validated_by uuid references public.profiles (id) on delete set null,
  validated_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  team_id uuid references public.teams (id) on delete cascade, -- null = a tutti
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists observations_campaign_idx on public.observations (campaign_id, created_at desc);
create index if not exists memberships_user_idx on public.memberships (user_id);
create index if not exists memberships_campaign_idx on public.memberships (campaign_id);
create index if not exists areas_campaign_idx on public.areas (campaign_id);
create index if not exists teams_campaign_idx on public.teams (campaign_id);
create index if not exists missions_campaign_idx on public.missions (campaign_id);
create index if not exists themes_campaign_idx on public.themes (campaign_id);
create index if not exists announcements_campaign_idx on public.announcements (campaign_id, created_at desc);

-- ------------------------------------------------------ funzioni di ruolo
create or replace function public.is_member(c uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from memberships m where m.campaign_id = c and m.user_id = auth.uid());
$$;

create or replace function public.is_staff(c uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from memberships m
    where m.campaign_id = c and m.user_id = auth.uid() and m.role in ('master', 'tutor')
  );
$$;

-- La raccolta è aperta solo se la campagna è attiva e dentro la finestra temporale.
create or replace function public.can_collect(c uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from campaigns k
    join memberships m on m.campaign_id = k.id and m.user_id = auth.uid()
    where k.id = c
      and m.status = 'active'
      and (m.role in ('master', 'tutor') or (k.status = 'live' and now() between k.starts_at and k.ends_at))
  );
$$;

-- Alla creazione: il creatore diventa master e la campagna riceve i temi di base.
create or replace function public.handle_new_campaign()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into memberships (campaign_id, user_id, role) values (new.id, new.owner_id, 'master')
  on conflict (campaign_id, user_id) do update set role = 'master';
  insert into themes (campaign_id, name, color, sort) values
    (new.id, 'Ambiente fisico', '#2E9E6B', 1),
    (new.id, 'Flussi di mobilità', '#3B7DD8', 2),
    (new.id, 'Socialità e movida', '#D9608F', 3),
    (new.id, 'Elementi caratterizzanti', '#E0A021', 4),
    (new.id, 'Servizi ed educazione', '#7A63D2', 5),
    (new.id, 'Associazioni e progetti', '#D8693B', 6);
  return new;
end $$;

drop trigger if exists on_campaign_created on public.campaigns;
create trigger on_campaign_created
  after insert on public.campaigns
  for each row execute function public.handle_new_campaign();

-- ----------------------------------------------------------------- RPC
-- Ingresso con codice campagna.
create or replace function public.join_campaign(code text)
returns uuid language plpgsql security definer set search_path = public as $$
declare c uuid;
begin
  if auth.uid() is null then raise exception 'Accesso richiesto'; end if;
  select id into c from campaigns where upper(join_code) = upper(trim(code)) and status <> 'closed';
  if c is null then raise exception 'Codice campagna non valido'; end if;
  insert into memberships (campaign_id, user_id, role) values (c, auth.uid(), 'player')
  on conflict (campaign_id, user_id) do nothing;
  return c;
end $$;

-- Il giocatore sceglie team e ruolo sul campo.
create or replace function public.choose_team(c uuid, t uuid, r text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if t is not null and not exists (select 1 from teams where id = t and campaign_id = c) then
    raise exception 'Team non valido';
  end if;
  update memberships set team_id = t, field_role = coalesce(r, field_role)
  where campaign_id = c and user_id = auth.uid();
end $$;

-- Presenza e ultima posizione nota, per il pannello del master.
create or replace function public.heartbeat(c uuid, lng double precision default null, lat double precision default null)
returns void language sql security definer set search_path = public as $$
  update memberships
  set last_seen_at = now(),
      last_lng = coalesce(lng, last_lng),
      last_lat = coalesce(lat, last_lat)
  where campaign_id = c and user_id = auth.uid();
$$;

-- Validazione tra pari: lo staff, oppure un membro di un team diverso dall'autore.
create or replace function public.validate_observation(obs uuid, q smallint, new_status text default 'validated')
returns void language plpgsql security definer set search_path = public as $$
declare o observations; me memberships;
begin
  select * into o from observations where id = obs;
  if o.id is null then raise exception 'Osservazione non trovata'; end if;
  select * into me from memberships where campaign_id = o.campaign_id and user_id = auth.uid();
  if me.id is null or me.status <> 'active' then raise exception 'Non fai parte di questa campagna'; end if;
  if new_status not in ('validated', 'flagged', 'pending') then raise exception 'Stato non valido'; end if;
  if me.role = 'player' then
    if o.author_id = auth.uid() then raise exception 'Non puoi validare una tua osservazione'; end if;
    if o.team_id is not null and o.team_id = me.team_id then
      raise exception 'La validazione spetta a un altro team';
    end if;
  end if;
  update observations
  set status = new_status,
      quality = case when new_status = 'validated' then least(3, greatest(1, q)) else null end,
      validated_by = case when new_status = 'pending' then null else auth.uid() end,
      validated_at = case when new_status = 'pending' then null else now() end
  where id = obs;
end $$;

-- ------------------------------------------------------------------ RLS
alter table public.profiles enable row level security;
alter table public.campaigns enable row level security;
alter table public.teams enable row level security;
alter table public.memberships enable row level security;
alter table public.areas enable row level security;
alter table public.themes enable row level security;
alter table public.missions enable row level security;
alter table public.observations enable row level security;
alter table public.announcements enable row level security;

drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select to authenticated using (true);
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists campaigns_read on public.campaigns;
create policy campaigns_read on public.campaigns for select to authenticated
  using (owner_id = auth.uid() or public.is_member(id));
drop policy if exists campaigns_insert on public.campaigns;
create policy campaigns_insert on public.campaigns for insert to authenticated
  with check (owner_id = auth.uid());
drop policy if exists campaigns_update on public.campaigns;
create policy campaigns_update on public.campaigns for update to authenticated
  using (public.is_staff(id)) with check (public.is_staff(id));
drop policy if exists campaigns_delete on public.campaigns;
create policy campaigns_delete on public.campaigns for delete to authenticated
  using (owner_id = auth.uid());

drop policy if exists memberships_read on public.memberships;
create policy memberships_read on public.memberships for select to authenticated
  using (user_id = auth.uid() or public.is_member(campaign_id));
drop policy if exists memberships_update on public.memberships;
create policy memberships_update on public.memberships for update to authenticated
  using (public.is_staff(campaign_id)) with check (public.is_staff(campaign_id));
drop policy if exists memberships_delete on public.memberships;
create policy memberships_delete on public.memberships for delete to authenticated
  using (public.is_staff(campaign_id) or user_id = auth.uid());

-- Tabelle di configurazione: tutti i membri leggono, lo staff scrive.
do $$
declare t text;
begin
  foreach t in array array['teams', 'areas', 'themes', 'missions', 'announcements'] loop
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

-- Osservazioni: bene comune leggibile da tutta la campagna.
drop policy if exists observations_read on public.observations;
create policy observations_read on public.observations for select to authenticated
  using (public.is_member(campaign_id));
drop policy if exists observations_insert on public.observations;
create policy observations_insert on public.observations for insert to authenticated
  with check (author_id = auth.uid() and status = 'pending' and quality is null and public.can_collect(campaign_id));
drop policy if exists observations_update on public.observations;
create policy observations_update on public.observations for update to authenticated
  using (public.is_staff(campaign_id) or (author_id = auth.uid() and status = 'pending'))
  with check (public.is_staff(campaign_id) or (author_id = auth.uid() and status = 'pending' and quality is null));
drop policy if exists observations_delete on public.observations;
create policy observations_delete on public.observations for delete to authenticated
  using (public.is_staff(campaign_id) or (author_id = auth.uid() and status = 'pending'));

-- -------------------------------------------------------------- permessi
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
revoke all on function public.join_campaign(text) from public, anon;
revoke all on function public.choose_team(uuid, uuid, text) from public, anon;
revoke all on function public.heartbeat(uuid, double precision, double precision) from public, anon;
revoke all on function public.validate_observation(uuid, smallint, text) from public, anon;
grant execute on function public.join_campaign(text) to authenticated;
grant execute on function public.choose_team(uuid, uuid, text) to authenticated;
grant execute on function public.heartbeat(uuid, double precision, double precision) to authenticated;
grant execute on function public.validate_observation(uuid, smallint, text) to authenticated;


-- ================================================================ 20261114000100_platform.sql
-- Territorial Quest — integrazione con i servizi Supabase (Storage e Realtime).
-- Separato dallo schema perché dipende da oggetti gestiti dalla piattaforma.

-- Profili per gli utenti già registrati prima dell'installazione.
insert into public.profiles (id, display_name)
select u.id, coalesce(nullif(u.raw_user_meta_data ->> 'display_name', ''), split_part(u.email, '@', 1), 'Senza nome')
from auth.users u
on conflict (id) do nothing;

-- Media delle osservazioni: lettura pubblica, caricamento per chi ha effettuato l'accesso.
-- In alcuni progetti le tabelle di Storage appartengono a un altro ruolo e queste istruzioni
-- non sono permesse: in quel caso si prosegue e si crea lo spazio dal pannello (vedi README).
do $$
begin
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
exception when others then
  raise warning 'Spazio per le foto non configurato (%): crealo da Storage nel pannello Supabase.', sqlerrm;
end $$;

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
exception when others then
  raise warning 'Tempo reale non attivato (%): l''app si aggiorna comunque ogni 20 secondi.', sqlerrm;
end $$;


-- ================================================================ 20261115000000_model_and_forms.sql
-- Territorial Quest — modello 3D del territorio, sfondi della mappa, forme di raccolta e uscite.
-- Idempotente: si può rieseguire senza errori.

-- Sfondo della mappa per campagna.
alter table public.campaigns add column if not exists basemap text not null default 'mappa';
alter table public.campaigns add column if not exists basemap_url text;
alter table public.campaigns add column if not exists basemap_opacity real not null default 1;
alter table public.campaigns add column if not exists overlay jsonb; -- immagine caricata: { path, coordinates[4], opacity }

-- Modello 3D: ambiente prevalente dell'area e ambiente per singola cella H3.
alter table public.areas add column if not exists environment text not null default 'urbano';
alter table public.areas add column if not exists terrain jsonb not null default '{}'::jsonb;

-- Forme di raccolta: che cosa si registra, con quale lente, e i dati propri di ogni forma.
alter table public.observations add column if not exists form text not null default 'informazione';
alter table public.observations add column if not exists lens text;   -- lente AEIOU
alter table public.observations add column if not exists path jsonb;  -- tracciato di un flusso: [[lng, lat], …]
alter table public.observations add column if not exists data jsonb not null default '{}'::jsonb;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'campaigns_basemap_check') then
    alter table public.campaigns add constraint campaigns_basemap_check check (basemap in ('mappa', 'satellite', 'custom', 'nessuno'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'campaigns_basemap_opacity_check') then
    alter table public.campaigns add constraint campaigns_basemap_opacity_check check (basemap_opacity between 0 and 1);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'observations_form_check') then
    alter table public.observations add constraint observations_form_check
      check (form in ('immagine', 'flusso', 'percezione', 'dato', 'informazione', 'idea'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'observations_lens_check') then
    alter table public.observations add constraint observations_lens_check
      check (lens is null or lens in ('attivita', 'ambiente', 'interazioni', 'oggetti', 'persone'));
  end if;
end $$;

create index if not exists observations_form_idx on public.observations (campaign_id, form);

-- Uscite: una camminata di rilievo. Si salvano le celle attraversate e la distanza,
-- non il tracciato GPS preciso della persona.
create table if not exists public.walks (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  team_id uuid references public.teams (id) on delete set null,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  distance_m integer not null default 0 check (distance_m >= 0),
  cells jsonb not null default '[]'::jsonb -- celle H3 attraversate
);
create index if not exists walks_campaign_idx on public.walks (campaign_id, started_at desc);

alter table public.walks enable row level security;
drop policy if exists walks_read on public.walks;
create policy walks_read on public.walks for select to authenticated using (public.is_member(campaign_id));
drop policy if exists walks_insert on public.walks;
create policy walks_insert on public.walks for insert to authenticated
  with check (user_id = auth.uid() and public.can_collect(campaign_id));
drop policy if exists walks_update on public.walks;
create policy walks_update on public.walks for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists walks_delete on public.walks;
create policy walks_delete on public.walks for delete to authenticated
  using (user_id = auth.uid() or public.is_staff(campaign_id));
grant select, insert, update, delete on public.walks to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'walks') then
    alter publication supabase_realtime add table public.walks;
  end if;
exception when others then
  raise warning 'Tempo reale per le uscite non attivato (%).', sqlerrm;
end $$;

-- Aggiorna subito l'API dopo la modifica dello schema.
notify pgrst, 'reload schema';


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
-- L'ultima riga mostrata dall'SQL Editor dice se l'installazione è completa.
select
  case when count(*) = 19 then 'Territorial Quest installato: apri /stato sul sito'
       else 'Installazione incompleta: mancano ' || (19 - count(*)) || ' tabelle' end as esito,
  string_agg(table_name, ', ' order by table_name) as tabelle
from information_schema.tables
where table_schema = 'public'
  and table_name in ('profiles', 'campaigns', 'teams', 'memberships', 'areas', 'themes', 'missions', 'observations', 'announcements', 'walks', 'places', 'routes', 'visits', 'recovery', 'contributions', 'organizers', 'settings', 'organizer_attempts', 'datasets');
