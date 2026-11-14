import { cellToBoundary, latLngToCell, polygonToCells } from "h3-js";
import type { Area, Polygon } from "./types";

/** Risoluzione H3 della griglia di copertura (esagoni di circa 65 m di lato). */
export const CELL_RESOLUTION = 10;

export const cellOf = (lng: number, lat: number) => latLngToCell(lat, lng, CELL_RESOLUTION);

export function pointInPolygon(lng: number, lat: number, polygon: Polygon): boolean {
  const ring = polygon.coordinates[0];
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export const areaAt = (lng: number, lat: number, areas: Area[]) =>
  areas.find((a) => pointInPolygon(lng, lat, a.geometry)) ?? null;

/** Celle della griglia contenute in un poligono. */
export function cellsOf(polygon: Polygon): string[] {
  try {
    return polygonToCells(polygon.coordinates, CELL_RESOLUTION, true);
  } catch {
    return [];
  }
}

/** Contorno di una cella come anello GeoJSON chiuso [lng, lat]. */
export function cellRing(cell: string): [number, number][] {
  const ring = cellToBoundary(cell, true) as [number, number][];
  return ring;
}

export function closeRing(points: [number, number][]): Polygon {
  const ring = [...points];
  const [fx, fy] = ring[0];
  const [lx, ly] = ring[ring.length - 1];
  if (fx !== lx || fy !== ly) ring.push([fx, fy]);
  return { type: "Polygon", coordinates: [ring] };
}

export function boundsOf(polygons: Polygon[]): [[number, number], [number, number]] | null {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of polygons)
    for (const [x, y] of p.coordinates[0]) {
      minX = Math.min(minX, x); maxX = Math.max(maxX, x);
      minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    }
  return Number.isFinite(minX) ? [[minX, minY], [maxX, maxY]] : null;
}

/** Superficie approssimata in ettari (proiezione locale equirettangolare). */
export function hectares(polygon: Polygon): number {
  const ring = polygon.coordinates[0];
  if (ring.length < 4) return 0;
  const lat0 = (ring[0][1] * Math.PI) / 180;
  const kx = 111320 * Math.cos(lat0);
  const ky = 110540;
  let sum = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    sum += ring[i][0] * kx * (ring[i + 1][1] * ky) - ring[i + 1][0] * kx * (ring[i][1] * ky);
  }
  return Math.abs(sum) / 2 / 10000;
}
