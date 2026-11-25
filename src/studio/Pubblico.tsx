"use client";

import { useState } from "react";
import { FormTag } from "@/campo/Collect";
import { formOf } from "@/domain/forms";
import { ago } from "@/domain/time";
import type { Contribution, ContributionStatus } from "@/domain/types";
import { isRows } from "@/domain/datasets";
import { deleteContribution, mediaUrl, reviewContribution, saveDataset, updateCampaign } from "@/lib/data";
import { useAction } from "@/lib/hooks";
import MapView from "@/ui/MapView";
import { Area, Button, Card, cx, Empty, Label, Notice, SectionTitle, Segmented, Tag } from "@/ui/kit";
import { backdrop, type Ctx } from "./shared";

function Toggle({ on, onChange, title, hint, disabled }: { on: boolean; onChange: (v: boolean) => void; title: string; hint: string; disabled?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={on} disabled={disabled} onClick={() => onChange(!on)}
      className="flex w-full items-start gap-4 rounded-2xl border hairline p-4 text-left transition hover:bg-ink/5 disabled:opacity-50">
      <span className={cx("relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition", on ? "bg-leaf" : "bg-ink/15")}>
        <span className={cx("absolute top-0.5 size-5 rounded-full bg-white shadow transition-all", on ? "left-[22px]" : "left-0.5")} />
      </span>
      <span><span className="block text-[15px]">{title}</span><span className="soft block text-sm leading-snug">{hint}</span></span>
    </button>
  );
}

export default function Pubblico({ data, me, now, refresh }: Ctx) {
  const c = data.campaign;
  const { busy, error, run } = useAction();
  const [tab, setTab] = useState<ContributionStatus>("pending");
  const [intro, setIntro] = useState(c.public_intro ?? "");
  const [copied, setCopied] = useState<string | null>(null);
  const [focus, setFocus] = useState<Contribution | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const origin = typeof location !== "undefined" ? location.origin : "";
  const links = [
    { id: "mappa", label: "Mappa pubblica", url: `${origin}/mappa/${c.id}`, on: !!c.public_map },
    { id: "contrib", label: "Pagina per contribuire", url: `${origin}/contribuisci/${c.id}`, on: !!c.contributions_open },
  ];
  const copy = async (id: string, url: string) => { await navigator.clipboard?.writeText(url); setCopied(id); setTimeout(() => setCopied(null), 2000); };
  const set = (patch: Parameters<typeof updateCampaign>[1]) => run(async () => { await updateCampaign(c.id, patch); await refresh(); });
  /** Nome del punto a cui si riferisce un contributo. */
  const targetName = (x: Contribution) => {
    if (x.place_id) return data.places.find((p) => p.id === x.place_id)?.name ?? "luogo eliminato";
    if (x.dataset_id) {
      const d = data.datasets.find((y) => y.id === x.dataset_id);
      const r = d && isRows(d.rows) && x.row_index != null ? d.rows[x.row_index] : null;
      return r ? `${String((d!.label_column && r[d!.label_column]) || (d!.category_column && r[d!.category_column]) || "punto")}, ${d!.name}` : "punto eliminato";
    }
    return null;
  };
  /** Una correzione approvata si può scrivere nel file: il valore nuovo sostituisce quello vecchio. */
  const applyCorrection = (x: Contribution) => run(async () => {
    const d = data.datasets.find((y) => y.id === x.dataset_id);
    const col = String(x.data?.column ?? "");
    if (!d || !isRows(d.rows) || x.row_index == null || !col) throw new Error("Non trovo il dato da correggere.");
    const rows = d.rows.map((r, i) => (i === x.row_index ? { ...r, [col]: x.data?.new as string | number } : r));
    await saveDataset({ id: d.id, campaign_id: d.campaign_id ?? c.id, name: d.name, kind: d.kind, rows });
    await reviewContribution(x.id, me.user_id, "approved", [notes[x.id]?.trim(), "Applicata al dato."].filter(Boolean).join(" "));
    await refresh();
  });
  const review = (x: Contribution, status: ContributionStatus) =>
    run(async () => { await reviewContribution(x.id, me.user_id, status, notes[x.id]?.trim() || null); await refresh(); setFocus(null); });

  const count = (s: ContributionStatus) => data.contributions.filter((x) => (x.status ?? "pending") === s).length;
  const list = data.contributions.filter((x) => (x.status ?? "pending") === tab);
  const validated = data.observations.filter((o) => o.status === "validated").length;

  return (
    <div className="space-y-10">
      <section className="grid grid-cols-1 gap-4 [&>*]:min-w-0 lg:grid-cols-2">
        <Card className="space-y-3 !p-6">
          <Label>Visibilità</Label>
          <Toggle on={!!c.public_map} disabled={busy} onChange={(v) => set({ public_map: v })} title="Mappa pubblica"
            hint={`Chiunque abbia il link vede i ${validated} rilievi validati, i luoghi, i percorsi e i contributi approvati. Mai i nomi di chi ha raccolto.`} />
          <Toggle on={!!c.contributions_open} disabled={busy} onChange={(v) => set({ contributions_open: v })} title="Contributi individuali"
            hint="Chiunque abbia un profilo può proporre foto, informazioni, percezioni, dati e idee. Nulla viene pubblicato senza la tua approvazione." />
          <div className="pt-2">
            <Area label="Presentazione sulla mappa pubblica" value={intro} onChange={(e) => setIntro(e.target.value)} maxLength={600}
              placeholder="Che cos'è questa ricerca, chi la conduce, che cosa si può scoprire." />
            <Button size="sm" className="mt-2" disabled={busy || intro === (c.public_intro ?? "")} onClick={() => set({ public_intro: intro.trim() })}>Salva la presentazione</Button>
          </div>
          {error && <Notice tone="error">{error}</Notice>}
        </Card>
        <Card className="space-y-3 !p-6">
          <Label>Link da condividere</Label>
          {links.map((l) => (
            <div key={l.id} className={cx("rounded-2xl border hairline p-4", !l.on && "opacity-55")}>
              <div className="flex items-center justify-between gap-3"><span className="text-[15px]">{l.label}</span><Tag color={l.on ? "var(--color-leaf)" : undefined}>{l.on ? "attivo" : "spento"}</Tag></div>
              <p className="num soft mt-1 truncate text-[13px]">{l.url}</p>
              <div className="mt-3 flex gap-2">
                <Button size="sm" variant="outline" onClick={() => copy(l.id, l.url)}>{copied === l.id ? "Copiato ✓" : "Copia"}</Button>
                <a href={l.url} target="_blank" rel="noreferrer" className="inline-flex h-8 items-center rounded-full px-3.5 text-[13px] font-medium hover:bg-ink/5">Apri ↗</a>
              </div>
            </div>
          ))}
          <p className="soft text-xs">I membri della campagna vedono la mappa anche quando è spenta, come archivio di ciò che è stato validato.</p>
        </Card>
      </section>

      <section>
        <SectionTitle kicker="Nulla esce senza revisione" title="Contributi individuali" />
        <Segmented value={tab} onChange={setTab} className="mb-4" options={[
          { id: "pending", label: `In revisione ${count("pending")}` },
          { id: "approved", label: `Pubblicati ${count("approved")}` },
          { id: "rejected", label: `Non pubblicati ${count("rejected")}` },
        ]} />
        {list.length === 0 ? (
          <Empty title={tab === "pending" ? "Coda vuota." : "Niente qui."}>{c.contributions_open ? "I contributi arrivano dalla pagina per contribuire." : "Attiva i contributi individuali per ricevere proposte."}</Empty>
        ) : (
          <div className="grid grid-cols-1 gap-4 [&>*]:min-w-0 xl:grid-cols-[1fr_420px]">
            <div className="space-y-3">
              {list.map((x) => {
                const img = mediaUrl(x.media_path);
                return (
                  <Card key={x.id} className={cx("!p-4 transition", focus?.id === x.id && "!border-ink")} onMouseEnter={() => setFocus(x)}>
                    <div className="flex gap-4">
                      {img ? /* eslint-disable-next-line @next/next/no-img-element */ <a href={img} target="_blank" rel="noreferrer"><img src={img} alt="" className="size-24 shrink-0 rounded-2xl object-cover" /></a>
                        : <span className="size-24 shrink-0 rounded-2xl" style={{ background: `color-mix(in srgb, ${formOf(x.form).color} 16%, transparent)` }} />}
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5"><FormTag form={x.form === "correzione" ? "flusso" : x.form} /><span className="soft text-[13px]">{x.display_name} – {ago(x.created_at, now)}</span></div>
                        {targetName(x) && <p className="mt-1 text-[13px]">Su: <b className="font-medium">{targetName(x)}</b></p>}
                        {x.form === "correzione" && <p className="mt-1 text-sm"><b className="font-medium">{String(x.data?.label ?? x.data?.column)}</b>: <span className="soft line-through">{String(x.data?.old ?? "—")}</span> → <b className="font-medium">{String(x.data?.new ?? "")}</b></p>}
                        <h3 className="mt-1.5 text-[17px] tracking-[-0.02em]">{x.title}</h3>
                        {x.feeling && <p className="serif text-lg italic">«{x.feeling}»</p>}
                        {typeof x.data?.value === "number" && <p className="num text-sm">{String(x.data.value)} {String(x.data.unit ?? "")}</p>}
                        {x.note && <p className="soft mt-1 text-sm leading-snug">{x.note}</p>}
                        <p className="num soft mt-1 text-xs">{x.lat.toFixed(5)}, {x.lng.toFixed(5)}</p>
                      </div>
                    </div>
                    {x.review_note && tab !== "pending" && <p className="soft mt-3 text-sm">Nota: {x.review_note}</p>}
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <input aria-label="Nota per chi ha contribuito" value={notes[x.id] ?? ""} onChange={(e) => setNotes({ ...notes, [x.id]: e.target.value })} maxLength={200}
                        placeholder="Nota per chi ha contribuito (facoltativa)" className="h-9 min-w-48 flex-1 rounded-full border hairline bg-transparent px-3.5 text-[13px] outline-none focus:border-leaf" />
                      {tab !== "approved" && <Button size="sm" variant="glow" disabled={busy} onClick={() => review(x, "approved")}>Pubblica</Button>}
                      {x.form === "correzione" && x.dataset_id && !String(x.review_note ?? "").includes("Applicata") && (
                        <Button size="sm" variant="outline" disabled={busy} onClick={() => applyCorrection(x)}>{tab === "approved" ? "Applica al dato" : "Pubblica e applica al dato"}</Button>
                      )}
                      {tab !== "rejected" && <Button size="sm" variant="outline" disabled={busy} onClick={() => review(x, "rejected")}>{tab === "approved" ? "Ritira" : "Non pubblicare"}</Button>}
                      <Button size="sm" variant="danger" disabled={busy} onClick={() => confirm("Eliminare definitivamente il contributo?") && run(async () => { await deleteContribution(x.id); await refresh(); })}>Elimina</Button>
                    </div>
                  </Card>
                );
              })}
            </div>
            <div className="sticky top-32 hidden h-[60dvh] overflow-hidden rounded-panel border hairline xl:block">
              <MapView className="size-full" center={[c.center_lng, c.center_lat]} zoom={c.zoom} areas={data.areas} places={data.places} fit {...backdrop(c)}
                contributions={list} pin={focus ? [focus.lng, focus.lat] : null} focus={focus ? [focus.lng, focus.lat] : null} />
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
