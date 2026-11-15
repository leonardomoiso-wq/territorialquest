export type CampaignStatus = "draft" | "live" | "paused" | "closed";
export type Role = "master" | "tutor" | "player";
export type FieldRole = "esploratore" | "verificatore" | "cartografo" | "narratore";
export type ObservationKind = "field" | "desk" | "feel";
export type ObservationStatus = "pending" | "validated" | "flagged";
export type MissionKind = "observations" | "coverage" | "validation" | "exchange";

export interface Polygon {
  type: "Polygon";
  coordinates: [number, number][][];
}

export interface Profile {
  id: string;
  display_name: string;
}

export interface Campaign {
  id: string;
  owner_id: string;
  name: string;
  description: string;
  join_code: string;
  status: CampaignStatus;
  starts_at: string;
  ends_at: string;
  center_lng: number;
  center_lat: number;
  zoom: number;
  basemap?: Basemap;
  basemap_url?: string | null;
  basemap_opacity?: number;
  overlay?: Overlay | null;
  created_at: string;
}

export type Basemap = "mappa" | "satellite" | "custom" | "nessuno";

/** Immagine caricata e posata sulla mappa: angoli in senso orario da nord-ovest. */
export interface Overlay {
  path: string;
  coordinates: [[number, number], [number, number], [number, number], [number, number]];
  opacity: number;
}

export interface Team {
  id: string;
  campaign_id: string;
  name: string;
  color: string;
}

export interface Membership {
  id: string;
  campaign_id: string;
  user_id: string;
  team_id: string | null;
  role: Role;
  field_role: FieldRole | null;
  status: "active" | "suspended";
  joined_at: string;
  last_seen_at: string | null;
  last_lng: number | null;
  last_lat: number | null;
  profile?: Profile | null;
}

export interface Area {
  id: string;
  campaign_id: string;
  team_id: string | null;
  name: string;
  color: string;
  geometry: Polygon;
  environment?: string;
  terrain?: Record<string, string>;
  opens_at: string | null;
  closes_at: string | null;
}

export interface Theme {
  id: string;
  campaign_id: string;
  name: string;
  color: string;
  sort: number;
}

export interface Mission {
  id: string;
  campaign_id: string;
  title: string;
  description: string;
  kind: MissionKind;
  target: number;
  theme_id: string | null;
  area_id: string | null;
  starts_at: string;
  ends_at: string;
}

export interface Observation {
  id: string;
  campaign_id: string;
  author_id: string;
  team_id: string | null;
  area_id: string | null;
  theme_id: string | null;
  kind: ObservationKind;
  form?: string;
  lens?: string | null;
  /** Tracciato di un flusso: [[lng, lat], …] */
  path?: [number, number][] | null;
  data?: Record<string, unknown>;
  title: string;
  note: string;
  feeling: string | null;
  source_url: string | null;
  media_path: string | null;
  lng: number;
  lat: number;
  cell: string;
  status: ObservationStatus;
  quality: number | null;
  validated_by: string | null;
  validated_at: string | null;
  created_at: string;
}

export interface Announcement {
  id: string;
  campaign_id: string;
  author_id: string;
  team_id: string | null;
  body: string;
  created_at: string;
}

/** Un'uscita a piedi: celle attraversate e distanza, senza tracciato preciso. */
export interface Walk {
  id: string;
  campaign_id: string;
  user_id: string;
  team_id: string | null;
  started_at: string;
  ended_at: string | null;
  distance_m: number;
  cells: string[];
}

/** Tutto ciò che serve per mostrare una campagna. */
export interface CampaignData {
  campaign: Campaign;
  teams: Team[];
  members: Membership[];
  areas: Area[];
  themes: Theme[];
  missions: Mission[];
  observations: Observation[];
  announcements: Announcement[];
  walks: Walk[];
}

export const KIND_LABEL: Record<ObservationKind, string> = {
  field: "Field",
  desk: "Desk",
  feel: "Feel",
};
export const KIND_HINT: Record<ObservationKind, string> = {
  field: "Rilevato sul posto",
  desk: "Dato da fonte o ricerca a tavolino",
  feel: "Percezione, atmosfera, sensazione",
};
export const STATUS_LABEL: Record<CampaignStatus, string> = {
  draft: "Bozza",
  live: "In corso",
  paused: "In pausa",
  closed: "Chiusa",
};
export const ROLE_LABEL: Record<Role, string> = { master: "Master", tutor: "Tutor", player: "Giocatore" };
export const FIELD_ROLES: { id: FieldRole; label: string; hint: string }[] = [
  { id: "esploratore", label: "Esploratore", hint: "Apre zone nuove della mappa" },
  { id: "verificatore", label: "Verificatore", hint: "Conferma i rilievi degli altri team" },
  { id: "cartografo", label: "Cartografo", hint: "Cura posizioni, temi e completezza" },
  { id: "narratore", label: "Narratore", hint: "Raccoglie percezioni, storie e media" },
];
