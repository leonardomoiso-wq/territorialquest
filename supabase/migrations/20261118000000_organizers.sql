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
