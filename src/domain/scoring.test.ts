import { describe, expect, it } from "vitest";
import { cellOf, cellsOf, closeRing, pointInPolygon } from "./geo";
import { indicators, missionProgress, novelty, scoreObservations } from "./scoring";
import { phaseOf } from "./time";
import { toCSV, toGeoJSON } from "./export";
import { kindOf, pathLength, perHour, summary } from "./forms";
import { bearing, metersBetween, nearestDark, stepMeters, windOf } from "./walk";
import type { CampaignData, Observation } from "./types";

const square = closeRing([[7.68, 45.06], [7.69, 45.06], [7.69, 45.07], [7.68, 45.07]]);
let n = 0;
const obs = (p: Partial<Observation>): Observation => ({
  id: `o${++n}`, campaign_id: "c", author_id: "anna", team_id: "t1", area_id: "a1", theme_id: "th1",
  kind: "field", title: "Luogo", note: "", feeling: null, source_url: null, media_path: null,
  lng: 7.685, lat: 45.065, cell: cellOf(7.685, 45.065), status: "pending", quality: null,
  validated_by: null, validated_at: null, created_at: `2026-11-01T10:00:${String(n).padStart(2, "0")}Z`, ...p,
});
const base = (observations: Observation[]): CampaignData => ({
  campaign: { id: "c", owner_id: "m", name: "Aurora", description: "", join_code: "AURORA", status: "live",
    starts_at: "2026-11-01T00:00:00Z", ends_at: "2026-12-01T00:00:00Z", center_lng: 7.68, center_lat: 45.06, zoom: 13, created_at: "" },
  teams: [{ id: "t1", campaign_id: "c", name: "Uno", color: "#000" }, { id: "t2", campaign_id: "c", name: "Due", color: "#111" }],
  members: [
    { id: "1", campaign_id: "c", user_id: "anna", team_id: "t1", role: "player", field_role: null, status: "active", joined_at: "", last_seen_at: null, last_lng: null, last_lat: null },
    { id: "2", campaign_id: "c", user_id: "bruno", team_id: "t2", role: "player", field_role: null, status: "active", joined_at: "", last_seen_at: null, last_lng: null, last_lat: null },
  ],
  areas: [{ id: "a1", campaign_id: "c", team_id: null, name: "Aurora", color: "#000", geometry: square, opens_at: null, closes_at: null }],
  themes: [{ id: "th1", campaign_id: "c", name: "Ambiente", color: "#000", sort: 1 }],
  missions: [], observations, announcements: [], walks: [],
});

describe("punteggio cooperativo", () => {
  it("non assegna punti finché nessuno valida", () => {
    const [s] = scoreObservations([obs({})]);
    expect(s.value).toBe(0);
    expect(s.potential).toBe(10);
  });

  it("premia la qualità, non la quantità", () => {
    const high = scoreObservations([obs({ status: "validated", quality: 3 })])[0].value;
    const low = scoreObservations([obs({ status: "validated", quality: 1 })])[0].value;
    expect(high).toBe(15);
    expect(low).toBe(5);
  });

  it("riduce il valore dei doppioni nella stessa cella e tema", () => {
    const many = Array.from({ length: 6 }, () => obs({ status: "validated", quality: 2 }));
    const values = scoreObservations(many).map((s) => s.value);
    expect(values).toEqual([10, 5, 2.5, 1.3, 0.6, 0.6]);
    expect(novelty(0)).toBe(1);
  });

  it("un rilievo altrove o su un altro tema torna a valere pieno", () => {
    const s = scoreObservations([
      obs({ status: "validated", quality: 2 }),
      obs({ status: "validated", quality: 2, theme_id: "th2" }),
      obs({ status: "validated", quality: 2, lng: 7.689, lat: 45.069, cell: cellOf(7.689, 45.069) }),
    ]);
    expect(s.map((x) => x.value)).toEqual([10, 10, 10]);
  });

  it("i rilievi segnalati non contano e non consumano novità", () => {
    const s = scoreObservations([obs({ status: "flagged" }), obs({ status: "validated", quality: 2 })]);
    expect(s[0].value).toBe(0);
    expect(s[1].novelty).toBe(1);
  });
});

describe("indicatori collettivi", () => {
  it("misura copertura, equilibrio, affidabilità e scambio", () => {
    const i = indicators(base([
      obs({ status: "validated", quality: 2, validated_by: "bruno" }),
      obs({ kind: "desk", lng: 7.689, lat: 45.069, cell: cellOf(7.689, 45.069) }),
    ]));
    expect(i.cellsTotal).toBe(cellsOf(square).length);
    expect(i.cellsCovered).toBe(2);
    expect(i.coverage).toBeGreaterThan(0);
    expect(i.reliability).toBe(0.5);
    expect(i.exchange).toBe(1);
    expect(i.balance).toBe(0);
    expect(i.score).toBe(10);
    expect(i.byTeam).toEqual({ t1: 10 });
  });
});

describe("missioni e tempi", () => {
  it("calcola l'avanzamento dentro la finestra della missione", () => {
    const data = base([obs({}), obs({ created_at: "2026-12-20T10:00:00Z" })]);
    const p = missionProgress(
      { id: "m", campaign_id: "c", title: "", description: "", kind: "observations", target: 2, theme_id: null, area_id: null,
        starts_at: "2026-11-01T00:00:00Z", ends_at: "2026-11-15T00:00:00Z" },
      data, new Date("2026-11-05T00:00:00Z"));
    expect(p.current).toBe(1);
    expect(p.state).toBe("active");
  });

  it("deriva la fase da stato e date", () => {
    const c = { status: "live" as const, starts_at: "2026-11-01T00:00:00Z", ends_at: "2026-12-01T00:00:00Z" };
    expect(phaseOf(c, new Date("2026-10-01"))).toBe("upcoming");
    expect(phaseOf(c, new Date("2026-11-10"))).toBe("live");
    expect(phaseOf(c, new Date("2027-01-01"))).toBe("ended");
    expect(phaseOf({ ...c, status: "paused" }, new Date("2026-11-10"))).toBe("paused");
  });
});

describe("forme di raccolta", () => {
  it("ricava Field, Desk e Feel dalla forma", () => {
    expect(kindOf("percezione")).toBe("feel");
    expect(kindOf("idea")).toBe("feel");
    expect(kindOf("dato", false)).toBe("desk");
    expect(kindOf("informazione", true)).toBe("field");
    expect(kindOf("flusso")).toBe("field");
  });

  it("riassume un flusso contato e tracciato", () => {
    const flow = obs({ form: "flusso", data: { mode: "piedi", intensity: 4, count: 30, minutes: 10 }, path: [[7.68, 45.06], [7.681, 45.06]] });
    expect(perHour(flow.data!)).toBe(180);
    expect(pathLength(flow.path)).toBeGreaterThan(70);
    expect(summary(flow)).toContain("A piedi · intensità 4/5 · 180 passaggi/ora");
    const g = toGeoJSON(base([flow]));
    expect(g.features[0].geometry.type).toBe("LineString");
    expect(g.features[0].properties).toMatchObject({ layer: "flussi", forma: "flusso", modo: "piedi" });
  });
});

describe("geografia ed export", () => {
  it("riconosce i punti dentro l'area", () => {
    expect(pointInPolygon(7.685, 45.065, square)).toBe(true);
    expect(pointInPolygon(7.7, 45.065, square)).toBe(false);
  });

  it("esporta GeoJSON e CSV coerenti", () => {
    const data = base([obs({ title: 'Parco "Dora", nord' })]);
    const g = toGeoJSON(data);
    expect(g.features).toHaveLength(2);
    expect(g.features[0].geometry).toEqual({ type: "Point", coordinates: [7.685, 45.065] });
    const csv = toCSV(data).split("\n");
    expect(csv[0].startsWith("id,data,forma,tipo,lente,titolo")).toBe(true);
    expect(csv[1]).toContain('"Parco ""Dora"", nord"');
  });
});

describe("uscite a piedi", () => {
  it("misura distanza e direzione", () => {
    const a: [number, number] = [7.68, 45.06], north: [number, number] = [7.68, 45.061], east: [number, number] = [7.6813, 45.06];
    expect(Math.round(metersBetween(a, north))).toBe(111);
    expect(Math.round(bearing(a, north))).toBe(0);
    expect(windOf(bearing(a, east))).toBe("est");
  });

  it("scarta il rumore GPS e i salti", () => {
    const a: [number, number] = [7.68, 45.06];
    expect(stepMeters(a, [7.68001, 45.06])).toBe(0);
    expect(stepMeters(a, [7.69, 45.07])).toBe(0);
    expect(stepMeters(a, [7.68, 45.0603], 80)).toBe(0);
    expect(Math.round(stepMeters(a, [7.68, 45.0603]))).toBe(33);
  });

  it("indica la cella spenta più vicina", () => {
    const here = cellOf(7.685, 45.065), far = cellOf(7.689, 45.069), near = cellOf(7.686, 45.0655);
    const t = nearestDark([7.685, 45.065], [here, far, near], new Set([here]));
    expect(t?.cell).toBe(near);
    expect(t!.meters).toBeLessThan(150);
  });
});
