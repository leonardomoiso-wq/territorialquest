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
