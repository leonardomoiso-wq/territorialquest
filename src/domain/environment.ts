import { cellToLatLng } from "h3-js";
import { cellsOf } from "./geo";
import type { Area } from "./types";

/** Ambienti geografici con cui si costruisce il modello 3D del territorio. */
export type Environment = "urbano" | "verde" | "acqua" | "rilievo" | "rurale" | "costa" | "industriale";

export interface EnvironmentSpec {
  id: Environment;
  label: string;
  hint: string;
  /** Colore pieno: cella esplorata, pennello, legenda. */
  color: string;
  /** Tinta spenta: cella non ancora esplorata. */
  tint: string;
  /** Altezza minima in metri. */
  base: number;
  /** Escursione in metri sopra la base. */
  vary: number;
  /** 0 = altezze a blocchi (edifici), 1 = altezze continue (rilievo). */
  smooth: number;
}

export const ENVIRONMENTS: EnvironmentSpec[] = [
  { id: "urbano", label: "Urbano", hint: "Isolati, strade, edifici", color: "#d2704a", tint: "#d6d5d0", base: 10, vary: 46, smooth: 0.15 },
  { id: "verde", label: "Verde", hint: "Parchi, boschi, giardini", color: "#2e9e6b", tint: "#cfdccf", base: 4, vary: 12, smooth: 0.6 },
  { id: "acqua", label: "Acqua", hint: "Fiumi, laghi, canali", color: "#3b8fd8", tint: "#c8d7e2", base: 1, vary: 0, smooth: 1 },
  { id: "rilievo", label: "Rilievo", hint: "Colline e montagne", color: "#7d6b57", tint: "#d9d2c6", base: 30, vary: 190, smooth: 1 },
  { id: "rurale", label: "Rurale", hint: "Campi e coltivi", color: "#c2b23e", tint: "#dedcc4", base: 3, vary: 5, smooth: 0.7 },
  { id: "costa", label: "Costa", hint: "Spiagge, rive, greti", color: "#e3c47a", tint: "#e6dfcb", base: 2, vary: 3, smooth: 0.8 },
  { id: "industriale", label: "Industriale", hint: "Capannoni, scali, aree produttive", color: "#6f6a8c", tint: "#cfced6", base: 9, vary: 16, smooth: 0.3 },
];

const BY_ID = new Map(ENVIRONMENTS.map((e) => [e.id, e]));
export const environmentOf = (id: string | null | undefined): EnvironmentSpec => BY_ID.get(id as Environment) ?? ENVIRONMENTS[0];

/** Numero stabile 0–1 ricavato dall'identificativo della cella. */
function hash(cell: string): number {
  let h = 2166136261;
  for (let i = 0; i < cell.length; i++) h = Math.imul(h ^ cell.charCodeAt(i), 16777619);
  return ((h >>> 0) % 10000) / 10000;
}

/** Ondulazione continua 0–1: celle vicine hanno valori simili. */
function wave(lat: number, lng: number): number {
  const v = Math.sin(lat * 900) + Math.cos(lng * 700) + Math.sin((lat + lng) * 420);
  return (v + 3) / 6;
}

/** Altezza in metri di una cella del modello. */
export function cellHeight(env: EnvironmentSpec, cell: string): number {
  if (!env.vary) return env.base;
  const [lat, lng] = cellToLatLng(cell);
  const mix = wave(lat, lng) * env.smooth + hash(cell) * (1 - env.smooth);
  return Math.round(env.base + mix * env.vary);
}

export interface ModelCell {
  cell: string;
  areaId: string;
  environment: Environment;
}

/** Celle del modello: ogni area contribuisce le proprie, con l'ambiente dipinto o quello prevalente. */
export function modelCells(areas: Pick<Area, "id" | "geometry" | "environment" | "terrain">[], res = 10): ModelCell[] {
  const seen = new Set<string>();
  const out: ModelCell[] = [];
  for (const a of areas) {
    for (const cell of cellsOf(a.geometry, res)) {
      if (seen.has(cell)) continue;
      seen.add(cell);
      out.push({ cell, areaId: a.id, environment: environmentOf(a.terrain?.[cell] ?? a.environment).id });
    }
  }
  return out;
}
