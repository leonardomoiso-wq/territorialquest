import { ENVIRONMENTS, modelCells } from "@/domain/environment";
import { FORMS, SURVEY_FORM } from "@/domain/forms";
import { gridResolution, toRes } from "@/domain/geo";
import { PLACE_CATEGORIES, type CampaignData } from "@/domain/types";

/** Inviti brevi sulle caselle vuote dei tipi di luogo. */
const PLACE_HINT: Record<string, string> = {
  storico: "Un ponte, una torre, una lapide",
  naturalistico: "Un albero, una sponda, un prato",
  culturale: "Un museo, un teatro, un murale",
  sociale: "Una piazza, un mercato, un circolo",
  paesaggio: "Un punto da cui si vede lontano",
  ospitalita: "Un posto dove fermarsi",
  altro: "Ciò che non sta in nessun tipo",
};

/** Una casella dell'Atlante: piena quando il gruppo l'ha trovata almeno una volta. */
export interface AtlasEntry {
  id: string;
  label: string;
  color: string;
  /** Domanda o suggerimento mostrato sulla casella vuota, come invito. */
  hint: string;
  count: number;
  /** Quando è stata trovata la prima volta. */
  first: string | null;
}

export interface Atlas {
  forms: AtlasEntry[];
  places: AtlasEntry[];
  environments: AtlasEntry[];
}

const entry = (id: string, label: string, color: string, hint: string): AtlasEntry => ({ id, label, color, hint, count: 0, first: null });
const add = (e: AtlasEntry | undefined, at: string) => {
  if (!e) return;
  e.count++;
  if (!e.first || at < e.first) e.first = at;
};

/**
 * Atlante collettivo della campagna: le forme raccolte, i tipi di luogo raggiunti e gli ambienti attraversati
 * da tutti i team insieme. Non c'è una casella «mia»: l'Atlante si riempie solo collaborando.
 * Contano i rilievi non segnalati, gli arrivi ai luoghi e le celle camminate o osservate.
 */
export function atlasOf(data: Pick<CampaignData, "observations" | "visits" | "places" | "areas" | "walks">): Atlas {
  const forms = [...FORMS, SURVEY_FORM].map((f) => entry(f.id, f.label, f.color, f.prompt));
  const places = PLACE_CATEGORIES.map((c) => entry(c.id, c.label, c.color, PLACE_HINT[c.id] ?? "Raggiungi un luogo"));
  const environments = ENVIRONMENTS.map((e) => entry(e.id, e.label, e.color, e.hint));
  const byId = <T extends { id: string }>(list: T[]) => new Map(list.map((x) => [x.id, x]));
  const F = byId(forms), P = byId(places), E = byId(environments);

  for (const o of data.observations) if (o.status !== "flagged") add(F.get(o.form ?? "informazione"), o.created_at);

  const placeById = new Map(data.places.map((p) => [p.id, p]));
  for (const v of data.visits) add(P.get(placeById.get(v.place_id)?.category ?? ""), v.created_at);

  // ambiente di ogni cella delle aree (dipinto dalla regia o quello prevalente dell'area)
  const res = gridResolution(data.areas);
  const envOf = new Map(modelCells(data.areas, res).map((c) => [c.cell, c.environment]));
  const seen = new Map<string, string>();
  for (const o of data.observations) if (o.cell && o.status !== "flagged") {
    const c = toRes(o.cell, res);
    if (!seen.has(c) || o.created_at < seen.get(c)!) seen.set(c, o.created_at);
  }
  for (const w of data.walks ?? []) for (const cell of w.cells ?? []) {
    const c = toRes(cell, res);
    if (!seen.has(c) || w.started_at < seen.get(c)!) seen.set(c, w.started_at);
  }
  for (const [cell, at] of seen) add(E.get(envOf.get(cell) ?? ""), at);

  return { forms, places, environments };
}

/** Quante caselle sono piene su quante. */
export const filled = (list: AtlasEntry[]) => list.filter((e) => e.count > 0).length;
