// Valida lo schema e le regole di accesso su un Postgres in memoria (PGlite),
// simulando auth.users e auth.uid() di Supabase.
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { readFileSync } from "node:fs";

const db = new PGlite({ extensions: { pgcrypto } });
const sql = readFileSync("supabase/migrations/20261114000000_init.sql", "utf8");
await db.exec(`
  create role authenticated nologin; create role anon nologin;
  create schema auth;
  create table auth.users (id uuid primary key default gen_random_uuid(), email text, raw_user_meta_data jsonb default '{}', encrypted_password text, updated_at timestamptz);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('app.uid', true), '')::uuid $$;
  grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;
`);
const forms = readFileSync("supabase/migrations/20261115000000_model_and_forms.sql", "utf8");
const places = readFileSync("supabase/migrations/20261117000000_places_routes.sql", "utf8");
const recovery = readFileSync("supabase/migrations/20261117000100_recovery.sql", "utf8");
const pub = readFileSync("supabase/migrations/20261117000200_public.sql", "utf8");
const orgs = readFileSync("supabase/migrations/20261118000000_organizers.sql", "utf8");
for (let i = 0; i < 2; i++) { await db.exec(sql); await db.exec(forms); await db.exec(places); await db.exec(recovery); await db.exec(pub); await db.exec(orgs); } // due passate: idempotenza

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

await fails("senza regia non si crea una campagna", () => as(master, `insert into campaigns (owner_id, name, join_code) values ($1, 'X', 'XXXXXX')`, [master]));
await fails("codice di regia non ancora impostato", () => as(master, `select claim_organizer('qualsiasi')`));
await fails("l'app non imposta il codice di regia", () => as(master, `select set_organizer_code('codice-segreto')`));
console.log(one(await db.query(`select set_organizer_code('Aurora 2026!') r`)).r);
console.log("codice sbagliato:", one(await as(master, `select claim_organizer('aurora') ok`)).ok);
console.log("codice giusto:", one(await as(master, `select claim_organizer('Aurora 2026!') ok`)).ok, "· regia:", one(await as(master, `select is_organizer() r`)).r);
console.log("giocatore regia:", one(await as(anna, `select is_organizer() r`)).r);
for (let k = 0; k < 5; k++) await as(bruno, `select claim_organizer('tentativo')`);
await fails("bloccato dopo 5 tentativi", () => as(bruno, `select claim_organizer('Aurora 2026!')`));
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
// luoghi, percorsi, arrivi
const place = one(await as(master, `insert into places (campaign_id, name, lng, lat, radius_m, points) values ($1, 'Ponte Mosca', 7.6860, 45.0780, 40, 30) returning id`, [camp])).id;
await fails("un giocatore non crea luoghi", () => as(anna, `insert into places (campaign_id, name, lng, lat) values ($1, 'X', 7, 45)`, [camp]));
await as(master, `insert into routes (campaign_id, name, stops) values ($1, 'Lungo Dora', $2)`, [camp, JSON.stringify([place])]);
await fails("arrivo da lontano", () => as(anna, `select check_in($1, 7.6900, 45.0780)`, [place]));
console.log("arrivo:", one(await as(anna, `select check_in($1, 7.6862, 45.0781) r`, [place])).r);
console.log("stesso team, secondo arrivo:", one(await as(anna, `select check_in($1, 7.6862, 45.0781) r`, [place])).r);
await fails("arrivo inserito a mano", () => as(anna, `insert into visits (campaign_id, place_id, user_id) values ($1, $2, $3)`, [camp, place, anna]));
await as(master, `update campaigns set status = 'paused' where id = $1`, [camp]);
await fails("arrivo a campagna in pausa", () => as(bruno, `select check_in($1, 7.6862, 45.0781)`, [place]));
await as(master, `update campaigns set status = 'live' where id = $1`, [camp]);
console.log("altro team:", one(await as(bruno, `select check_in($1, 7.6860, 45.0780) r`, [place])).r);
await as(master, `update places set survey = '[{"id":"a1","type":"scala","label":"Stato"}]' where id = $1`, [place]);
console.log("indagine sul sito:", one(await as(anna, `insert into observations (campaign_id, author_id, team_id, kind, form, title, lng, lat, place_id, data) values ($1, $2, $3, 'field', 'indagine', 'Indagine', 7.686, 45.078, $4, '{"answers":{"a1":4}}') returning form`, [camp, anna, t1, place])).form);
console.log("rilievo sul luogo:", one(await as(anna, `insert into observations (campaign_id, author_id, team_id, kind, title, lng, lat, place_id) values ($1, $2, $3, 'field', 'Arcata', 7.686, 45.078, $4) returning place_id is not null ok`, [camp, anna, t1, place])).ok);
// recupero con domanda segreta
const asAnon = async (q, params) => { await db.exec(`set role anon; select set_config('app.uid', '', false);`); try { return await db.query(q, params); } finally { await db.exec("reset role"); } };
await db.exec(`grant usage on schema auth to anon; grant execute on function auth.uid() to anon; grant usage on schema extensions to anon, authenticated;`);
console.log("domanda prima:", one(await as(anna, `select has_recovery() h`)).h);
await fails("risposta troppo corta", () => as(anna, `select set_recovery('Il nome del tuo primo animale', 'x')`));
await as(anna, `select set_recovery('Il nome del tuo primo animale', '  Fuffì  Primo ')`);
console.log("domanda dopo:", one(await as(anna, `select has_recovery() h`)).h);
await fails("la tabella non si legge", async () => { await as(anna, `select * from recovery`); });
console.log("domanda per email:", one(await asAnon(`select recovery_question('ANNA@x.it') q`)).q);
console.log("email sconosciuta:", one(await asAnon(`select recovery_question('nessuno@x.it') q`)).q);
console.log("risposta sbagliata:", one(await asAnon(`select reset_password('anna@x.it', 'Micio', 'nuovapassword') ok`)).ok);
console.log("accenti, maiuscole e spazi non contano:", one(await asAnon(`select reset_password('anna@x.it', 'fuffi primo', 'nuovapassword') ok`)).ok);
console.log("password cambiata:", one(await db.query(`select encrypted_password = extensions.crypt('nuovapassword', encrypted_password) ok from auth.users where email = 'anna@x.it'`)).ok);
for (let k = 0; k < 5; k++) await asAnon(`select reset_password('anna@x.it', 'sbagliata', 'altrapassword')`);
await fails("bloccato dopo 5 errori, anche con la risposta giusta", () => asAnon(`select reset_password('anna@x.it', 'fuffi primo', 'altrapassword')`));
await fails("password troppo corta", async () => { await db.exec(`update recovery set locked_until = null, failures = 0`); await asAnon(`select reset_password('anna@x.it', 'fuffi primo', 'corta')`); });
await fails("chi non ha effettuato l'accesso non imposta domande", () => asAnon(`select set_recovery('Domanda qualsiasi', 'risposta')`));
// mappa pubblica e contributi
await db.exec(`grant execute on function public_map(uuid) to anon`);
console.log("mappa privata, da fuori:", one(await asAnon(`select public_map($1) m`, [camp])).m);
await as(master, `update campaigns set contributions_open = true where id = $1`, [camp]);
const half = one(await asAnon(`select public_map($1) m`, [camp])).m;
console.log("solo contributi aperti, da fuori:", !!half, "rilievi visibili:", half.observations.length, "luoghi:", half.places.length);
await as(master, `update campaigns set contributions_open = false where id = $1`, [camp]);
console.log("mappa privata, da membro:", !!one(await as(anna, `select public_map($1) m`, [camp])).m);
const contrib = `insert into contributions (campaign_id, user_id, display_name, form, title, lng, lat) values ($1, $2, 'Una cittadina', 'idea', 'Panchine sul lungofiume', 7.69, 45.07) returning id`;
await fails("contributi chiusi", () => as(outsider, contrib, [camp, outsider]));
await as(master, `update campaigns set public_map = true, contributions_open = true where id = $1`, [camp]);
const cid = one(await as(outsider, contrib, [camp, outsider])).id;
await fails("il contributo non si auto-approva", () => as(outsider, `insert into contributions (campaign_id, user_id, form, title, lng, lat, status) values ($1, $2, 'idea', 'Ciao', 7, 45, 'approved')`, [camp, outsider]));
await fails("un altro non legge il contributo in attesa", async () => { const r = await as(anna, `select id from contributions where id = $1`, [cid]); if (!r.rows.length) throw new Error("0 righe"); });
let pm = one(await asAnon(`select public_map($1) m`, [camp])).m;
console.log("pubblica, prima dell'approvazione:", pm.contributions.length, "contributi,", pm.observations.length, "rilievi validati; nomi presenti:", JSON.stringify(pm).includes("anna@x.it") || "author_id" in (pm.observations[0] ?? {}));
await fails("un giocatore non approva", async () => { const r = await as(anna, `update contributions set status = 'approved' where id = $1 returning id`, [cid]); if (!r.rows.length) throw new Error("0 righe"); });
await as(master, `update contributions set status = 'approved', reviewed_by = $2, reviewed_at = now() where id = $1`, [cid, master]);
pm = one(await asAnon(`select public_map($1) m`, [camp])).m;
console.log("dopo l'approvazione:", pm.contributions.map((x) => x.display_name + ": " + x.title));
console.log("SCHEMA OK");
