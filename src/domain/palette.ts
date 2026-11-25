/**
 * Palette unica di Territorial Quest («carta e mappa»): fondi neutri quasi bianchi, inchiostro quasi nero,
 * accenti saturi. Niente seppia nei neutri: il calore viene dagli accenti.
 *
 * È l'unico posto dove si scrivono colori. Da qui leggono:
 * - l'interfaccia: `npm run palette` riscrive i token `--color-*` in src/app/globals.css;
 * - la mappa (MapView), i tipi di luogo, le forme di raccolta, gli ambienti, i grafici;
 * - le illustrazioni in scala di grigi, ricolorate con inchiostro, carta e un accento.
 *
 * Per cambiare un colore: modificalo qui, poi esegui `npm run palette`.
 * Il test `palette.test.ts` segnala se i token CSS non sono allineati.
 */

/** Toni di base: carta, inchiostro e neutri. */
export const BASE = {
  ink: "#1c1e22",
  "ink-2": "#2a2d32",
  "ink-3": "#3a3d44",
  night: "#111316",
  paper: "#f3f2ee",
  "paper-2": "#e6e5e0",
  card: "#fbfaf7",
  edge: "#ffffff",
  white: "#ffffff",
  line: "#d3d3cf",
  mute: "#6a6d72",
  graphite: "#4c5058",
  brown: "#1f2226",
} as const;

/** Tinte d'accento con un nome: tutte le altre tabelle le riusano. */
export const HUE = {
  moss: "#2f4a2c",
  leaf: "#4a6b43",
  sage: "#b4c49c",
  "sage-2": "#9fb98a",
  glow: "#c47a1c",
  river: "#3d6f99",
  brick: "#a8473a",
  terracotta: "#b8573f",
  plum: "#7a5c9a",
  teal: "#3d8a8a",
  copper: "#b5643c",
  rust: "#a8651c",
  violet: "#7a63d2",
  amber: "#e8a81c",
  honey: "#e3b04b",
} as const;

/** Toni chiari per testi e accenti su fondo scuro (pannelli inchiostro). */
export const ON_INK = {
  cream: "#f2f1ec",
  "sky-light": "#7fb0ff",
  "pink-light": "#ff9cc2",
  "balance": "#8fb3d1",
  "reliability": "#e08a6e",
  "exchange": "#e8c07a",
} as const;

/** Ruoli dell'interfaccia: le tre famiglie di rilievo e gli stati. */
export const ROLE = {
  field: HUE.leaf,
  desk: HUE.river,
  feel: HUE.terracotta,
  sun: HUE.glow,
  alert: HUE.brick,
} as const;

/** Colori dei tipi di luogo. */
export const PLACE_COLOR = {
  storico: HUE.brick,
  naturalistico: HUE.leaf,
  culturale: HUE.plum,
  sociale: HUE.terracotta,
  paesaggio: HUE.river,
  ospitalita: HUE.rust,
  altro: BASE.graphite,
} as const;

/** Colori delle forme di raccolta. */
export const FORM_COLOR = {
  immagine: HUE.leaf,
  flusso: HUE.teal,
  percezione: HUE.terracotta,
  dato: HUE.river,
  informazione: HUE.plum,
  idea: HUE.glow,
  indagine: HUE.copper,
  correzione: HUE.violet,
} as const;

/** Ambienti del modello: colore pieno e tinta tenue. */
export const ENV_COLOR = {
  urbano: { color: "#d2704a", tint: "#d6d5d0" },
  verde: { color: "#2e9e6b", tint: "#cfdccf" },
  acqua: { color: "#3b8fd8", tint: "#c8d7e2" },
  rilievo: { color: "#7d6b57", tint: "#d9d2c6" },
  rurale: { color: "#c2b23e", tint: "#dedcc4" },
  costa: { color: "#e3c47a", tint: "#e6dfcb" },
  industriale: { color: "#6f6a8c", tint: "#cfced6" },
} as const;

/** Serie dei grafici dei dati del territorio (ordine validato per contrasto e daltonismo). */
export const SERIES = ["#2f8a4e", "#c98a12", "#2f78c8", "#d0483e", "#9358c8", "#a8651c"] as const;
export const SERIES_OTHER = BASE.mute;

/** Colori proposti per le squadre. */
export const TEAM_COLORS = [HUE.leaf, HUE.river, HUE.terracotta, HUE.glow, HUE.plum, HUE.rust, HUE.teal, BASE.graphite] as const;

/** Indicatori cooperativi (su fondo scuro). */
export const INDICATOR = {
  coverage: HUE.glow,
  balance: ON_INK.balance,
  reliability: ON_INK.reliability,
  exchange: ON_INK.exchange,
} as const;

/** Strati della mappa pubblica. */
export const PUBLIC_LAYER = {
  territorio: HUE.leaf,
  siti: HUE.copper,
  luoghi: HUE.amber,
  contributi: HUE.violet,
  dati: HUE.rust,
} as const;

/** Cielo della vista esplora secondo l'ora. */
export const SKY = {
  alba: { sky: "#e9c9a4", horizon: "#f4e2c8", fog: "#efe4d2" },
  giorno: { sky: "#b9d0d6", horizon: "#e9eee6", fog: BASE.paper },
  tramonto: { sky: "#d9a184", horizon: "#f0d3b4", fog: "#e9dcc8" },
  sera: { sky: "#4b5566", horizon: "#9aa0a6", fog: "#c9c4b8" },
} as const;

/** Colori propri della mappa. */
export const MAP = {
  /** Nebbia di carta della vista esplora. */
  fogPaper: "#f2f2ef",
  /** Edifici in rilievo. */
  building: "#e4e4e1",
  /** Persona senza squadra sulla mappa della regia. */
  noTeam: "#3d4046",
} as const;

/** Token CSS generati da `npm run palette` (nome → valore). */
export function cssTokens(): Record<string, string> {
  return { ...BASE, ...HUE, ...ROLE, ...ON_INK };
}

/** Converte un esadecimale in componenti RGB 0–255. */
export function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const channel = (c: number) => { const v = c / 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
/** Luminanza relativa (WCAG). */
export function luminance(hex: string): number {
  const [r, g, b] = rgb(hex);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}
/** Rapporto di contrasto WCAG tra due colori (1–21). */
export function contrast(a: string, b: string): number {
  const x = luminance(a), y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
/**
 * Versione leggibile di un colore d'accento usato come testo: lo scurisce solo quanto basta
 * per raggiungere il contrasto richiesto sullo sfondo (AA: 4,5 per il testo normale).
 */
export function readable(hex: string, bg: string = BASE.card, min = 4.5): string {
  for (let k = 1; k > 0.3; k -= 0.05) {
    const c = "#" + rgb(hex).map((v) => Math.round(v * k).toString(16).padStart(2, "0")).join("");
    if (contrast(c, bg) >= min) return c;
  }
  return BASE.ink;
}
