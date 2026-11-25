"use client";

import { useEffect } from "react";

/** Registra il service worker solo nella versione pubblicata (in sviluppo interferirebbe con gli aggiornamenti). */
export default function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => undefined);
  }, []);
  return null;
}
