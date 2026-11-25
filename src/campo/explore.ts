"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { SKY } from "@/domain/palette";

/** Qualità della vista esplora: automatica misura il telefono e decide. */
export type Quality = "auto" | "ricca" | "essenziale";
export const QUALITY_LABEL: Record<Quality, string> = { auto: "Automatica", ricca: "Ricca", essenziale: "Essenziale" };

const read = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const write = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* memoria non disponibile */ } };

/** Preferenze della vista: esplora o piatta, qualità grafica. Restano sul dispositivo. */
export function useViewPrefs() {
  const [explore, setExploreState] = useState(() => typeof window === "undefined" ? true : read("tq-explore") !== "0");
  const [quality, setQualityState] = useState<Quality>(() => (typeof window === "undefined" ? "auto" : (read("tq-quality") as Quality | null)) ?? "auto");
  const setExplore = useCallback((v: boolean) => { setExploreState(v); write("tq-explore", v ? "1" : "0"); }, []);
  const setQuality = useCallback((v: Quality) => { setQualityState(v); write("tq-quality", v); }, []);
  return { explore, setExplore, quality, setQuality };
}

/** Il telefono chiede meno movimento: niente animazioni, solo cambi di stato. */
export function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const q = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!q) return;
    const on = () => setReduced(q.matches);
    on();
    q.addEventListener("change", on);
    return () => q.removeEventListener("change", on);
  }, []);
  return reduced;
}

/**
 * Misura i fotogrammi al secondo per qualche istante dopo l'apertura della vista:
 * sotto i 30 la vista si alleggerisce da sola (niente rilievo, niente cielo).
 */
export function useAutoQuality(active: boolean) {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (!active || slow) return;
    let frames = 0, raf = 0, startAt = 0;
    const wait = setTimeout(() => {
      const tick = (t: number) => {
        if (!startAt) startAt = t;
        frames++;
        if (t - startAt < 3000) raf = requestAnimationFrame(tick);
        else if ((frames * 1000) / (t - startAt) < 30 && document.visibilityState === "visible") setSlow(true);
      };
      raf = requestAnimationFrame(tick);
    }, 2500);
    return () => { clearTimeout(wait); cancelAnimationFrame(raf); };
  }, [active, slow]);
  return slow;
}

type OrientationEvent = DeviceOrientationEvent & { webkitCompassHeading?: number };
type PermissionApi = { requestPermission?: () => Promise<"granted" | "denied"> };

/**
 * Bussola del telefono: direzione in gradi da nord (0–360), oppure null.
 * Su iPhone serve un tocco per autorizzarla: lo si chiede con enable().
 * Aggiorna al massimo 5 volte al secondo e ignora scarti sotto i 4°.
 */
export function useHeading(active: boolean) {
  const [heading, setHeading] = useState<number | null>(null);
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const last = useRef({ h: -999, t: 0 });

  const enable = useCallback(async () => {
    const api = (typeof DeviceOrientationEvent !== "undefined" ? DeviceOrientationEvent : undefined) as unknown as PermissionApi | undefined;
    if (!api) { setAllowed(false); return false; }
    if (typeof api.requestPermission === "function") {
      try { const r = await api.requestPermission(); setAllowed(r === "granted"); return r === "granted"; } catch { setAllowed(false); return false; }
    }
    setAllowed(true);
    return true;
  }, []);

  useEffect(() => {
    if (!active || !allowed) return;
    const absolute = "ondeviceorientationabsolute" in window;
    const on = (e: Event) => {
      const o = e as OrientationEvent;
      let h: number | null = null;
      if (typeof o.webkitCompassHeading === "number") h = o.webkitCompassHeading;
      else if (o.alpha != null && (o.absolute || absolute)) h = (360 - o.alpha) % 360;
      if (h == null) return;
      h = (h + (screen.orientation?.angle ?? 0)) % 360;
      const now = performance.now();
      const diff = Math.abs(((h - last.current.h + 540) % 360) - 180);
      if (diff < 4 || now - last.current.t < 200) return;
      last.current = { h, t: now };
      setHeading(Math.round(h));
    };
    const type = absolute ? "deviceorientationabsolute" : "deviceorientation";
    window.addEventListener(type, on);
    return () => window.removeEventListener(type, on);
  }, [active, allowed]);

  return { heading: active && allowed ? heading : null, allowed, enable };
}

/** Tiene lo schermo acceso durante l'uscita (dove il browser lo permette). */
export function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    type Sentinel = { release: () => Promise<void> };
    const nav = navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<Sentinel> } };
    if (!nav.wakeLock) return;
    let lock: Sentinel | null = null, stopped = false;
    const ask = () => { if (document.visibilityState === "visible") nav.wakeLock!.request("screen").then((l) => { if (stopped) l.release(); else lock = l; }, () => undefined); };
    ask();
    document.addEventListener("visibilitychange", ask);
    return () => { stopped = true; document.removeEventListener("visibilitychange", ask); lock?.release().catch(() => undefined); };
  }, [active]);
}

/** Colori del cielo secondo l'ora: alba, giorno, tramonto, sera. */
export function skyAt(date: Date) {
  const h = date.getHours() + date.getMinutes() / 60;
  if (h >= 6 && h < 8.5) return SKY.alba;
  if (h >= 8.5 && h < 17.5) return SKY.giorno;
  if (h >= 17.5 && h < 20.5) return SKY.tramonto;
  return SKY.sera;
}
