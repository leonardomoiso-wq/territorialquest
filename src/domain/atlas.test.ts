import { describe, expect, it } from "vitest";
import { atlasOf, filled } from "./atlas";
import { cellOf } from "./geo";
import type { Area, Observation, Place, Visit, Walk } from "./types";

const square = (lng: number, lat: number, d = 0.004): Area["geometry"] => ({
  type: "Polygon", coordinates: [[[lng - d, lat - d], [lng + d, lat - d], [lng + d, lat + d], [lng - d, lat + d], [lng - d, lat - d]]],
});

describe("atlante collettivo", () => {
  const area = { id: "a1", campaign_id: "c", name: "Parco", color: "#000", geometry: square(7.68, 45.08), environment: "verde" } as unknown as Area;
  const obs = (form: string, status: Observation["status"], at: string) =>
    ({ id: form + at, form, status, created_at: at, cell: cellOf(7.68, 45.08), lng: 7.68, lat: 45.08 }) as unknown as Observation;
  const place = { id: "p1", category: "storico" } as unknown as Place;
  const visit = { id: "v1", place_id: "p1", created_at: "2026-11-02T10:00:00Z" } as unknown as Visit;

  it("riempie forme, tipi di luogo e ambienti dai dati di tutti i team", () => {
    const a = atlasOf({
      observations: [obs("dato", "validated", "2026-11-03T10:00:00Z"), obs("dato", "pending", "2026-11-01T10:00:00Z"), obs("idea", "flagged", "2026-11-01T09:00:00Z")],
      visits: [visit], places: [place], areas: [area], walks: [] as Walk[],
    });
    const dato = a.forms.find((f) => f.id === "dato")!;
    expect(dato.count).toBe(2);
    expect(dato.first).toBe("2026-11-01T10:00:00Z");
    expect(a.forms.find((f) => f.id === "idea")!.count).toBe(0); // i rilievi segnalati non contano
    expect(a.places.find((p) => p.id === "storico")!.count).toBe(1);
    expect(a.environments.find((e) => e.id === "verde")!.count).toBe(1);
    expect(filled(a.forms)).toBe(1);
  });

  it("conta gli ambienti attraversati a piedi", () => {
    const walk = { id: "w", started_at: "2026-11-04T08:00:00Z", cells: [cellOf(7.681, 45.081)] } as unknown as Walk;
    const a = atlasOf({ observations: [], visits: [], places: [], areas: [area], walks: [walk] });
    expect(a.environments.find((e) => e.id === "verde")!.first).toBe("2026-11-04T08:00:00Z");
  });
});
