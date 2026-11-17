// Unisce le migrazioni in supabase/setup.sql, da incollare una volta nell'SQL Editor.
import { readdirSync, readFileSync, writeFileSync } from "node:fs";

const dir = "supabase/migrations";
// Aggiornamento: solo le migrazioni dal 17 novembre 2026 (luoghi, recupero password, mappa pubblica).
const UPDATE_FROM = "20261117";
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
  "  case when count(*) = 15 then 'Territorial Quest installato: apri /stato sul sito'",
  "       else 'Installazione incompleta: mancano ' || (15 - count(*)) || ' tabelle' end as esito,",
  "  string_agg(table_name, ', ' order by table_name) as tabelle",
  "from information_schema.tables",
  "where table_schema = 'public'",
  "  and table_name in ('profiles', 'campaigns', 'teams', 'memberships', 'areas', 'themes', 'missions', 'observations', 'announcements', 'walks', 'places', 'routes', 'visits', 'recovery', 'contributions');",
  "",
].join("\n"));

const update = readdirSync(dir).filter((f) => f.endsWith(".sql") && f >= UPDATE_FROM).sort()
  .map((f) => `\n-- ================================================================ ${f}\n${readFileSync(`${dir}/${f}`, "utf8")}`);
writeFileSync("supabase/update.sql", [
  "-- Territorial Quest — aggiornamento: luoghi e percorsi, indagini sul sito, recupero password, mappa pubblica.",
  "-- Per un database già installato. Supabase → SQL Editor → New query → incolla tutto → Run.",
  "-- Generato da scripts/build-setup.mjs: non modificarlo a mano.",
  ...update,
  "",
  "-- ================================================================ esito",
  "select case when count(*) = 4 then 'Aggiornamento completato: apri /stato sul sito'",
  "            else 'Aggiornamento incompleto: mancano ' || (4 - count(*)) || ' tabelle' end as esito",
  "from information_schema.tables where table_schema = 'public' and table_name in ('places', 'routes', 'visits', 'contributions');",
  "",
].join("\n"));
