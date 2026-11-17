"use client";

import { newQuestionId, QUESTION_TYPES, SURVEY_TEMPLATES, withIds, type Question, type QuestionType } from "@/domain/survey";
import type { PlaceCategory } from "@/domain/types";
import { Button, cx, Label, PlusIcon } from "@/ui/kit";

const input = "h-10 w-full rounded-xl border hairline bg-transparent px-3 text-[14px] outline-none transition focus:border-leaf";

/** Editor della scheda d'indagine sul sito: domande in ordine, di tipi diversi. */
export default function SurveyEditor({ value, onChange, category }: { value: Question[]; onChange: (q: Question[]) => void; category: PlaceCategory }) {
  const set = (i: number, patch: Partial<Question>) => onChange(value.map((x, n) => (n === i ? { ...x, ...patch } : x)));
  const move = (i: number, d: -1 | 1) => { const v = [...value]; [v[i], v[i + d]] = [v[i + d], v[i]]; onChange(v); };
  const add = (type: QuestionType) => onChange([...value, { id: newQuestionId(), type, label: "", ...(type === "scelta" || type === "multipla" ? { options: [] } : {}) }]);

  return (
    <div className="rounded-card border hairline p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Label>Indagine sul sito · scala micro</Label>
          <p className="soft mt-1 max-w-md text-sm">Le domande che i team compilano una volta arrivati, una per schermata. Completata e confermata da un altro team, vale la seconda metà dei punti del luogo.</p>
        </div>
        <Button size="sm" variant="outline" onClick={() => (!value.length || confirm("Sostituire le domande con la scheda modello?")) && onChange(withIds(SURVEY_TEMPLATES[category]))}>
          Usa la scheda modello
        </Button>
      </div>

      {value.length > 0 && (
        <ol className="mt-4 space-y-2">
          {value.map((q, i) => (
            <li key={q.id} className="rounded-2xl bg-paper-2 p-3">
              <div className="flex items-center gap-2">
                <span className="num grid size-6 shrink-0 place-items-center rounded-full bg-ink text-[11px] text-paper">{i + 1}</span>
                <select aria-label="Tipo di domanda" value={q.type} onChange={(e) => set(i, { type: e.target.value as QuestionType })}
                  className="h-8 rounded-full border hairline bg-card px-2.5 text-[13px] outline-none">
                  {QUESTION_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                </select>
                <span className="flex-1" />
                <Button size="sm" variant="ghost" className="!px-2" aria-label="Sposta su" disabled={i === 0} onClick={() => move(i, -1)}>↑</Button>
                <Button size="sm" variant="ghost" className="!px-2" aria-label="Sposta giù" disabled={i === value.length - 1} onClick={() => move(i, 1)}>↓</Button>
                <Button size="sm" variant="ghost" className="!px-2" aria-label="Togli la domanda" onClick={() => onChange(value.filter((_, n) => n !== i))}>✕</Button>
              </div>
              <input aria-label="Domanda" className={cx(input, "mt-2 bg-card")} value={q.label} required maxLength={140}
                placeholder={QUESTION_TYPES.find((t) => t.id === q.type)?.hint} onChange={(e) => set(i, { label: e.target.value })} />
              {(q.type === "scelta" || q.type === "multipla") && (
                <input aria-label="Opzioni" className={cx(input, "mt-2 bg-card")} value={(q.options ?? []).join(", ")} placeholder="Opzioni separate da virgola"
                  onChange={(e) => set(i, { options: e.target.value.split(",").map((x) => x.trimStart()) })}
                  onBlur={(e) => set(i, { options: e.target.value.split(",").map((x) => x.trim()).filter(Boolean) })} />
              )}
              {q.type === "misura" && <input aria-label="Unità" className={cx(input, "mt-2 w-40 bg-card")} value={q.unit ?? ""} placeholder="Unità: m, dB, °C…" onChange={(e) => set(i, { unit: e.target.value })} />}
              {q.type === "scala" && (
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <input aria-label="Estremo basso" className={cx(input, "bg-card")} value={q.low ?? ""} placeholder="1 = …" onChange={(e) => set(i, { low: e.target.value })} />
                  <input aria-label="Estremo alto" className={cx(input, "bg-card")} value={q.high ?? ""} placeholder="5 = …" onChange={(e) => set(i, { high: e.target.value })} />
                </div>
              )}
            </li>
          ))}
        </ol>
      )}

      <div className="mt-3 flex flex-wrap gap-1.5">
        {QUESTION_TYPES.map((t) => (
          <button key={t.id} type="button" onClick={() => add(t.id)} title={t.hint}
            className="inline-flex h-8 items-center gap-1.5 rounded-full border hairline px-3 text-[13px] transition hover:bg-ink/5">
            <PlusIcon />{t.label}
          </button>
        ))}
      </div>
    </div>
  );
}
