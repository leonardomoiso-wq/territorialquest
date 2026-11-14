import type { Area, Campaign } from "./types";

export type Phase = "draft" | "upcoming" | "live" | "paused" | "ended";

/** Fase effettiva della campagna: unisce lo stato deciso dal master e le date. */
export function phaseOf(c: Pick<Campaign, "status" | "starts_at" | "ends_at">, now = new Date()): Phase {
  if (c.status === "draft") return "draft";
  if (c.status === "closed") return "ended";
  if (c.status === "paused") return "paused";
  const t = now.getTime();
  if (t < new Date(c.starts_at).getTime()) return "upcoming";
  if (t > new Date(c.ends_at).getTime()) return "ended";
  return "live";
}

export const PHASE_LABEL: Record<Phase, string> = {
  draft: "Bozza",
  upcoming: "In partenza",
  live: "In corso",
  paused: "In pausa",
  ended: "Conclusa",
};

export function areaOpen(a: Pick<Area, "opens_at" | "closes_at">, now = new Date()): boolean {
  const t = now.getTime();
  if (a.opens_at && t < new Date(a.opens_at).getTime()) return false;
  if (a.closes_at && t > new Date(a.closes_at).getTime()) return false;
  return true;
}

/** Avanzamento 0–1 tra due istanti. */
export function progressBetween(from: string, to: string, now = new Date()): number {
  const a = new Date(from).getTime(), b = new Date(to).getTime();
  if (b <= a) return 1;
  return Math.max(0, Math.min(1, (now.getTime() - a) / (b - a)));
}

export function remaining(to: string, now = new Date()): string {
  const ms = new Date(to).getTime() - now.getTime();
  if (ms <= 0) return "terminato";
  const min = Math.floor(ms / 60000);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 48) return `${h} h ${min % 60} min`;
  return `${Math.floor(h / 24)} giorni`;
}

export function ago(iso: string | null, now = new Date()): string {
  if (!iso) return "mai";
  const s = Math.max(0, Math.floor((now.getTime() - new Date(iso).getTime()) / 1000));
  if (s < 60) return "adesso";
  if (s < 3600) return `${Math.floor(s / 60)} min fa`;
  if (s < 86400) return `${Math.floor(s / 3600)} h fa`;
  return `${Math.floor(s / 86400)} g fa`;
}

/** Presente sul campo: ha dato segnale negli ultimi tre minuti. */
export const isOnline = (iso: string | null, now = new Date()) =>
  !!iso && now.getTime() - new Date(iso).getTime() < 180000;

const pad = (n: number) => String(n).padStart(2, "0");
/** ISO → valore per <input type="datetime-local"> nel fuso locale. */
export function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
export const fromLocalInput = (v: string): string | null => (v ? new Date(v).toISOString() : null);

export const formatDate = (iso: string) =>
  new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
