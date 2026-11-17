// Unisce le migrazioni in supabase/setup.sql, da incollare una volta nell'SQL Editor.
import { readdirSync, readFileSync, writeFileSync } from "node:fs";

const dir = "supabase/migrations";
// Aggiornamento: solo le migrazioni più recenti (dal 18 novembre 2026: accesso di regia).
const UPDATE_FROM = "20261118";
const parts = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()
  .map((f) => `\n-- ================================================================ ${f}\n${readFileSync(`${dir}/${f}`, "utf8")}`);
writeFileSync("supabase/setup.sql", [
  "-- Territorial Quest — installazione completa in un solo file.",
  "-- Supabase → SQL Editor → New query → incolla tutto → Run. Si può rieseguire senza danni.",
  "-- Generato da scripts/build-setup.mjs a partire da supabase/migrations: non modificarlo a mano.",
  ...parts,
  "",
  "-- ================================================================ esito",
  "-- L'ultima riga mostrata dall'SQL Editor dice se l'installazione è completa.",
  "select",
  "  case when count(*) = 18 then 'Territorial Quest installato: apri /stato sul sito'",
  "       else 'Installazione incompleta: mancano ' || (18 - count(*)) || ' tabelle' end as esito,",
  "  string_agg(table_name, ', ' order by table_name) as tabelle",
  "from information_schema.tables",
  "where table_schema = 'public'",
  "  and table_name in ('profiles', 'campaigns', 'teams', 'memberships', 'areas', 'themes', 'missions', 'observations', 'announcements', 'walks', 'places', 'routes', 'visits', 'recovery', 'contributions', 'organizers', 'settings', 'organizer_attempts');",
  "",
].join("\n"));

const update = readdirSync(dir).filter((f) => f.endsWith(".sql") && f >= UPDATE_FROM).sort()
  .map((f) => `\n-- ================================================================ ${f}\n${readFileSync(`${dir}/${f}`, "utf8")}`);
writeFileSync("supabase/update.sql", [
  "-- Territorial Quest — aggiornamento: accesso di regia separato.",
  "-- Per un database già installato. Supabase → SQL Editor → New query → incolla tutto → Run.",
  "-- Poi, in una nuova query, scegli il codice di regia (almeno 8 caratteri):",
  "--   select public.set_organizer_code('la-tua-parola-segreta');",
  "-- Generato da scripts/build-setup.mjs: non modificarlo a mano.",
  ...update,
  "",
  "-- ================================================================ esito",
  "select case when count(*) = 3 then 'Aggiornamento completato. Ora imposta il codice di regia (vedi sopra) e apri /stato'",
  "            else 'Aggiornamento incompleto: mancano ' || (3 - count(*)) || ' tabelle' end as esito",
  "from information_schema.tables where table_schema = 'public' and table_name in ('organizers', 'settings', 'organizer_attempts');",
  "",
].join("\n"));
