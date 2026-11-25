// Riscrive i token colore di src/app/globals.css a partire da src/domain/palette.ts.
// Uso: npm run palette
import { readFileSync, writeFileSync } from "node:fs";

const { cssTokens } = await import("../src/domain/palette.ts");
const file = new URL("../src/app/globals.css", import.meta.url);
const css = readFileSync(file, "utf8");
const START = "/* palette:inizio (generato da src/domain/palette.ts con npm run palette: non modificare a mano) */";
const END = "/* palette:fine */";
const i = css.indexOf(START), j = css.indexOf(END);
if (i < 0 || j < 0) throw new Error("Segnaposto della palette non trovati in globals.css");
const lines = Object.entries(cssTokens()).map(([k, v]) => `  --color-${k}: ${v};`).join("\n");
writeFileSync(file, `${css.slice(0, i)}${START}\n${lines}\n  ${css.slice(j)}`);
console.log(`Palette: ${Object.keys(cssTokens()).length} colori scritti in globals.css`);
