import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { cssTokens, rgb } from "./palette";

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
});
