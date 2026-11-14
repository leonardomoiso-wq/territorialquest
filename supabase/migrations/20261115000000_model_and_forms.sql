-- Territorial Quest — modello 3D del territorio, sfondi della mappa e forme di raccolta.
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

-- Aggiorna subito l'API dopo la modifica dello schema.
notify pgrst, 'reload schema';
