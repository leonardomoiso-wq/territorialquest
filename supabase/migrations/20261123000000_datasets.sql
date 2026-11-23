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
