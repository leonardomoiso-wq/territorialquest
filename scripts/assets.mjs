// Prepara le illustrazioni generate (vedi docs/ASSET-GEMINI.md) per l'app.
//
// Uso:  npm run assets              (legge asset-sorgenti/)
//       npm run assets -- cartella  (legge un'altra cartella)
//
// Per ogni immagine:
// 1. toglie lo sfondo verde pieno (#00FF00) e il riflesso verde sui bordi (oggetti ritagliati);
// 2. la porta in scala di grigi e ne stira i toni (il più scuro diventa nero, il più chiaro bianco),
//    così l'app può ricolorarla con inchiostro, accento e carta del tema;
// 3. ritaglia i bordi vuoti, centra gli oggetti in un quadrato con margine;
// 4. salva WebP nelle misure d'uso in public/assets/<gruppo>/;
// 5. riscrive src/domain/assets.generated.ts con l'elenco degli asset disponibili.
import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { basename, extname, join } from "node:path";
import sharp from "sharp";

const SRC = process.argv[2] ?? "asset-sorgenti";
const OUT = process.env.TQ_ASSETS_OUT ?? "public/assets";
const REGISTRY = process.env.TQ_ASSETS_REGISTRY ?? "src/domain/assets.generated.ts";

/** Gruppo, misure e trattamento per prefisso del nome del file. */
const RULES = [
  { prefix: "atlante-", group: "atlante", sizes: [512, 256], cutout: true, square: true },
  { prefix: "toppa-", group: "toppe", sizes: [512, 256], cutout: true, square: true },
  { prefix: "stemma-", group: "toppe", sizes: [512, 256], cutout: true, square: true },
  // le texture tengono i loro toni (la grana leggera non va stirata); quelle a riempimento si ripetono a specchio
  { prefix: "texture-strappo", group: "texture", sizes: [2048], cutout: true, square: false, keepTones: true },
  // le curve non si specchiano (diventerebbero un caleidoscopio): fondo intero, sezioni in modalità «cover»
  { prefix: "texture-curve", group: "texture", sizes: [2000], cutout: false, square: false, keepTones: true },
  { prefix: "texture-", group: "texture", sizes: [1024], cutout: false, square: false, tile: true, keepTones: true },
  { prefix: "icone-", group: null },
  { prefix: "", group: "scene", sizes: [1600, 800], cutout: false, square: false },
];

if (!existsSync(SRC)) {
  console.error(`Cartella ${SRC} non trovata. Metti lì le immagini generate con i nomi di docs/ASSET-GEMINI.md.`);
  process.exit(1);
}

const done = [];
for (const file of readdirSync(SRC).sort()) {
  if (!/\.(png|jpe?g|webp)$/i.test(file)) continue;
  const name = basename(file, extname(file)).toLowerCase();
  const rule = RULES.find((r) => name.startsWith(r.prefix));
  if (!rule.group) { console.log(`– ${file}: solo riferimento, non pubblicato`); continue; }

  const { data, info } = await sharp(join(SRC, file)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const px = info.width * info.height;
  const lum = new Float32Array(px);
  const alpha = new Uint8ClampedArray(px);
  // fondo verde da ritagliare oppure fondo bianco (che nell'app diventa il colore carta)
  const greenBg = rule.cutout && data[1] - Math.max(data[0], data[2]) > 90;
  const whiteBg = rule.cutout && !greenBg;
  // luminosità del fondo chiaro, misurata sui quattro angoli (Gemini lo fa bianco o grigio chiarissimo)
  const L = (i) => 0.2126 * data[i * 4] + 0.7152 * data[i * 4 + 1] + 0.0722 * data[i * 4 + 2];
  const bgL = Math.min(...[0, info.width - 1, (info.height - 1) * info.width, px - 1].map(L));

  for (let i = 0; i < px; i++) {
    let r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2], a = data[i * 4 + 3];
    if (greenBg) {
      // quanto il pixel è «verde sfondo»: verde molto più forte di rosso e blu
      const green = g - Math.max(r, b);
      if (green > 90) a = 0;
      else if (green > 30) a = Math.round(a * (1 - (green - 30) / 60));
      if (green > 0) g = Math.max(r, b); // toglie il riflesso verde sui bordi
    }
    lum[i] = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    // fondo bianco: il quasi bianco diventa trasparente, così sotto si vede la carta vera dell'interfaccia
    if (whiteBg) a = lum[i] > bgL - 5 ? 0 : lum[i] > bgL - 25 ? Math.round(a * (bgL - 5 - lum[i]) / 20) : a;
    alpha[i] = a;
  }

  // livelli: percentili 1% e 99% dei pixel visibili diventano nero e bianco
  const visible = [];
  for (let i = 0; i < px; i += 3) if (alpha[i] > 200) visible.push(lum[i]);
  visible.sort((x, y) => x - y);
  const lo = rule.keepTones ? 0 : visible[Math.floor(visible.length * 0.01)] ?? 0;
  const hi = rule.keepTones ? 255 : visible[Math.floor(visible.length * 0.99)] ?? 255;
  const span = Math.max(1, hi - lo);

  // accento tarato: il grigio più frequente tra i toni medi va a metà scala,
  // così nell'app prende pieno il colore d'accento (gamma sui toni, nero e bianco restano)
  let gamma = 1;
  if (!rule.keepTones) {
    const hist = new Array(256).fill(0);
    for (let i = 0; i < px; i += 2) if (alpha[i] > 200) { const v = Math.round(((lum[i] - lo) / span) * 255); if (v >= 70 && v <= 215) hist[v]++; }
    let peak = 0;
    for (let v = 70; v <= 215; v++) if (hist[v] > hist[peak]) peak = v;
    if (peak > 0) gamma = Math.log(0.5) / Math.log(peak / 255);
  }

  const out = Buffer.alloc(px * 2);
  for (let i = 0; i < px; i++) {
    const t = Math.max(0, Math.min(1, (lum[i] - lo) / span));
    out[i * 2] = Math.round(Math.pow(t, gamma) * 255);
    out[i * 2 + 1] = alpha[i];
  }

  let img = sharp(out, { raw: { width: info.width, height: info.height, channels: 2 } });
  if (greenBg) img = sharp(await img.png().toBuffer()).trim({ threshold: 1 });
  // fondo bianco: si tolgono i margini bianchi (soglia larga per la grana della carta)
  if (whiteBg) img = sharp(await img.png().toBuffer()).trim({ threshold: 1 });
  let base = await img.png().toBuffer();
  if (rule.square) {
    const meta = await sharp(base).metadata();
    const side = Math.round(Math.max(meta.width, meta.height) * 1.12);
    base = await sharp({ create: { width: side, height: side, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite([{ input: base, gravity: "centre" }]).png().toBuffer();
  }

  if (rule.tile) {
    // ripetizione senza giunture: la metà sinistra-alta specchiata in un quadrato 2×2
    const meta = await sharp(base).metadata();
    const side = Math.min(meta.width, meta.height);
    const q = await sharp(base).extract({ left: 0, top: 0, width: side, height: side }).resize(512, 512).png().toBuffer();
    const fx = await sharp(q).flop().png().toBuffer(), fy = await sharp(q).flip().png().toBuffer(), fxy = await sharp(q).flip().flop().png().toBuffer();
    base = await sharp({ create: { width: 1024, height: 1024, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } } })
      .composite([{ input: q, left: 0, top: 0 }, { input: fx, left: 512, top: 0 }, { input: fy, left: 0, top: 512 }, { input: fxy, left: 512, top: 512 }]).png().toBuffer();
  }

  const dir = join(OUT, rule.group);
  mkdirSync(dir, { recursive: true });
  // atlante-forma-idea → atlante/forma-idea; toppa-fiume → toppe/fiume; texture-carta → texture/carta; stemma-base resta
  const slug = name.replace(/^(atlante|toppa|texture)-/, "");
  for (const size of rule.sizes) {
    const resized = sharp(base).resize(rule.tile ? { width: size, height: size, fit: "cover" } : { width: size, height: rule.square ? size : undefined, fit: "inside", withoutEnlargement: true });
    const target = join(dir, rule.sizes.length > 1 && size !== rule.sizes[0] ? `${slug}-${size}.webp` : `${slug}.webp`);
    await resized.webp({ quality: 86, alphaQuality: 90 }).toFile(target);
  }
  done.push(`${rule.group}/${slug}`);
  console.log(`✓ ${file} → ${rule.group}/${slug}.webp (toni ${Math.round(lo)}–${Math.round(hi)}, accento γ ${gamma.toFixed(2)}${whiteBg ? ", fondo bianco" : greenBg ? ", ritagliato" : ""})`);
}

const list = [...new Set(done)].sort();
writeFileSync(REGISTRY, `// Generato da scripts/assets.mjs: non modificare a mano.
/** Illustrazioni disponibili in public/assets (gruppo/nome, senza estensione). */
export const ASSETS: ReadonlySet<string> = new Set(${JSON.stringify(list, null, 2)});
`);
console.log(`\n${list.length} asset pronti in ${OUT}, elenco in ${REGISTRY}`);
