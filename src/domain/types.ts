import { PLACE_COLOR } from "@/domain/palette";

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
  /** Mappa pubblica visibile a chiunque. */
  public_map?: boolean;
  /** Contributi individuali aperti. */
  contributions_open?: boolean;
  /** Testo di presentazione della mappa pubblica. */
  public_intro?: string;
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
  place_id?: string | null;
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

export type PlaceCategory = "storico" | "naturalistico" | "culturale" | "sociale" | "paesaggio" | "ospitalita" | "altro";

/** Luogo di interesse da raggiungere, creato dalla regia. */
export interface Place {
  id: string;
  campaign_id: string;
  name: string;
  description: string;
  /** Che cosa raccogliere una volta arrivati. */
  prompt: string;
  category: PlaceCategory;
  lng: number;
  lat: number;
  radius_m: number;
  /** Punti per team: metà all'arrivo, metà al primo rilievo confermato sul posto. */
  points: number;
  /** Percorsi delle immagini nello Storage; la prima è la copertina. */
  images: string[];
  /** Scheda d'indagine sul sito (scala micro). */
  survey?: import("./survey").Question[];
  /** Provenienza, se importato da un file. */
  source?: string;
  /** Colonne originali del file da cui è stato importato. */
  attributes?: Record<string, unknown>;
  /** false = importato senza coordinate, da posizionare dalla regia. */
  placed?: boolean;
  created_at: string;
}

/** Percorso di esplorazione: luoghi in ordine. */
export interface Route {
  id: string;
  campaign_id: string;
  name: string;
  description: string;
  color: string;
  stops: string[];
  created_at: string;
}

/** Arrivo di una persona a un luogo. */
export interface Visit {
  id: string;
  campaign_id: string;
  place_id: string;
  user_id: string;
  team_id: string | null;
  distance_m: number;
  created_at: string;
}

export const PLACE_CATEGORIES: { id: PlaceCategory; label: string; color: string }[] = [
  { id: "storico", label: "Storico", color: PLACE_COLOR.storico },
  { id: "naturalistico", label: "Naturalistico", color: PLACE_COLOR.naturalistico },
  { id: "culturale", label: "Culturale", color: PLACE_COLOR.culturale },
  { id: "sociale", label: "Sociale", color: PLACE_COLOR.sociale },
  { id: "paesaggio", label: "Paesaggio", color: PLACE_COLOR.paesaggio },
  { id: "ospitalita", label: "Ospitalità", color: PLACE_COLOR.ospitalita },
  { id: "altro", label: "Altro", color: PLACE_COLOR.altro },
];
export const categoryOf = (id: string | null | undefined) => PLACE_CATEGORIES.find((c) => c.id === id) ?? PLACE_CATEGORIES[PLACE_CATEGORIES.length - 1];

export type ContributionStatus = "pending" | "approved" | "rejected";

/** Contributo individuale, fuori dal gioco dei team, pubblicato solo se approvato. */
export interface Contribution {
  id: string;
  campaign_id: string;
  user_id?: string;
  display_name: string;
  form: "immagine" | "percezione" | "dato" | "informazione" | "idea" | "correzione";
  /** Punto a cui si riferisce: un luogo del gioco oppure una riga di uno strato di dati. */
  place_id?: string | null;
  dataset_id?: string | null;
  row_index?: number | null;
  title: string;
  note: string;
  feeling: string | null;
  media_path: string | null;
  data: Record<string, unknown>;
  lng: number;
  lat: number;
  status?: ContributionStatus;
  review_note?: string | null;
  reviewed_at?: string | null;
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
  places: Place[];
  routes: Route[];
  visits: Visit[];
  contributions: Contribution[];
  datasets: import("./datasets").Dataset[];
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
