import type { Observation, ObservationKind } from "./types";

/**
 * Impianto di raccolta per la ricerca sul campo.
 * - Forma: che cosa si registra (sei strumenti diversi).
 * - Lente AEIOU: di che cosa parla l'osservazione (facoltativa).
 * - Field / Desk / Feel: da dove viene la conoscenza, ricavato dalla forma.
 */
export type Form = "immagine" | "flusso" | "percezione" | "dato" | "informazione" | "idea";
export type Lens = "attivita" | "ambiente" | "interazioni" | "oggetti" | "persone";

export interface FormSpec {
  id: Form;
  label: string;
  /** Domanda che guida la compilazione. */
  prompt: string;
  hint: string;
  color: string;
  titleLabel: string;
  titlePlaceholder: string;
  /** Tracciato SVG dell'icona, in un riquadro 24×24. */
  icon: string;
}

export const FORMS: FormSpec[] = [
  { id: "immagine", label: "Immagine", prompt: "Che cosa vale la pena mostrare?", hint: "Una foto con la sua didascalia", color: "#17804f",
    titleLabel: "Didascalia", titlePlaceholder: "Il murale all'angolo di via Cuneo",
    icon: "M4 7h3l1.5-2h7L17 7h3v12H4zM12 16.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z" },
  { id: "flusso", label: "Flusso", prompt: "Che cosa si muove, e da dove a dove?", hint: "Persone, mezzi, merci, acqua: si traccia e si conta", color: "#0f9aa8",
    titleLabel: "Che flusso è", titlePlaceholder: "Uscita dalla scuola verso la fermata",
    icon: "M3 17c4 0 4-10 9-10s5 6 9 6M17 9l4 4-4 4" },
  { id: "percezione", label: "Percezione", prompt: "Come si sta, qui e adesso?", hint: "Atmosfera, sensazioni, sensi coinvolti", color: "#e2578f",
    titleLabel: "In una frase", titlePlaceholder: "Silenzio improvviso dietro la piazza",
    icon: "M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.500-7 10-7 10z" },
  { id: "dato", label: "Dato", prompt: "Che cosa hai misurato o contato?", hint: "Un numero con la sua unità", color: "#2f6fe0",
    titleLabel: "Che cosa misura", titlePlaceholder: "Posti bici davanti alla biblioteca",
    icon: "M5 20V11M12 20V4M19 20v-6" },
  { id: "informazione", label: "Informazione", prompt: "Che cosa hai saputo, e da chi?", hint: "Un fatto, una storia, una fonte", color: "#7a63d2",
    titleLabel: "Che cosa hai saputo", titlePlaceholder: "Il mercato chiuderà per lavori in primavera",
    icon: "M5 5h14v10H10l-5 4zM9 9h6M9 12h4" },
  { id: "idea", label: "Idea", prompt: "E se qui…?", hint: "Un'opportunità o una proposta nata sul posto", color: "#e8a81c",
    titleLabel: "E se…", titlePlaceholder: "…il cortile diventasse un'aula all'aperto?",
    icon: "M9 18h6M10 21h4M12 3a6 6 0 0 0-3.500 10.900V15h7v-1.100A6 6 0 0 0 12 3z" },
];

export const formOf = (id: string | null | undefined): FormSpec => FORMS.find((f) => f.id === id) ?? FORMS[4];

export const LENSES: { id: Lens; label: string; hint: string }[] = [
  { id: "attivita", label: "Attività", hint: "Che cosa fanno le persone" },
  { id: "ambiente", label: "Ambiente", hint: "Com'è fatto lo spazio" },
  { id: "interazioni", label: "Interazioni", hint: "Chi incontra chi, e come" },
  { id: "oggetti", label: "Oggetti", hint: "Cose, arredi, segni" },
  { id: "persone", label: "Persone", hint: "Chi c'è, chi manca" },
];
export const lensLabel = (id: string | null | undefined) => LENSES.find((l) => l.id === id)?.label ?? null;

export const FLOW_MODES = [
  { id: "piedi", label: "A piedi" }, { id: "bici", label: "In bici" }, { id: "auto", label: "Auto e moto" },
  { id: "mezzi", label: "Mezzi pubblici" }, { id: "merci", label: "Merci" }, { id: "acqua", label: "Acqua" }, { id: "altro", label: "Altro" },
];
export const SENSES = ["Vista", "Udito", "Olfatto", "Tatto"];
export const FEELINGS = ["Accogliente", "Vivace", "Tranquillo", "Trascurato", "Rumoroso", "Insicuro"];
export const INTENSITY = ["Appena", "Poco", "Abbastanza", "Molto", "Moltissimo"];

/** Dati propri di ciascuna forma, salvati nel campo `data`. */
export interface FormData {
  /** flusso */
  mode?: string;
  count?: number;
  minutes?: number;
  /** flusso e percezione: 1–5 */
  intensity?: number;
  /** percezione */
  senses?: string[];
  /** dato */
  value?: number;
  unit?: string;
  /** informazione */
  who?: string;
  /** dato e informazione: rilevato sul posto oppure da una fonte */
  onSite?: boolean;
}

/** Field, Desk o Feel: si ricava dalla forma, non si chiede. */
export function kindOf(form: Form, onSite = true): ObservationKind {
  if (form === "percezione" || form === "idea") return "feel";
  if (form === "dato" || form === "informazione") return onSite ? "field" : "desk";
  return "field";
}

/** Passaggi all'ora, se il flusso è stato contato. */
export const perHour = (d: FormData) => (d.count && d.minutes ? Math.round((d.count / d.minutes) * 60) : null);

/** Lunghezza di un tracciato in metri. */
export function pathLength(path: [number, number][] | null | undefined): number {
  if (!path || path.length < 2) return 0;
  let m = 0;
  for (let i = 1; i < path.length; i++) {
    const [x1, y1] = path[i - 1], [x2, y2] = path[i];
    const kx = 111320 * Math.cos((((y1 + y2) / 2) * Math.PI) / 180);
    m += Math.hypot((x2 - x1) * kx, (y2 - y1) * 110540);
  }
  return Math.round(m);
}

/** Riga di sintesi dei dati propri della forma. */
export function summary(o: Pick<Observation, "form" | "data" | "path" | "feeling">): string {
  const d = (o.data ?? {}) as FormData;
  const parts: string[] = [];
  if (o.form === "flusso") {
    const mode = FLOW_MODES.find((m) => m.id === d.mode)?.label;
    if (mode) parts.push(mode);
    if (d.intensity) parts.push(`intensità ${d.intensity}/5`);
    const h = perHour(d);
    if (h) parts.push(`${h} passaggi/ora`);
    const len = pathLength(o.path);
    if (len) parts.push(`${len} m`);
  } else if (o.form === "percezione") {
    if (o.feeling) parts.push(o.feeling);
    if (d.intensity) parts.push(INTENSITY[d.intensity - 1].toLowerCase());
    if (d.senses?.length) parts.push(d.senses.join(", ").toLowerCase());
  } else if (o.form === "dato") {
    if (d.value != null) parts.push(`${d.value.toLocaleString("it-IT")}${d.unit ? ` ${d.unit}` : ""}`);
    if (d.onSite === false) parts.push("da fonte");
  } else if (o.form === "informazione") {
    if (d.who) parts.push(d.who);
    if (d.onSite === false) parts.push("da fonte");
  }
  return parts.join(" · ");
}
