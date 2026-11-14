"use client";

import { Map as MLMap, NavigationControl, setWorkerUrl, type GeoJSONSource, type MapMouseEvent, type StyleSpecification } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef } from "react";
import { boundsOf, cellRing, cellsOf } from "@/domain/geo";
import type { Area, Observation } from "@/domain/types";

setWorkerUrl("/maplibre-gl-worker.mjs");

const STYLE_URL = "https://tiles.openfreemap.org/styles/positron";
/** Stile di riserva se le tessere non sono raggiungibili: restano visibili i dati. */
const BLANK: StyleSpecification = {
  version: 8,
  sources: {},
  layers: [{ id: "bg", type: "background", paint: { "background-color": "#e7e6df" } }],
};

const KIND_COLOR = { field: "#17804f", desk: "#2f6fe0", feel: "#e2578f" };

export interface MapPlayer {
  id: string;
  name: string;
  color: string;
  lng: number;
  lat: number;
  online: boolean;
}

interface Props {
  center: [number, number];
  zoom: number;
  areas?: Area[];
  observations?: Observation[];
  players?: MapPlayer[];
  /** Mostra la griglia di copertura sulle aree. */
  grid?: boolean;
  selectedAreaId?: string | null;
  /** Vertici del poligono in corso di disegno. */
  draft?: [number, number][];
  /** Punto scelto per una nuova osservazione. */
  pin?: [number, number] | null;
  onClick?: (lngLat: [number, number]) => void;
  onAreaClick?: (id: string) => void;
  onObservationClick?: (id: string) => void;
  onMove?: (center: [number, number], zoom: number) => void;
  /** Adatta la vista alle aree al primo caricamento. */
  fit?: boolean;
  pitch?: number;
  interactive?: boolean;
  /** Pulsanti di zoom (su telefono basta il gesto). */
  controls?: boolean;
  className?: string;
}

type FC = GeoJSON.FeatureCollection;
const fc = (features: GeoJSON.Feature[]): FC => ({ type: "FeatureCollection", features });

export default function MapView(props: Props) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<MLMap | null>(null);
  const ready = useRef(false);
  const latest = useRef(props);
  const fitted = useRef(false);

  const sync = () => {
    const m = map.current;
    if (!m || !ready.current) return;
    const p = latest.current;
    const set = (id: string, data: FC) => (m.getSource(id) as GeoJSONSource | undefined)?.setData(data);

    set("areas", fc((p.areas ?? []).map((a) => ({
      type: "Feature", id: a.id, geometry: a.geometry,
      properties: { id: a.id, name: a.name, color: a.color, selected: a.id === p.selectedAreaId },
    }))));

    const counts = new Map<string, number>();
    for (const o of p.observations ?? []) if (o.cell && o.status !== "flagged") counts.set(o.cell, (counts.get(o.cell) ?? 0) + 1);
    const cells = new Set<string>();
    if (p.grid) for (const a of p.areas ?? []) for (const c of cellsOf(a.geometry)) cells.add(c);
    for (const c of counts.keys()) cells.add(c);
    set("cells", fc([...cells].map((c) => ({
      type: "Feature", geometry: { type: "Polygon", coordinates: [cellRing(c)] }, properties: { n: counts.get(c) ?? 0 },
    }))));

    set("observations", fc((p.observations ?? []).map((o) => ({
      type: "Feature", geometry: { type: "Point", coordinates: [o.lng, o.lat] },
      properties: { id: o.id, color: KIND_COLOR[o.kind], status: o.status },
    }))));

    set("players", fc((p.players ?? []).map((u) => ({
      type: "Feature", geometry: { type: "Point", coordinates: [u.lng, u.lat] },
      properties: { name: u.name, color: u.color, online: u.online },
    }))));

    const d = p.draft ?? [];
    set("draft", fc([
      ...(d.length >= 3 ? [{ type: "Feature" as const, geometry: { type: "Polygon" as const, coordinates: [[...d, d[0]]] }, properties: {} }] : []),
      ...(d.length >= 2 ? [{ type: "Feature" as const, geometry: { type: "LineString" as const, coordinates: d }, properties: {} }] : []),
      ...d.map((c) => ({ type: "Feature" as const, geometry: { type: "Point" as const, coordinates: c }, properties: {} })),
    ]));

    set("pin", fc(p.pin ? [{ type: "Feature", geometry: { type: "Point", coordinates: p.pin }, properties: {} }] : []));

    if (p.fit && !fitted.current && p.areas?.length) {
      const b = boundsOf(p.areas.map((a) => a.geometry));
      if (b) {
        fitted.current = true;
        m.fitBounds(b, { padding: Math.min(80, m.getContainer().clientWidth / 8), duration: 0, maxZoom: 16 });
      }
    }
  };

  useEffect(() => {
    if (!el.current) return;
    let cancelled = false;
    const p = latest.current;

    const start = (style: StyleSpecification | string) => {
      if (cancelled || !el.current) return;
      const m = new MLMap({
        container: el.current,
        style,
        center: p.center,
        zoom: p.zoom,
        pitch: p.pitch ?? 0,
        interactive: p.interactive ?? true,
        attributionControl: { compact: true },
      });
      map.current = m;
      if ((p.interactive ?? true) && (p.controls ?? true)) m.addControl(new NavigationControl({ showCompass: false }), "top-right");

      m.on("load", () => {
        const empty = fc([]);
        for (const id of ["areas", "cells", "observations", "players", "draft", "pin"]) m.addSource(id, { type: "geojson", data: empty });

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
        m.addLayer({ id: "pin-halo", type: "circle", source: "pin", paint: { "circle-radius": 18, "circle-color": "#0b0b0c", "circle-opacity": 0.14 } });
        m.addLayer({ id: "pin", type: "circle", source: "pin", paint: { "circle-radius": 7, "circle-color": "#0b0b0c", "circle-stroke-color": "#37e08b", "circle-stroke-width": 3 } });

        ready.current = true;
        sync();
      });

      m.on("click", (e: MapMouseEvent) => {
        const cur = latest.current;
        const hit = (layer: string) => m.getLayer(layer) ? m.queryRenderedFeatures(e.point, { layers: [layer] })[0] : undefined;
        // In disegno o scelta del punto, il tocco serve a posizionare.
        if (cur.onClick) return cur.onClick([e.lngLat.lng, e.lngLat.lat]);
        const o = hit("obs");
        if (o && cur.onObservationClick) return cur.onObservationClick(String(o.properties.id));
        const a = hit("areas-fill");
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

  const cursor = props.onClick ? "crosshair" : undefined;
  return (
    <div className={props.className} style={{ cursor }}>
      <div ref={el} className="size-full" />
    </div>
  );
}
