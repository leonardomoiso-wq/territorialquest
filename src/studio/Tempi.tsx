"use client";

import { useState } from "react";
import { MISSION_KIND, missionProgress } from "@/domain/scoring";
import { areaOpen, formatDate, fromLocalInput, phaseOf, PHASE_LABEL, progressBetween, remaining, toLocalInput } from "@/domain/time";
import type { CampaignStatus, Mission, MissionKind } from "@/domain/types";
import { deleteMission, saveArea, saveMission, updateCampaign } from "@/lib/data";
import { useAction } from "@/lib/hooks";
import { Area, Button, Card, Empty, Field, Label, Meter, Notice, PlusIcon, SectionTitle, Select, Sheet, Tag } from "@/ui/kit";
import type { Ctx } from "./shared";

type Draft = Partial<Mission> & { title: string; description: string; kind: MissionKind; target: number; starts_at: string; ends_at: string };

export default function Tempi({ data, now, refresh }: Ctx) {
  const c = data.campaign;
  const phase = phaseOf(c, now);
  const { busy, error, run } = useAction();
  const [starts, setStarts] = useState(toLocalInput(c.starts_at));
  const [ends, setEnds] = useState(toLocalInput(c.ends_at));
  const [draft, setDraft] = useState<Draft | null>(null);
  const dirty = starts !== toLocalInput(c.starts_at) || ends !== toLocalInput(c.ends_at);

  const apply = (patch: Parameters<typeof updateCampaign>[1]) => run(async () => { await updateCampaign(c.id, patch); await refresh(); });
  const setStatus = (status: CampaignStatus) => apply({ status });
  const extend = (minutes: number) => {
    const base = Math.max(new Date(c.ends_at).getTime(), now.getTime());
    const next = new Date(base + minutes * 60000).toISOString();
    setEnds(toLocalInput(next));
    apply({ ends_at: next });
  };

  const newMission = (): Draft => ({
    title: "", description: "", kind: "observations", target: 20, theme_id: null, area_id: null,
    starts_at: now.toISOString(), ends_at: new Date(now.getTime() + 14 * 86400000).toISOString(),
  });
  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft) return;
    run(async () => {
      await saveMission({ ...draft, campaign_id: c.id, title: draft.title.trim(), target: Number(draft.target) });
      await refresh();
      setDraft(null);
    });
  };

  return (
    <div className="space-y-10">
      <section>
        <SectionTitle kicker="Finestra della campagna" title="Quando si gioca" />
        <Card className="!p-7">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Tag color={phase === "live" ? "var(--color-leaf)" : phase === "paused" ? "var(--color-sun)" : undefined}>{PHASE_LABEL[phase]}</Tag>
              <span className="soft text-sm">
                {phase === "live" && `Si chiude tra ${remaining(c.ends_at, now)}`}
                {phase === "upcoming" && `Si apre tra ${remaining(c.starts_at, now)}`}
                {phase === "paused" && "La raccolta è sospesa per tutti i giocatori"}
                {phase === "draft" && "I giocatori possono entrare, ma non raccogliere"}
                {phase === "ended" && "La raccolta è chiusa"}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {(c.status === "draft" || c.status === "closed") && <Button variant="glow" onClick={() => setStatus("live")} disabled={busy}>Avvia la campagna</Button>}
              {c.status === "live" && <Button variant="outline" onClick={() => setStatus("paused")} disabled={busy}>Metti in pausa</Button>}
              {c.status === "paused" && <Button variant="glow" onClick={() => setStatus("live")} disabled={busy}>Riprendi</Button>}
              {(c.status === "live" || c.status === "paused") && <Button variant="danger" onClick={() => confirm("Chiudere la campagna? Potrai riaprirla.") && setStatus("closed")} disabled={busy}>Chiudi</Button>}
            </div>
          </div>

          <div className="mt-8">
            <div className="relative">
              <Meter value={progressBetween(c.starts_at, c.ends_at, now)} className="!h-2.5" />
            </div>
            <div className="label soft mt-2 flex justify-between"><span>{formatDate(c.starts_at)}</span><span>{formatDate(c.ends_at)}</span></div>
          </div>

          <div className="mt-8 grid items-end gap-3 sm:grid-cols-[1fr_1fr_auto]">
            <Field label="Inizio" type="datetime-local" value={starts} onChange={(e) => setStarts(e.target.value)} />
            <Field label="Fine" type="datetime-local" value={ends} min={starts} onChange={(e) => setEnds(e.target.value)} />
            <Button className="h-11" disabled={!dirty || busy || !starts || !ends} onClick={() => apply({ starts_at: fromLocalInput(starts)!, ends_at: fromLocalInput(ends)! })}>Salva i tempi</Button>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Label>Prolunga</Label>
            {[[15, "+15 min"], [60, "+1 ora"], [1440, "+1 giorno"], [10080, "+1 settimana"]].map(([m, l]) => (
              <Button key={m} size="sm" variant="outline" onClick={() => extend(m as number)} disabled={busy}>{l}</Button>
            ))}
          </div>
          {error && !draft && <div className="mt-4"><Notice tone="error">{error}</Notice></div>}
        </Card>
      </section>

      <section>
        <SectionTitle kicker="Obiettivi comuni a tempo" title="Missioni" action={<Button onClick={() => setDraft(newMission())}><PlusIcon /> Nuova missione</Button>} />
        {data.missions.length === 0 ? (
          <Empty title="Nessuna missione.">Le missioni sono traguardi condivisi da tutte le squadre, con un inizio e una fine. Alla scadenza si chiudono.</Empty>
        ) : (
          <div className="grid grid-cols-1 gap-4 [&>*]:min-w-0 md:grid-cols-2">
            {data.missions.map((m) => {
              const p = missionProgress(m, data, now);
              return (
                <Card key={m.id} className="cursor-pointer transition hover:shadow-soft" onClick={() => setDraft({ ...m })}>
                  <div className="flex items-center justify-between">
                    <Tag>{MISSION_KIND[m.kind].label}</Tag>
                    <span className="label" style={{ color: p.state === "done" ? "var(--color-leaf)" : p.state === "active" ? "var(--color-ink)" : "var(--color-mute)" }}>
                      {{ upcoming: `tra ${remaining(m.starts_at, now)}`, active: `ancora ${remaining(m.ends_at, now)}`, done: "raggiunta", expired: "scaduta" }[p.state]}
                    </span>
                  </div>
                  <h3 className="display mt-5 text-[22px]">{m.title}</h3>
                  {m.description && <p className="soft mt-1 text-sm">{m.description}</p>}
                  <div className="mt-5 flex items-center gap-3">
                    <Meter value={p.ratio} color={p.state === "done" ? "var(--color-glow)" : undefined} />
                    <span className="num text-sm whitespace-nowrap">{p.current}/{m.target}</span>
                  </div>
                  <div className="label soft mt-2">{formatDate(m.starts_at)} → {formatDate(m.ends_at)}</div>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      <section>
        <SectionTitle kicker="Aperture per zona" title="Tempi delle aree" />
        {data.areas.length === 0 ? (
          <p className="soft text-sm">Disegna almeno un&apos;area per impostarne gli orari.</p>
        ) : (
          <Card className="divide-y divide-line !p-0">
            {data.areas.map((a) => (
              <div key={a.id} className="grid items-center gap-3 p-4 sm:grid-cols-[1fr_auto_auto_auto]">
                <div className="flex items-center gap-2.5">
                  <span className="size-3 rounded-full" style={{ background: a.color }} />
                  <span>{a.name}</span>
                  <Tag color={areaOpen(a, now) ? "var(--color-leaf)" : "var(--color-mute)"}>{areaOpen(a, now) ? "aperta" : "chiusa"}</Tag>
                </div>
                <Field aria-label={`Apertura ${a.name}`} type="datetime-local" defaultValue={toLocalInput(a.opens_at)}
                  onBlur={(e) => fromLocalInput(e.target.value) !== a.opens_at && run(async () => { await saveArea({ ...a, opens_at: fromLocalInput(e.target.value) }); await refresh(); })} />
                <Field aria-label={`Chiusura ${a.name}`} type="datetime-local" defaultValue={toLocalInput(a.closes_at)}
                  onBlur={(e) => fromLocalInput(e.target.value) !== a.closes_at && run(async () => { await saveArea({ ...a, closes_at: fromLocalInput(e.target.value) }); await refresh(); })} />
                <span className="soft text-[13px]">{!a.opens_at && !a.closes_at ? "segue la campagna" : ""}</span>
              </div>
            ))}
          </Card>
        )}
      </section>

      <Sheet open={!!draft} onClose={() => setDraft(null)} kicker={draft?.id ? "Modifica missione" : "Nuova missione"} title="Un traguardo per tutti" wide>
        {draft && (
          <form onSubmit={save} className="space-y-3">
            <Field label="Titolo" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} required maxLength={80} placeholder="Apriamo la zona nord" autoFocus />
            <Area label="Descrizione" value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} maxLength={300} />
            <div className="grid gap-3 sm:grid-cols-2">
              <Select label="Tipo" value={draft.kind} onChange={(e) => setDraft({ ...draft, kind: e.target.value as MissionKind })}>
                {Object.entries(MISSION_KIND).map(([k, v]) => <option key={k} value={k}>{v.label} — {v.unit}</option>)}
              </Select>
              <Field label={`Traguardo (${MISSION_KIND[draft.kind].unit})`} type="number" min={1} value={draft.target} onChange={(e) => setDraft({ ...draft, target: Number(e.target.value) })} required />
              <Select label="Tema" value={draft.theme_id ?? ""} onChange={(e) => setDraft({ ...draft, theme_id: e.target.value || null })}>
                <option value="">Tutti i temi</option>
                {data.themes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </Select>
              <Select label="Area" value={draft.area_id ?? ""} onChange={(e) => setDraft({ ...draft, area_id: e.target.value || null })}>
                <option value="">Tutto il territorio</option>
                {data.areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </Select>
              <Field label="Inizio" type="datetime-local" value={toLocalInput(draft.starts_at)} onChange={(e) => setDraft({ ...draft, starts_at: fromLocalInput(e.target.value) ?? draft.starts_at })} required />
              <Field label="Fine" type="datetime-local" value={toLocalInput(draft.ends_at)} min={toLocalInput(draft.starts_at)} onChange={(e) => setDraft({ ...draft, ends_at: fromLocalInput(e.target.value) ?? draft.ends_at })} required />
            </div>
            {error && <Notice tone="error">{error}</Notice>}
            <div className="flex gap-2 pt-2">
              <Button type="submit" size="lg" className="flex-1" disabled={busy}>Salva la missione</Button>
              {draft.id && <Button size="lg" variant="danger" disabled={busy} onClick={() => run(async () => { await deleteMission(draft.id!); await refresh(); setDraft(null); })}>Elimina</Button>}
            </div>
          </form>
        )}
      </Sheet>
    </div>
  );
}
