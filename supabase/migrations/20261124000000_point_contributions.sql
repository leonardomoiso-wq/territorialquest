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
