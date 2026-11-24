import { describe, expect, it } from "vitest";
import { categoryColors, classify, compare, guessSource, layersBounds, SERIES, withCategories, figuresFor, labelFor, nameFromFile, parseCSV, parseGeoJSON, pointsOf, series, type Dataset, type Draft } from "./datasets";

const asDataset = (d: Draft): Dataset => ({ id: "d", source: "", licence: "", note: "", color: "#000", public: true, ...d });

describe("lettura dei CSV", () => {
  it("riconosce separatore, virgolette e righe vuote", () => {
    const { header, rows } = parseCSV('﻿categoria;nome;lat\r\n"musei, biblioteche";"Museo ""Jasoni""";44,5\r\n\r\n');
    expect(header).toEqual(["categoria", "nome", "lat"]);
    expect(rows).toEqual([{ categoria: "musei, biblioteche", nome: 'Museo "Jasoni"', lat: "44,5" }]);
  });

  it("dà nomi leggibili a file e colonne", () => {
    expect(nameFromFile("2cbc205a-abitazioni_2021.csv")).toBe("Abitazioni 2021");
    expect(labelFor("pct_non_occupate")).toEqual({ label: "Abitazioni non occupate", unit: "%" });
    expect(labelFor("pct_giovani_attivi")).toEqual({ label: "Giovani attivi", unit: "%" });
    expect(labelFor("ar_frp3p4p").label).toContain("frana");
  });
});

describe("classificazione", () => {
  it("indicatori per Comune, con serie nel tempo", () => {
    const d = classify("censimenti.csv", "comune,anno,popolazione\nBerceto,1861,5988\nBerceto,2021,1996\nFidenza,2021,26981\n");
    expect(d.kind).toBe("indicatori");
    expect(d.key_column).toBe("comune");
    expect(d.time_column).toBe("anno");
    const ds = asDataset(d);
    const [f] = figuresFor([ds], "berceto");
    expect(f.value).toBe(1996);
    expect(f.year).toBe(2021);
    expect(f.series).toHaveLength(2);
    expect(compare(ds, "popolazione")[0]).toEqual({ key: "Fidenza", value: 26981, year: 2021 });
    expect(series(ds, "popolazione").find((s) => s.key === "Berceto")?.points.map((p) => p.t)).toEqual([1861, 2021]);
  });

  it("indicatori ripetuti per categoria (piramide) non finiscono nella scheda semplice", () => {
    const d = classify("piramide.csv", "comune,classe,maschi,femmine\nBerceto,0-4,19,23\nBerceto,5-9,26,26\n");
    expect(d.kind).toBe("indicatori");
    expect(d.category_column).toBe("classe");
    expect(figuresFor([asDataset(d)], "Berceto")).toHaveLength(0);
  });

  it("valori testuali restano testo (zona climatica, posti 10-15)", () => {
    const d = classify("geografia.csv", "comune,zona_climatica,alt_sede\nBerceto,F,808\n");
    expect(d.columns.find((c) => c.key === "zona_climatica")?.type).toBe("testo");
    expect(figuresFor([asDataset(d)], "Berceto").map((f) => f.value)).toEqual(["F", 808]);
  });

  it("punti con coordinate diventano uno strato", () => {
    const d = classify("osm_accoglienza_2026.csv", "tipo,cod,nome,lat,lon,comune\nostello,O,Ostello di Cassio,44.5851,10.0337,Terenzo\n");
    expect(d.kind).toBe("punti");
    expect(d.label_column).toBe("nome");
    expect(d.category_column).toBe("tipo");
    expect(pointsOf(asDataset(d))[0]).toMatchObject({ lng: 10.0337, lat: 44.5851, label: "Ostello di Cassio", category: "ostello" });
  });

  it("un elenco senza coordinate né numeri resta una tabella", () => {
    const d = classify("accoglienza.csv", "tappa,localita,comune,struttura\n19,Cella,Noceto,Comunità di Betania\n");
    expect(d.kind).toBe("tabella");
    expect(d.label_column).toBe("struttura");
  });
});

describe("fonti e strati", () => {
  it("riconosce fonte e licenza dal nome del file", () => {
    expect(guessSource("9181fee3-osm_accoglienza_2026.csv")).toEqual({ source: "OpenStreetMap", licence: "ODbL" });
    expect(guessSource("luoghi_wikidata_2026.csv").licence).toBe("CC0");
    expect(guessSource("tappe.csv").source).toBe("");
  });

  it("colora le categorie in ordine fisso e calcola l'estensione degli strati", () => {
    const d = asDataset(classify("servizi.csv", "tipo,nome,lat,lon\nbar,A,44.5,10.0\nbar,B,44.7,10.2\nfarmacia,C,44.6,10.1\n"));
    const colors = categoryColors(d);
    expect(colors.get("bar")).toBe(SERIES[0]);
    expect(colors.get("farmacia")).toBe(SERIES[1]);
    expect(layersBounds([d])).toEqual([[10.0, 44.5], [10.2, 44.7]]);
    expect(withCategories(d, new Set(["farmacia"])).rows).toHaveLength(1);
  });
});

describe("GeoJSON", () => {
  it("divide aree, linee e punti; dei multipoligoni tiene la parte maggiore", () => {
    const sq = (s: number) => [[[0, 0], [s, 0], [s, s], [0, s], [0, 0]]];
    const g = parseGeoJSON(JSON.stringify({ type: "FeatureCollection", features: [
      { type: "Feature", properties: { name: "Berceto" }, geometry: { type: "MultiPolygon", coordinates: [sq(1), sq(3)] } },
      { type: "Feature", properties: { name: "Via Francigena" }, geometry: { type: "LineString", coordinates: [[0, 0], [1, 1]] } },
      { type: "Feature", properties: { name: "Fontana" }, geometry: { type: "Point", coordinates: [10, 44] } },
    ] }));
    expect(g.areas[0].name).toBe("Berceto");
    expect(g.areas[0].geometry.coordinates[0][2]).toEqual([3, 3]);
    expect(g.lines.features).toHaveLength(1);
    expect(g.points[0]).toEqual({ nome: "Fontana", lng: 10, lat: 44 });
  });
});
