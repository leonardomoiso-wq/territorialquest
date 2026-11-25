"use client";

import {
  AttributionControl, Map as MLMap, NavigationControl, setWorkerUrl,
  type GeoJSONSource, type MapMouseEvent, type MapTouchEvent, type StyleSpecification,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { cellToLatLng } from "h3-js";
import { useEffect, useRef } from "react";
import { cellHeight, environmentOf, modelCells, type Environment } from "@/domain/environment";
import { boundsOf, cellOf, cellRing, cellsOf, gridResolution, toRes } from "@/domain/geo";
import { categoryColors, layersBounds, pointsOf, type Dataset } from "@/domain/datasets";
import { BASE, FORM_COLOR, HUE, MAP, ROLE } from "@/domain/palette";
import { ASSETS } from "@/domain/assets.generated";
import { categoryOf, PLACE_CATEGORIES, type Area, type Basemap, type Observation, type Overlay, type Place, type Route } from "@/domain/types";

setWorkerUrl("/maplibre-gl-worker.mjs");

const STYLE_URL = "https://tiles.openfreemap.org/styles/positron";
const SATELLITE_URL = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
const SATELLITE_CREDIT = "Immagini © Esri, Maxar, Earthstar Geographics";
const PAPER = BASE.paper;

/**
 * Stile di riserva se la mappa vettoriale non risponde: una mappa a immagini chiara,
 * così sotto i dati resta sempre un riferimento (strade, edifici, nomi).
 */
const BLANK: StyleSpecification = {
  version: 8,
  sources: {
    riserva: {
      type: "raster", tileSize: 256, maxzoom: 19,
      tiles: ["a", "b", "c"].map((s) => `https://${s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png`),
      attribution: "© OpenStreetMap © CARTO",
    },
  },
  layers: [
    { id: "bg", type: "background", paint: { "background-color": PAPER } },
    { id: "riserva", type: "raster", source: "riserva" },
  ],
};

const KIND_COLOR = { field: ROLE.field, desk: ROLE.desk, feel: ROLE.feel };
const CONTRIB_COLOR: Record<string, string> = FORM_COLOR;

/** Piano oppure modello a celle in rilievo (solo per dipingere gli ambienti e per lo schermo grande). */
export type MapMode = "2d" | "model";
type Ring = [number, number][];
type Corners = Overlay["coordinates"];

export interface MapPlayer {
  id: string;
  name: string;
  color: string;
  lng: number;
  lat: number;
  online: boolean;
}

/** Funzioni che la mappa mette a disposizione di chi la ospita. */
export interface MapApi {
  /** Angoli della vista corrente, in senso orario da nord-ovest. */
  corners: () => Corners;
  /** Legge la mappa reale e propone un ambiente per le celle visibili. */
  classify: (cells: string[]) => Record<string, Environment>;
}

interface Props {
  center: [number, number];
  zoom: number;
  areas?: Area[];
  observations?: Observation[];
  players?: MapPlayer[];
  /** Mostra la griglia di copertura sulle aree. */
  grid?: boolean;
  /** Celle attraversate a piedi: risultano «accese». */
  walked?: Iterable<string>;
  /** Vela le celle mai attraversate né osservate. */
  fog?: boolean;
  /** Centra la mappa su questo punto quando cambia. */
  focus?: [number, number] | null;
  /** Cambia per ricentrare sullo stesso punto (pulsante «Dove sono»). */
  focusNonce?: number;
  /** L'utente ha spostato la mappa con un gesto. */
  onDrag?: () => void;
  mode?: MapMode;
  /** Nel modello, mostra ogni cella a colore pieno (editor) anziché solo quelle esplorate. */
  vivid?: boolean;
  basemap?: Basemap;
  basemapUrl?: string | null;
  /** 0 = sfondo invisibile, 1 = sfondo pieno. */
  basemapOpacity?: number;
  overlay?: { url: string; coordinates: Corners; opacity: number } | null;
  selectedAreaId?: string | null;
  /** Vertici del poligono in corso di disegno. */
  draft?: Ring;
  /** Il disegno in corso è un tracciato aperto (flusso), non un perimetro. */
  draftLine?: boolean;
  /** Vertici di un'area in modifica: si trascinano. */
  edit?: Ring;
  onEdit?: (ring: Ring) => void;
  /** Punto scelto per una nuova osservazione. */
  pin?: [number, number] | null;
  onClick?: (lngLat: [number, number]) => void;
  /** Pennello: riceve le celle toccate o attraversate trascinando. */
  onPaint?: (cell: string) => void;
  onAreaClick?: (id: string) => void;
  /** Luoghi di interesse da raggiungere. */
  places?: Place[];
  /** Percorsi di esplorazione: linee che uniscono i luoghi in ordine. */
  routes?: Route[];
  /** Luoghi già raggiunti (dal team o da chi guarda). */
  reached?: Iterable<string>;
  /** Percorso in evidenza: gli altri si attenuano. */
  activeRouteId?: string | null;
  selectedPlaceId?: string | null;
  onPlaceClick?: (id: string) => void;
  /** Contributi individuali approvati (o in revisione, per la regia). */
  contributions?: { id: string; lng: number; lat: number; form: string; status?: string }[];
  onContributionClick?: (id: string) => void;
  /** Strati di riferimento dai dati del territorio (punti e linee). */
  layers?: Dataset[];
  onLayerPointClick?: (info: { datasetId: string; index: number; dataset: string; label: string; category: string }) => void;
  /** Raggio d'azione in metri attorno alla posizione del giocatore («me»). */
  reach?: number | null;
  /** Luoghi completati (arrivo e indagine confermata). */
  completed?: Iterable<string>;
  onObservationClick?: (id: string) => void;
  onMove?: (center: [number, number], zoom: number) => void;
  onReady?: (api: MapApi) => void;
  /** Adatta la vista alle aree al primo caricamento. */
  fit?: boolean;
  interactive?: boolean;
  /** Pulsanti di zoom, solo su schermi larghi (su telefono basta il gesto). */
  controls?: boolean;
  /** Solleva i crediti della mappa sopra i pulsanti in basso (es. "5rem"). */
  creditsLift?: string;
  /**
   * Vista esplora: camera inclinata che segue chi cammina (e la bussola), cartelli in piedi,
   * sagome di carta, nebbia di carta sulle zone mai attraversate. rich aggiunge edifici e cielo;
   * motion abilita le brevi animazioni (celle che si accendono).
   */
  explore?: { heading: number | null; rich: boolean; motion: boolean; sky?: { sky: string; horizon: string; fog: string }; accent?: string } | null;
  className?: string;
}

type FC = GeoJSON.FeatureCollection;
const fc = (features: GeoJSON.Feature[]): FC => ({ type: "FeatureCollection", features });
const point = (c: [number, number], properties: GeoJSON.GeoJsonProperties = {}): GeoJSON.Feature => ({
  type: "Feature", geometry: { type: "Point", coordinates: c }, properties,
});

/** Colore a metà strada tra due esadecimali. */
function blend(a: string, b: string): string {
  const mix = (i: number) => Math.round((parseInt(a.slice(i, i + 2), 16) + parseInt(b.slice(i, i + 2), 16)) / 2).toString(16).padStart(2, "0");
  return `#${mix(1)}${mix(3)}${mix(5)}`;
}

/** Propone un ambiente a partire dagli elementi della mappa vettoriale sotto un punto. */
function environmentFrom(features: { sourceLayer?: string; properties: Record<string, unknown> | null }[]): Environment | null {
  const has = (layer: string, classes?: string[]) =>
    features.some((f) => f.sourceLayer === layer && (!classes || classes.includes(String(f.properties?.class ?? ""))));
  if (has("water") || has("waterway")) return "acqua";
  if (has("landuse", ["industrial", "railway", "quarry"])) return "industriale";
  if (has("building")) return "urbano";
  if (has("park") || has("landcover", ["wood", "grass", "wetland"])) return "verde";
  if (has("landcover", ["farmland"])) return "rurale";
  if (has("landcover", ["sand", "ice", "rock"])) return "costa";
  if (has("landuse", ["residential", "commercial", "retail"])) return "urbano";
  return null;
}

/* ------------------------------------------------ immagini della vista esplora */
/** Aggiunge alla mappa un cartello («sign|colore|stato») o una sagoma («fig|colore») se manca. */
function ensureImage(m: MLMap, id: string) {
  const [kind, color, state] = id.split("|");
  if (m.hasImage(id) || !/^#[0-9a-f]{6}$/i.test(color ?? "")) return;
  if (kind === "sign") m.addImage(id, signImage(color, state ?? "da"), { pixelRatio: PX });
  if (kind === "fig") m.addImage(id, figureImage(color), { pixelRatio: PX });
}
const PX = 2;
const INK = BASE.ink;
const canvas = (w: number, h: number) => {
  const c = document.createElement("canvas");
  c.width = w * PX; c.height = h * PX;
  const g = c.getContext("2d")!;
  g.scale(PX, PX);
  return { c, g };
};
const asImage = (c: HTMLCanvasElement) => c.getContext("2d")!.getImageData(0, 0, c.width, c.height);

/** Cartello da sentiero in piedi: palina, tabella del colore del tipo, segno dello stato. */
function signImage(color: string, state: string) {
  const W = 40, H = 62;
  const { c, g } = canvas(W, H);
  // ombra a terra
  g.fillStyle = "rgba(20,22,26,0.22)";
  g.beginPath(); g.ellipse(W / 2, H - 4, 9, 3.2, 0, 0, Math.PI * 2); g.fill();
  // palina
  g.strokeStyle = INK; g.lineWidth = 3; g.lineCap = "round";
  g.beginPath(); g.moveTo(W / 2, H - 5); g.lineTo(W / 2, 26); g.stroke();
  // tabella: bordo carta, poi colore
  const board = (inset: number, fill: string) => {
    g.fillStyle = fill;
    g.beginPath(); g.roundRect(4 + inset, 3 + inset, W - 8 - inset * 2, 26 - inset * 2, 4 - inset / 2); g.fill();
  };
  board(0, INK); board(1.6, BASE.edge); board(3.6, color);
  g.strokeStyle = BASE.edge; g.lineWidth = 2.4; g.lineJoin = "round"; g.lineCap = "round";
  if (state === "da") {
    // freccia di sentiero: meta da raggiungere
    g.beginPath(); g.moveTo(13, 16); g.lineTo(26, 16); g.moveTo(22, 11.5); g.lineTo(26.5, 16); g.lineTo(22, 20.5); g.stroke();
  } else {
    g.beginPath(); g.moveTo(13.5, 16); g.lineTo(18, 20.5); g.lineTo(26.5, 11.5); g.stroke();
  }
  if (state === "done") {
    // timbro del team: luogo completato
    g.fillStyle = HUE.glow; g.strokeStyle = INK; g.lineWidth = 1.6;
    g.beginPath(); g.arc(W - 7, 7, 6.5, 0, Math.PI * 2); g.fill(); g.stroke();
    g.fillStyle = INK; g.beginPath(); g.arc(W - 7, 7, 2, 0, Math.PI * 2); g.fill();
  }
  return asImage(c);
}

/** Sagoma di carta ritagliata: chi cammina, con il colore della squadra. */
function figureImage(color: string) {
  const W = 34, H = 58;
  const { c, g } = canvas(W, H);
  const body = new Path2D();
  body.arc(W / 2, 10, 6.5, 0, Math.PI * 2);
  body.moveTo(W / 2 - 8, 21);
  body.roundRect(W / 2 - 8.5, 19, 17, 21, 6);
  body.roundRect(W / 2 - 7, 36, 5.6, 17, 2.6);
  body.roundRect(W / 2 + 1.4, 36, 5.6, 17, 2.6);
  // bordo di carta bianca, poi il colore: effetto ritaglio
  g.save(); g.translate(1.5, 1.5); g.fillStyle = "rgba(20,22,26,0.25)"; g.fill(body); g.restore();
  g.strokeStyle = BASE.edge; g.lineWidth = 5; g.lineJoin = "round"; g.stroke(body);
  g.fillStyle = color; g.fill(body);
  g.strokeStyle = INK; g.lineWidth = 1.2; g.stroke(body);
  return asImage(c);
}

export default function MapView(props: Props) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<MLMap | null>(null);
  const ready = useRef(false);
  const latest = useRef(props);
  const fitted = useRef(false);
  const applied = useRef({ mode: "" as string, raster: "", overlay: "", focus: "", place: "", explore: "" });
  /** Celle percorse all'ultimo disegno: le nuove si accendono con una breve dissolvenza. */
  const walkedBefore = useRef<{ key: string; cells: Set<string> } | null>(null);
  const flashAnim = useRef(0);
  /** Luoghi raggiunti all'ultimo disegno: un nuovo arrivo fa alzare il suo cartello. */
  const reachedBefore = useRef<Set<string> | null>(null);
  const riseAnim = useRef(0);

  /** Ultimi ingressi di ogni sorgente: si ridisegna solo ciò che è cambiato. */
  const lastDeps = useRef(new Map<string, unknown[]>());

  const sync = () => {
    const m = map.current;
    if (!m || !ready.current) return;
    const p = latest.current;
    const mode = p.mode ?? "2d";
    const res = gridResolution(p.areas ?? []);
    const write = (id: string, data: FC) => (m.getSource(id) as GeoJSONSource | undefined)?.setData(data);
    /** Aggiorna una sorgente solo se i suoi ingressi sono cambiati. */
    const put = (id: string, deps: unknown[], build: () => FC) => {
      const prev = lastDeps.current.get(id);
      if (prev && prev.length === deps.length && prev.every((d, i) => d === deps[i])) return;
      lastDeps.current.set(id, deps);
      write(id, build());
    };
    const set = (id: string, data: FC) => { lastDeps.current.delete(id); write(id, data); };
    const keyOf = (it?: Iterable<string>) => (it ? [...it].join(",") : "");
    const show = (id: string, on: boolean) => m.getLayer(id) && m.setLayoutProperty(id, "visibility", on ? "visible" : "none");

    /* ---------------------------------------------------------------- dati */
    put("areas", [p.areas, p.selectedAreaId], () => fc((p.areas ?? []).map((a) => ({
      type: "Feature", id: a.id, geometry: a.geometry,
      properties: { id: a.id, name: a.name, color: a.color, selected: a.id === p.selectedAreaId },
    }))));

    // conteggi e celle percorse portati alla risoluzione della griglia
    const walkedKey = keyOf(p.walked);
    put(mode === "model" ? "model" : "cells", [mode, p.areas, p.observations, walkedKey, p.grid, p.fog, p.vivid, res], () => {
      const counts = new Map<string, number>();
      for (const o of p.observations ?? []) if (o.cell && o.status !== "flagged") { const c = toRes(o.cell, res); counts.set(c, (counts.get(c) ?? 0) + 1); }
      const walked = new Set([...(p.walked ?? [])].map((c) => toRes(c, res)));
      if (mode === "model") {
        return fc(modelCells(p.areas ?? [], res).map(({ cell, environment }) => {
          const env = environmentOf(environment);
          const n = counts.get(cell) ?? 0;
          return {
            type: "Feature", geometry: { type: "Polygon", coordinates: [cellRing(cell)] },
            properties: { cell, h: cellHeight(env, cell) * (res < 10 ? 2 : 1), color: p.vivid || n > 0 ? env.color : walked.has(cell) ? blend(env.tint, env.color) : env.tint },
          };
        }));
      }
      const cells = new Set<string>();
      if (p.grid) for (const a of p.areas ?? []) for (const c of cellsOf(a.geometry, res)) cells.add(c);
      for (const c of counts.keys()) cells.add(c);
      for (const c of walked) cells.add(c);
      return fc([...cells].map((c) => {
        const n = counts.get(c) ?? 0;
        return {
          type: "Feature", geometry: { type: "Polygon", coordinates: [cellRing(c)] },
          properties: { n, dark: !!p.fog && n === 0 && !walked.has(c) },
        };
      }));
    });
    if (mode === "model") put("cells", ["vuoto"], () => fc([])); else put("model", ["vuoto"], () => fc([]));

    // celle appena accese: dissolvenza dorata di poco più di un secondo
    if (walkedBefore.current?.key !== walkedKey) {
      const now = new Set([...(p.walked ?? [])].map((c) => toRes(c, res)));
      const before = walkedBefore.current?.cells;
      walkedBefore.current = { key: walkedKey, cells: now };
      const fresh = before && p.explore?.motion ? [...now].filter((c) => !before.has(c)) : [];
      if (fresh.length && fresh.length < 40 && m.getLayer("flash")) {
        write("flash", fc(fresh.map((c) => ({ type: "Feature", geometry: { type: "Polygon", coordinates: [cellRing(c)] }, properties: {} }))));
        cancelAnimationFrame(flashAnim.current);
        const t0 = performance.now();
        const step = (t: number) => {
          const k = Math.max(0, Math.min(1, (t - t0) / 1200));
          if (!map.current?.getLayer("flash")) return;
          map.current.setPaintProperty("flash", "fill-opacity", 0.85 * (1 - k) * (1 - k));
          if (k < 1) flashAnim.current = requestAnimationFrame(step);
        };
        flashAnim.current = requestAnimationFrame(step);
      }
    }

    put("observations", [p.observations], () => fc((p.observations ?? []).map((o) => point([o.lng, o.lat], { id: o.id, color: KIND_COLOR[o.kind], status: o.status }))));
    put("flows", [p.observations], () => fc((p.observations ?? []).filter((o) => o.path && o.path.length > 1 && o.status !== "flagged").map((o) => ({
      type: "Feature", geometry: { type: "LineString", coordinates: o.path! },
      properties: { id: o.id, intensity: Number((o.data as { intensity?: number } | undefined)?.intensity ?? 2), status: o.status },
    }))));
    for (const u of p.players ?? []) ensureImage(m, `fig|${u.color}`);
    set("players", fc((p.players ?? []).map((u) => point([u.lng, u.lat], { name: u.name, color: u.color, online: u.online, me: u.id === "me" }))));

    const d = p.draft ?? [];
    set("draft", fc([
      ...(d.length >= 3 && !p.draftLine ? [{ type: "Feature" as const, geometry: { type: "Polygon" as const, coordinates: [[...d, d[0]]] }, properties: {} }] : []),
      ...(d.length >= 2 ? [{ type: "Feature" as const, geometry: { type: "LineString" as const, coordinates: d }, properties: {} }] : []),
      ...d.map((c) => point(c)),
    ]));

    const e = p.edit ?? [];
    set("edit", fc(e.length >= 3 ? [
      { type: "Feature", geometry: { type: "Polygon", coordinates: [[...e, e[0]]] }, properties: {} },
      ...e.map((c, i) => point(c, { i, kind: "vertex" })),
      ...e.map((c, i) => {
        const n = e[(i + 1) % e.length];
        return point([(c[0] + n[0]) / 2, (c[1] + n[1]) / 2], { i, kind: "mid" });
      }),
    ] : []));

    set("pin", fc(p.pin ? [point(p.pin)] : []));

    put("layers", [p.layers, p.places], () => {
    const asPlace = new Set((p.places ?? []).filter((pl) => pl.placed !== false).map((pl) => `${pl.lng.toFixed(5)},${pl.lat.toFixed(5)}`));
    const layerPoints: GeoJSON.Feature[] = [], layerLines: GeoJSON.Feature[] = [];
    for (const d of p.layers ?? []) {
      if (d.kind === "punti") {
        const colors = categoryColors(d);
        for (const x of pointsOf(d)) if (!asPlace.has(`${x.lng.toFixed(5)},${x.lat.toFixed(5)}`)) layerPoints.push(point([x.lng, x.lat], { color: colors.get(x.category) ?? d.color, datasetId: d.id, index: x.index, dataset: d.name, label: x.label, category: x.category }));
      }
      if (d.kind === "linee" && !Array.isArray(d.rows)) for (const f of d.rows.features ?? []) layerLines.push({ ...f, properties: { ...(f.properties ?? {}), color: d.color } });
    }
    write("layer-points", fc(layerPoints));
    write("layer-lines", fc(layerLines));
    return fc([]);
    });
    const me = (p.players ?? []).find((u) => u.id === "me");
    set("reach", fc(me && p.reach ? [point([me.lng, me.lat], { r0: p.reach / (156543.03 * Math.cos((me.lat * Math.PI) / 180)) })] : []));

    set("contribs", fc((p.contributions ?? []).map((x) => point([x.lng, x.lat], {
      id: x.id, color: CONTRIB_COLOR[x.form] ?? HUE.violet, pending: x.status === "pending",
    }))));

    /* ------------------------------------------------------ luoghi e percorsi */
    const reached = new Set(p.reached ?? []);
    const completed = new Set(p.completed ?? []);
    put("places", [p.places, keyOf(p.reached), keyOf(p.completed), p.selectedPlaceId], () => fc((p.places ?? []).filter((pl) => pl.placed !== false).map((pl) => {
      // raggio in pixel a zoom 0: si scala con lo zoom nella regola del livello
      const r0 = pl.radius_m / (156543.03 * Math.cos((pl.lat * Math.PI) / 180));
      return point([pl.lng, pl.lat], {
        id: pl.id, name: pl.name, color: categoryOf(pl.category).color, reached: reached.has(pl.id), done: completed.has(pl.id),
        state: completed.has(pl.id) ? "done" : reached.has(pl.id) ? "ok" : "da",
        selected: pl.id === p.selectedPlaceId, r0, r22: r0 * 4194304,
      });
    })));
    // arrivo: il cartello del luogo appena raggiunto esce dal terreno e si alza (0,6 s)
    const prevReached = reachedBefore.current;
    reachedBefore.current = reached;
    const risen = prevReached && p.explore?.motion ? (p.places ?? []).find((pl) => reached.has(pl.id) && !prevReached.has(pl.id) && pl.placed !== false) : undefined;
    if (risen && m.getLayer("rise-sign")) {
      write("rise", fc([point([risen.lng, risen.lat], { id: risen.id, color: categoryOf(risen.category).color, state: completed.has(risen.id) ? "done" : "ok" })]));
      m.setFilter("places-sign", ["all", ["!", ["has", "point_count"]], ["!=", ["get", "id"], risen.id]]);
      cancelAnimationFrame(riseAnim.current);
      const t0 = performance.now();
      const step = (t: number) => {
        const mm = map.current;
        if (!mm?.getLayer("rise-sign")) return;
        const k = Math.max(0, Math.min(1, (t - t0) / 600));
        // uscita con un piccolo rimbalzo finale
        const e = 1 + 2.2 * Math.pow(k - 1, 3) + 1.2 * Math.pow(k - 1, 2);
        mm.setPaintProperty("rise-sign", "icon-translate", [0, 34 * (1 - e)]);
        mm.setPaintProperty("rise-sign", "icon-opacity", Math.min(1, k * 2.5));
        if (k < 1) riseAnim.current = requestAnimationFrame(step);
        else {
          mm.setFilter("places-sign", ["!", ["has", "point_count"]]);
          (mm.getSource("rise") as GeoJSONSource | undefined)?.setData(fc([]));
        }
      };
      riseAnim.current = requestAnimationFrame(step);
    }

    const byId = new Map((p.places ?? []).map((pl) => [pl.id, pl]));
    put("routes", [p.routes, p.places, p.activeRouteId], () => fc((p.routes ?? []).flatMap((r) => {
      const coords = r.stops.map((id) => byId.get(id)).filter((x): x is Place => !!x).map((x) => [x.lng, x.lat]);
      if (coords.length < 2) return [];
      const active = p.activeRouteId ? r.id === p.activeRouteId : true;
      return [{ type: "Feature" as const, geometry: { type: "LineString" as const, coordinates: coords }, properties: { id: r.id, color: r.color, active } }];
    })));

    /* -------------------------------------------------------------- sfondo */
    const raster = p.basemap === "satellite" ? SATELLITE_URL : p.basemap === "custom" && p.basemapUrl ? p.basemapUrl : "";
    if (raster !== applied.current.raster) {
      applied.current.raster = raster;
      if (m.getLayer("tq-raster")) m.removeLayer("tq-raster");
      if (m.getSource("tq-raster")) m.removeSource("tq-raster");
      if (raster) {
        try {
          m.addSource("tq-raster", { type: "raster", tiles: [raster], tileSize: 256, maxzoom: 19, attribution: p.basemap === "satellite" ? SATELLITE_CREDIT : "" });
          m.addLayer({ id: "tq-raster", type: "raster", source: "tq-raster" }, m.getLayer("tq-overlay") ? "tq-overlay" : "tq-veil");
        } catch { /* indirizzo non valido: resta lo sfondo di base */ }
      }
    }

    const overlayKey = p.overlay ? `${p.overlay.url}|${JSON.stringify(p.overlay.coordinates)}` : "";
    if (overlayKey !== applied.current.overlay) {
      applied.current.overlay = overlayKey;
      if (m.getLayer("tq-overlay")) m.removeLayer("tq-overlay");
      if (m.getSource("tq-overlay")) m.removeSource("tq-overlay");
      if (p.overlay) {
        m.addSource("tq-overlay", { type: "image", url: p.overlay.url, coordinates: p.overlay.coordinates });
        m.addLayer({ id: "tq-overlay", type: "raster", source: "tq-overlay", paint: { "raster-fade-duration": 0 } }, "tq-veil");
      }
    }
    if (p.overlay && m.getLayer("tq-overlay")) m.setPaintProperty("tq-overlay", "raster-opacity", p.overlay.opacity);

    // Il velo color carta regola la trasparenza di qualunque sfondo.
    // il velo color carta dà il tono a ogni sfondo; sulla mappa di base resta un velo leggero
    const veil = 1 - Math.max(0, Math.min(1, p.basemapOpacity ?? 1));
    m.setPaintProperty("tq-veil", "background-opacity", p.basemap === "nessuno" ? 1 : (p.basemap ?? "mappa") === "mappa" ? Math.max(0.22, veil) : veil);

    /* ---------------------------------------------------------------- vista */
    if (mode !== applied.current.mode) {
      const first = applied.current.mode === "";
      applied.current.mode = mode;
      const flat = mode !== "model";
      for (const id of ["cells-fill", "cells-fog", "cells-line", "areas-fill", "flows", "obs", "obs-cluster", "obs-cluster-count"]) show(id, flat);
      show("model", !flat);
      const camera = mode === "2d" ? { pitch: 0, bearing: 0 } : { pitch: 55, bearing: -18 };
      if (first) m.jumpTo(camera);
      else m.easeTo({ ...camera, duration: 900 });
    }

    const sel = p.selectedPlaceId ? (p.places ?? []).find((pl) => pl.id === p.selectedPlaceId && pl.placed !== false) : null;
    if ((sel?.id ?? "") !== applied.current.place) {
      applied.current.place = sel?.id ?? "";
      if (sel) m.easeTo({ center: [sel.lng, sel.lat], zoom: Math.max(m.getZoom(), 15), duration: 700 });
    }

    /* ------------------------------------------------------- vista esplora */
    const ex = p.explore ?? null;
    const exKey = ex ? `on|${ex.rich}|${ex.sky?.sky ?? ""}|${ex.accent ?? ""}` : "off";
    if (exKey !== applied.current.explore) {
      const was = applied.current.explore;
      applied.current.explore = exKey;
      const on = !!ex;
      for (const id of ["places-sign", "players-fig", "players-shadow"]) show(id, on);
      for (const id of ["places-halo", "places", "players-halo", "players", "cells-line"]) show(id, !on);
      show("tq-buildings", on && !!ex?.rich);
      // le celle appena accese prendono il colore della squadra
      m.setPaintProperty("flash", "fill-color", ex?.accent ?? HUE.honey);
      // nebbia di carta: le zone mai attraversate restano coperte da una velatura chiara
      // sempre leggera: strade ed edifici della mappa di riferimento devono restare leggibili
      m.setPaintProperty("cells-fog", "fill-color", on ? MAP.fogPaper : BASE["ink-2"]);
      // nella vista esplora la nebbia ha la grana della carta vera (se la texture è disponibile)
      m.setPaintProperty("cells-fog", "fill-pattern", on && m.hasImage("tq-carta") ? "tq-carta" : undefined);
      m.setPaintProperty("cells-fog", "fill-opacity", ["case", ["get", "dark"], on ? 0.38 : 0.16, 0]);
      m.setPaintProperty("cells-fill", "fill-opacity", on
        ? ["interpolate", ["linear"], ["get", "n"], 0, 0, 1, 0.22, 6, 0.4]
        : ["interpolate", ["linear"], ["get", "n"], 0, 0, 1, 0.5, 6, 0.78]);
      if (on && ex?.rich && ex.sky) {
        try {
          m.setSky({ "sky-color": ex.sky.sky, "horizon-color": ex.sky.horizon, "fog-color": ex.sky.fog, "sky-horizon-blend": 0.6, "horizon-fog-blend": 0.7, "fog-ground-blend": 0.35, "atmosphere-blend": 0 });
        } catch { /* cielo non disponibile */ }
      }
      if (on && !was.startsWith("on")) m.easeTo({ pitch: 58, zoom: Math.max(m.getZoom(), 16.8), duration: was === "" || !ex?.motion ? 0 : 900 });
      else if (!on && was.startsWith("on")) m.easeTo({ pitch: 0, bearing: 0, duration: 700 });
    }

    const heading = ex?.heading;
    const focus = p.focus ? `${p.focus.map((v) => v.toFixed(5)).join(",")}|${ex ? heading ?? "" : ""}|${p.focusNonce ?? ""}` : "";
    if (focus !== applied.current.focus) {
      applied.current.focus = focus;
      if (p.focus) {
        fitted.current = true;
        if (ex) m.easeTo({ center: p.focus, zoom: Math.min(19, Math.max(m.getZoom(), 16.8)), pitch: Math.max(m.getPitch(), 45), ...(heading != null ? { bearing: heading } : {}), duration: ex.motion ? 650 : 0 });
        else m.easeTo({ center: p.focus, zoom: Math.max(m.getZoom(), 16.4), duration: 900 });
      }
    }

    // inquadratura: le aree; se non ci sono, luoghi e strati di dati
    const placed = (p.places ?? []).filter((pl) => pl.placed !== false);
    const dataBounds = () => {
      const lb = layersBounds(p.layers ?? []);
      const pts: [number, number][] = placed.map((pl) => [pl.lng, pl.lat]);
      if (lb) pts.push(lb[0], lb[1]);
      if (!pts.length) return null;
      const xs = pts.map((q) => q[0]), ys = pts.map((q) => q[1]);
      return [[Math.min(...xs), Math.min(...ys)], [Math.max(...xs), Math.max(...ys)]] as [[number, number], [number, number]];
    };
    if (p.fit && !fitted.current && (p.areas?.length || placed.length || p.layers?.length)) {
      const b = p.areas?.length ? boundsOf(p.areas.map((a) => a.geometry)) : dataBounds();
      if (b) {
        fitted.current = true;
        m.fitBounds(b, { padding: Math.min(80, m.getContainer().clientWidth / 8), duration: 0, maxZoom: 16, pitch: m.getPitch(), bearing: m.getBearing() });
      }
    }
  };

  useEffect(() => {
    if (!el.current) return;
    let cancelled = false;
    const p = latest.current;
    applied.current = { mode: "", raster: "", overlay: "", focus: "", place: "", explore: "" };
    walkedBefore.current = null;
    reachedBefore.current = null;
    lastDeps.current = new Map();
    fitted.current = false;

    const start = (style: StyleSpecification | string) => {
      if (cancelled || !el.current) return;
      const m = new MLMap({
        container: el.current,
        style,
        center: p.center,
        zoom: p.zoom,
        maxPitch: 75,
        interactive: p.interactive ?? true,
        attributionControl: false,
      });
      // crediti compatti: una «i» che si apre al tocco
      m.addControl(new AttributionControl({ compact: true }), "bottom-right");
      map.current = m;
      if ((p.interactive ?? true) && (p.controls ?? true) && window.matchMedia("(min-width: 768px)").matches) m.addControl(new NavigationControl({ visualizePitch: true }), "top-right");

      m.on("styleimagemissing", (e: { id: string }) => ensureImage(m, e.id));

      m.on("load", () => {
        const empty = fc([]);
        // rilievi, contributi e strati di punti si raggruppano: sotto lo zoom 16 i punti vicini diventano un grappolo
        const CLUSTERED = new Set(["observations", "contribs", "layer-points"]);
        for (const id of ["areas", "cells", "flash", "rise", "model", "observations", "flows", "routes", "places", "contribs", "layer-points", "layer-lines", "reach", "players", "draft", "edit", "pin"]) {
          // i luoghi sono mete: si raggruppano solo da lontano (scala di vallata), da vicino restano singoli
          m.addSource(id, CLUSTERED.has(id) ? { type: "geojson", data: empty, cluster: true, clusterRadius: 44, clusterMaxZoom: 15 }
            : id === "places" ? { type: "geojson", data: empty, cluster: true, clusterRadius: 36, clusterMaxZoom: 12 }
            : { type: "geojson", data: empty });
        }
        // grana della carta per la nebbia della vista esplora
        if (ASSETS.has("texture/carta")) {
          m.loadImage("/assets/texture/carta.webp").then((img) => {
            if (!m.hasImage("tq-carta")) m.addImage("tq-carta", img.data, { pixelRatio: 2 });
            applied.current.explore = ""; // ridisegna la vista con la grana appena caricata
            sync();
          }, () => undefined);
        }
        // cartelli pronti per ogni tipo di luogo e stato: le immagini create al volo possono andare perse
        for (const cat of PLACE_CATEGORIES) for (const st of ["da", "ok", "done"]) ensureImage(m, `sign|${cat.color}|${st}`);
        const single = ["!", ["has", "point_count"]] as const;
        const grouped = ["has", "point_count"] as const;
        /** Cerchio di un grappolo: più grande quanti più punti contiene. */
        const clusterPaint = (fill: string) => ({
          "circle-color": fill, "circle-opacity": 0.92, "circle-stroke-color": BASE.edge, "circle-stroke-width": 3,
          "circle-radius": ["step", ["get", "point_count"], 13, 10, 17, 50, 22, 200, 28] as unknown as number,
        });
        const glyphs = !!m.getStyle().glyphs;
        const clusterCount = (id: string, source: string, color: string) => {
          if (!glyphs) return;
          try {
            m.addLayer({ id, type: "symbol", source, filter: grouped as never, layout: {
              "text-field": ["get", "point_count_abbreviated"], "text-font": ["Noto Sans Regular"], "text-size": 12, "text-allow-overlap": true,
            }, paint: { "text-color": color } });
          } catch { /* senza caratteri il grappolo mostra solo la grandezza */ }
        };

        m.addLayer({ id: "tq-veil", type: "background", paint: { "background-color": PAPER, "background-opacity": 0 } });
        m.addLayer({ id: "cells-fill", type: "fill", source: "cells", paint: {
          "fill-color": ["interpolate", ["linear"], ["get", "n"], 0, HUE.sage, 1, HUE["sage-2"], 6, HUE.leaf],
          "fill-opacity": ["interpolate", ["linear"], ["get", "n"], 0, 0, 1, 0.5, 6, 0.78],
        } });
        m.addLayer({ id: "cells-fog", type: "fill", source: "cells", paint: { "fill-color": BASE["ink-2"], "fill-opacity": ["case", ["get", "dark"], 0.16, 0] } });
        m.addLayer({ id: "cells-line", type: "line", source: "cells", paint: { "line-color": BASE.ink, "line-opacity": 0.1, "line-width": 0.6 } });
        m.addLayer({ id: "areas-fill", type: "fill", source: "areas", paint: {
          "fill-color": ["get", "color"], "fill-opacity": ["case", ["get", "selected"], 0.16, 0.05],
        } });
        m.addLayer({ id: "areas-line", type: "line", source: "areas", paint: {
          "line-color": ["get", "color"], "line-width": ["case", ["get", "selected"], 3, 1.6], "line-dasharray": [2, 1.5],
        } });

        // edifici in rilievo dalla mappa di base (solo nella vista esplora ricca)
        if (m.getStyle().sources?.openmaptiles) {
          try {
            m.addLayer({ id: "tq-buildings", type: "fill-extrusion", source: "openmaptiles", "source-layer": "building", minzoom: 14, layout: { visibility: "none" }, paint: {
              "fill-extrusion-color": MAP.building,
              "fill-extrusion-height": ["coalesce", ["get", "render_height"], 6],
              "fill-extrusion-base": ["coalesce", ["get", "render_min_height"], 0],
              "fill-extrusion-opacity": 0.85,
            } });
          } catch { /* mappa di base senza edifici */ }
        }
        m.addLayer({ id: "flash", type: "fill", source: "flash", paint: { "fill-color": HUE.honey, "fill-opacity": 0 } });

        m.addLayer({ id: "model", type: "fill-extrusion", source: "model", layout: { visibility: "none" }, paint: {
          "fill-extrusion-color": ["get", "color"], "fill-extrusion-height": ["get", "h"], "fill-extrusion-opacity": 0.94,
        } });

        m.addLayer({ id: "flows", type: "line", source: "flows", layout: { "line-cap": "round", "line-join": "round" }, paint: {
          "line-color": HUE.river, "line-width": ["interpolate", ["linear"], ["get", "intensity"], 1, 2, 5, 8],
          "line-opacity": ["case", ["==", ["get", "status"], "validated"], 0.9, 0.5],
        } });
        m.addLayer({ id: "layer-lines-casing", type: "line", source: "layer-lines", layout: { "line-cap": "round", "line-join": "round" }, paint: {
          "line-color": BASE.card, "line-width": 7, "line-opacity": 0.9,
        } });
        // sentiero a puntini, come nelle mappe dei parchi
        m.addLayer({ id: "layer-lines", type: "line", source: "layer-lines", layout: { "line-cap": "round", "line-join": "round" }, paint: {
          "line-color": ["get", "color"], "line-width": 4.5, "line-dasharray": [0, 2],
        } });
        m.addLayer({ id: "layer-cluster", type: "circle", source: "layer-points", filter: grouped as never, paint: clusterPaint(BASE.graphite) });
        clusterCount("layer-cluster-count", "layer-points", BASE.card);
        m.addLayer({ id: "layer-points", type: "circle", source: "layer-points", filter: single as never, paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 10, 3.5, 14, 5, 18, 8], "circle-color": ["get", "color"],
          "circle-stroke-color": BASE.card, "circle-stroke-width": ["interpolate", ["linear"], ["zoom"], 10, 1, 16, 2], "circle-opacity": 0.95,
        } });
        m.addLayer({ id: "routes-casing", type: "line", source: "routes", layout: { "line-cap": "round", "line-join": "round" }, paint: {
          "line-color": BASE.white, "line-width": 7, "line-opacity": ["case", ["get", "active"], 0.85, 0.25],
        } });
        m.addLayer({ id: "routes", type: "line", source: "routes", layout: { "line-cap": "round", "line-join": "round" }, paint: {
          "line-color": ["get", "color"], "line-width": 3.5, "line-dasharray": [1.2, 1.4], "line-opacity": ["case", ["get", "active"], 1, 0.3],
        } });
        m.addLayer({ id: "places-radius", type: "circle", source: "places", minzoom: 14, filter: ["!", ["has", "point_count"]], paint: {
          "circle-radius": ["interpolate", ["exponential", 2], ["zoom"], 0, ["get", "r0"], 22, ["get", "r22"]],
          "circle-color": ["get", "color"], "circle-opacity": ["case", ["get", "selected"], 0.16, 0.07],
          "circle-stroke-color": ["get", "color"], "circle-stroke-width": 1, "circle-stroke-opacity": 0.5,
        } });
        m.addLayer({ id: "obs-cluster", type: "circle", source: "observations", filter: grouped as never, paint: clusterPaint(HUE.leaf) });
        clusterCount("obs-cluster-count", "observations", BASE.card);
        m.addLayer({ id: "obs", type: "circle", source: "observations", filter: single as never, paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 11, 3.5, 14, 5, 18, 9],
          "circle-color": ["case", ["==", ["get", "status"], "flagged"], BASE.mute, ["get", "color"]],
          "circle-opacity": ["case", ["==", ["get", "status"], "validated"], 1, 0.45],
          "circle-stroke-color": BASE.edge, "circle-stroke-width": 1.5,
        } });
        // raggio d'azione: entro questo cerchio luoghi e rilievi si possono toccare
        m.addLayer({ id: "reach", type: "circle", source: "reach", paint: {
          "circle-radius": ["interpolate", ["exponential", 2], ["zoom"], 0, ["get", "r0"], 22, ["*", ["get", "r0"], 4194304]],
          "circle-color": HUE.glow, "circle-opacity": 0.08, "circle-stroke-color": HUE.glow, "circle-stroke-width": 2, "circle-stroke-opacity": 0.55,
        } });
        m.addLayer({ id: "players-halo", type: "circle", source: "players", paint: {
          "circle-radius": 14, "circle-color": ["get", "color"], "circle-opacity": ["case", ["get", "online"], 0.22, 0.06],
        } });
        m.addLayer({ id: "players", type: "circle", source: "players", paint: {
          "circle-radius": 6, "circle-color": ["get", "color"], "circle-opacity": ["case", ["get", "online"], 1, 0.4],
          "circle-stroke-color": BASE.ink, "circle-stroke-width": 2,
        } });
        // vista esplora: ombra a terra e sagoma di carta in piedi per chi cammina
        m.addLayer({ id: "players-shadow", type: "circle", source: "players", layout: { visibility: "none" }, paint: {
          "circle-radius": ["case", ["get", "me"], 10, 7], "circle-color": BASE.ink, "circle-opacity": 0.16, "circle-blur": 0.4,
          "circle-pitch-alignment": "map",
        } });
        m.addLayer({ id: "players-fig", type: "symbol", source: "players", layout: {
          visibility: "none", "icon-image": ["concat", "fig|", ["get", "color"]], "icon-anchor": "bottom",
          "icon-size": ["case", ["get", "me"], 1, 0.72], "icon-allow-overlap": true, "icon-ignore-placement": true,
          "icon-pitch-alignment": "viewport", "icon-rotation-alignment": "viewport", "symbol-sort-key": ["case", ["get", "me"], 1, 0],
        } });
        // contributi individuali: anello bianco, nucleo colorato; in revisione tratteggiati dalla trasparenza
        m.addLayer({ id: "contribs-cluster", type: "circle", source: "contribs", filter: grouped as never, paint: clusterPaint(HUE.plum) });
        clusterCount("contribs-cluster-count", "contribs", BASE.card);
        m.addLayer({ id: "contribs", type: "circle", source: "contribs", filter: single as never, paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 11, 4, 16, 8],
          "circle-color": BASE.white, "circle-stroke-color": ["get", "color"], "circle-stroke-width": ["interpolate", ["linear"], ["zoom"], 11, 2, 16, 3.5],
          "circle-opacity": ["case", ["get", "pending"], 0.6, 1], "circle-stroke-opacity": ["case", ["get", "pending"], 0.5, 1],
        } });
        // grappolo di luoghi: cartello chiaro con bordo, distinto dai grappoli dei servizi
        m.addLayer({ id: "places-cluster", type: "circle", source: "places", filter: grouped as never, paint: {
          "circle-color": BASE.card, "circle-stroke-color": HUE.brick, "circle-stroke-width": 2.5,
          "circle-radius": ["step", ["get", "point_count"], 14, 10, 18, 40, 23] as unknown as number,
        } });
        if (glyphs) clusterCount("places-cluster-count", "places", BASE.ink);
        else m.addLayer({ id: "places-cluster-dot", type: "circle", source: "places", filter: grouped as never, paint: { "circle-radius": 5, "circle-color": HUE.brick } });
        m.addLayer({ id: "places-halo", type: "circle", source: "places", filter: single as never, paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 9, ["case", ["get", "selected"], 10, 6], 13, ["case", ["get", "selected"], 15, 10], 16, ["case", ["get", "selected"], 20, 15]],
          "circle-color": ["case", ["get", "done"], HUE.glow, BASE.white], "circle-opacity": 0.95,
          "circle-stroke-color": ["case", ["get", "done"], BASE.ink, ["get", "reached"], HUE.leaf, BASE.ink],
          "circle-stroke-width": ["interpolate", ["linear"], ["zoom"], 9, 1, 14, ["case", ["get", "reached"], 3, 1.5]],
        } });
        m.addLayer({ id: "places", type: "circle", source: "places", filter: single as never, paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 9, ["case", ["get", "selected"], 7, 4], 13, ["case", ["get", "selected"], 10, 7], 16, ["case", ["get", "selected"], 12, 9]],
          "circle-color": ["get", "color"],
          "circle-stroke-color": BASE.white, "circle-stroke-width": ["case", ["get", "reached"], 2, 0],
        } });
        // vista esplora: cartelli in piedi, più grandi da vicino; i più vicini coprono i lontani
        m.addLayer({ id: "places-sign", type: "symbol", source: "places", filter: single as never, layout: {
          visibility: "none", "icon-image": ["concat", "sign|", ["get", "color"], "|", ["get", "state"]], "icon-anchor": "bottom",
          "icon-size": ["interpolate", ["linear"], ["zoom"], 13, 0.55, 16, 0.85, 18, 1.1], "icon-allow-overlap": true,
          "icon-pitch-alignment": "viewport", "icon-rotation-alignment": "viewport", "symbol-z-order": "viewport-y",
        } });
        m.addLayer({ id: "rise-sign", type: "symbol", source: "rise", layout: {
          "icon-image": ["concat", "sign|", ["get", "color"], "|", ["get", "state"]], "icon-anchor": "bottom",
          "icon-size": ["interpolate", ["linear"], ["zoom"], 13, 0.55, 16, 0.85, 18, 1.1], "icon-allow-overlap": true, "icon-ignore-placement": true,
          "icon-pitch-alignment": "viewport", "icon-rotation-alignment": "viewport",
        }, paint: { "icon-translate-anchor": "viewport", "icon-opacity": 0 } });
        if (m.getStyle().glyphs) {
          try {
            m.addLayer({ id: "places-label", type: "symbol", source: "places", minzoom: 14, filter: single as never, layout: {
              "text-field": ["get", "name"], "text-font": ["Noto Sans Regular"], "text-size": 12, "text-offset": [0, 1.7], "text-anchor": "top", "text-max-width": 9,
            }, paint: { "text-color": BASE.ink, "text-halo-color": BASE.white, "text-halo-width": 1.6 } });
          } catch { /* caratteri non disponibili: restano i simboli */ }
        }
        m.addLayer({ id: "draft-fill", type: "fill", source: "draft", filter: ["==", ["geometry-type"], "Polygon"], paint: { "fill-color": BASE.ink, "fill-opacity": 0.1 } });
        m.addLayer({ id: "draft-line", type: "line", source: "draft", filter: ["==", ["geometry-type"], "LineString"], paint: { "line-color": BASE.ink, "line-width": 2 } });
        m.addLayer({ id: "draft-points", type: "circle", source: "draft", filter: ["==", ["geometry-type"], "Point"], paint: { "circle-radius": 5, "circle-color": BASE.white, "circle-stroke-color": BASE.ink, "circle-stroke-width": 2 } });
        m.addLayer({ id: "edit-fill", type: "fill", source: "edit", filter: ["==", ["geometry-type"], "Polygon"], paint: { "fill-color": BASE.ink, "fill-opacity": 0.1 } });
        m.addLayer({ id: "edit-line", type: "line", source: "edit", filter: ["==", ["geometry-type"], "Polygon"], paint: { "line-color": BASE.ink, "line-width": 2 } });
        m.addLayer({ id: "edit-mid", type: "circle", source: "edit", filter: ["==", ["get", "kind"], "mid"], paint: { "circle-radius": 4, "circle-color": BASE.ink, "circle-opacity": 0.35 } });
        m.addLayer({ id: "edit-vertex", type: "circle", source: "edit", filter: ["==", ["get", "kind"], "vertex"], paint: { "circle-radius": 7, "circle-color": BASE.white, "circle-stroke-color": BASE.ink, "circle-stroke-width": 2.5 } });
        m.addLayer({ id: "pin-halo", type: "circle", source: "pin", paint: { "circle-radius": 18, "circle-color": BASE.ink, "circle-opacity": 0.14 } });
        m.addLayer({ id: "pin", type: "circle", source: "pin", paint: { "circle-radius": 7, "circle-color": BASE.ink, "circle-stroke-color": HUE.glow, "circle-stroke-width": 3 } });

        ready.current = true;
        m.getContainer().querySelector(".maplibregl-compact-show")?.classList.remove("maplibregl-compact-show");
        sync();

        latest.current.onReady?.({
          corners: () => {
            const b = m.getBounds();
            return [[b.getWest(), b.getNorth()], [b.getEast(), b.getNorth()], [b.getEast(), b.getSouth()], [b.getWest(), b.getSouth()]];
          },
          classify: (cells) => {
            const out: Record<string, Environment> = {};
            const { clientWidth: w, clientHeight: h } = m.getContainer();
            const ours = new Set(["model", "cells-fill", "cells-fog", "cells-line", "areas-fill", "areas-line", "layer-points", "layer-lines"]);
            for (const cell of cells) {
              const [lat, lng] = cellToLatLng(cell);
              const px = m.project([lng, lat]);
              if (px.x < 0 || px.y < 0 || px.x > w || px.y > h) continue;
              const env = environmentFrom(m.queryRenderedFeatures(px).filter((f) => !ours.has(f.layer.id)));
              if (env) out[cell] = env;
            }
            return out;
          },
        });
      });

      /* ----------------------------------------------- tocco, pennello, vertici */
      type Pointer = MapMouseEvent | MapTouchEvent;
      const lngLat = (e: Pointer): [number, number] => [e.lngLat.lng, e.lngLat.lat];
      const hit = (e: Pointer, layer: string) => (m.getLayer(layer) ? m.queryRenderedFeatures(e.point, { layers: [layer] })[0] : undefined);
      let painting = false, lastCell = "";
      let drag: { i: number; ring: Ring } | null = null;

      const paintAt = (e: Pointer) => {
        const cell = String(hit(e, "model")?.properties?.cell ?? toRes(cellOf(e.lngLat.lng, e.lngLat.lat), gridResolution(latest.current.areas ?? [])));
        if (cell === lastCell) return;
        lastCell = cell;
        latest.current.onPaint?.(cell);
      };

      const down = (e: Pointer) => {
        const cur = latest.current;
        if (cur.edit && cur.onEdit) {
          const v = hit(e, "edit-vertex") ?? hit(e, "edit-mid");
          if (!v) return;
          e.preventDefault();
          const ring = [...cur.edit];
          let i = Number(v.properties.i);
          if (v.properties.kind === "mid") ring.splice(++i, 0, lngLat(e));
          drag = { i, ring };
          m.dragPan.disable();
          return;
        }
        if (cur.onPaint) {
          if ("touches" in e.originalEvent && e.originalEvent.touches.length > 1) return;
          e.preventDefault();
          painting = true;
          lastCell = "";
          m.dragPan.disable();
          paintAt(e);
        }
      };
      const move = (e: Pointer) => {
        if (drag) {
          drag.ring[drag.i] = lngLat(e);
          latest.current.onEdit?.([...drag.ring]);
        } else if (painting) paintAt(e);
      };
      const up = () => {
        if (drag || painting) m.dragPan.enable();
        drag = null;
        painting = false;
      };
      m.on("mousedown", down); m.on("touchstart", down);
      m.on("mousemove", move); m.on("touchmove", move);
      m.on("mouseup", up); m.on("touchend", up);
      m.getCanvas().addEventListener("mouseleave", up);

      m.on("dblclick", (e: MapMouseEvent) => {
        const cur = latest.current;
        if (!cur.edit || !cur.onEdit) return;
        const v = hit(e, "edit-vertex");
        if (!v || cur.edit.length <= 3) return;
        e.preventDefault();
        cur.onEdit(cur.edit.filter((_, i) => i !== Number(v.properties.i)));
      });

      m.on("click", (e: MapMouseEvent) => {
        const cur = latest.current;
        if (cur.edit || cur.onPaint) return;
        // In disegno o scelta del punto, il tocco serve a posizionare.
        if (cur.onClick) return cur.onClick(lngLat(e));
        const cl = hit(e, "places-cluster") ?? hit(e, "layer-cluster") ?? hit(e, "obs-cluster") ?? hit(e, "contribs-cluster");
        if (cl) {
          const src = m.getSource(cl.layer.source) as GeoJSONSource;
          const center = (cl.geometry as GeoJSON.Point).coordinates as [number, number];
          Promise.resolve(src.getClusterExpansionZoom(Number(cl.properties.cluster_id)))
            .then((z) => m.easeTo({ center, zoom: Math.min(Number(z) + 0.3, 18), duration: 600 }), () => m.easeTo({ center, zoom: m.getZoom() + 2 }));
          return;
        }
        const lp = hit(e, "layer-points");
        if (lp && cur.onLayerPointClick) return cur.onLayerPointClick({ datasetId: String(lp.properties.datasetId), index: Number(lp.properties.index), dataset: String(lp.properties.dataset), label: String(lp.properties.label), category: String(lp.properties.category) });
        const ct = hit(e, "contribs");
        if (ct && cur.onContributionClick) return cur.onContributionClick(String(ct.properties.id));
        const pl = hit(e, "places-sign") ?? hit(e, "places-halo") ?? hit(e, "places");
        if (pl && cur.onPlaceClick) return cur.onPlaceClick(String(pl.properties.id));
        const o = hit(e, "obs") ?? hit(e, "flows");
        if (o && cur.onObservationClick) return cur.onObservationClick(String(o.properties.id));
        const a = hit(e, "areas-fill");
        if (a && cur.onAreaClick) cur.onAreaClick(String(a.properties.id));
      });
      m.on("dragstart", () => latest.current.onDrag?.());
      m.on("moveend", () => {
        const c = m.getCenter();
        latest.current.onMove?.([c.lng, c.lat], m.getZoom());
      });
    };

    fetch(STYLE_URL)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((style: StyleSpecification) => start(style), () => start(BLANK));

    const observer = new ResizeObserver(() => map.current?.resize());
    observer.observe(el.current);
    return () => {
      cancelled = true;
      cancelAnimationFrame(flashAnim.current);
      cancelAnimationFrame(riseAnim.current);
      observer.disconnect();
      ready.current = false;
      map.current?.remove();
      map.current = null;
    };
  }, []);

  useEffect(() => {
    latest.current = props;
    sync();
  });

  const cursor = props.onClick || props.onPaint ? "crosshair" : undefined;
  return (
    <div className={props.className} style={{ cursor, ["--credits-lift" as string]: props.creditsLift }}>
      <div ref={el} className="size-full" />
    </div>
  );
}
