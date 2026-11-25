// Territorial Quest: service worker essenziale.
// Pagine: prima la rete, poi l'ultima copia salvata, poi la pagina «Senza rete».
// File statici di Next e della mappa: dalla memoria, aggiornati in background.
// Non tocca mai Supabase né le tessere della mappa (dati sempre freschi, nessun dato personale in memoria).
const VERSION = "tq-v1";
const OFFLINE = "/offline";

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll([OFFLINE, "/icon-192.png"])).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); }
          return res;
        })
        .catch(async () => (await caches.match(req)) || (await caches.match(OFFLINE)) || Response.error()),
    );
    return;
  }

  const isStatic = url.pathname.startsWith("/_next/static/") || /\.(?:png|svg|ico|woff2?|mjs)$/.test(url.pathname);
  if (!isStatic) return;
  e.respondWith(
    caches.open(VERSION).then(async (c) => {
      const hit = await c.match(req);
      const net = fetch(req).then((res) => { if (res.ok) c.put(req, res.clone()); return res; }).catch(() => hit);
      return hit || net;
    }),
  );
});
