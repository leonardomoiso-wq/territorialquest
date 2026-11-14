"use client";

import {
  Map as MLMap, NavigationControl, setWorkerUrl,
  type GeoJSONSource, type MapMouseEvent, type MapTouchEvent, type StyleSpecification,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { cellToLatLng } from "h3-js";
import { useEffect, useRef } from "react";
import { cellHeight, environmentOf, modelCells, type Environment } from "@/domain/environment";
import { boundsOf, cellOf, cellRing, cellsOf } from "@/domain/geo";
import type { Area, Basemap, Observation, Overlay } from "@/domain/types";

setWorkerUrl("/maplibre-gl-worker.mjs");

const STYLE_URL = "https://tiles.openfreemap.org/styles/positron";
const SATELLITE_URL = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
const SATELLITE_CREDIT = "Immagini © Esri, Maxar, Earthstar Geographics";
const DEM_URL = "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png";
const PAPER = "#e7e6df";

/** Stile di riserva se le tessere non sono raggiungibili: restano visibili i dati. */
const BLANK: StyleSpecification = {
  version: 8,
  sources: {},
  layers: [{ id: "bg", type: "background", paint: { "background-color": PAPER } }],
};

const KIND_COLOR = { field: "#17804f", desk: "#2f6fe0", feel: "#e2578f" };

/** Piano, 3D reale (edifici e rilievo) oppure modello a celle. */
export type MapMode = "2d" | "3d" | "model";
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
  /** Vertici di un'area in modifica: si trascinano. */
  edit?: Ring;
  onEdit?: (ring: Ring) => void;
  /** Punto scelto per una nuova osservazione. */
  pin?: [number, number] | null;
  onClick?: (lngLat: [number, number]) => void;
  /** Pennello: riceve le celle toccate o attraversate trascinando. */
  onPaint?: (cell: string) => void;
  onAreaClick?: (id: string) => void;
  onObservationClick?: (id: string) => void;
  onMove?: (center: [number, number], zoom: number) => void;
  onReady?: (api: MapApi) => void;
  /** Adatta la vista alle aree al primo caricamento. */
  fit?: boolean;
  interactive?: boolean;
  /** Pulsanti di zoom (su telefono basta il gesto). */
  controls?: boolean;
  className?: string;
}

type FC = GeoJSON.FeatureCollection;
const fc = (features: GeoJSON.Feature[]): FC => ({ type: "FeatureCollection", features });
const point = (c: [number, number], properties: GeoJSON.GeoJsonProperties = {}): GeoJSON.Feature => ({
  type: "Feature", geometry: { type: "Point", coordinates: c }, properties,
});

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

export default function MapView(props: Props) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<MLMap | null>(null);
  const ready = useRef(false);
  const latest = useRef(props);
  const fitted = useRef(false);
  const applied = useRef({ mode: "" as string, raster: "", overlay: "" });

  const sync = () => {
    const m = map.current;
    if (!m || !ready.current) return;
    const p = latest.current;
    const mode = p.mode ?? "2d";
    const set = (id: string, data: FC) => (m.getSource(id) as GeoJSONSource | undefined)?.setData(data);
    const show = (id: string, on: boolean) => m.getLayer(id) && m.setLayoutProperty(id, "visibility", on ? "visible" : "none");

    /* ---------------------------------------------------------------- dati */
    set("areas", fc((p.areas ?? []).map((a) => ({
      type: "Feature", id: a.id, geometry: a.geometry,
      properties: { id: a.id, name: a.name, color: a.color, selected: a.id === p.selectedAreaId },
    }))));

    const counts = new Map<string, number>();
    for (const o of p.observations ?? []) if (o.cell && o.status !== "flagged") counts.set(o.cell, (counts.get(o.cell) ?? 0) + 1);

    if (mode === "model") {
      set("cells", fc([]));
      set("model", fc(modelCells(p.areas ?? []).map(({ cell, environment }) => {
        const env = environmentOf(environment);
        const n = counts.get(cell) ?? 0;
        return {
          type: "Feature", geometry: { type: "Polygon", coordinates: [cellRing(cell)] },
          properties: { cell, h: cellHeight(env, cell), color: p.vivid || n > 0 ? env.color : env.tint },
        };
      })));
    } else {
      set("model", fc([]));
      const cells = new Set<string>();
      if (p.grid) for (const a of p.areas ?? []) for (const c of cellsOf(a.geometry)) cells.add(c);
      for (const c of counts.keys()) cells.add(c);
      set("cells", fc([...cells].map((c) => ({
        type: "Feature", geometry: { type: "Polygon", coordinates: [cellRing(c)] }, properties: { n: counts.get(c) ?? 0 },
      }))));
    }

    set("observations", fc((p.observations ?? []).map((o) => point([o.lng, o.lat], { id: o.id, color: KIND_COLOR[o.kind], status: o.status }))));
    set("players", fc((p.players ?? []).map((u) => point([u.lng, u.lat], { name: u.name, color: u.color, online: u.online }))));

    const d = p.draft ?? [];
    set("draft", fc([
      ...(d.length >= 3 ? [{ type: "Feature" as const, geometry: { type: "Polygon" as const, coordinates: [[...d, d[0]]] }, properties: {} }] : []),
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
    m.setPaintProperty("tq-veil", "background-opacity", p.basemap === "nessuno" ? 1 : 1 - Math.max(0, Math.min(1, p.basemapOpacity ?? 1)));

    /* ---------------------------------------------------------------- vista */
    if (mode !== applied.current.mode) {
      const first = applied.current.mode === "";
      applied.current.mode = mode;
      const flat = mode !== "model";
      for (const id of ["cells-fill", "cells-line", "areas-fill", "obs"]) show(id, flat);
      show("model", !flat);
      show("tq-buildings", mode === "3d");
      try {
        m.setTerrain(mode === "3d" && m.getSource("tq-dem") ? { source: "tq-dem", exaggeration: 1.3 } : null);
      } catch { /* rilievo non disponibile */ }
      const camera = mode === "2d" ? { pitch: 0, bearing: 0 } : { pitch: 58, bearing: -18 };
      if (first) m.jumpTo(camera);
      else m.easeTo({ ...camera, duration: 900 });
    }

    if (p.fit && !fitted.current && p.areas?.length) {
      const b = boundsOf(p.areas.map((a) => a.geometry));
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
    applied.current = { mode: "", raster: "", overlay: "" };
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
        attributionControl: { compact: true },
      });
      map.current = m;
      if ((p.interactive ?? true) && (p.controls ?? true)) m.addControl(new NavigationControl({ visualizePitch: true }), "top-right");

      m.on("load", () => {
        const empty = fc([]);
        for (const id of ["areas", "cells", "model", "observations", "players", "draft", "edit", "pin"]) m.addSource(id, { type: "geojson", data: empty });

        m.addLayer({ id: "tq-veil", type: "background", paint: { "background-color": PAPER, "background-opacity": 0 } });
        m.addLayer({ id: "cells-fill", type: "fill", source: "cells", paint: {
          "fill-color": ["interpolate", ["linear"], ["get", "n"], 0, "#17804f", 1, "#2bbf74", 6, "#37e08b"],
          "fill-opacity": ["interpolate", ["linear"], ["get", "n"], 0, 0, 1, 0.38, 6, 0.7],
        } });
        m.addLayer({ id: "cells-line", type: "line", source: "cells", paint: { "line-color": "#0b0b0c", "line-opacity": 0.08, "line-width": 0.6 } });
        m.addLayer({ id: "areas-fill", type: "fill", source: "areas", paint: {
          "fill-color": ["get", "color"], "fill-opacity": ["case", ["get", "selected"], 0.16, 0.05],
        } });
        m.addLayer({ id: "areas-line", type: "line", source: "areas", paint: {
          "line-color": ["get", "color"], "line-width": ["case", ["get", "selected"], 3, 1.6], "line-dasharray": [2, 1.5],
        } });

        // Edifici e rilievo reali, se lo sfondo vettoriale li offre.
        const vector = Object.entries(m.getStyle().sources ?? {}).find(([, s]) => s.type === "vector")?.[0];
        if (vector) {
          m.addLayer({ id: "tq-buildings", type: "fill-extrusion", source: vector, "source-layer": "building", minzoom: 13, layout: { visibility: "none" }, paint: {
            "fill-extrusion-color": "#dcdbd5", "fill-extrusion-opacity": 0.9,
            "fill-extrusion-height": ["coalesce", ["get", "render_height"], 8],
            "fill-extrusion-base": ["coalesce", ["get", "render_min_height"], 0],
          } });
        }
        try {
          m.addSource("tq-dem", { type: "raster-dem", tiles: [DEM_URL], tileSize: 256, maxzoom: 14, encoding: "terrarium", attribution: "Rilievo © Mapzen, AWS Terrain Tiles" });
        } catch { /* senza rilievo la mappa resta piana */ }

        m.addLayer({ id: "model", type: "fill-extrusion", source: "model", layout: { visibility: "none" }, paint: {
          "fill-extrusion-color": ["get", "color"], "fill-extrusion-height": ["get", "h"], "fill-extrusion-opacity": 0.94,
        } });

        m.addLayer({ id: "obs", type: "circle", source: "observations", paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 11, 3, 16, 7],
          "circle-color": ["case", ["==", ["get", "status"], "flagged"], "#8b8f98", ["get", "color"]],
          "circle-opacity": ["case", ["==", ["get", "status"], "validated"], 1, 0.45],
          "circle-stroke-color": "#ffffff", "circle-stroke-width": 1.5,
        } });
        m.addLayer({ id: "players-halo", type: "circle", source: "players", paint: {
          "circle-radius": 14, "circle-color": ["get", "color"], "circle-opacity": ["case", ["get", "online"], 0.22, 0.06],
        } });
        m.addLayer({ id: "players", type: "circle", source: "players", paint: {
          "circle-radius": 6, "circle-color": ["get", "color"], "circle-opacity": ["case", ["get", "online"], 1, 0.4],
          "circle-stroke-color": "#0b0b0c", "circle-stroke-width": 2,
        } });
        m.addLayer({ id: "draft-fill", type: "fill", source: "draft", filter: ["==", ["geometry-type"], "Polygon"], paint: { "fill-color": "#0b0b0c", "fill-opacity": 0.1 } });
        m.addLayer({ id: "draft-line", type: "line", source: "draft", filter: ["==", ["geometry-type"], "LineString"], paint: { "line-color": "#0b0b0c", "line-width": 2 } });
        m.addLayer({ id: "draft-points", type: "circle", source: "draft", filter: ["==", ["geometry-type"], "Point"], paint: { "circle-radius": 5, "circle-color": "#ffffff", "circle-stroke-color": "#0b0b0c", "circle-stroke-width": 2 } });
        m.addLayer({ id: "edit-fill", type: "fill", source: "edit", filter: ["==", ["geometry-type"], "Polygon"], paint: { "fill-color": "#0b0b0c", "fill-opacity": 0.1 } });
        m.addLayer({ id: "edit-line", type: "line", source: "edit", filter: ["==", ["geometry-type"], "Polygon"], paint: { "line-color": "#0b0b0c", "line-width": 2 } });
        m.addLayer({ id: "edit-mid", type: "circle", source: "edit", filter: ["==", ["get", "kind"], "mid"], paint: { "circle-radius": 4, "circle-color": "#0b0b0c", "circle-opacity": 0.35 } });
        m.addLayer({ id: "edit-vertex", type: "circle", source: "edit", filter: ["==", ["get", "kind"], "vertex"], paint: { "circle-radius": 7, "circle-color": "#ffffff", "circle-stroke-color": "#0b0b0c", "circle-stroke-width": 2.5 } });
        m.addLayer({ id: "pin-halo", type: "circle", source: "pin", paint: { "circle-radius": 18, "circle-color": "#0b0b0c", "circle-opacity": 0.14 } });
        m.addLayer({ id: "pin", type: "circle", source: "pin", paint: { "circle-radius": 7, "circle-color": "#0b0b0c", "circle-stroke-color": "#37e08b", "circle-stroke-width": 3 } });

        ready.current = true;
        sync();

        latest.current.onReady?.({
          corners: () => {
            const b = m.getBounds();
            return [[b.getWest(), b.getNorth()], [b.getEast(), b.getNorth()], [b.getEast(), b.getSouth()], [b.getWest(), b.getSouth()]];
          },
          classify: (cells) => {
            const out: Record<string, Environment> = {};
            const { clientWidth: w, clientHeight: h } = m.getContainer();
            const ours = new Set(["model", "cells-fill", "cells-line", "areas-fill", "areas-line", "tq-buildings"]);
            for (const cell of cells) {
              const [lat, lng] = cellToLatLng(cell);
              const px = m.project([lng, lat]);
              if (px.x < 0 || px.y < 0 || px.x > w || px.y > h) continue;
              const env = environmentFrom(m.queryRenderedFeatures(px).filter((f) => !ours.has(f.layer.id) || f.layer.id === "tq-buildings"));
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
        const cell = String(hit(e, "model")?.properties?.cell ?? cellOf(e.lngLat.lng, e.lngLat.lat));
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
        const o = hit(e, "obs");
        if (o && cur.onObservationClick) return cur.onObservationClick(String(o.properties.id));
        const a = hit(e, "areas-fill");
        if (a && cur.onAreaClick) cur.onAreaClick(String(a.properties.id));
      });
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
    <div className={props.className} style={{ cursor }}>
      <div ref={el} className="size-full" />
    </div>
  );
}
