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
].join("\n"));
