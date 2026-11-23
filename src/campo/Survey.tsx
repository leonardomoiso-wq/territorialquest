"use client";

import { useState } from "react";
import { formatAnswer, isAnswered, type Answer, type Answers, type Question } from "@/domain/survey";
import type { Place } from "@/domain/types";
import { Area, Button, cx, Label, Meter, Notice, PlusIcon, Sheet } from "@/ui/kit";

/** Risultato della compilazione: risposte, foto da caricare per domanda, nota finale. */
export interface SurveyResult {
  answers: Answers;
  photos: Record<string, File>;
  note: string;
}

const big = "h-14 w-full rounded-2xl border hairline bg-transparent px-4 text-[22px] outline-none transition focus:border-leaf num";

function Step({ q, value, photo, onAnswer, onPhoto }: {
  q: Question; value: Answer | undefined; photo?: File; onAnswer: (a: Answer | undefined) => void; onPhoto: (f: File | undefined) => void;
}) {
  if (q.type === "foto") {
    return (
      <label className={cx("flex aspect-[4/3] w-full cursor-pointer flex-col items-center justify-center gap-3 overflow-hidden rounded-card border-2 border-dashed transition hover:bg-ink/5", photo ? "border-leaf" : "hairline")}>
        {photo
          ? /* eslint-disable-next-line @next/next/no-img-element */ <img alt="" className="size-full object-cover" ref={(el) => { if (el && el.dataset.f !== photo.name + photo.size) { el.dataset.f = photo.name + photo.size; el.src = URL.createObjectURL(photo); } }} />
          : <><span className="grid size-14 place-items-center rounded-full bg-ink text-paper"><PlusIcon /></span><span className="text-[15px]">Scatta la foto</span></>}
        <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => onPhoto(e.target.files?.[0])} />
      </label>
    );
  }
  if (q.type === "conteggio") {
    const n = typeof value === "number" ? value : 0;
    return (
      <div className="flex items-center justify-center gap-4">
        <button type="button" aria-label="Meno uno" className="grid size-16 place-items-center rounded-full border hairline text-3xl transition active:scale-95" onClick={() => onAnswer(Math.max(0, n - 1))}>−</button>
        <input type="number" inputMode="numeric" min={0} aria-label={q.label} value={value === undefined ? "" : n} onChange={(e) => onAnswer(e.target.value === "" ? undefined : Number(e.target.value))}
          className="num h-20 w-32 rounded-2xl border hairline bg-transparent text-center text-[44px] outline-none focus:border-leaf" />
        <button type="button" aria-label="Più uno" className="grid size-16 place-items-center rounded-full bg-ink text-3xl text-paper transition active:scale-95" onClick={() => onAnswer(n + 1)}>+</button>
      </div>
    );
  }
  if (q.type === "misura") {
    return (
      <div className="flex items-center gap-3">
        <input type="number" inputMode="decimal" step="any" aria-label={q.label} className={big} value={typeof value === "number" ? value : ""} onChange={(e) => onAnswer(e.target.value === "" ? undefined : Number(e.target.value))} />
        {q.unit && <span className="text-xl">{q.unit}</span>}
      </div>
    );
  }
  if (q.type === "scala") {
    return (
      <div>
        <div className="grid grid-cols-5 gap-2" role="radiogroup" aria-label={q.label}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} type="button" role="radio" aria-checked={value === n} onClick={() => onAnswer(n)}
              className={cx("num grid h-16 place-items-center rounded-2xl border text-2xl transition active:scale-95", value === n ? "border-ink bg-ink text-paper" : "hairline hover:bg-ink/5")}>{n}</button>
          ))}
        </div>
        {(q.low || q.high) && <div className="soft mt-2 flex justify-between text-sm"><span>{q.low}</span><span>{q.high}</span></div>}
      </div>
    );
  }
  if (q.type === "sino") {
    return (
      <div className="grid grid-cols-2 gap-2">
        {[[true, "Sì"], [false, "No"]].map(([v, l]) => (
          <button key={String(v)} type="button" aria-pressed={value === v} onClick={() => onAnswer(v as boolean)}
            className={cx("h-20 rounded-2xl border text-2xl transition active:scale-95", value === v ? "border-ink bg-ink text-paper" : "hairline hover:bg-ink/5")}>{l as string}</button>
        ))}
      </div>
    );
  }
  if (q.type === "scelta" || q.type === "multipla") {
    const many = q.type === "multipla";
    const list = Array.isArray(value) ? value : [];
    return (
      <div className="space-y-2">
        {many && <Label className="block">Anche più di una</Label>}
        {(q.options ?? []).map((o) => {
          const on = many ? list.includes(o) : value === o;
          return (
            <button key={o} type="button" aria-pressed={on} onClick={() => onAnswer(many ? (on ? list.filter((x) => x !== o) : [...list, o]) : on ? undefined : o)}
              className={cx("flex h-13 w-full items-center gap-3 rounded-2xl border px-4 text-left text-[17px] transition", on ? "border-ink bg-ink text-paper" : "hairline hover:bg-ink/5")}>
              <span className={cx("grid size-5 shrink-0 place-items-center border", many ? "rounded-md" : "rounded-full", on ? "border-paper" : "border-current/40")}>{on && <span className={cx("size-2.5 bg-paper", many ? "rounded-sm" : "rounded-full")} />}</span>
              {o}
            </button>
          );
        })}
      </div>
    );
  }
  return <Area aria-label={q.label} value={typeof value === "string" ? value : ""} onChange={(e) => onAnswer(e.target.value)} maxLength={800} rows={5} />;
}

/** Compilazione dell'indagine sul sito: una domanda per schermata, poi il riepilogo. */
export default function Survey({ place, open, busy, error, onClose, onSubmit }: {
  place: Place | null; open: boolean; busy: boolean; error: string | null; onClose: () => void; onSubmit: (r: SurveyResult) => void;
}) {
  const [i, setI] = useState(0);
  const [answers, setAnswers] = useState<Answers>({});
  const [photos, setPhotos] = useState<Record<string, File>>({});
  const [note, setNote] = useState("");
  const qs = place?.survey ?? [];
  const review = i >= qs.length;
  const q = qs[i];
  const done = qs.filter((x) => (x.type === "foto" ? !!photos[x.id] : isAnswered(answers[x.id]))).length;
  const reset = () => { setI(0); setAnswers({}); setPhotos({}); setNote(""); };

  return (
    <Sheet open={open && !!place} onClose={onClose} kicker={place ? `Indagine sul sito – ${place.name}` : ""}
      title={review ? "Riepilogo" : <span className="text-[24px] leading-tight">{q?.label}</span>} wide>
      <div className="mb-5 flex items-center gap-3">
        <Meter value={qs.length ? Math.min(i, qs.length) / qs.length : 0} color="var(--color-glow)" />
        <span className="num soft shrink-0 text-sm">{Math.min(i + 1, qs.length)}/{qs.length}</span>
      </div>

      {!review && q && (
        <div key={q.id} className="animate-rise">
          {q.hint && <p className="soft mb-3 text-sm">{q.hint}</p>}
          <Step q={q} value={answers[q.id]} photo={photos[q.id]}
            onAnswer={(a) => setAnswers((x) => { const n = { ...x }; if (a === undefined) delete n[q.id]; else n[q.id] = a; return n; })}
            onPhoto={(f) => setPhotos((x) => { const n = { ...x }; if (f) n[q.id] = f; else delete n[q.id]; return n; })} />
        </div>
      )}

      {review && (
        <div className="space-y-4">
          <ul className="divide-y divide-line">
            {qs.map((x, n) => (
              <li key={x.id}>
                <button type="button" className="flex w-full items-baseline gap-3 py-2.5 text-left" onClick={() => setI(n)}>
                  <span className="min-w-0 flex-1 text-sm">{x.label}</span>
                  <span className={cx("text-sm", !(x.type === "foto" ? photos[x.id] : isAnswered(answers[x.id])) && "soft")}>{x.type === "foto" ? (photos[x.id] ? "foto ✓" : "—") : formatAnswer(x, answers[x.id])}</span>
                </button>
              </li>
            ))}
          </ul>
          <Area label="Nota finale – facoltativa" value={note} onChange={(e) => setNote(e.target.value)} maxLength={800} placeholder="Qualcosa che le domande non coglievano." />
          <p className="soft text-sm">{done}/{qs.length} risposte. Puoi inviare anche un&apos;indagine parziale; un altro team la conferma sul posto.</p>
          {error && <Notice tone="error">{error}</Notice>}
        </div>
      )}

      <div className="mt-6 flex gap-2">
        {i > 0 && <Button variant="outline" size="lg" onClick={() => setI(i - 1)}>Indietro</Button>}
        {!review && <Button variant="ghost" size="lg" onClick={() => setI(i + 1)}>Salta</Button>}
        {!review
          ? <Button size="lg" className="flex-1" onClick={() => setI(i + 1)}>{i === qs.length - 1 ? "Riepilogo" : "Avanti"}</Button>
          : <Button size="lg" variant="glow" className="flex-1" disabled={busy || done === 0} onClick={() => { onSubmit({ answers, photos, note }); }}>{busy ? "Invio…" : "Invia l'indagine"}</Button>}
      </div>
      <button type="button" className="soft mt-4 text-xs underline-offset-2 hover:underline" onClick={reset}>Ricomincia da capo</button>
    </Sheet>
  );
}

/** Risposte di un'indagine, in lettura. */
export function SurveyAnswers({ data, mediaUrl }: { data: Record<string, unknown> | undefined; mediaUrl: (p: string | null) => string | null }) {
  const survey = (data?.survey ?? []) as Question[];
  const answers = (data?.answers ?? {}) as Answers;
  if (!survey.length) return null;
  return (
    <dl className="divide-y divide-line rounded-2xl border hairline">
      {survey.map((q) => {
        const a = answers[q.id];
        return (
          <div key={q.id} className="flex items-start gap-3 px-3.5 py-2.5 text-sm">
            <dt className="soft min-w-0 flex-1">{q.label}</dt>
            <dd className="max-w-[55%] text-right">
              {q.type === "foto" && typeof a === "string"
                ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={mediaUrl(a) ?? ""} alt="" className="ml-auto size-16 rounded-xl object-cover" />
                : formatAnswer(q, a)}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
