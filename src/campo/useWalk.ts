"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cellOf } from "@/domain/geo";
import { stepMeters, type LngLat } from "@/domain/walk";
import { startWalk, updateWalk } from "@/lib/data";

/** Stato di un'uscita in corso. */
export interface ActiveWalk {
  /** Assente se l'uscita vive solo sul dispositivo (senza rete o tabella non pronta). */
  id: string | null;
  startedAt: string;
  cells: string[];
  /** Celle che nessuno aveva ancora acceso prima di questa uscita. */
  fresh: string[];
  meters: number;
}

const key = (campaignId: string) => `tq-walk-${campaignId}`;
const vibrate = (pattern: number | number[]) => { try { navigator.vibrate?.(pattern); } catch { /* non supportato */ } };

/**
 * L'uscita: conta i passi plausibili, accende le celle attraversate e
 * salva periodicamente. Sopravvive al ricaricamento della pagina.
 */
export function useWalk(campaignId: string, userId: string | undefined, teamId: string | null, lit: Set<string>, onLit?: (cell: string) => void) {
  const [walk, setWalk] = useState<ActiveWalk | null>(null);
  const onLitRef = useRef(onLit);
  const last = useRef<LngLat | null>(null);
  const litRef = useRef(lit);
  const dirty = useRef(false);
  const walkRef = useRef<ActiveWalk | null>(null);

  useEffect(() => { litRef.current = lit; onLitRef.current = onLit; }, [lit, onLit]);
  useEffect(() => { walkRef.current = walk; }, [walk]);

  // riprende un'uscita lasciata aperta
  useEffect(() => {
    try {
      const saved = localStorage.getItem(key(campaignId));
      if (saved) setTimeout(() => setWalk(JSON.parse(saved) as ActiveWalk), 0);
    } catch { /* memoria locale non disponibile */ }
  }, [campaignId]);

  const persist = useCallback((w: ActiveWalk | null) => {
    try {
      if (w) localStorage.setItem(key(campaignId), JSON.stringify(w));
      else localStorage.removeItem(key(campaignId));
    } catch { /* memoria locale non disponibile */ }
  }, [campaignId]);

  const start = useCallback(async () => {
    if (!userId) return;
    let id: string | null = null;
    try { id = (await startWalk(campaignId, userId, teamId)).id; } catch { /* si prosegue in locale */ }
    const w: ActiveWalk = { id, startedAt: new Date().toISOString(), cells: [], fresh: [], meters: 0 };
    last.current = null;
    setWalk(w);
    persist(w);
    vibrate(40);
  }, [campaignId, userId, teamId, persist]);

  /** Da chiamare a ogni nuova posizione GPS. */
  const track = useCallback((p: LngLat, accuracy: number) => {
    const w = walkRef.current;
    if (!w || accuracy > 50) return;
    const step = stepMeters(last.current, p, accuracy);
    if (step || !last.current) last.current = p;
    const cell = cellOf(p[0], p[1]);
    const isNew = !w.cells.includes(cell);
    if (!step && !isNew) return;
    const fresh = isNew && !litRef.current.has(cell);
    const next: ActiveWalk = {
      ...w, meters: w.meters + step,
      cells: isNew ? [...w.cells, cell] : w.cells,
      fresh: fresh ? [...w.fresh, cell] : w.fresh,
    };
    walkRef.current = next;
    dirty.current = true;
    setWalk(next);
    persist(next);
    if (fresh) {
      vibrate(25);
      onLitRef.current?.(cell);
    }
  }, [persist]);

  // salvataggio periodico sul server
  useEffect(() => {
    if (!walk) return;
    const t = setInterval(() => {
      const w = walkRef.current;
      if (!w?.id || !dirty.current) return;
      dirty.current = false;
      updateWalk(w.id, { distance_m: Math.round(w.meters), cells: w.cells }).catch(() => { dirty.current = true; });
    }, 20000);
    return () => clearInterval(t);
  }, [walk?.id, walk]);

  // lo schermo resta acceso mentre si cammina
  useEffect(() => {
    if (!walk) return;
    let lock: WakeLockSentinel | null = null;
    const request = () => navigator.wakeLock?.request("screen").then((l) => { lock = l; }, () => undefined);
    const onVisible = () => document.visibilityState === "visible" && request();
    request();
    document.addEventListener("visibilitychange", onVisible);
    return () => { document.removeEventListener("visibilitychange", onVisible); lock?.release().catch(() => undefined); };
  }, [walk?.startedAt, walk]);

  const stop = useCallback(async (): Promise<ActiveWalk | null> => {
    const w = walkRef.current;
    if (!w) return null;
    if (w.id) await updateWalk(w.id, { distance_m: Math.round(w.meters), cells: w.cells, ended_at: new Date().toISOString() }).catch(() => undefined);
    walkRef.current = null;
    setWalk(null);
    persist(null);
    vibrate([30, 60, 30]);
    return w;
  }, [persist]);

  return { walk, start, stop, track };
}

export { vibrate };
