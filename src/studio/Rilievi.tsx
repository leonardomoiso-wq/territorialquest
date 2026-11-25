"use client";

import { useMemo, useState } from "react";
import { FormIcon, FormTag } from "@/campo/Collect";
import { SurveyAnswers } from "@/campo/Survey";
import { toCSV, toGeoJSON, download } from "@/domain/export";
import { FORMS, formOf, lensLabel, summary } from "@/domain/forms";
import { scoreObservations } from "@/domain/scoring";
import { ago } from "@/domain/time";
import type { ObservationStatus } from "@/domain/types";
import { deleteObservation, deleteTheme, mediaUrl, saveTheme, validateObservation } from "@/lib/data";
import { useAction } from "@/lib/hooks";
import { Button, Card, Dot, Empty, Field, Label, Notice, SectionTitle, Segmented, Select, Tag } from "@/ui/kit";
import { KindTag, nameOf, PALETTE, teamOf, themeOf, type Ctx } from "./shared";
import { readable } from "@/domain/palette";

const QUALITY = [[1, "Bassa"], [2, "Media"], [3, "Alta"]] as const;

export function Rilievi({ data, now, refresh }: Ctx) {
  const [status, setStatus] = useState<ObservationStatus | "all">("pending");
  const [theme, setTheme] = useState("");
  const [form, setForm] = useState("");
  /** Si mostrano 20 rilievi alla volta: la pagina resta leggera anche su telefono. */
  const [shown, setShown] = useState(20);
  const { busy, error, run } = useAction();
  const act = (fn: () => Promise<unknown>) => run(async () => { await fn(); await refresh(); });
  const scored = useMemo(() => new Map(scoreObservations(data.observations).map((s) => [s.observation.id, s])), [data.observations]);
  const count = (s: ObservationStatus) => data.observations.filter((o) => o.status === s).length;
  const list = data.observations.filter((o) => (status === "all" || o.status === status) && (!theme || o.theme_id === theme) && (!form || (o.form ?? "informazione") === form));

  return (
    <div>
      <SectionTitle kicker="Qualità prima della quantità" title="Rilievi" />
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Segmented className="max-w-full overflow-x-auto" value={status} onChange={(v) => { setStatus(v); setShown(20); }} options={[
          { id: "pending", label: `In attesa ${count("pending")}` },
          { id: "validated", label: `Validati ${count("validated")}` },
          { id: "flagged", label: `Segnalati ${count("flagged")}` },
          { id: "all", label: "Tutti" },
        ]} />
        <Select aria-label="Forma" value={form} onChange={(e) => setForm(e.target.value)} className="w-full sm:w-48">
          <option value="">Tutte le forme</option>
          {FORMS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
          <option value="indagine">Indagine sul sito</option>
        </Select>
        <Select aria-label="Tema" value={theme} onChange={(e) => setTheme(e.target.value)} className="w-full sm:w-56">
          <option value="">Tutti i temi</option>
          {data.themes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </Select>
      </div>
      {error && <div className="mb-4"><Notice tone="error">{error}</Notice></div>}

      {list.length === 0 ? (
        <Empty title="Niente da vedere qui.">{status === "pending" ? "Tutti i rilievi sono stati esaminati." : "Nessun rilievo corrisponde ai filtri."}</Empty>
      ) : (
        <div className="space-y-3">
          {list.slice(0, shown).map((o) => {
            const s = scored.get(o.id);
            const team = teamOf(data, o.team_id), th = themeOf(data, o.theme_id), img = mediaUrl(o.media_path);
            return (
              <Card key={o.id} className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <div className="flex min-w-0 flex-1 gap-4">
                {img
                  ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={img} alt="" className="size-16 shrink-0 rounded-2xl object-cover sm:size-20" loading="lazy" />
                  : <div className="grid size-16 shrink-0 place-items-center rounded-2xl text-white sm:size-20" style={{ background: formOf(o.form).color }}><FormIcon form={o.form} className="!size-7" /></div>}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <FormTag form={o.form} />
                    <KindTag o={o} />
                    {th && <Tag color={th.color}>{th.name}</Tag>}
                    {lensLabel(o.lens) && <Tag>{lensLabel(o.lens)}</Tag>}
                    {s && s.novelty < 1 && <Tag>doppione ×{s.novelty}</Tag>}
                  </div>
                  <h3 className="mt-2 truncate text-[17px] tracking-[-0.02em]">{o.title}</h3>
                  {summary(o) && <p className="mt-0.5 text-sm" style={{ color: readable(formOf(o.form).color) }}>{summary(o)}</p>}
                  {o.note && <p className="soft mt-0.5 line-clamp-2 text-sm">{o.note}</p>}
                  {o.form === "indagine" && <details className="mt-2"><summary className="cursor-pointer text-sm">Vedi le risposte</summary><div className="mt-2"><SurveyAnswers data={o.data} mediaUrl={mediaUrl} /></div></details>}
                  <div className="soft mt-1.5 flex flex-wrap items-center gap-x-3 text-[13px]">
                    <span className="inline-flex items-center gap-1.5">{team && <Dot color={team.color} />}{nameOf(data, o.author_id)}{team ? ` – ${team.name}` : ""}</span>
                    <span>{ago(o.created_at, now)}</span>
                    <span className="num">{o.lat.toFixed(5)}, {o.lng.toFixed(5)}</span>
                    {o.source_url && <a href={o.source_url} target="_blank" rel="noreferrer" className="underline underline-offset-2">fonte</a>}
                  </div>
                </div>
                </div>
                <div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end">
                  <div className="num text-right text-sm">
                    {o.status === "validated" ? <span className="text-leaf">+{s?.value ?? 0} pt</span> : o.status === "pending" ? <span className="soft">fino a +{Math.round((s?.potential ?? 0) * 1.5 * 10) / 10} pt</span> : <span className="soft">non conta</span>}
                  </div>
                  {/* su telefono tre pulsanti larghi a tutta riga */}
                  <div className="grid grid-cols-3 gap-1.5 sm:flex sm:flex-wrap">
                    {QUALITY.map(([q, label]) => (
                      <Button key={q} size="sm" variant={o.status === "validated" && o.quality === q ? "primary" : "outline"} disabled={busy} onClick={() => act(() => validateObservation(o.id, q))}>{label}</Button>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 sm:flex sm:justify-end">
                    {o.status !== "flagged"
                      ? <Button size="sm" variant="ghost" disabled={busy} onClick={() => act(() => validateObservation(o.id, 1, "flagged"))}>Segnala</Button>
                      : <Button size="sm" variant="ghost" disabled={busy} onClick={() => act(() => validateObservation(o.id, 1, "pending"))}>Riapri</Button>}
                    <Button size="sm" variant="danger" disabled={busy} onClick={() => confirm("Eliminare definitivamente il rilievo?") && act(() => deleteObservation(o.id))}>Elimina</Button>
                  </div>
                </div>
              </Card>
            );
          })}
          {list.length > shown && (
            <Button variant="outline" className="w-full" onClick={() => setShown((n) => n + 20)}>Mostra altri {Math.min(20, list.length - shown)} di {list.length - shown}</Button>
          )}
        </div>
      )}
    </div>
  );
}

export function Dati({ data, refresh }: Ctx) {
  const [name, setName] = useState("");
  const { busy, error, run } = useAction();
  const slug = data.campaign.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "campagna";

  return (
    <div className="space-y-10">
      <section>
        <SectionTitle kicker="Interoperabilità" title="Esporta i dati" />
        <div className="grid grid-cols-1 gap-4 [&>*]:min-w-0 md:grid-cols-2">
          <Card className="!p-6">
            <Tag>GeoJSON – EPSG:4326</Tag>
            <h3 className="display mt-5 text-[22px]">Per QGIS e strumenti GIS</h3>
            <p className="soft mt-1 text-sm">Osservazioni come punti e aree come poligoni, con tutti gli attributi.</p>
            <Button className="mt-5" onClick={() => download(`${slug}.geojson`, JSON.stringify(toGeoJSON(data), null, 2), "application/geo+json")}>Scarica GeoJSON</Button>
          </Card>
          <Card className="!p-6">
            <Tag>CSV – UTF-8</Tag>
            <h3 className="display mt-5 text-[22px]">Per fogli di calcolo, R, Python</h3>
            <p className="soft mt-1 text-sm">Una riga per osservazione, coordinate in colonne lng/lat, cella H3 inclusa.</p>
            <Button className="mt-5" onClick={() => download(`${slug}.csv`, "﻿" + toCSV(data), "text/csv;charset=utf-8")}>Scarica CSV</Button>
          </Card>
        </div>
        <p className="soft mt-3 text-[13px]">{data.observations.length} osservazioni – {data.areas.length} aree – le foto restano scaricabili dal link nella colonna «media».</p>
      </section>

      <section>
        <SectionTitle kicker="Macro-temi della ricerca" title="Temi" />
        <Card>
          <ul className="divide-y divide-line">
            {data.themes.map((t) => (
              <li key={t.id} className="flex items-center gap-3 py-2.5">
                <span className="size-3 rounded-full" style={{ background: t.color }} />
                <span className="flex-1">{t.name}</span>
                <span className="soft num text-[13px]">{data.observations.filter((o) => o.theme_id === t.id).length}</span>
                <Button size="sm" variant="danger" disabled={busy} onClick={() => confirm(`Eliminare il tema «${t.name}»? I rilievi restano senza tema.`) && run(async () => { await deleteTheme(t.id); await refresh(); })}>Elimina</Button>
              </li>
            ))}
          </ul>
          <form className="mt-4 flex gap-2 border-t hairline pt-4" onSubmit={(e) => { e.preventDefault(); if (!name.trim()) return; run(async () => { await saveTheme({ campaign_id: data.campaign.id, name: name.trim(), color: PALETTE[data.themes.length % PALETTE.length], sort: data.themes.length + 1 }); setName(""); await refresh(); }); }}>
            <Field aria-label="Nuovo tema" placeholder="Aggiungi un tema" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} className="flex-1" />
            <Button type="submit" className="h-11" disabled={busy || !name.trim()}>Aggiungi</Button>
          </form>
          {error && <div className="mt-3"><Notice tone="error">{error}</Notice></div>}
        </Card>
      </section>
      <Label>Schema e regole di accesso: supabase/migrations</Label>
    </div>
  );
}
