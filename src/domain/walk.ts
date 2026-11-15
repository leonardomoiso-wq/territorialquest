import { cellToLatLng } from "h3-js";

export type LngLat = [number, number];

/** Distanza in metri tra due punti (formula dell'emisenoverso). */
export function metersBetween(a: LngLat, b: LngLat): number {
  const rad = Math.PI / 180, R = 6371000;
  const dLat = (b[1] - a[1]) * rad, dLng = (b[0] - a[0]) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * rad) * Math.cos(b[1] * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Direzione da a verso b, in gradi da nord in senso orario. */
export function bearing(a: LngLat, b: LngLat): number {
  const rad = Math.PI / 180;
  const y = Math.sin((b[0] - a[0]) * rad) * Math.cos(b[1] * rad);
  const x = Math.cos(a[1] * rad) * Math.sin(b[1] * rad) - Math.sin(a[1] * rad) * Math.cos(b[1] * rad) * Math.cos((b[0] - a[0]) * rad);
  return (Math.atan2(y, x) / rad + 360) % 360;
}

const WINDS = ["nord", "nord-est", "est", "sud-est", "sud", "sud-ovest", "ovest", "nord-ovest"];
export const windOf = (deg: number) => WINDS[Math.round(deg / 45) % 8];

/**
 * Un passo GPS conta se è plausibile per chi cammina:
 * scarta il rumore da fermi e i salti dovuti a un segnale impreciso.
 */
export function stepMeters(from: LngLat | null, to: LngLat, accuracy = 0): number {
  if (!from || accuracy > 50) return 0;
  const d = metersBetween(from, to);
  return d >= 4 && d <= 120 ? d : 0;
}

export interface Target {
  cell: string;
  meters: number;
  bearing: number;
}

/** La cella ancora spenta più vicina: dà una direzione a chi cammina. */
export function nearestDark(position: LngLat, territory: Iterable<string>, lit: Set<string>): Target | null {
  let best: Target | null = null;
  for (const cell of territory) {
    if (lit.has(cell)) continue;
    const [lat, lng] = cellToLatLng(cell);
    const meters = metersBetween(position, [lng, lat]);
    if (!best || meters < best.meters) best = { cell, meters, bearing: bearing(position, [lng, lat]) };
  }
  return best;
}

export const formatMeters = (m: number) => (m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(1).replace(".", ",")} km`);

export function formatDuration(ms: number): string {
  const min = Math.max(0, Math.floor(ms / 60000));
  return min < 60 ? `${min} min` : `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, "0")}`;
}
