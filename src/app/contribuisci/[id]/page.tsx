"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { FormIcon, FormTag } from "@/campo/Collect";
import { FEELINGS, FORMS } from "@/domain/forms";
import type { Contribution } from "@/domain/types";
import { addContribution, explain, loadPublicMap, myContributions, useSession, type PublicMap } from "@/lib/data";
import { useAction } from "@/lib/hooks";
import { backdrop } from "@/studio/shared";
import MapView from "@/ui/MapView";
import { Area, Button, cx, Empty, Field, Label, LinkButton, Logo, Notice, PlusIcon, Sheet, Spinner, Tag } from "@/ui/kit";

const KINDS = FORMS.filter((f) => f.id !== "flusso") as (typeof FORMS[number] & { id: Contribution["form"] })[];
const STATUS = { pending: ["In revisione", "var(--color-sun)"], approved: ["Pubblicato", "var(--color-leaf)"], rejected: ["Non pubblicato", "var(--color-alert)"] } as const;

export default function Contribuisci() {
  const { id } = useParams<{ id: string }>();
  const { user, name } = useSession();
  const [map, setMap] = useState<PublicMap | null | undefined>(undefined);
  const [mine, setMine] = useState<Contribution[]>([]);
  const [pin, setPin] = useState<[number, number] | null>(null);
  const [step, setStep] = useState<"punto" | "modulo" | "fatto" | "miei">("punto");
  const [form, setForm] = useState<Contribution["form"]>("immagine");
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [feeling, setFeeling] = useState("");
  const [value, setValue] = useState("");
  const [unit, setUnit] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [anon, setAnon] = useState(false);
  const [consent, setConsent] = useState(false);
  const { busy, error, run } = useAction();

  useEffect(() => { loadPublicMap(id).then(setMap, () => setMap(null)); }, [id]);
  useEffect(() => { if (user) myContributions(id, user.id).then(setMine, () => undefined); }, [id, user]);

  if (map === undefined || user === undefined) return <main className="on-ink min-h-dvh"><Spinner label="Preparo la mappa" /></main>;
  if (!map || !map.campaign.contributions_open) {
    return (
      <main className="on-paper grid min-h-dvh place-items-center p-6">
        <Empty title="Contributi chiusi." action={map ? <LinkButton href={`/mappa/${id}`}>Vedi la mappa</LinkButton> : <LinkButton href="/">Torna all&apos;inizio</LinkButton>}>
          Questa campagna non accetta contributi individuali in questo momento.
        </Empty>
      </main>
    );
  }

  const c = map.campaign;
  const spec = KINDS.find((k) => k.id === form)!;
  const locate = () => navigator.geolocation?.getCurrentPosition((g) => setPin([g.coords.longitude, g.coords.latitude]), () => undefined, { enableHighAccuracy: true });
  const reset = () => { setTitle(""); setNote(""); setFeeling(""); setValue(""); setUnit(""); setFile(null); setConsent(false); setPin(null); };
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin || !user) return;
    run(async () => {
      await addContribution(id, user.id, {
        display_name: anon ? "Anonimo" : name || "Anonimo", form, title: title.trim(), note: note.trim(),
        feeling: form === "percezione" ? feeling || null : null,
        data: form === "dato" && value !== "" ? { value: Number(value), unit: unit.trim() } : {},
        lng: pin[0], lat: pin[1], file,
      }).catch((err) => { throw new Error(explain(err)); });
      setMine(await myContributions(id, user.id));
      reset();
      setStep("fatto");
    });
  };

  return (
    <main className="fixed inset-0 overflow-hidden bg-paper-2">
      <MapView className="absolute inset-0" center={[c.center_lng, c.center_lat]} zoom={c.zoom} areas={map.areas} places={map.places} fit {...backdrop(c)}
        contributions={mine.filter((x) => x.status !== "rejected")} pin={pin} onClick={step === "punto" ? setPin : undefined} />

      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 p-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:p-5">
        <div className="glass pointer-events-auto max-w-md rounded-[26px] p-4">
          <div className="flex items-center justify-between gap-3">
            <Link href={c.public_map ? `/mappa/${id}` : "/"} aria-label="Indietro"><Logo /></Link>
            <Label>Contributo individuale</Label>
          </div>
          <h1 className="display mt-3 text-[26px]">{c.name}</h1>
          <p className="soft mt-1 text-sm leading-snug">
            {step === "punto" ? "Tocca la mappa nel punto di cui vuoi parlare." : "Il tuo contributo viene letto dalla regia prima di comparire sulla mappa pubblica."}
          </p>
        </div>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex justify-center px-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="glass pointer-events-auto flex items-center gap-1.5 rounded-full p-1.5">
          <Button variant="ghost" onClick={locate}>Dove sono</Button>
          <Button variant="glow" disabled={!pin} onClick={() => setStep("modulo")}>Continua</Button>
          {mine.length > 0 && <Button variant="ghost" onClick={() => setStep("miei")}>I miei – {mine.length}</Button>}
        </div>
      </div>

      <Sheet open={step === "modulo"} onClose={() => setStep("punto")} kicker="Contributo individuale" title="Che cosa vuoi condividere?" wide>
        <form onSubmit={submit} className="space-y-5">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {KINDS.map((k) => (
              <button key={k.id} type="button" aria-pressed={form === k.id} onClick={() => setForm(k.id)}
                className={cx("flex flex-col items-start gap-2 rounded-2xl border p-3 text-left transition", form === k.id ? "text-white" : "hairline hover:bg-ink/5")}
                style={form === k.id ? { background: k.color, borderColor: k.color } : undefined}>
                <FormIcon form={k.id} /><span className="text-[15px]">{k.label}</span>
              </button>
            ))}
          </div>
          <label className={cx("flex cursor-pointer items-center gap-3 rounded-2xl border border-dashed p-3.5 transition hover:bg-ink/5", form === "immagine" && !file ? "border-leaf" : "hairline")}>
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-paper-2"><PlusIcon /></span>
            <span className="min-w-0 flex-1 text-sm">{file ? <span className="block truncate">{file.name}</span> : <>{form === "immagine" ? "Scegli la foto" : "Aggiungi una foto"} <span className="soft">, facoltativa{form === "immagine" ? " ma consigliata" : ""}</span></>}</span>
            <input type="file" accept="image/*" className="sr-only" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </label>
          <Field label={spec.titleLabel} value={title} onChange={(e) => setTitle(e.target.value)} required minLength={2} maxLength={120} placeholder={spec.titlePlaceholder} />
          {form === "percezione" && (
            <div className="flex flex-wrap gap-1.5">
              {FEELINGS.map((f) => (
                <button key={f} type="button" aria-pressed={feeling === f} onClick={() => setFeeling(feeling === f ? "" : f)}
                  className={cx("h-9 rounded-full border px-3.5 text-sm transition", feeling === f ? "border-feel bg-feel text-white" : "hairline hover:bg-ink/5")}>{f}</button>
              ))}
            </div>
          )}
          {form === "dato" && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Valore" type="number" step="any" value={value} onChange={(e) => setValue(e.target.value)} required />
              <Field label="Unità" value={unit} onChange={(e) => setUnit(e.target.value)} maxLength={20} placeholder="posti, m², dB…" />
            </div>
          )}
          <Area label="Racconta" value={note} onChange={(e) => setNote(e.target.value)} maxLength={1200} placeholder="Che cosa sai di questo punto? Perché è importante?" />
          <div className="space-y-2 rounded-2xl bg-paper-2 p-4 text-sm">
            <label className="flex items-start gap-3">
              <input type="checkbox" className="mt-0.5 size-4 accent-ink" checked={anon} onChange={(e) => setAnon(e.target.checked)} />
              <span>Pubblica come «Anonimo» {name && !anon && <span className="soft">(altrimenti compare «{name}»)</span>}</span>
            </label>
            <label className="flex items-start gap-3">
              <input type="checkbox" required className="mt-0.5 size-4 accent-ink" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
              <span>Acconsento alla pubblicazione con licenza <b>CC BY 4.0</b>, se approvato. Le foto non ritraggono persone riconoscibili e non contengono dati personali.</span>
            </label>
          </div>
          {error && <Notice tone="error">{error}</Notice>}
          <div className="flex gap-2">
            <Button variant="outline" size="lg" onClick={() => setStep("punto")}>Sposta il punto</Button>
            <Button type="submit" size="lg" className="flex-1" disabled={busy || !consent}>{busy ? "Invio…" : "Invia alla regia"}</Button>
          </div>
        </form>
      </Sheet>

      <Sheet open={step === "fatto"} onClose={() => setStep("punto")} kicker="Grazie" title={<span className="serif text-[40px] italic">Ricevuto.</span>}>
        <p className="text-[15px]">La regia lo legge e, se lo approva, compare sulla mappa pubblica. Puoi seguirne lo stato da «I miei».</p>
        <div className="mt-6 flex gap-2">
          <Button size="lg" variant="outline" className="flex-1" onClick={() => setStep("miei")}>I miei contributi</Button>
          <Button size="lg" className="flex-1" onClick={() => setStep("punto")}>Un altro</Button>
        </div>
      </Sheet>

      <Sheet open={step === "miei"} onClose={() => setStep("punto")} kicker={c.name} title="I tuoi contributi" wide>
        {mine.length === 0 ? <Empty title="Nessun contributo, per ora." /> : (
          <ul className="space-y-2">
            {mine.map((x) => {
              const [label, color] = STATUS[x.status ?? "pending"];
              return (
                <li key={x.id} className="rounded-card border hairline p-4">
                  <div className="flex flex-wrap items-center gap-1.5"><FormTag form={x.form} /><Tag color={color}>{label}</Tag></div>
                  <p className="mt-1.5 text-[15px]">{x.title}</p>
                  {x.review_note && <p className="soft mt-1 text-sm">Nota della regia: {x.review_note}</p>}
                </li>
              );
            })}
          </ul>
        )}
      </Sheet>
    </main>
  );
}
