"use client";

import { Icon } from "@/ui/icons";
import { FEELINGS, FLOW_MODES, FORMS, formOf, INTENSITY, LENSES, perHour, SENSES, type Form, type FormData, type Lens } from "@/domain/forms";
import type { Theme } from "@/domain/types";
import { Area, Button, cx, Field, Label, Notice, PlusIcon, Sheet } from "@/ui/kit";

/** Un rilievo in compilazione. */
export interface Entry {
  form: Form;
  title: string;
  note: string;
  theme_id: string;
  lens: Lens | null;
  feeling: string;
  source_url: string;
  data: FormData;
  file: File | null;
}

export const emptyEntry = (form: Form, keep?: Partial<Entry>): Entry => ({
  form, title: "", note: "", theme_id: keep?.theme_id ?? "", lens: null, feeling: "", source_url: "", data: { onSite: true }, file: null,
});

export function FormIcon({ form, className }: { form: string | null | undefined; className?: string }) {
  return (
    <Icon name={`forma-${formOf(form).id}`} className={className} strokeWidth={1.6} />
  );
}

/** Etichetta compatta della forma, usata in elenchi e schede. */
export function FormTag({ form }: { form: string | null | undefined }) {
  const f = formOf(form);
  return (
    <span className="label inline-flex h-6 items-center gap-1.5 rounded-full border px-2.5"
      style={{ color: f.color, borderColor: `color-mix(in srgb, ${f.color} 35%, transparent)`, background: `color-mix(in srgb, ${f.color} 9%, transparent)` }}>
      <FormIcon form={form} className="!size-3.5" />{f.label}
    </span>
  );
}

/* --------------------------------------------------------- scelta forma */
export function FormPicker({ open, onClose, onPick }: { open: boolean; onClose: () => void; onPick: (f: Form) => void }) {
  return (
    <Sheet open={open} onClose={onClose} kicker="Nuovo rilievo" title="Che cosa raccogli?" wide>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {FORMS.map((f) => (
          <button key={f.id} onClick={() => onPick(f.id)}
            className="surface group flex min-h-32 flex-col rounded-card border hairline p-4 text-left transition duration-300 hover:-translate-y-0.5 hover:shadow-soft">
            <span className="grid size-10 place-items-center rounded-full text-white transition group-hover:scale-110" style={{ background: f.color }}>
              <FormIcon form={f.id} />
            </span>
            <span className="mt-auto pt-4 text-[19px] tracking-[-0.02em]">{f.label}</span>
            <span className="soft mt-0.5 text-xs leading-tight">{f.hint}</span>
          </button>
        ))}
      </div>
    </Sheet>
  );
}

/* ------------------------------------------------------------- mattoni */
function Chips<T extends string>({ options, value, onChange, color = "var(--color-ink)", label }: {
  options: { id: T; label: string; hint?: string; color?: string }[]; value: T | "" | null; onChange: (v: T | "") => void; color?: string; label: string;
}) {
  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label={label}>
      {options.map((o) => {
        const on = value === o.id, c = o.color ?? color;
        return (
          <button key={o.id} type="button" aria-pressed={on} title={o.hint} onClick={() => onChange(on ? "" : o.id)}
            className={cx("h-9 rounded-full border px-3.5 text-sm transition", on ? "text-white" : "hairline hover:bg-ink/5")}
            style={on ? { background: c, borderColor: c } : undefined}>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function Scale({ value, onChange, color, label }: { value?: number; onChange: (v: number) => void; color: string; label: string }) {
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <Label>{label}</Label>
        <span className="text-sm">{value ? INTENSITY[value - 1] : <span className="soft">scegli</span>}</span>
      </div>
      <div className="grid grid-cols-5 gap-1.5" role="radiogroup" aria-label={label}>
        {INTENSITY.map((name, i) => (
          <button key={name} type="button" role="radio" aria-checked={value === i + 1} aria-label={name} onClick={() => onChange(i + 1)}
            className="h-9 rounded-full border hairline transition hover:bg-ink/5"
            style={value && i < value ? { background: color, borderColor: color, opacity: 0.45 + (i + 1) * 0.11 } : undefined} />
        ))}
      </div>
    </div>
  );
}

function Photo({ file, onChange, required }: { file: File | null; onChange: (f: File | null) => void; required?: boolean }) {
  return (
    <label className={cx("flex cursor-pointer items-center gap-3 rounded-2xl border border-dashed p-3.5 transition hover:bg-ink/5", required && !file ? "border-leaf" : "hairline")}>
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-paper-2"><PlusIcon /></span>
      <span className="min-w-0 flex-1 text-sm">
        {file ? <span className="block truncate">{file.name}</span> : <>{required ? "Scatta o scegli la foto" : "Aggiungi una foto"} <span className="soft">dalla fotocamera o dalla galleria</span></>}
      </span>
      <input type="file" accept="image/*" className="sr-only" required={required && !file} onChange={(e) => onChange(e.target.files?.[0] ?? null)} />
    </label>
  );
}

function OnSite({ data, onChange }: { data: FormData; onChange: (v: boolean) => void }) {
  const on = data.onSite !== false;
  return (
    <div className="grid grid-cols-2 gap-2">
      {[[true, "Rilevato sul posto", "Visto, contato, ascoltato qui"], [false, "Da una fonte", "Documento, sito, archivio"]].map(([v, t, h]) => (
        <button key={String(v)} type="button" aria-pressed={on === v} onClick={() => onChange(v as boolean)}
          className={cx("rounded-2xl border p-3 text-left transition", on === v ? "border-ink bg-ink text-paper" : "hairline hover:bg-ink/5")}>
          <span className="block text-[15px]">{t}</span>
          <span className={cx("block text-xs leading-tight", on !== v && "soft")}>{h}</span>
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------ dettagli */
interface DetailsProps {
  open: boolean;
  entry: Entry;
  setEntry: (e: Entry) => void;
  themes: Theme[];
  /** Punti che il rilievo porterà alla conferma. */
  worth: number;
  /** Rilievi già presenti in questa cella e su questo tema. */
  previous: number;
  placeNote: string;
  areaClosed: boolean;
  busy: boolean;
  error: string | null;
  /** Nome del luogo presso cui si raccoglie. */
  placeName?: string | null;
  onClose: () => void;
  onMove: () => void;
  onSubmit: () => void;
}

export function Details({ open, entry, setEntry, themes, worth, previous, placeNote, areaClosed, busy, error, placeName, onClose, onMove, onSubmit }: DetailsProps) {
  const f = formOf(entry.form);
  const set = (patch: Partial<Entry>) => setEntry({ ...entry, ...patch });
  const setData = (patch: FormData) => set({ data: { ...entry.data, ...patch } });
  const num = (v: string) => (v === "" ? undefined : Number(v));
  const rate = perHour(entry.data);
  const fromSource = (entry.form === "dato" || entry.form === "informazione") && entry.data.onSite === false;

  return (
    <Sheet open={open} onClose={onClose} kicker={placeName ? `${f.label} – ${placeName}` : f.label} title={f.prompt} wide>
      <form onSubmit={(e) => { e.preventDefault(); onSubmit(); }} className="space-y-5">
        {entry.form === "immagine" && <Photo file={entry.file} onChange={(file) => set({ file })} required />}

        {entry.form === "flusso" && (
          <>
            <div><Label className="mb-2 block">Che cosa si muove</Label>
              <Chips label="Che cosa si muove" options={FLOW_MODES} value={entry.data.mode ?? ""} color={f.color} onChange={(mode) => setData({ mode: mode || undefined })} /></div>
            <Scale label="Quanto è intenso" value={entry.data.intensity} color={f.color} onChange={(intensity) => setData({ intensity })} />
            <div>
              <Label className="mb-2 block">Conteggio – facoltativo</Label>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span>Ho contato</span>
                <input type="number" min={0} inputMode="numeric" aria-label="Passaggi contati" value={entry.data.count ?? ""} onChange={(e) => setData({ count: num(e.target.value) })}
                  className="num h-11 w-20 rounded-2xl border hairline bg-transparent px-3 text-center outline-none focus:border-leaf" />
                <span>passaggi in</span>
                <input type="number" min={1} inputMode="numeric" aria-label="Minuti di conteggio" value={entry.data.minutes ?? ""} onChange={(e) => setData({ minutes: num(e.target.value) })}
                  className="num h-11 w-16 rounded-2xl border hairline bg-transparent px-3 text-center outline-none focus:border-leaf" />
                <span>minuti</span>
                {rate != null && <span className="num ml-auto rounded-full bg-paper-2 px-3 py-1.5">≈ {rate}/ora</span>}
              </div>
            </div>
          </>
        )}

        {entry.form === "percezione" && (
          <>
            <div><Label className="mb-2 block">Come si sta qui</Label>
              <Chips label="Come si sta qui" options={FEELINGS.map((x) => ({ id: x, label: x }))} value={entry.feeling} color={f.color} onChange={(feeling) => set({ feeling })} /></div>
            <Scale label="Quanto lo senti" value={entry.data.intensity} color={f.color} onChange={(intensity) => setData({ intensity })} />
            <div><Label className="mb-2 block">Con quali sensi</Label>
              <div className="flex flex-wrap gap-1.5">
                {SENSES.map((s) => {
                  const on = entry.data.senses?.includes(s) ?? false;
                  return (
                    <button key={s} type="button" aria-pressed={on} onClick={() => setData({ senses: on ? entry.data.senses!.filter((x) => x !== s) : [...(entry.data.senses ?? []), s] })}
                      className={cx("h-9 rounded-full border px-3.5 text-sm transition", on ? "border-feel bg-feel text-white" : "hairline hover:bg-ink/5")}>{s}</button>
                  );
                })}
              </div>
            </div>
          </>
        )}

        <Field label={f.titleLabel} value={entry.title} onChange={(e) => set({ title: e.target.value })} required maxLength={90} placeholder={f.titlePlaceholder} />

        {entry.form === "dato" && (
          <div className="grid grid-cols-[1fr_1fr] gap-3">
            <Field label="Valore" type="number" step="any" inputMode="decimal" value={entry.data.value ?? ""} onChange={(e) => setData({ value: num(e.target.value) })} required placeholder="24" />
            <Field label="Unità" value={entry.data.unit ?? ""} onChange={(e) => setData({ unit: e.target.value })} maxLength={20} placeholder="posti, m², dB, persone" />
          </div>
        )}
        {entry.form === "informazione" && (
          <Field label="Da chi l'hai saputo" value={entry.data.who ?? ""} onChange={(e) => setData({ who: e.target.value })} maxLength={80} placeholder="Una commerciante della via (senza nome)" hint="Descrivi il ruolo, non riportare nomi e cognomi." />
        )}
        {(entry.form === "dato" || entry.form === "informazione") && <OnSite data={entry.data} onChange={(onSite) => setData({ onSite })} />}
        {fromSource && <Field label="Fonte (link)" type="url" value={entry.source_url} onChange={(e) => set({ source_url: e.target.value })} placeholder="https://…" />}

        <Area label={entry.form === "idea" ? "Perché potrebbe funzionare" : entry.form === "informazione" ? "Il racconto" : "Note"} value={entry.note} onChange={(e) => set({ note: e.target.value })}
          maxLength={800} placeholder={entry.form === "idea" ? "Che cosa hai visto che ti ha fatto pensare a questo?" : "Che cosa rende utile questo rilievo per la ricerca?"} />

        {entry.form !== "immagine" && <Photo file={entry.file} onChange={(file) => set({ file })} />}

        <div><Label className="mb-2 block">Tema</Label>
          <Chips label="Tema" options={themes.map((t) => ({ id: t.id, label: t.name, color: t.color }))} value={entry.theme_id} onChange={(theme_id) => set({ theme_id })} /></div>
        <div><Label className="mb-2 block">Di che cosa parla – facoltativo</Label>
          <Chips label="Lente" options={LENSES} value={entry.lens} onChange={(lens) => set({ lens: lens || null })} /></div>

        <div className="rounded-2xl bg-paper-2 p-4">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-sm">{previous === 0 ? "Zona nuova per questo tema: vale pieno." : `Qui ci sono già ${previous} ${previous === 1 ? "rilievo" : "rilievi"} su questo tema: vale meno.`}</span>
            <span className="num text-lg whitespace-nowrap">+{worth} pt</span>
          </div>
          <p className="soft mt-1 text-xs">I punti arrivano a tutti quando un altro team conferma il rilievo. {placeNote}</p>
        </div>
        {areaClosed && <Notice>Quest&apos;area è chiusa in questo momento: il rilievo viene salvato comunque e la regia lo vedrà.</Notice>}
        {error && <Notice tone="error">{error}</Notice>}
        <div className="flex gap-2">
          <Button variant="outline" size="lg" onClick={onMove}>{entry.form === "flusso" ? "Ritraccia" : "Sposta il punto"}</Button>
          <Button type="submit" size="lg" className="flex-1" disabled={busy}>{busy ? "Salvo…" : "Salva il rilievo"}</Button>
        </div>
      </form>
    </Sheet>
  );
}
