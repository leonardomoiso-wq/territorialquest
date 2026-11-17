import type { PlaceCategory } from "./types";

/**
 * Indagine sul sito (scala micro): la scheda che la regia prepara per un luogo
 * e che i team compilano una volta arrivati. Il territorio (scala macro) si
 * racconta invece con i rilievi liberi raccolti camminando.
 */
export type QuestionType = "foto" | "conteggio" | "misura" | "scala" | "scelta" | "multipla" | "sino" | "testo";

export interface Question {
  id: string;
  type: QuestionType;
  label: string;
  hint?: string;
  /** scelta e multipla */
  options?: string[];
  /** misura */
  unit?: string;
  /** scala: etichette degli estremi */
  low?: string;
  high?: string;
}

export type Answer = string | number | boolean | string[];
export type Answers = Record<string, Answer>;

export const QUESTION_TYPES: { id: QuestionType; label: string; hint: string }[] = [
  { id: "foto", label: "Foto", hint: "Un dettaglio da documentare" },
  { id: "conteggio", label: "Conteggio", hint: "Quanti sono" },
  { id: "misura", label: "Misura", hint: "Un valore con unità" },
  { id: "scala", label: "Scala 1–5", hint: "Una valutazione" },
  { id: "scelta", label: "Scelta", hint: "Una risposta tra più opzioni" },
  { id: "multipla", label: "Scelta multipla", hint: "Più risposte possibili" },
  { id: "sino", label: "Sì / no", hint: "Presente o assente" },
  { id: "testo", label: "Testo", hint: "Una risposta libera" },
];

const q = (type: QuestionType, label: string, extra: Partial<Question> = {}): Question => ({ id: "", type, label, ...extra });

/** Schede modello per tipo di luogo: un punto di partenza, sempre modificabile. */
export const SURVEY_TEMPLATES: Record<PlaceCategory, Question[]> = {
  storico: [
    q("foto", "Un dettaglio che racconta l'epoca del luogo"),
    q("scala", "Stato di conservazione", { low: "In rovina", high: "Ottimo" }),
    q("multipla", "Materiali prevalenti", { options: ["Pietra", "Mattone", "Legno", "Ferro", "Cemento", "Intonaco"] }),
    q("sino", "C'è un'indicazione che ne spieghi la storia?"),
    q("scelta", "Come viene usato oggi?", { options: ["Come in origine", "Riconvertito", "Abbandonato", "Solo di passaggio"] }),
    q("testo", "Che cosa ti dice di chi lo ha costruito?"),
  ],
  naturalistico: [
    q("foto", "Una specie o un elemento naturale caratteristico"),
    q("multipla", "Che cosa vedi", { options: ["Alberi", "Arbusti", "Prato", "Acqua", "Uccelli", "Insetti"] }),
    q("conteggio", "Specie di piante diverse riconosciute"),
    q("scala", "Rumore di fondo", { low: "Silenzio", high: "Molto rumoroso" }),
    q("sino", "Ci sono rifiuti abbandonati?"),
    q("testo", "Che cosa minaccia questo luogo, e che cosa lo protegge?"),
  ],
  culturale: [
    q("foto", "Il punto che attira più sguardi"),
    q("conteggio", "Persone che si fermano a guardare in 5 minuti"),
    q("scala", "Quanto è leggibile per chi non lo conosce", { low: "Per niente", high: "Del tutto" }),
    q("scelta", "Chi lo frequenta soprattutto", { options: ["Residenti", "Turisti", "Studenti", "Famiglie", "Nessuno in particolare"] }),
    q("testo", "Quale storia racconta, secondo te?"),
  ],
  sociale: [
    q("foto", "Un segno della vita quotidiana del luogo"),
    q("conteggio", "Persone presenti in questo momento"),
    q("multipla", "Attività in corso", { options: ["Sostare", "Giocare", "Lavorare", "Commerciare", "Attraversare", "Incontrarsi"] }),
    q("scala", "Senso di accoglienza", { low: "Respingente", high: "Accogliente" }),
    q("sino", "Ci sono sedute o ripari?"),
    q("testo", "Chi manca, e perché?"),
  ],
  paesaggio: [
    q("foto", "La vista più ampia dal punto"),
    q("multipla", "Elementi nel campo visivo", { options: ["Montagne", "Fiume", "Colline", "Edifici storici", "Infrastrutture", "Campi"] }),
    q("scala", "Apertura della vista", { low: "Chiusa", high: "Aperta" }),
    q("scelta", "Momento della giornata", { options: ["Mattina", "Mezzogiorno", "Pomeriggio", "Tramonto", "Sera"] }),
    q("testo", "Che cosa cambieresti in questa vista?"),
  ],
  altro: [
    q("foto", "Il dettaglio più significativo"),
    q("scala", "Quanto è interessante per la ricerca", { low: "Poco", high: "Molto" }),
    q("testo", "Che cosa hai osservato?"),
  ],
};

export const newQuestionId = () => Math.random().toString(36).slice(2, 9);
export const withIds = (qs: Question[]) => qs.map((x) => ({ ...x, id: x.id || newQuestionId() }));

export function isAnswered(a: Answer | undefined): boolean {
  if (a == null) return false;
  if (typeof a === "string") return a.trim() !== "";
  if (Array.isArray(a)) return a.length > 0;
  return true;
}

/** Risposta in forma leggibile. */
export function formatAnswer(question: Question, a: Answer | undefined): string {
  if (!isAnswered(a)) return "—";
  if (question.type === "foto") return "foto";
  if (question.type === "sino") return a ? "sì" : "no";
  if (question.type === "scala") return `${a}/5`;
  if (question.type === "misura") return `${a}${question.unit ? ` ${question.unit}` : ""}`;
  if (Array.isArray(a)) return a.join(", ");
  return String(a);
}

/** Le domande sono salvate con le risposte, così l'indagine resta leggibile anche se la scheda cambia. */
export interface SurveyData {
  survey: Question[];
  answers: Answers;
}

export const completeness = (d: Partial<SurveyData>) => {
  const qs = d.survey ?? [];
  return { answered: qs.filter((x) => isAnswered(d.answers?.[x.id])).length, total: qs.length };
};

/** Indagine su una riga, per CSV e anteprime. */
export const surveyLine = (d: Partial<SurveyData>) =>
  (d.survey ?? []).filter((x) => x.type !== "foto").map((x) => `${x.label}: ${formatAnswer(x, d.answers?.[x.id])}`).join(" · ");
