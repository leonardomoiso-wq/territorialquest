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
