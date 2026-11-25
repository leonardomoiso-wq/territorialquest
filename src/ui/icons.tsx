
import { FORMS, SURVEY_FORM } from "@/domain/forms";

/**
 * Icone di Territorial Quest: un solo set, griglia 24, tratto 1,7 arrotondato, senza riempimenti.
 * Prendono il colore dal testo (currentColor), quindi seguono il tema e la palette.
 * Uso: <Icon name="camera" /> oppure <Icon name="luogo-storico" className="size-6 text-brick" />.
 */
const BASE = {
  // azioni e navigazione
  camera: "M4 8h3l1.5-2h7L17 8h3v11H4zM12 16.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z",
  plus: "M12 5v14M5 12h14",
  close: "M6 6l12 12M18 6 6 18",
  check: "M5 12.5 10 17.5 19 7",
  search: "M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13zM15.5 15.5 20 20",
  list: "M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01",
  download: "M12 4v11M7.5 10.5 12 15l4.5-4.5M5 20h14",
  eye: "M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
  help: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .9-1 1.7M12 17v.01",
  tray: "M4 13l2.5-7h11L20 13v5H4zM4 13h5l1 2h4l1-2h5",
  clock: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2",
  announce: "M4 10v4h3l7 4V6l-7 4zM17.5 9.5a3.5 3.5 0 0 1 0 5",
  // mappa e cammino
  walk: "M13 4.5a1.5 1.5 0 1 0 0-.01M9 21l2-6-2.5-2.5L10 8l3 1 2 3h3M11 15l3 2 1 4",
  pin: "M12 21s-6.5-5.6-6.5-11A6.5 6.5 0 0 1 18.5 10c0 5.4-6.5 11-6.5 11zM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z",
  target: "M12 3v3M12 18v3M3 12h3M18 12h3M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z",
  route: "M6 19a2 2 0 1 0 0-.01M18 7a2 2 0 1 0 0-.01M6 17v-6a4 4 0 0 1 4-4h6",
  layers: "M12 3 21 8l-9 5-9-5zM3 12.5l9 5 9-5M3 16.5l9 5 9-5",
  view: "M3 17 12 21l9-4M3 12l9 4 9-4M12 3 3 7.5l9 4 9-4z",
  compass: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM15.5 8.5l-2 5-5 2 2-5z",
  map: "M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2zM9 4v14M15 6v14",
  hexagon: "M12 3 20 7.5v9L12 21l-8-4.5v-9z",
  flag: "M5 21V4M5 4h11l-2 4 2 4H5",
  // gioco cooperativo
  team: "M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM3.5 19c.6-3 2.8-5 5.5-5s4.9 2 5.5 5M16 11a2.5 2.5 0 1 0 0-5M17.5 14c1.8.5 3 2.2 3.4 5",
  corale: "M12 8a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM5 14a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM19 14a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM8 20c.5-2.3 2-3.5 4-3.5s3.5 1.2 4 3.5M1.5 19.5c.4-1.6 1.7-2.7 3.5-2.7M22.5 19.5c-.4-1.6-1.7-2.7-3.5-2.7",
  stamp: "M10 3h4v4l2 3H8l2-3zM5 13h14v3H5zM7 19h10",
  toppa: "M12 3l2.4 1.8 3-.2.9 2.9 2.4 1.8-1 2.8 1 2.8-2.4 1.8-.9 2.9-3-.2L12 21l-2.4-1.8-3 .2-.9-2.9-2.4-1.8 1-2.8-1-2.8 2.4-1.8.9-2.9 3 .2zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
  diario: "M6 3h11a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H6zM6 3v18M9.5 8h5M9.5 12h5",
  atlante: "M3 5c3-1 6-1 9 1 3-2 6-2 9-1v14c-3-1-6-1-9 1-3-2-6-2-9-1zM12 6v14",
  capitolo: "M6 3h12v18l-6-4-6 4z",
  suono: "M4 10v4h3l5 4V6l-5 4zM15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11",
  rifoto: "M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M7.5 15.5l3-3.5 2.5 3 1.5-1.5 2 2",
  // ora e meteo
  sole: "M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4",
  luna: "M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z",
  pioggia: "M7 15a4 4 0 0 1-.5-8A5.5 5.5 0 0 1 17 8a3.5 3.5 0 0 1 0 7zM9 18l-1 2.5M13 18l-1 2.5M17 18l-1 2.5",
  // tipi di luogo
  "luogo-storico": "M4 9h16L12 4zM6 9v8M10 9v8M14 9v8M18 9v8M4 20h16M5 17h14",
  "luogo-naturalistico": "M5 19C5 10 10 5 19 5c0 9-5 14-14 14zM5 19l8-8",
  "luogo-culturale": "M4 4h16v11H4zM4 15l5-5 4 4 2-2 5 5M8.5 8.5h.01M9 20h6M12 15v5",
  "luogo-sociale": "M8 8a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM16 8a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM3 14h18M5 14v6M19 14v6M4 17h16M8 11v3M16 11v3",
  "luogo-paesaggio": "M2 19l6-8 4 5 3-3 7 6zM17 9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z",
  "luogo-ospitalita": "M4 11 12 4l8 7M6 9.5V20h12V9.5M10 20v-5h4v5",
  "luogo-altro": "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM8 12h.01M12 12h.01M16 12h.01",
  // ambienti
  "ambiente-urbano": "M3 21V9l5-3v15M8 21V4h8v17M16 21V10h5v11M3 21h18M11 8h2M11 12h2M11 16h2",
  "ambiente-verde": "M7 21v-4M7 17a4 4 0 1 1 0-8 4 4 0 0 1 0 8zM16 21v-6M12.5 15h7L16 6z",
  "ambiente-acqua": "M3 9c2-1.5 4-1.5 6 0s4 1.5 6 0 4-1.5 6 0M3 14c2-1.5 4-1.5 6 0s4 1.5 6 0 4-1.5 6 0M3 19c2-1.5 4-1.5 6 0s4 1.5 6 0 4-1.5 6 0",
  "ambiente-rilievo": "M2 20 9 8l4 6 2.5-3.5L22 20zM7.5 10.5 9 12l1.5-1.5",
  "ambiente-rurale": "M3 20h18M3 20 8 10h8l5 10M7.5 15h9M9.5 12.5h5M12 10v10",
  "ambiente-costa": "M12 10.5V19M5 10.5a7 7 0 0 1 14 0zM3 19c3-1.5 6-1.5 9 0s6 1.5 9 0",
  "ambiente-industriale": "M3 21V11l5 3v-3l5 3v-3l5 3V4h3v17zM3 21h18",
} as const;

/** Forme di raccolta: stesse icone delle schede di rilievo. */
const FORM_ICONS = Object.fromEntries([...FORMS, SURVEY_FORM].map((f) => [`forma-${f.id}`, f.icon])) as Record<string, string>;

export const ICONS: Record<string, string> = { ...BASE, ...FORM_ICONS, "forma-correzione": "M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4" };
export type IconName = keyof typeof BASE | `forma-${string}`;

export function Icon({ name, className, strokeWidth = 1.7, title }: { name: IconName; className?: string; strokeWidth?: number; title?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`size-5 shrink-0 ${className ?? ""}`} fill="none" stroke="currentColor" strokeWidth={strokeWidth}
      strokeLinecap="round" strokeLinejoin="round" role={title ? "img" : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
      <path d={ICONS[name] ?? ICONS["luogo-altro"]} />
    </svg>
  );
}
