// Unisce le migrazioni in supabase/setup.sql, da incollare una volta nell'SQL Editor.
import { readdirSync, readFileSync, writeFileSync } from "node:fs";

const dir = "supabase/migrations";
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
  "  case when count(*) = 14 then 'Territorial Quest installato: apri /stato sul sito'",
  "       else 'Installazione incompleta: mancano ' || (14 - count(*)) || ' tabelle' end as esito,",
  "  string_agg(table_name, ', ' order by table_name) as tabelle",
  "from information_schema.tables",
  "where table_schema = 'public'",
  "  and table_name in ('profiles', 'campaigns', 'teams', 'memberships', 'areas', 'themes', 'missions', 'observations', 'announcements', 'walks', 'places', 'routes', 'visits', 'recovery');",
  "",
].join("\n"));
