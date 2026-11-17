import { type FormData, lensLabel, pathLength, perHour } from "./forms";
import { surveyLine, type SurveyData } from "./survey";
import type { CampaignData } from "./types";

const name = <T extends { id: string; name: string }>(list: T[], id: string | null) =>
  list.find((x) => x.id === id)?.name ?? "";

function rows(data: CampaignData) {
  const authors = new Map(data.members.map((m) => [m.user_id, m.profile?.display_name ?? ""]));
  return data.observations.map((o) => {
    const d = (o.data ?? {}) as FormData;
    return {
    id: o.id,
    data: o.created_at,
    forma: o.form ?? "informazione",
    tipo: o.kind,
    lente: lensLabel(o.lens) ?? "",
    titolo: o.title,
    luogo: name(data.places ?? [], o.place_id ?? null),
    nota: o.note,
    percezione: o.feeling ?? "",
    tema: name(data.themes, o.theme_id),
    area: name(data.areas, o.area_id),
    team: name(data.teams, o.team_id),
    autore: authors.get(o.author_id) ?? "",
    stato: o.status,
    qualita: o.quality ?? "",
    fonte: o.source_url ?? "",
    media: o.media_path ?? "",
    valore: d.value ?? "",
    unita: d.unit ?? "",
    intensita: d.intensity ?? "",
    sensi: (d.senses ?? []).join(" "),
    modo: d.mode ?? "",
    passaggi_ora: perHour(d) ?? "",
    lunghezza_m: pathLength(o.path) || "",
    interlocutore: d.who ?? "",
    indagine: o.form === "indagine" ? surveyLine(o.data as Partial<SurveyData>) : "",
    lng: o.lng,
    lat: o.lat,
    cella_h3: o.cell,
    path: o.path ?? null,
    };
  });
}

/** FeatureCollection GeoJSON (EPSG:4326) con osservazioni e aree. */
export function toGeoJSON(data: CampaignData) {
  return {
    type: "FeatureCollection",
    name: data.campaign.name,
    features: [
      // I flussi tracciati escono come linee, tutto il resto come punti.
      ...rows(data).map(({ lng, lat, path, ...properties }) => ({
        type: "Feature",
        id: properties.id,
        geometry: path && path.length > 1 ? { type: "LineString", coordinates: path } : { type: "Point", coordinates: [lng, lat] },
        properties: { layer: path && path.length > 1 ? "flussi" : "osservazioni", ...properties },
      })),
      ...(data.places ?? []).map((p) => ({
        type: "Feature",
        id: p.id,
        geometry: { type: "Point", coordinates: [p.lng, p.lat] },
        properties: {
          layer: "luoghi", nome: p.name, categoria: p.category, descrizione: p.description, da_raccogliere: p.prompt,
          raggio_m: p.radius_m, punti: p.points, arrivi: (data.visits ?? []).filter((v) => v.place_id === p.id).length, immagini: p.images.join(" "),
        },
      })),
      ...(data.routes ?? []).map((r) => {
        const pts = r.stops.map((id) => (data.places ?? []).find((p) => p.id === id)).filter((p) => !!p);
        return {
          type: "Feature",
          id: r.id,
          geometry: { type: "LineString", coordinates: pts.map((p) => [p!.lng, p!.lat]) },
          properties: { layer: "percorsi", nome: r.name, descrizione: r.description, tappe: pts.map((p) => p!.name).join(" → ") },
        };
      }),
      ...data.areas.map((a) => ({
        type: "Feature",
        id: a.id,
        geometry: a.geometry,
        properties: { layer: "aree", nome: a.name, team: name(data.teams, a.team_id), apre: a.opens_at, chiude: a.closes_at },
      })),
    ],
  };
}

const CSV_HEAD = ["id", "data", "forma", "tipo", "lente", "titolo", "luogo", "nota", "percezione", "tema", "area", "team", "autore", "stato", "qualita", "fonte", "media", "valore", "unita", "intensita", "sensi", "modo", "passaggi_ora", "lunghezza_m", "interlocutore", "indagine", "lng", "lat", "cella_h3", "tracciato"];

const esc = (v: unknown) => {
  const s = String(v ?? "");
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** CSV UTF-8 con intestazione, separatore virgola, coordinate in colonne lng/lat. */
export function toCSV(data: CampaignData): string {
  const r = rows(data).map(({ path, ...x }) => ({ ...x, tracciato: path ? path.map((p) => p.join(" ")).join(";") : "" }));
  const head = Object.keys(r[0] ?? Object.fromEntries(CSV_HEAD.map((k) => [k, ""])));
  return [head.join(","), ...r.map((x) => head.map((h) => esc((x as Record<string, unknown>)[h])).join(","))].join("\n");
}

export function download(filename: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
