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
