import type { CampaignData } from "./types";

const name = <T extends { id: string; name: string }>(list: T[], id: string | null) =>
  list.find((x) => x.id === id)?.name ?? "";

function rows(data: CampaignData) {
  const authors = new Map(data.members.map((m) => [m.user_id, m.profile?.display_name ?? ""]));
  return data.observations.map((o) => ({
    id: o.id,
    data: o.created_at,
    tipo: o.kind,
    titolo: o.title,
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
    lng: o.lng,
    lat: o.lat,
    cella_h3: o.cell,
  }));
}

/** FeatureCollection GeoJSON (EPSG:4326) con osservazioni e aree. */
export function toGeoJSON(data: CampaignData) {
  return {
    type: "FeatureCollection",
    name: data.campaign.name,
    features: [
      ...rows(data).map(({ lng, lat, ...properties }) => ({
        type: "Feature",
        id: properties.id,
        geometry: { type: "Point", coordinates: [lng, lat] },
        properties: { layer: "osservazioni", ...properties },
      })),
      ...data.areas.map((a) => ({
        type: "Feature",
        id: a.id,
        geometry: a.geometry,
        properties: { layer: "aree", nome: a.name, team: name(data.teams, a.team_id), apre: a.opens_at, chiude: a.closes_at },
      })),
    ],
  };
}

const esc = (v: unknown) => {
  const s = String(v ?? "");
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** CSV UTF-8 con intestazione, separatore virgola, coordinate in colonne lng/lat. */
export function toCSV(data: CampaignData): string {
  const r = rows(data);
  const head = Object.keys(
    r[0] ?? { id: "", data: "", tipo: "", titolo: "", nota: "", percezione: "", tema: "", area: "", team: "", autore: "", stato: "", qualita: "", fonte: "", media: "", lng: "", lat: "", cella_h3: "" },
  );
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
