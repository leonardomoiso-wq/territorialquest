// Valida lo schema e le regole di accesso su un Postgres in memoria (PGlite),
// simulando auth.users e auth.uid() di Supabase.
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";

const db = new PGlite();
const sql = readFileSync("supabase/migrations/20261114000000_init.sql", "utf8");
await db.exec(`
  create role authenticated nologin; create role anon nologin;
  create schema auth;
  create table auth.users (id uuid primary key default gen_random_uuid(), email text, raw_user_meta_data jsonb default '{}');
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('app.uid', true), '')::uuid $$;
  grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;
`);
const forms = readFileSync("supabase/migrations/20261115000000_model_and_forms.sql", "utf8");
for (let i = 0; i < 2; i++) { await db.exec(sql); await db.exec(forms); } // due passate: idempotenza

const as = async (uid, q, params) => {
  await db.exec(`set role authenticated; select set_config('app.uid', '${uid}', false);`);
  try { return await db.query(q, params); } finally { await db.exec("reset role"); }
};
const fails = async (label, fn) => {
  try { await fn(); } catch (e) { console.log("  ok, bloccato:", label, "→", e.message); return; }
  throw new Error("Doveva fallire: " + label);
};
const one = (r) => r.rows[0];

const [master, anna, bruno, outsider] = (await db.query(
  `insert into auth.users (email) values ('master@x.it'), ('anna@x.it'), ('bruno@x.it'), ('fuori@x.it') returning id`
)).rows.map((r) => r.id);

const camp = one(await as(master, `insert into campaigns (owner_id, name, join_code, status) values ($1, 'Aurora', 'AURORA', 'live') returning id`, [master])).id;
console.log("campagna creata; temi:", one(await as(master, `select count(*)::int n from themes where campaign_id = $1`, [camp])).n);
const [t1, t2] = (await as(master, `insert into teams (campaign_id, name) values ($1, 'Uno'), ($1, 'Due') returning id`, [camp])).rows.map((r) => r.id);

await fails("campagna non visibile agli esterni", async () => {
  const r = await as(outsider, `select * from campaigns`); if (r.rows.length === 0) throw new Error("0 righe"); });
await fails("codice errato", () => as(anna, `select join_campaign('NOPE')`));
await as(anna, `select join_campaign('aurora')`); await as(bruno, `select join_campaign('AURORA')`);
await as(anna, `select choose_team($1, $2, 'esploratore')`, [camp, t1]);
await as(bruno, `select choose_team($1, $2, 'verificatore')`, [camp, t2]);
await fails("un giocatore non crea team", () => as(anna, `insert into teams (campaign_id, name) values ($1, 'X')`, [camp]));
await fails("un giocatore non si promuove", async () => {
  const r = await as(anna, `update memberships set role = 'master' where user_id = $1 returning id`, [anna]); if (!r.rows.length) throw new Error("0 righe"); });

const ins = `insert into observations (campaign_id, author_id, team_id, kind, title, lng, lat) values ($1, $2, $3, 'field', 'Parco', 7.68, 45.07) returning id`;
const obs = one(await as(anna, ins, [camp, anna, t1])).id;
await fails("esterno non inserisce", () => as(outsider, ins, [camp, outsider, null]));
await fails("non ci si auto-valida", () => as(anna, `select validate_observation($1, 3::smallint)`, [obs]));
await as(bruno, `select validate_observation($1, 3::smallint)`, [obs]);
console.log("validata da un altro team:", one(await as(anna, `select status, quality from observations where id = $1`, [obs])));
await fails("dopo la validazione l'autore non modifica", async () => {
  const r = await as(anna, `update observations set title = 'x' where id = $1 returning id`, [obs]); if (!r.rows.length) throw new Error("0 righe"); });

await as(master, `update campaigns set status = 'paused' where id = $1`, [camp]);
await fails("in pausa la raccolta è chiusa", () => as(anna, ins, [camp, anna, t1]));
await as(master, `update campaigns set status = 'live', starts_at = now() - interval '9 days', ends_at = now() - interval '1 day' where id = $1`, [camp]);
await fails("fuori dalla finestra temporale", () => as(anna, ins, [camp, anna, t1]));
await as(master, ins, [camp, master, null]);
await as(anna, `select heartbeat($1, 7.68, 45.07)`, [camp]);
console.log("presenza:", one(await as(master, `select last_lng, last_seen_at is not null seen from memberships where user_id = $1`, [anna])));
const flow = one(await as(master, `insert into observations (campaign_id, author_id, kind, form, lens, title, lng, lat, path, data) values ($1, $2, 'field', 'flusso', 'persone', 'Uscita dalla scuola', 7.68, 45.07, '[[7.68,45.07],[7.681,45.071]]', '{"mode":"piedi","intensity":4}') returning form, data`, [camp, master]));
console.log("flusso:", flow.form, flow.data);
await fails("forma non prevista", () => as(master, `insert into observations (campaign_id, author_id, kind, form, title, lng, lat) values ($1, $2, 'field', 'altro', 'x', 7.68, 45.07)`, [camp, master]));
await as(master, `update areas set environment = 'verde', terrain = '{"8a1f9a5a0007fff":"acqua"}' where campaign_id = $1`, [camp]);
await as(master, `update campaigns set basemap = 'satellite', basemap_opacity = 0.4 where id = $1`, [camp]);
await as(master, `update campaigns set status = 'live', starts_at = now() - interval '1 day', ends_at = now() + interval '1 day' where id = $1`, [camp]);
const walk = one(await as(anna, `insert into walks (campaign_id, user_id, team_id) values ($1, $2, $3) returning id`, [camp, anna, t1])).id;
await as(anna, `update walks set distance_m = 420, cells = '["8a1f9a5a0007fff"]', ended_at = now() where id = $1`, [walk]);
await fails("non si modifica l'uscita di un altro", async () => {
  const r = await as(bruno, `update walks set distance_m = 9 where id = $1 returning id`, [walk]); if (!r.rows.length) throw new Error("0 righe"); });
await fails("non si apre un'uscita a nome di un altro", () => as(bruno, `insert into walks (campaign_id, user_id) values ($1, $2)`, [camp, anna]));
console.log("uscite visibili al team:", one(await as(bruno, `select count(*)::int n from walks where campaign_id = $1`, [camp])).n);
console.log("SCHEMA OK");
