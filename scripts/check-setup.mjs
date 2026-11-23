// Esegue supabase/setup.sql su un Postgres in memoria SENZA Storage né Realtime:
// deve comunque creare tutte le tabelle e chiudere con l'esito positivo.
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
const db = new PGlite({ extensions: { pgcrypto } });
await db.exec(`
  create role authenticated nologin; create role anon nologin;
  create schema auth;
  create table auth.users (id uuid primary key default gen_random_uuid(), email text, raw_user_meta_data jsonb default '{}', encrypted_password text, updated_at timestamptz);
  insert into auth.users (email) values ('gia-registrato@x.it');
  create function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
`);
const sql = readFileSync("supabase/setup.sql", "utf8");
for (let i = 0; i < 2; i++) {
  const res = await db.exec(sql);
  const last = res[res.length - 1].rows[0];
  console.log(`passata ${i + 1}:`, last.esito, "·", last.tabelle.split(", ").length, "tabelle");
}
console.log("profili creati per utenti esistenti:", (await db.query("select count(*)::int n from public.profiles")).rows[0].n);
