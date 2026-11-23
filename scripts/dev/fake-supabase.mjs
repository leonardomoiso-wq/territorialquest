// Finto Supabase in memoria per provare l'interfaccia senza database (dati di prova del quartiere Aurora).
// Uso: node scripts/dev/fake-supabase.mjs  poi  NEXT_PUBLIC_TQ_SUPABASE_URL=http://localhost:54321 NEXT_PUBLIC_TQ_SUPABASE_KEY=fake npm run dev
// Password di prova: qualsiasi. Codice di regia: «Aurora 2026!». Non per produzione.
// Finto Supabase minimale per verifiche visive locali.
import http from "node:http";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
const require = createRequire(process.cwd() + "/");
const { latLngToCell } = require("h3-js");

const uid = "11111111-1111-4111-8111-111111111111";
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const token = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub: uid, role: "authenticated", exp: Math.floor(Date.now() / 1000) + 86400, email: "master@tq.test" })}.sig`;
const user = { id: uid, aud: "authenticated", role: "authenticated", email: "master@tq.test", user_metadata: { display_name: "Leonardo" }, app_metadata: {}, created_at: new Date().toISOString() };
const session = { access_token: token, token_type: "bearer", expires_in: 86400, expires_at: Math.floor(Date.now() / 1000) + 86400, refresh_token: "r", user };

const now = Date.now(), iso = (ms) => new Date(now + ms).toISOString(), H = 3600000, D = 24 * H;
const C = "c0000000-0000-4000-8000-000000000001";
const T = ["Borgo Dora", "Aurora Nord", "Lungo Dora"].map((name, i) => ({ id: `t000000${i}-0000-4000-8000-000000000000`, campaign_id: C, name, color: ["#17804f", "#2f6fe0", "#e2578f"][i], created_at: iso(-9 * D) }));
const names = ["Leonardo", "Giulia", "Marco", "Sara", "Ahmed", "Chiara", "Luca", "Elena", "Tommaso", "Noor"];
const db = {
  profiles: names.map((n, i) => ({ id: i ? `u000000${i}-0000-4000-8000-000000000000` : uid, display_name: n })),
  campaigns: [{ id: C, owner_id: uid, name: "Aurora, quartiere creativo", description: "", public_map: true, contributions_open: true, public_intro: "Una ricerca del corso di Innovation Design sul quartiere Aurora: tre mesi di esplorazioni a piedi, dodici team, una sola mappa.", join_code: "AUR7KQ", status: "live", starts_at: iso(-5 * D), ends_at: iso(9 * D), center_lng: 7.688, center_lat: 45.083, zoom: 14.2, rules: {}, created_at: iso(-10 * D) }],
  teams: T,
  areas: [
    { id: "a0000001-0000-4000-8000-000000000000", campaign_id: C, team_id: T[0].id, name: "Borgo Dora", color: "#17804f", opens_at: null, closes_at: null, created_at: iso(-9 * D), geometry: { type: "Polygon", coordinates: [[[7.678, 45.078], [7.69, 45.0775], [7.6915, 45.083], [7.681, 45.0845], [7.678, 45.078]]] } },
    { id: "a0000002-0000-4000-8000-000000000000", campaign_id: C, team_id: T[1].id, name: "Aurora Nord", color: "#2f6fe0", opens_at: null, closes_at: iso(-1 * H), created_at: iso(-9 * D), geometry: { type: "Polygon", coordinates: [[[7.681, 45.0845], [7.6915, 45.083], [7.696, 45.089], [7.685, 45.091], [7.681, 45.0845]]] } },
    { id: "a0000003-0000-4000-8000-000000000000", campaign_id: C, team_id: null, name: "Lungo Dora", color: "#e2578f", opens_at: null, closes_at: null, created_at: iso(-9 * D), geometry: { type: "Polygon", coordinates: [[[7.69, 45.0775], [7.701, 45.079], [7.7, 45.084], [7.6915, 45.083], [7.69, 45.0775]]] } },
  ],
  themes: ["Ambiente fisico", "Flussi di mobilità", "Socialità e movida", "Elementi caratterizzanti", "Servizi ed educazione", "Associazioni e progetti"].map((name, i) => ({ id: `e000000${i}-0000-4000-8000-000000000000`, campaign_id: C, name, color: ["#2E9E6B", "#3B7DD8", "#D9608F", "#E0A021", "#7A63D2", "#D8693B"][i], sort: i + 1 })),
  missions: [
    { id: randomUUID(), campaign_id: C, title: "Apriamo la zona nord", description: "Portiamo almeno un rilievo in 30 celle di Aurora Nord.", kind: "coverage", target: 30, theme_id: null, area_id: "a0000002-0000-4000-8000-000000000000", starts_at: iso(-3 * D), ends_at: iso(4 * D), created_at: iso(-3 * D) },
    { id: randomUUID(), campaign_id: C, title: "Venti conferme tra team", description: "", kind: "exchange", target: 20, theme_id: null, area_id: null, starts_at: iso(-3 * D), ends_at: iso(2 * D), created_at: iso(-3 * D) },
    { id: randomUUID(), campaign_id: C, title: "Le voci del quartiere", description: "Raccogliamo percezioni: come si sta qui?", kind: "observations", target: 25, theme_id: null, area_id: null, starts_at: iso(2 * D), ends_at: iso(8 * D), created_at: iso(-1 * D) },
  ],
  announcements: [{ id: randomUUID(), campaign_id: C, author_id: uid, team_id: null, body: "La zona nord è ancora scoperta: chi può passarci oggi pomeriggio?", created_at: iso(-0.4 * H) }],
  memberships: [], observations: [], walks: [], visits: [], contributions: [
    { id: randomUUID(), campaign_id: C, user_id: 'u0000009-0000-4000-8000-000000000000', display_name: 'Una residente', form: 'idea', title: 'Panchine all\'ombra sul lungofiume', note: 'D\'estate non c\'è un posto per sedersi tra i due ponti.', feeling: null, media_path: null, data: {}, lng: 7.6885, lat: 45.0815, status: 'pending', review_note: null, created_at: iso(-3 * H) },
    { id: randomUUID(), campaign_id: C, user_id: 'u0000008-0000-4000-8000-000000000000', display_name: 'Anonimo', form: 'informazione', title: 'Il mercato del sabato nasce negli anni Settanta', note: 'Lo racconta mia nonna: all\'inizio erano dieci banchi.', feeling: null, media_path: null, data: {}, lng: 7.6858, lat: 45.0832, status: 'approved', review_note: null, created_at: iso(-30 * H) },
  ],
  places: [
    { id: "p0000001-0000-4000-8000-000000000000", campaign_id: C, name: "Ponte Mosca", category: "storico", description: "Il ponte ottocentesco a una sola arcata sulla Dora, tra Borgo Dora e Aurora.", prompt: "Fotografa l'arcata dal lungofiume e conta chi attraversa in cinque minuti.", lng: 7.6843, lat: 45.0808, radius_m: 40, points: 40, images: [], survey: [
      { id: "q1", type: "foto", label: "Un dettaglio che racconta l'epoca del ponte" },
      { id: "q2", type: "scala", label: "Stato di conservazione", low: "In rovina", high: "Ottimo" },
      { id: "q3", type: "multipla", label: "Materiali prevalenti", options: ["Pietra", "Mattone", "Ferro", "Cemento"] },
      { id: "q4", type: "conteggio", label: "Persone che attraversano in 5 minuti" },
      { id: "q5", type: "sino", label: "C'è un'indicazione che ne spieghi la storia?" },
    ], created_at: iso(-2 * D) },
    { id: "p0000002-0000-4000-8000-000000000000", campaign_id: C, name: "Giardino della Dora", category: "naturalistico", description: "Ansa del fiume con alberature e accesso all'acqua.", prompt: "Che suoni senti? Registra una percezione.", lng: 7.6925, lat: 45.0812, radius_m: 50, points: 30, images: [], created_at: iso(-2 * D) },
    { id: "p0000003-0000-4000-8000-000000000000", campaign_id: C, name: "Ex fabbrica Superga", category: "culturale", description: "Complesso industriale riconvertito.", prompt: "Chi usa oggi questi spazi?", lng: 7.6880, lat: 45.0865, radius_m: 40, points: 30, images: [], created_at: iso(-2 * D) },
  ],
  routes: [{ id: "r0000001-0000-4000-8000-000000000000", campaign_id: C, name: "Dai ponti ai giardini", description: "Lungo la Dora, tre tappe.", color: "#e8a81c",
    stops: ["p0000001-0000-4000-8000-000000000000", "p0000003-0000-4000-8000-000000000000", "p0000002-0000-4000-8000-000000000000"], created_at: iso(-2 * D) }],
};
const roles = ["esploratore", "verificatore", "cartografo", "narratore"];
db.profiles.forEach((p, i) => db.memberships.push({ id: randomUUID(), campaign_id: C, user_id: p.id, team_id: i === 0 ? null : i === 9 ? null : T[(i - 1) % 3].id, role: i === 0 ? "master" : "player", field_role: i ? roles[i % 4] : null, status: i === 7 ? "suspended" : "active", joined_at: iso(-8 * D), last_seen_at: i % 3 === 1 ? iso(-40000) : i ? iso(-(i * 7) * H) : null, last_lng: i ? 7.68 + ((i * 37) % 20) / 1000 : null, last_lat: i ? 45.078 + ((i * 53) % 12) / 1000 : null }));
let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const titles = ["Giardino condiviso", "Murale di via Cuneo", "Fermata tram 4", "Officina ciclistica", "Mercato del sabato", "Ex fabbrica riconvertita", "Pista ciclabile lungo Dora", "Biblioteca di quartiere", "Cortile con orti", "Bar storico", "Studio di ceramica", "Passerella pedonale", "Scuola primaria", "Spazio di coworking"];
for (let i = 0; i < 140; i++) {
  const cl = [[7.684, 45.081], [7.688, 45.086], [7.695, 45.0805], [7.681, 45.0795]][i % 4];
  const lng = cl[0] + (rnd() - 0.5) * 0.008, lat = cl[1] + (rnd() - 0.5) * 0.005;
  const m = db.memberships[1 + (i % 8)], kind = ["field", "field", "desk", "feel"][i % 4];
  const st = rnd() < 0.62 ? "validated" : rnd() < 0.9 ? "pending" : "flagged";
  const other = db.memberships.find((x) => x.team_id && x.team_id !== m.team_id);
  db.observations.push({ id: randomUUID(), campaign_id: C, author_id: m.user_id, team_id: m.team_id, area_id: null, theme_id: db.themes[i % 6].id, kind, title: titles[i % titles.length], note: i % 3 ? "Molto frequentato nel tardo pomeriggio, soprattutto da famiglie." : "", feeling: kind === "feel" ? ["Accogliente", "Vivace", "Trascurato"][i % 3] : null, source_url: kind === "desk" ? "https://example.org/dati" : null, media_path: null, lng, lat, cell: latLngToCell(lat, lng, 10), status: st, quality: st === "validated" ? 1 + (i % 3) : null, validated_by: st === "validated" ? (i % 5 ? other.user_id : uid) : null, validated_at: st === "validated" ? iso(-i * H) : null, created_at: iso(-(i * 0.6 + 0.1) * H) });
}
db.observations.sort((a, b) => b.created_at.localeCompare(a.created_at));

const norm = (x) => x.trim().replace(/\s+/g, " ").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const send = (res, code, body) => { res.writeHead(code, { "content-type": "application/json", "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*", "access-control-expose-headers": "*" }); res.end(body === undefined ? "" : JSON.stringify(body)); };
http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") return send(res, 204);
  const url = new URL(req.url, "http://x"); const p = url.pathname;
  if (p.startsWith("/storage/v1/object/")) { for await (const _ of req) {} return send(res, 200, { Key: p.slice(19) }); }
  let raw = ""; for await (const c of req) raw += c; const body = raw ? JSON.parse(raw) : null;
  if (p === "/auth/v1/token") { if (db.password && body?.password !== db.password) return send(res, 400, { error: "invalid_grant", error_description: "Invalid login credentials", message: "Invalid login credentials" }); return send(res, 200, session); }
  if (p === "/auth/v1/signup") return send(res, 200, session);
  if (p === "/auth/v1/user") return req.headers.authorization?.includes(token) ? send(res, 200, user) : send(res, 401, { message: "no" });
  if (p === "/auth/v1/logout") return send(res, 204);
  if (p.startsWith("/rest/v1/rpc/")) {
    const fn = p.split("/").pop();
    if (fn === "validate_observation") { const o = db.observations.find((x) => x.id === body.obs); Object.assign(o, { status: body.new_status, quality: body.new_status === "validated" ? body.q : null, validated_by: uid }); }
    if (fn === "choose_team") Object.assign(db.memberships.find((m) => m.user_id === uid), { team_id: body.t, field_role: body.r });
    if (fn === "join_campaign") return send(res, 200, C);
    if (fn === "public_map") {
      const k = db.campaigns.find((x) => x.id === body.c);
      return send(res, 200, { campaign: k, areas: db.areas, themes: db.themes, teams: db.teams, places: db.places, routes: db.routes,
        observations: db.observations.filter((o) => o.status === "validated").map(({ author_id, ...o }) => o),
        contributions: db.contributions.filter((x) => x.status === "approved").map(({ user_id, status, ...x }) => x),
        stats: { walked_m: 4280, visits: db.visits.length, teams: db.teams.length } });
    }
    if (fn === "is_organizer") return send(res, 200, !!db.organizer);
    if (fn === "claim_organizer") { if (body.code === "Aurora 2026!") { db.organizer = true; return send(res, 200, true); } return send(res, 200, false); }
    if (fn === "has_recovery") return send(res, 200, !!db.recovery);
    if (fn === "set_recovery") { db.recovery = { q: body.question, a: norm(body.answer), fails: 0 }; return send(res, 204); }
    if (fn === "recovery_question") return send(res, 200, body.email.toLowerCase() === "m@tq.test" && db.recovery ? db.recovery.q : null);
    if (fn === "reset_password") {
      if (db.recovery.fails >= 5) return send(res, 400, { code: "P0001", message: "Troppi tentativi: riprova tra 15 minuti" });
      if (norm(body.answer) !== db.recovery.a) { db.recovery.fails++; return send(res, 200, false); }
      db.password = body.new_password; return send(res, 200, true);
    }
    if (fn === "check_in") {
      const pl = db.places.find((x) => x.id === body.p); const R = 6371000, rad = Math.PI / 180;
      const h = Math.sin((pl.lat - body.lat) * rad / 2) ** 2 + Math.cos(body.lat * rad) * Math.cos(pl.lat * rad) * Math.sin((pl.lng - body.lng) * rad / 2) ** 2;
      const d = Math.round(2 * R * Math.asin(Math.sqrt(h)));
      if (d > pl.radius_m + 25) return send(res, 400, { code: "P0001", message: `Sei a ${d} m: avvicinati ancora (raggio ${pl.radius_m})` });
      const me = db.memberships.find((m) => m.user_id === uid); const first = !db.visits.some((v) => v.place_id === pl.id && (v.team_id ?? v.user_id) === (me.team_id ?? uid));
      if (!db.visits.some((v) => v.place_id === pl.id && v.user_id === uid)) db.visits.push({ id: randomUUID(), campaign_id: C, place_id: pl.id, user_id: uid, team_id: me.team_id, distance_m: d, created_at: new Date().toISOString() });
      return send(res, 200, { distance: d, first_for_team: first });
    }
    return send(res, 204);
  }
  if (p.startsWith("/rest/v1/")) {
    const table = p.split("/").pop(); const rows = db[table]; if (!rows) return send(res, 404, { code: "PGRST205", message: "no table" });
    const match = (r) => [...url.searchParams].every(([k, v]) => !v.startsWith("eq.") || String(r[k]) === v.slice(3));
    const object = (req.headers.accept ?? "").includes("vnd.pgrst.object");
    if (req.method === "GET") {
      let out = rows.filter(match); const sel = url.searchParams.get("select") ?? "";
      if (sel.includes("profile:profiles")) out = out.map((r) => ({ ...r, profile: db.profiles.find((x) => x.id === r.user_id) }));
      if (sel.includes("campaign:campaigns")) out = out.map((r) => ({ role: r.role, campaign: db.campaigns.find((x) => x.id === r.campaign_id) }));
      return send(res, 200, object ? out[0] ?? null : out);
    }
    if (req.method === "POST") { const list = (Array.isArray(body) ? body : [body]).map((r) => ({ id: randomUUID(), created_at: new Date().toISOString(), status: table === "observations" ? "pending" : table === "campaigns" ? "draft" : undefined, ...r })); if (table === "campaigns") { list.forEach((c) => { Object.assign(c, { center_lng: 7.6869, center_lat: 45.0703, zoom: 12.5 }); db.memberships.push({ id: randomUUID(), campaign_id: c.id, user_id: uid, team_id: null, role: "master", status: "active", joined_at: c.created_at }); }); } rows.unshift(...list); return send(res, 201, object ? list[0] : list); }
    if (req.method === "PATCH") { const hit = rows.filter(match); hit.forEach((r) => Object.assign(r, body)); return send(res, 200, object ? hit[0] : hit); }
    if (req.method === "DELETE") { db[table] = rows.filter((r) => !match(r)); return send(res, 204); }
  }
  send(res, 404, { message: "not found " + p });
}).listen(54321, () => console.log("fake supabase on 54321"));
