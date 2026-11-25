import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { BASE, contrast, cssTokens, FORM_COLOR, HUE, ON_INK, PLACE_COLOR, readable, rgb, TEAM_COLORS } from "./palette";

const files = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => { const p = join(dir, f); return statSync(p).isDirectory() ? files(p) : [p]; });

describe("palette", () => {
  it("i token di globals.css coincidono con palette.ts (altrimenti: npm run palette)", () => {
    const css = readFileSync("src/app/globals.css", "utf8");
    for (const [name, value] of Object.entries(cssTokens())) {
      expect(css, `--color-${name}`).toContain(`--color-${name}: ${value};`);
    }
  });

  it("nessun colore esadecimale scritto a mano fuori dalla palette", () => {
    const allowed = ["src/domain/palette.ts", "src/app/design/page.tsx"];
    const offenders = files("src")
      .filter((p) => /\.(ts|tsx)$/.test(p) && !p.endsWith(".test.ts") && !allowed.includes(p))
      .filter((p) => /["'`\[(,_ ]#[0-9a-fA-F]{6}\b/.test(readFileSync(p, "utf8")));
    expect(offenders).toEqual([]);
  });

  it("converte un colore in RGB", () => {
    expect(rgb("#2b2118")).toEqual([43, 33, 24]);
  });

  it("leggibilità AA: testi principali, secondari e tenui su carta e schede", () => {
    for (const bg of [BASE.paper, BASE.card]) {
      expect(contrast(BASE.ink, bg)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(BASE.graphite, bg)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(BASE.mute, bg)).toBeGreaterThanOrEqual(4.5);
    }
    expect(contrast(ON_INK.cream, BASE.brown)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(HUE.glow, BASE.brown)).toBeGreaterThanOrEqual(4.5); // ocra su pannelli scuri
    expect(contrast(BASE.ink, HUE.glow)).toBeGreaterThanOrEqual(4.5); // pulsante Parti
  });

  it("le etichette colorate, rese leggibili, superano AA; il bianco si legge su luoghi e squadre", () => {
    for (const c of [...Object.values(FORM_COLOR), ...Object.values(PLACE_COLOR)]) {
      expect(contrast(readable(c), BASE.card)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(readable(c, BASE.paper), BASE.paper)).toBeGreaterThanOrEqual(4.5);
    }
    for (const c of [...Object.values(PLACE_COLOR), ...TEAM_COLORS]) expect(contrast(BASE.white, c)).toBeGreaterThanOrEqual(3);
  });
});
