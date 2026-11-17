"use client";

import { useState } from "react";
import { setRecovery } from "@/lib/data";
import { useAction } from "@/lib/hooks";
import { Button, Field, Label, Notice, Select, Sheet } from "@/ui/kit";

export const QUESTIONS = [
  "Il nome del tuo primo animale",
  "La via della tua scuola elementare",
  "Il titolo del primo libro che hai amato",
  "La città dove sono nati i tuoi nonni",
  "Il soprannome che ti davano da piccolo",
];
const OWN = "__mia__";

export interface Secret { question: string; answer: string }

/** Scelta della domanda segreta e della risposta. */
export function SecretFields({ value, onChange }: { value: Secret; onChange: (s: Secret) => void }) {
  const preset = QUESTIONS.includes(value.question);
  const [own, setOwn] = useState(!preset && value.question !== "");
  return (
    <div className="space-y-3">
      <Select label="Domanda segreta" value={own ? OWN : value.question} required
        onChange={(e) => { const v = e.target.value; setOwn(v === OWN); onChange({ ...value, question: v === OWN ? "" : v }); }}>
        <option value="" disabled>Scegli una domanda</option>
        {QUESTIONS.map((q) => <option key={q} value={q}>{q}</option>)}
        <option value={OWN}>Scrivo io la domanda…</option>
      </Select>
      {own && <Field label="La tua domanda" value={value.question} onChange={(e) => onChange({ ...value, question: e.target.value })} required minLength={5} maxLength={120} />}
      <Field label="Risposta" value={value.answer} onChange={(e) => onChange({ ...value, answer: e.target.value })} required minLength={3} maxLength={120}
        autoComplete="off" hint="Serve per recuperare la password. Maiuscole, spazi e accenti non contano: scegli qualcosa che solo tu sai." />
    </div>
  );
}

/** Foglio per impostare o cambiare la domanda segreta. */
export function SecretSheet({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved?: () => void }) {
  const [s, setS] = useState<Secret>({ question: "", answer: "" });
  const [ok, setOk] = useState(false);
  const { busy, error, run } = useAction();
  return (
    <Sheet open={open} onClose={() => { setOk(false); onClose(); }} kicker="Il tuo profilo" title="Domanda segreta">
      {ok ? (
        <>
          <Notice tone="ok">Fatto. Se dimentichi la password, la recuperi da «Password dimenticata?» nella pagina di accesso.</Notice>
          <Button size="lg" className="mt-5 w-full" onClick={() => { setOk(false); onClose(); }}>Chiudi</Button>
        </>
      ) : (
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); run(async () => { await setRecovery(s.question.trim(), s.answer); setOk(true); setS({ question: "", answer: "" }); onSaved?.(); }); }}>
          <p className="soft text-sm">Ti servirà per scegliere una nuova password senza email.</p>
          <SecretFields value={s} onChange={setS} />
          {error && <Notice tone="error">{error}</Notice>}
          <Button type="submit" size="lg" className="w-full" disabled={busy}>Salva</Button>
        </form>
      )}
    </Sheet>
  );
}
