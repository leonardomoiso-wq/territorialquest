import type { Polygon } from "./types";
import { SERIES as PALETTE_SERIES, SERIES_OTHER } from "@/domain/palette";

/**
 * Dati del territorio importati da file: CSV di indicatori, punti, tabelle; GeoJSON di aree e linee.
 * Tutto qui è puro e testato: niente rete, niente database.
 */
export type DatasetKind = "indicatori" | "punti" | "linee" | "tabella";
export type ColumnType = "numero" | "testo";

export interface Column {
  key: string;
  label: string;
  type: ColumnType;
  unit?: string;
}
export type Row = Record<string, string | number | null>;

export interface Dataset {
  id: string;
  campaign_id?: string;
  name: string;
  kind: DatasetKind;
  source: string;
  licence: string;
  note: string;
  key_column: string | null;
  time_column: string | null;
  category_column: string | null;
  label_column: string | null;
  columns: Column[];
  rows: Row[] | GeoJSON.FeatureCollection;
  color: string;
  public: boolean;
  created_at?: string;
}

/** Palette categorica dei grafici, verificata sul fondo carta (ordine fisso, mai a rotazione). */
export const SERIES: readonly string[] = PALETTE_SERIES;

/* ---------------------------------------------------------------- CSV */

/** Legge un CSV: separatore (virgola, punto e virgola, tabulazione) e virgolette riconosciuti da soli. */
export function parseCSV(text: string): { header: string[]; rows: Record<string, string>[] } {
  const src = text.replace(/^﻿/, "");
  const first = src.split(/\r?\n/, 1)[0] ?? "";
  const counts = [",", ";", "\t"].map((d) => [d, first.split(d).length] as const).sort((a, b) => b[1] - a[1]);
  const sep = counts[0][1] > 1 ? counts[0][0] : ",";
  const records: string[][] = [];
  let field = "", record: string[] = [], quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === sep) { record.push(field); field = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      record.push(field); field = "";
      if (record.some((x) => x.trim() !== "")) records.push(record);
      record = [];
    } else field += ch;
  }
  record.push(field);
  if (record.some((x) => x.trim() !== "")) records.push(record);
  const [head = [], ...body] = records;
  const header = head.map((h) => h.trim());
  return { header, rows: body.map((r) => Object.fromEntries(header.map((h, i) => [h, (r[i] ?? "").trim()]))) };
}

const NUMBER = /^-?\d+(?:[.,]\d+)?$/;
export const toNumber = (v: string) => (NUMBER.test(v.trim()) ? Number(v.trim().replace(",", ".")) : null);

/* ----------------------------------------------------------- etichette */

/** Nomi di colonna frequenti nei dati Istat, ISPRA, MEF, OSM, Wikidata: etichetta leggibile e unità. */
const DICT: Record<string, [string, string?]> = {
  comune: ["Comune"], anno: ["Anno"], nome: ["Nome"], tipo: ["Tipo"], categoria: ["Categoria"], classe: ["Classe"],
  popolazione: ["Popolazione", "ab."], superficie_km2: ["Superficie", "km²"], densita: ["Densità", "ab./km²"],
  altitudine: ["Altitudine", "m"], alt_sede: ["Quota della sede", "m"], alt_min: ["Quota minima", "m"], alt_max: ["Quota massima", "m"],
  zona_sismica: ["Zona sismica"], zona_climatica: ["Zona climatica"], n_frazioni_localita: ["Frazioni e località"],
  pop_2026_istat_stima: ["Popolazione 2026, stima Istat", "ab."], pop_2026_regione: ["Popolazione 2026, Regione", "ab."],
  famiglie: ["Famiglie"], comp_medi: ["Componenti medi per famiglia"],
  nascite: ["Nascite"], decessi: ["Decessi"], iscritti: ["Iscritti all'anagrafe"], cancellati: ["Cancellati dall'anagrafe"],
  eta_0_14: ["Residenti 0–14 anni"], eta_15_64: ["Residenti 15–64 anni"], eta_65_piu: ["Residenti 65 anni e più"],
  eta_media: ["Età media", "anni"], indice_vecchiaia: ["Indice di vecchiaia", "%"],
  dipendenza_2025: ["Indice di dipendenza 2025", "%"], ricambio_2025: ["Indice di ricambio 2025", "%"],
  struttura_attiva_2025: ["Indice di struttura della popolazione attiva 2025", "%"], carico_figli_2025: ["Carico di figli per donna feconda 2025", "%"],
  natalita_2024: ["Natalità 2024", "‰"], mortalita_2024: ["Mortalità 2024", "‰"],
  dichiaranti: ["Dichiaranti Irpef"], importo: ["Reddito imponibile complessivo", "€"],
  media_dichiarante: ["Reddito medio per dichiarante", "€"], media_pop: ["Reddito medio per abitante", "€"],
  occupate: ["Abitazioni occupate"], non_occupate: ["Abitazioni non occupate"], totale: ["Totale"], pct_non_occupate: ["Abitazioni non occupate", "%"],
  imprese_femminili_attive: ["Imprese femminili attive"], pct_femminili_su_attive: ["Imprese femminili sulle attive", "%"], imprese_attive_stimate: ["Imprese attive, stima"],
  arrivi_ita: ["Arrivi italiani"], arrivi_str: ["Arrivi stranieri"], arrivi_tot: ["Arrivi"],
  presenze_ita: ["Presenze italiani"], presenze_str: ["Presenze stranieri"], presenze_tot: ["Presenze"],
  var_arr_23: ["Arrivi, variazione sul 2023", "%"], var_pres_23: ["Presenze, variazione sul 2023", "%"],
  var_arr_19: ["Arrivi, variazione sul 2019", "%"], var_pres_19: ["Presenze, variazione sul 2019", "%"],
  km_dal_tracciato: ["Distanza dal tracciato", "km"], km_da_fidenza: ["Km da Fidenza", "km"], lunghezza_m: ["Lunghezza", "m"],
  alunni_2024_25: ["Alunni 2024/25"], maschi: ["Maschi"], femmine: ["Femmine"], posti: ["Posti letto"], periodo: ["Periodo di apertura"],
  // ISPRA IdroGEO: etichette ricavate dai nomi dei campi, da verificare sulla documentazione ISPRA
  ar_kmq: ["Superficie", "km²"], pop_res021: ["Popolazione residente 2021", "ab."],
  ar_frp3p4p: ["Area a pericolosità frana elevata e molto elevata (P3+P4)", "%"], ar_frp4_p: ["Area a pericolosità frana molto elevata (P4)", "%"],
  ar_frp3_p: ["Area a pericolosità frana elevata (P3)", "%"], popfr_p3p4: ["Popolazione in aree a pericolosità frana P3+P4", "ab."],
  popfrp3p4p: ["Popolazione in aree a pericolosità frana P3+P4", "%"], ed_tot: ["Edifici"], ed_fr_p3p4: ["Edifici in aree a pericolosità frana P3+P4"],
  edfrp3p4p: ["Edifici in aree a pericolosità frana P3+P4", "%"], bbccfrp3p4: ["Beni culturali in aree a pericolosità frana P3+P4"],
  aridp2_p: ["Area a pericolosità idraulica media (P2)", "%"], pop_idr_p2: ["Popolazione in aree a pericolosità idraulica P2", "ab."],
  popidp2_p: ["Popolazione in aree a pericolosità idraulica P2", "%"], bbcc_id_p2: ["Beni culturali in aree a pericolosità idraulica P2"],
  im_tot: ["Imprese"], imfr_p3p4: ["Imprese in aree a pericolosità frana P3+P4"],
};

/** Etichetta leggibile per un nome di colonna. */
export function labelFor(key: string): { label: string; unit?: string } {
  const k = key.toLowerCase();
  if (DICT[k]) return { label: DICT[k][0], unit: DICT[k][1] };
  const pct = /^(pct|perc|quota)_/.test(k);
  const text = k.replace(/^(pct|perc|quota)_/, "").replace(/_/g, " ").trim();
  return { label: text.charAt(0).toUpperCase() + text.slice(1), unit: pct ? "%" : undefined };
}

/* ------------------------------------------------------- classificazione */

const pick = (header: string[], names: string[]) => header.find((h) => names.includes(h.toLowerCase())) ?? null;
const LAT = ["lat", "latitude", "latitudine", "y"];
const LNG = ["lon", "lng", "long", "longitude", "longitudine", "x"];
const KEY = ["comune", "comuni", "municipio", "nome_comune", "comune_confini", "denominazione"];
const TIME = ["anno", "year", "data"];
const CATEGORY = ["tipo", "categoria", "classe", "sezione", "category", "type"];
const LABEL = ["nome", "name", "struttura", "titolo", "denominazione", "luogo"];
/** Colonne che sembrano numeri ma sono codici. */
const CODES = ["tappa", "cod", "codice", "id", "cap", "istat", "wikidata", "codice_aevf"];

export interface Draft {
  name: string;
  kind: DatasetKind;
  key_column: string | null;
  time_column: string | null;
  category_column: string | null;
  label_column: string | null;
  lat_column: string | null;
  lng_column: string | null;
  columns: Column[];
  rows: Row[];
  /** Spiegazione della classificazione, per la regia. */
  reason: string;
}

/** Nome leggibile da un nome di file: «osm_servizi_2026.csv» → «Osm servizi 2026». */
export const nameFromFile = (file: string) => {
  const base = file.replace(/^[0-9a-f]{8}-/, "").replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim();
  return base.charAt(0).toUpperCase() + base.slice(1);
};

/** Fonte e licenza riconoscibili dal nome del file (da controllare prima di salvare). */
export function guessSource(file: string): { source: string; licence: string } {
  const f = file.toLowerCase();
  if (/(^|[^a-z])osm[_-]|openstreetmap/.test(f)) return { source: "OpenStreetMap", licence: "ODbL" };
  if (/wikidata/.test(f)) return { source: "Wikidata", licence: "CC0" };
  if (/idrogeo|ispra|dissesto/.test(f)) return { source: "ISPRA IdroGEO", licence: "CC BY 4.0" };
  if (/istat|censiment|piramide|struttura_eta|movimento|pop_serie/.test(f)) return { source: "Istat", licence: "CC BY 4.0" };
  return { source: "", licence: "" };
}

/** Riconosce il tipo di un CSV e prepara colonne e righe tipizzate. */
export function classify(fileName: string, text: string): Draft {
  const { header, rows: raw } = parseCSV(text);
  const lat = pick(header, LAT), lng = pick(header, LNG);
  const key = pick(header, KEY);
  const time = pick(header, TIME);
  const columns: Column[] = header.map((h) => {
    const values = raw.map((r) => r[h]).filter((v) => v !== "");
    const numeric = values.length > 0 && values.every((v) => toNumber(v) !== null) && h !== key && h !== time && !CODES.includes(h.toLowerCase());
    return { key: h, ...labelFor(h), type: numeric ? "numero" : "testo" };
  });
  const rows: Row[] = raw.map((r) => Object.fromEntries(columns.map((c) => {
    const v = r[c.key];
    if (v === "") return [c.key, null];
    if (c.type === "numero" || c.key === lat || c.key === lng || c.key === time) return [c.key, toNumber(v) ?? v];
    return [c.key, v];
  })));

  // una categoria serve quando la stessa chiave (e anno) compare più volte
  const repeated = key ? new Set(rows.map((r) => `${r[key]}|${time ? r[time] : ""}`)).size < rows.length : false;
  const category = pick(header.filter((h) => h !== key), CATEGORY);
  const base = { name: nameFromFile(fileName), key_column: key, time_column: time, lat_column: lat, lng_column: lng, columns, rows };

  if (lat && lng && rows.some((r) => typeof r[lat] === "number" && typeof r[lng] === "number")) {
    return { ...base, kind: "punti", category_column: category, label_column: pick(header, LABEL),
      reason: `Ha le coordinate (${lat}, ${lng}): diventa uno strato di punti; puoi trasformare alcuni punti in luoghi del gioco.` };
  }
  // un elenco di cose con un nome ciascuna (strutture, luoghi) è una tabella, anche se ha qualche numero
  const label = pick(header, LABEL);
  const isList = !!label && new Set(rows.map((r) => r[label])).size === rows.length && rows.length > 1;
  if (key && !isList && columns.some((c) => c.type === "numero")) {
    return { ...base, kind: "indicatori", category_column: repeated ? category : null, label_column: null,
      reason: `Ha una riga per ${labelFor(key).label.toLowerCase()}${time ? " e per anno" : ""}${repeated && category ? ` e per ${labelFor(category).label.toLowerCase()}` : ""}: diventano indicatori del territorio.` };
  }
  return { ...base, kind: "tabella", category_column: category, label_column: label,
    reason: key ? "Riferita ai Comuni ma senza valori numerici: resta una tabella consultabile; se elenca luoghi puoi trasformarli in luoghi da posizionare." : "Senza coordinate né Comuni: resta una tabella consultabile." };
}

/* ---------------------------------------------------------------- GeoJSON */

export interface GeoImport {
  areas: { name: string; geometry: Polygon; properties: Record<string, unknown> }[];
  lines: GeoJSON.FeatureCollection;
  points: Row[];
  nameKeys: string[];
}

const ringArea = (ring: number[][]) => {
  let s = 0;
  for (let i = 0; i < ring.length - 1; i++) s += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
  return Math.abs(s / 2);
};

/** Divide un GeoJSON in aree (poligoni; dei multipoligoni si tiene la parte più grande), linee e punti. */
export function parseGeoJSON(text: string, nameKey?: string): GeoImport {
  const data = JSON.parse(text) as GeoJSON.FeatureCollection | GeoJSON.Feature;
  const features = data.type === "FeatureCollection" ? data.features : [data];
  const props = features[0]?.properties ?? {};
  const nameKeys = Object.keys(props ?? {}).filter((k) => typeof (props as Record<string, unknown>)[k] === "string");
  const key = nameKey ?? nameKeys.find((k) => /^(name|nome|comune|com_name|denominazione|name_it)$/i.test(k)) ?? nameKeys[0];
  const out: GeoImport = { areas: [], lines: { type: "FeatureCollection", features: [] }, points: [], nameKeys };
  features.forEach((f, i) => {
    const p = (f.properties ?? {}) as Record<string, unknown>;
    const name = String((key && p[key]) ?? `Elemento ${i + 1}`);
    const g = f.geometry;
    if (!g) return;
    if (g.type === "Polygon" || g.type === "MultiPolygon") {
      const polys = g.type === "Polygon" ? [g.coordinates] : g.coordinates;
      const biggest = polys.reduce((a, b) => (ringArea(b[0]) > ringArea(a[0]) ? b : a));
      out.areas.push({ name, properties: p, geometry: { type: "Polygon", coordinates: [biggest[0] as [number, number][]] } });
    } else if (g.type === "LineString" || g.type === "MultiLineString") {
      out.lines.features.push({ type: "Feature", geometry: g, properties: { name, ...p } });
    } else if (g.type === "Point") {
      out.points.push({ nome: name, lng: g.coordinates[0], lat: g.coordinates[1] });
    }
  });
  return out;
}

/* -------------------------------------------------------- uso dei dati */

/** Confronto tollerante dei nomi: maiuscole, accenti e spazi non contano. */
export const normalizeKey = (s: unknown) =>
  String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

export const isRows = (r: Dataset["rows"]): r is Row[] => Array.isArray(r);

/** Valori di un indicatore per una chiave (es. un Comune): ultimo valore e serie nel tempo. */
export interface Figure {
  dataset: Dataset;
  column: Column;
  value: number | string | null;
  year: number | null;
  series: { t: number; v: number }[];
}

export function figuresFor(datasets: Dataset[], key: string): Figure[] {
  const want = normalizeKey(key);
  const out: Figure[] = [];
  for (const d of datasets) {
    if (d.kind !== "indicatori" || !d.key_column || !isRows(d.rows) || d.category_column) continue;
    const mine = d.rows.filter((r) => normalizeKey(r[d.key_column!]) === want);
    if (!mine.length) continue;
    for (const c of d.columns) {
      if (c.key === d.key_column || c.key === d.time_column) continue;
      if (d.time_column) {
        if (c.type !== "numero") continue;
        const series = mine
          .filter((r) => typeof r[c.key] === "number" && typeof r[d.time_column!] === "number")
          .map((r) => ({ t: r[d.time_column!] as number, v: r[c.key] as number }))
          .sort((a, b) => a.t - b.t);
        if (!series.length) continue;
        const last = series[series.length - 1];
        out.push({ dataset: d, column: c, value: last.v, year: last.t, series });
      } else {
        out.push({ dataset: d, column: c, value: mine[0][c.key], year: null, series: [] });
      }
    }
  }
  return out;
}

/** Valori di una colonna per ogni chiave, all'ultimo anno disponibile: per i confronti. */
export function compare(d: Dataset, column: string): { key: string; value: number; year: number | null }[] {
  if (!d.key_column || !isRows(d.rows)) return [];
  const best = new Map<string, { key: string; value: number; year: number | null }>();
  for (const r of d.rows) {
    const v = r[column];
    if (typeof v !== "number") continue;
    const k = String(r[d.key_column]);
    const year = d.time_column && typeof r[d.time_column] === "number" ? (r[d.time_column] as number) : null;
    const prev = best.get(k);
    if (!prev || (year ?? 0) >= (prev.year ?? 0)) best.set(k, { key: k, value: v, year });
  }
  return [...best.values()].sort((a, b) => b.value - a.value);
}

/** Serie nel tempo per ogni chiave. */
export function series(d: Dataset, column: string): { key: string; points: { t: number; v: number }[] }[] {
  if (!d.key_column || !d.time_column || !isRows(d.rows)) return [];
  const by = new Map<string, { t: number; v: number }[]>();
  for (const r of d.rows) {
    const t = r[d.time_column], v = r[column];
    if (typeof t !== "number" || typeof v !== "number") continue;
    const k = String(r[d.key_column]);
    by.set(k, [...(by.get(k) ?? []), { t, v }]);
  }
  return [...by.entries()].map(([key, points]) => ({ key, points: points.sort((a, b) => a.t - b.t) }));
}

/** Righe di punti con coordinate valide, per la mappa. */
export function pointsOf(d: Dataset): { lng: number; lat: number; label: string; category: string; row: Row; index: number }[] {
  if (d.kind !== "punti" || !isRows(d.rows)) return [];
  const lat = d.columns.find((c) => LAT.includes(c.key.toLowerCase()))?.key ?? "lat";
  const lng = d.columns.find((c) => LNG.includes(c.key.toLowerCase()))?.key ?? "lng";
  return d.rows
    .map((r, index) => ({ r, index }))
    .filter(({ r }) => typeof r[lat] === "number" && typeof r[lng] === "number")
    .map(({ r, index }) => ({
      lat: r[lat] as number, lng: r[lng] as number, row: r, index,
      label: String((d.label_column && r[d.label_column]) ?? (d.category_column && r[d.category_column]) ?? d.name),
      category: String((d.category_column && r[d.category_column]) ?? ""),
    }));
}

/** Colore di ogni categoria di uno strato: le prime sei nella palette fissa, le altre in grigio terra. */
export function categoryColors(d: Dataset): Map<string, string> {
  const cats = distinct(d, d.category_column).map((x) => x.value);
  if (cats.length <= 1) return new Map(cats.map((c) => [c, d.color]));
  return new Map(cats.map((c, i) => [c, i < SERIES.length ? SERIES[i] : OTHER]));
}
export const OTHER: string = SERIES_OTHER;

/** Estensione [ovest, sud, est, nord] di punti e linee degli strati. */
export function layersBounds(ds: Dataset[]): [[number, number], [number, number]] | null {
  let w = Infinity, s = Infinity, e = -Infinity, n = -Infinity;
  const add = (x: number, y: number) => { w = Math.min(w, x); e = Math.max(e, x); s = Math.min(s, y); n = Math.max(n, y); };
  const walk = (c: unknown): void => {
    if (Array.isArray(c) && typeof c[0] === "number") add(c[0] as number, c[1] as number);
    else if (Array.isArray(c)) c.forEach(walk);
  };
  for (const d of ds) {
    if (d.kind === "punti") for (const p of pointsOf(d)) add(p.lng, p.lat);
    if (d.kind === "linee" && !isRows(d.rows)) for (const f of d.rows.features ?? []) walk((f.geometry as GeoJSON.LineString | null)?.coordinates);
  }
  return Number.isFinite(w) ? [[w, s], [e, n]] : null;
}

/** Zoom approssimato che fa stare un'estensione in uno schermo. */
export function zoomFor(b: [[number, number], [number, number]]): number {
  const span = Math.max(b[1][0] - b[0][0], (b[1][1] - b[0][1]) * 1.4, 0.002);
  return Math.max(8, Math.min(16, Math.log2(360 / span) - 0.6));
}

/** Righe di uno strato filtrate per categoria (per accendere e spegnere le categorie). */
export function withCategories(d: Dataset, keep: Set<string> | null): Dataset {
  if (!keep || !d.category_column || !isRows(d.rows)) return d;
  return { ...d, rows: d.rows.filter((r) => keep.has(String(r[d.category_column!] ?? ""))) };
}

/** Valori distinti di una colonna, con quante volte compaiono. */
export function distinct(d: Dataset | Draft, column: string | null): { value: string; count: number }[] {
  if (!column || !Array.isArray(d.rows)) return [];
  const m = new Map<string, number>();
  for (const r of d.rows as Row[]) { const v = String(r[column] ?? ""); if (v) m.set(v, (m.get(v) ?? 0) + 1); }
  return [...m.entries()].map(([value, count]) => ({ value, count })).sort((a, b) => b.count - a.count);
}

export const formatValue = (v: number | string | null, unit?: string) => {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "number") {
    const s = v.toLocaleString("it-IT", { maximumFractionDigits: Math.abs(v) < 10 ? 2 : 1 });
    return unit ? `${s}${unit === "%" || unit === "‰" ? "" : " "}${unit}` : s;
  }
  return v;
};
