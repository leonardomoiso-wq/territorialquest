"use client";

import Link from "next/link";
import { useState } from "react";
import { FormIcon } from "@/campo/Collect";
import { formatValue, type Column } from "@/domain/datasets";
import type { Contribution } from "@/domain/types";
import { addContribution, mediaUrl, useSession } from "@/lib/data";
import { useAction } from "@/lib/hooks";
import { Area, Button, cx, Field, Label, Notice, PlusIcon, Select, Sheet } from "@/ui/kit";

/** Punto a cui si aggiunge qualcosa: un luogo del gioco o una riga di uno strato. */
export interface Target {
  campaignId: string;
  name: string;
  at: [number, number];
  place_id?: string | null;
  dataset_id?: string | null;
  row_index?: number | null;
  /** Colonne e valori correnti della riga, per proporre una correzione. */
  columns?: Column[];
  values?: Record<string, unknown>;
}

const KINDS: { id: Contribution["form"]; label: string; hint: string; icon: string }[] = [
  { id: "immagine", label: "Foto", hint: "Com'è oggi", icon: "immagine" },
  { id: "informazione", label: "Informazione", hint: "Una storia, un orario, un'avvertenza", icon: "informazione" },
  { id: "dato", label: "Dato", hint: "Un numero con la sua unità", icon: "dato" },
  { id: "correzione", label: "Correzione", hint: "Un valore del file non è più giusto", icon: "flusso" },
];

/** Modulo per arricchire un punto esistente. Tutto passa dalla revisione della regia. */
export function ContributeSheet({ target, onClose, onDone }: { target: Target | null; onClose: () => void; onDone?: () => void }) {
  const { user, name } = useSession();
  const [form, setForm] = useState<Contribution["form"]>("immagine");
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [value, setValue] = useState("");
  const [unit, setUnit] = useState("");
  const [column, setColumn] = useState("");
  const [fresh, setFresh] = useState("");
  const [anon, setAnon] = useState(false);
  const [consent, setConsent] = useState(false);
  const [sent, setSent] = useState(false);
  const { busy, error, run } = useAction();

  const editable = (target?.columns ?? []).filter((c) => !/^(lat|lon|lng|latitude|longitude|cod|id|wikidata)$/i.test(c.key));
  const col = editable.find((c) => c.key === column);
  const reset = () => { setTitle(""); setNote(""); setFile(null); setValue(""); setUnit(""); setColumn(""); setFresh(""); setConsent(false); setSent(false); };
  const close = () => { reset(); onClose(); };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!target || !user) return;
    run(async () => {
      const data: Record<string, unknown> =
        form === "dato" ? { value: Number(value), unit: unit.trim() } :
        form === "correzione" ? { column, label: col?.label ?? column, old: target.values?.[column] ?? null, new: col?.type === "numero" && fresh !== "" && !isNaN(Number(fresh)) ? Number(fresh) : fresh.trim() } : {};
      await addContribution(target.campaignId, user.id, {
        display_name: anon ? "Anonimo" : name || "Anonimo", form,
        title: form === "correzione" ? `${col?.label ?? column}: ${fresh.trim()}` : title.trim() || (form === "immagine" ? `Foto di ${target.name}` : target.name),
        note: note.trim(), feeling: null, data, lng: target.at[0], lat: target.at[1], file,
        place_id: target.place_id ?? null, dataset_id: target.dataset_id ?? null, row_index: target.row_index ?? null,
      });
      setSent(true);
      onDone?.();
    });
  };

  return (
    <Sheet open={!!target} onClose={close} kicker={target ? `Contribuisci a ${target.name}` : ""} title={sent ? "Ricevuto." : "Che cosa aggiungi?"} wide>
      {!user ? (
        <div className="space-y-4">
          <p className="text-[15px]">Per aggiungere foto e informazioni serve un profilo: ci vuole un minuto.</p>
          <Link className="inline-flex h-11 items-center rounded-full bg-ink px-5 text-sm font-medium text-paper" href={`/accedi?next=${encodeURIComponent(typeof location !== "undefined" ? location.pathname : "/")}`}>Accedi o crea il profilo</Link>
        </div>
      ) : sent ? (
        <div className="space-y-4">
          <Notice tone="ok">La regia lo legge e, se lo approva, compare nella scheda del punto, nella sezione «Dalla comunità».</Notice>
          <div className="flex gap-2"><Button variant="outline" size="lg" className="flex-1" onClick={reset}>Aggiungi altro</Button><Button size="lg" className="flex-1" onClick={close}>Chiudi</Button></div>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {KINDS.filter((k) => k.id !== "correzione" || editable.length > 0).map((k) => (
              <button key={k.id} type="button" aria-pressed={form === k.id} onClick={() => setForm(k.id)}
                className={cx("flex flex-col items-start gap-1.5 rounded-[3px] border-[1.5px] p-3 text-left transition", form === k.id ? "border-ink bg-ink text-paper" : "hairline hover:bg-ink/5")}>
                <FormIcon form={k.icon} /><span className="text-[15px]">{k.label}</span><span className={cx("text-xs leading-tight", form !== k.id && "soft")}>{k.hint}</span>
              </button>
            ))}
          </div>

          {form === "correzione" ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <Select label="Che cosa correggi" value={column} onChange={(e) => setColumn(e.target.value)} required>
                <option value="" disabled>Scegli un valore</option>
                {editable.map((c) => <option key={c.key} value={c.key}>{c.label}: {formatValue(target?.values?.[c.key] as number | string | null, c.unit)}</option>)}
              </Select>
              <Field label="Valore giusto" value={fresh} onChange={(e) => setFresh(e.target.value)} required placeholder={col ? String(target?.values?.[col.key] ?? "") : ""} />
            </div>
          ) : (
            <Field label={form === "immagine" ? "Didascalia" : "In una frase"} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120}
              required={form !== "immagine"} placeholder={form === "immagine" ? "La fontana restaurata, vista dalla strada" : "Aperta solo d'estate"} />
          )}
          {form === "dato" && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Valore" type="number" step="any" value={value} onChange={(e) => setValue(e.target.value)} required />
              <Field label="Unità" value={unit} onChange={(e) => setUnit(e.target.value)} maxLength={20} placeholder="posti, €, m…" />
            </div>
          )}
          <label className={cx("flex cursor-pointer items-center gap-3 rounded-[3px] border-[1.5px] border-dashed p-3.5 transition hover:bg-ink/5", form === "immagine" && !file ? "border-leaf" : "hairline")}>
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-paper-2"><PlusIcon /></span>
            <span className="min-w-0 flex-1 text-sm">{file ? <span className="block truncate">{file.name}</span> : form === "immagine" ? "Scatta o scegli la foto" : "Aggiungi una foto (facoltativa)"}</span>
            <input type="file" accept="image/*" className="sr-only" required={form === "immagine" && !file} onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </label>
          <Area label={form === "correzione" ? "Come lo sai" : "Racconta"} value={note} onChange={(e) => setNote(e.target.value)} maxLength={800}
            placeholder={form === "correzione" ? "L'ho visto oggi, me l'ha detto il gestore…" : "Quello che serve sapere a chi passa di qui."} />
          <div className="space-y-2 rounded-[3px] bg-paper-2 p-4 text-sm">
            <label className="flex items-start gap-3"><input type="checkbox" className="mt-0.5 size-4 accent-ink" checked={anon} onChange={(e) => setAnon(e.target.checked)} />
              <span>Pubblica come «Anonimo» {name && !anon && <span className="soft">(altrimenti compare «{name}»)</span>}</span></label>
            <label className="flex items-start gap-3"><input type="checkbox" required className="mt-0.5 size-4 accent-ink" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
              <span>Acconsento alla pubblicazione con licenza <b>CC BY 4.0</b>, se approvato. Le foto non ritraggono persone riconoscibili.</span></label>
          </div>
          {error && <Notice tone="error">{error}</Notice>}
          <Button type="submit" size="lg" className="w-full" disabled={busy || !consent}>{busy ? "Invio…" : "Invia alla regia"}</Button>
        </form>
      )}
    </Sheet>
  );
}

/** Contributi approvati su un punto: foto, informazioni, dati, correzioni. */
export function Community({ items, onAdd }: { items: Contribution[]; onAdd?: () => void }) {
  const photos = items.filter((x) => x.media_path);
  return (
    <section>
      <div className="mb-2 flex items-center justify-between gap-3">
        <Label>Dalla comunità{items.length ? ` · ${items.length}` : ""}</Label>
        {onAdd && <Button size="sm" variant="outline" onClick={onAdd}><PlusIcon /> Aggiungi foto o informazioni</Button>}
      </div>
      {items.length === 0 ? <p className="soft text-sm">Ancora niente. Se passi di qui, aggiungi una foto o un&apos;informazione aggiornata.</p> : (
        <div className="space-y-3">
          {photos.length > 0 && (
            <div className="-mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-1">
              {photos.map((x) => /* eslint-disable-next-line @next/next/no-img-element */ <img key={x.id} src={mediaUrl(x.media_path) ?? ""} alt={x.title} title={x.title} className="h-32 w-44 shrink-0 snap-start rounded-[2px] object-cover shadow-[0_0_0_3px_var(--color-edge)]" />)}
            </div>
          )}
          <ul className="divide-y divide-line text-sm">
            {items.map((x) => (
              <li key={x.id} className="py-2">
                {x.form === "correzione" ? (
                  <p><b className="font-medium">{String(x.data?.label ?? x.data?.column ?? "")}</b>: <span className="soft line-through">{String(x.data?.old ?? "—")}</span> → {String(x.data?.new ?? "")}</p>
                ) : x.form === "dato" ? (
                  <p>{x.title}: <b className="num font-medium">{formatValue(x.data?.value as number, String(x.data?.unit ?? "") || undefined)}</b></p>
                ) : <p>{x.title}</p>}
                {x.note && <p className="soft">{x.note}</p>}
                <p className="label soft mt-0.5 !text-[9px]">{x.display_name}, {new Date(x.created_at).toLocaleDateString("it-IT")}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

/** Contributi approvati che riguardano un punto. */
export const contributionsFor = (all: Contribution[], t: { place_id?: string | null; dataset_id?: string | null; row_index?: number | null }) =>
  all.filter((x) => (x.status ?? "approved") === "approved" && (t.place_id ? x.place_id === t.place_id : !!t.dataset_id && x.dataset_id === t.dataset_id && x.row_index === t.row_index));
