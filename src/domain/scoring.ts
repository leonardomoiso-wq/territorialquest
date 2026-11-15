import { cellsOf } from "./geo";
import type { CampaignData, Mission, Observation, ObservationKind } from "./types";

/**
 * Punteggio cooperativo.
 * valore = base(tipo) × novità × qualità
 * - novità: cala se nella stessa cella e nello stesso tema esistono già rilievi;
 * - qualità: zero finché un altro team (o un tutor) non valida.
 * Il totale appartiene alla campagna: non esiste una classifica.
 */
export const BASE: Record<ObservationKind, number> = { field: 10, desk: 6, feel: 8 };
export const QUALITY: Record<number, number> = { 1: 0.5, 2: 1, 3: 1.5 };

/** 1, 1/2, 1/4… per rilievi successivi nella stessa cella e tema. */
export const novelty = (previous: number) => 1 / 2 ** Math.min(previous, 4);

export interface Scored {
  observation: Observation;
  novelty: number;
  /** Punti già acquisiti dalla campagna. */
  value: number;
  /** Punti che arriverebbero con una validazione di qualità media. */
  potential: number;
}

export function scoreObservations(observations: Observation[]): Scored[] {
  const seen = new Map<string, number>();
  return [...observations]
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .map((o) => {
      const key = `${o.cell}|${o.theme_id ?? ""}`;
      const previous = seen.get(key) ?? 0;
      if (o.status !== "flagged") seen.set(key, previous + 1);
      const n = novelty(previous);
      const full = BASE[o.kind] * n;
      const value = o.status === "validated" ? full * (QUALITY[o.quality ?? 2] ?? 1) : 0;
      const potential = o.status === "pending" ? full : 0;
      return { observation: o, novelty: n, value: Math.round(value * 10) / 10, potential: Math.round(potential * 10) / 10 };
    });
}

export interface Indicators {
  /** Punteggio collettivo. */
  score: number;
  /** Punti in attesa di validazione. */
  potential: number;
  /** Quota di celle del territorio con almeno un rilievo (0–1). */
  coverage: number;
  /** Quanto sono bilanciati Field, Desk e Feel (0–1). */
  balance: number;
  /** Quota di rilievi validati (0–1). */
  reliability: number;
  /** Quota di validazioni fatte da un team diverso dall'autore (0–1). */
  exchange: number;
  cellsTotal: number;
  cellsCovered: number;
  byKind: Record<ObservationKind, number>;
  byTheme: Record<string, number>;
  /** Punti portati al totale da ciascun team: contributo, non graduatoria. */
  byTeam: Record<string, number>;
  coveredCells: Map<string, number>;
  /** Celle attraversate a piedi da qualcuno. */
  walkedCells: Set<string>;
  /** Metri percorsi insieme. */
  walkedMeters: number;
  /** Celle del territorio. */
  territory: Set<string>;
}

export function indicators(data: Pick<CampaignData, "areas" | "observations" | "members"> & { walks?: CampaignData["walks"] }): Indicators {
  const active = data.observations.filter((o) => o.status !== "flagged");
  const scored = scoreObservations(data.observations);
  const byKind: Record<ObservationKind, number> = { field: 0, desk: 0, feel: 0 };
  const byTheme: Record<string, number> = {};
  const byTeam: Record<string, number> = {};
  const coveredCells = new Map<string, number>();

  for (const o of active) {
    byKind[o.kind]++;
    if (o.theme_id) byTheme[o.theme_id] = (byTheme[o.theme_id] ?? 0) + 1;
    if (o.cell) coveredCells.set(o.cell, (coveredCells.get(o.cell) ?? 0) + 1);
  }
  let score = 0, potential = 0;
  for (const s of scored) {
    score += s.value;
    potential += s.potential;
    const t = s.observation.team_id;
    if (t && s.value) byTeam[t] = (byTeam[t] ?? 0) + s.value;
  }

  const territory = new Set<string>();
  for (const a of data.areas) for (const c of cellsOf(a.geometry)) territory.add(c);
  let cellsCovered = 0;
  if (territory.size) for (const c of coveredCells.keys()) if (territory.has(c)) cellsCovered++;
  const cellsTotal = territory.size;

  const total = active.length;
  const max = Math.max(byKind.field, byKind.desk, byKind.feel);
  const min = Math.min(byKind.field, byKind.desk, byKind.feel);
  const validated = active.filter((o) => o.status === "validated");
  const teamOf = new Map(data.members.map((m) => [m.user_id, m.team_id]));
  const crossTeam = validated.filter((o) => {
    const validatorTeam = o.validated_by ? teamOf.get(o.validated_by) : null;
    return validatorTeam && o.team_id && validatorTeam !== o.team_id;
  });

  return {
    score: Math.round(score),
    potential: Math.round(potential),
    coverage: cellsTotal ? cellsCovered / cellsTotal : 0,
    balance: max ? min / max : 0,
    reliability: total ? validated.length / total : 0,
    exchange: validated.length ? crossTeam.length / validated.length : 0,
    cellsTotal,
    cellsCovered,
    byKind,
    byTheme,
    byTeam,
    coveredCells,
    walkedCells: new Set((data.walks ?? []).flatMap((w) => w.cells ?? [])),
    walkedMeters: (data.walks ?? []).reduce((s, w) => s + (w.distance_m ?? 0), 0),
    territory,
  };
}

export interface MissionProgress {
  mission: Mission;
  current: number;
  /** 0–1 */
  ratio: number;
  state: "upcoming" | "active" | "done" | "expired";
}

export function missionProgress(mission: Mission, data: CampaignData, now = new Date()): MissionProgress {
  const from = mission.starts_at, to = mission.ends_at;
  const within = data.observations.filter(
    (o) =>
      o.status !== "flagged" &&
      o.created_at >= from &&
      o.created_at <= to &&
      (!mission.theme_id || o.theme_id === mission.theme_id) &&
      (!mission.area_id || o.area_id === mission.area_id),
  );
  let current = 0;
  if (mission.kind === "observations") current = within.length;
  if (mission.kind === "validation") current = within.filter((o) => o.status === "validated").length;
  if (mission.kind === "coverage") current = new Set(within.map((o) => o.cell)).size;
  if (mission.kind === "exchange") {
    const teamOf = new Map(data.members.map((m) => [m.user_id, m.team_id]));
    current = within.filter((o) => {
      const v = o.validated_by ? teamOf.get(o.validated_by) : null;
      return o.status === "validated" && v && o.team_id && v !== o.team_id;
    }).length;
  }
  const ratio = Math.min(1, mission.target ? current / mission.target : 0);
  const t = now.toISOString();
  const state = ratio >= 1 ? "done" : t < from ? "upcoming" : t > to ? "expired" : "active";
  return { mission, current, ratio, state };
}

export const MISSION_KIND: Record<Mission["kind"], { label: string; unit: string }> = {
  observations: { label: "Raccolta", unit: "osservazioni" },
  coverage: { label: "Esplorazione", unit: "celle esplorate" },
  validation: { label: "Verifica", unit: "osservazioni validate" },
  exchange: { label: "Scambio", unit: "validazioni tra team" },
};
