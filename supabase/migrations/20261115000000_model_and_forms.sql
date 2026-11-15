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
end $$;

-- Aggiorna subito l'API dopo la modifica dello schema.
notify pgrst, 'reload schema';
