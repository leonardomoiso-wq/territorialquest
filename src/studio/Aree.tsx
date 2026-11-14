"use client";

import { useRef, useState } from "react";
import { cellsOf, closeRing, hectares } from "@/domain/geo";
import { areaOpen, fromLocalInput, toLocalInput } from "@/domain/time";
import type { Polygon } from "@/domain/types";
import { deleteArea, saveArea, updateCampaign } from "@/lib/data";
import { useAction } from "@/lib/hooks";
import MapView from "@/ui/MapView";
import { Button, Card, Field, Label, Notice, PlusIcon, Select, Sheet, Tag } from "@/ui/kit";
import { PALETTE, Swatches, teamOf, type Ctx } from "./shared";

interface Draft {
  id?: string;
  name: string;
  color: string;
  team_id: string | null;
  opens_at: string | null;
  closes_at: string | null;
  geometry: Polygon;
}

export default function Aree({ data, now, refresh }: Ctx) {
  const c = data.campaign;
  const [points, setPoints] = useState<[number, number][] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const view = useRef<{ center: [number, number]; zoom: number } | null>(null);
  const [viewSaved, setViewSaved] = useState(false);
  const { busy, error, run } = useAction();
  const drawing = points !== null;

  const finish = () => {
    if (!points || points.length < 3) return;
    setDraft({
      name: `Area ${data.areas.length + 1}`, color: PALETTE[data.areas.length % PALETTE.length], team_id: null,
      opens_at: null, closes_at: null, geometry: closeRing(points),
    });
  };
  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft) return;
    run(async () => {
      await saveArea({ ...draft, campaign_id: c.id, name: draft.name.trim() });
      await refresh();
      setDraft(null);
      setPoints(null);
    });
  };
  const saveView = () => {
    if (!view.current) return;
    const { center, zoom } = view.current;
    run(async () => {
      await updateCampaign(c.id, { center_lng: center[0], center_lat: center[1], zoom });
      setViewSaved(true);
      setTimeout(() => setViewSaved(false), 2500);
    });
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
      <div className="relative h-[72dvh] min-h-[460px] overflow-hidden rounded-panel border hairline">
        <MapView
          className="size-full" center={[c.center_lng, c.center_lat]} zoom={c.zoom} areas={data.areas} observations={data.observations}
          grid fit selectedAreaId={selected} draft={points ?? undefined}
          onClick={drawing ? (p) => setPoints([...(points ?? []), p]) : undefined}
          onAreaClick={(id) => setSelected(id === selected ? null : id)}
          onMove={(center, zoom) => { view.current = { center, zoom }; }}
        />
        <div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center px-4">
          <div className="glass pointer-events-auto flex items-center gap-2 rounded-full p-1.5">
            {drawing ? (
              <>
                <span className="px-3 text-sm">{points.length < 3 ? `Tocca la mappa per i vertici (${points.length}/3)` : `${points.length} vertici`}</span>
                <Button size="sm" variant="ghost" onClick={() => setPoints(points.slice(0, -1))} disabled={!points.length}>Annulla ultimo</Button>
                <Button size="sm" variant="ghost" onClick={() => setPoints(null)}>Esci</Button>
                <Button size="sm" variant="glow" onClick={finish} disabled={points.length < 3}>Chiudi l&apos;area</Button>
              </>
            ) : (
              <>
                <Button onClick={() => { setPoints([]); setSelected(null); }}><PlusIcon /> Disegna un&apos;area</Button>
                <Button variant="ghost" onClick={saveView} disabled={busy}>{viewSaved ? "Vista salvata ✓" : "Usa questa vista come partenza"}</Button>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-end justify-between">
          <div>
            <Label>Territorio</Label>
            <h2 className="display mt-1 text-[26px]">{data.areas.length} {data.areas.length === 1 ? "area" : "aree"}</h2>
          </div>
          <span className="soft text-[13px]">{data.areas.reduce((s, a) => s + hectares(a.geometry), 0).toFixed(1)} ha</span>
        </div>
        {error && !draft && <Notice tone="error">{error}</Notice>}
        {data.areas.length === 0 && (
          <p className="soft rounded-card border border-dashed hairline p-5 text-sm">
            Sposta la mappa sul territorio da esplorare, premi «Disegna un&apos;area» e tocca i vertici del perimetro. Puoi creare più aree e assegnarle ai team.
          </p>
        )}
        {data.areas.map((a) => {
          const team = teamOf(data, a.team_id);
          const count = data.observations.filter((o) => o.area_id === a.id).length;
          return (
            <Card key={a.id} className={`cursor-pointer transition ${selected === a.id ? "!border-ink shadow-soft" : ""}`} onClick={() => setSelected(a.id === selected ? null : a.id)}>
              <div className="flex items-center gap-2.5">
                <span className="size-3 shrink-0 rounded-full" style={{ background: a.color }} />
                <h3 className="min-w-0 flex-1 truncate text-[17px] tracking-[-0.02em]">{a.name}</h3>
                <Tag color={areaOpen(a, now) ? "var(--color-leaf)" : "var(--color-mute)"}>{areaOpen(a, now) ? "aperta" : "chiusa"}</Tag>
              </div>
              <div className="soft mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[13px]">
                <span>{hectares(a.geometry).toFixed(1)} ha</span>
                <span>{cellsOf(a.geometry).length} celle</span>
                <span>{count} rilievi</span>
                <span>{team ? team.name : "tutti i team"}</span>
              </div>
              {selected === a.id && (
                <div className="mt-4 flex gap-2">
                  <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); setDraft({ ...a }); }}>Modifica</Button>
                  <Button size="sm" variant="danger" disabled={busy} onClick={(e) => { e.stopPropagation(); if (confirm(`Eliminare «${a.name}»? I rilievi restano.`)) run(async () => { await deleteArea(a.id); await refresh(); }); }}>Elimina</Button>
                </div>
              )}
            </Card>
          );
        })}
      </div>

      <Sheet open={!!draft} onClose={() => setDraft(null)} kicker={draft?.id ? "Modifica area" : "Nuova area"} title="Dove si esplora">
        {draft && (
          <form onSubmit={save} className="space-y-4">
            <Field label="Nome" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} required maxLength={50} autoFocus />
            <div><Label className="mb-2 block">Colore</Label><Swatches value={draft.color} onChange={(color) => setDraft({ ...draft, color })} /></div>
            <Select label="Assegnata a" value={draft.team_id ?? ""} onChange={(e) => setDraft({ ...draft, team_id: e.target.value || null })}>
              <option value="">Tutti i team</option>
              {data.teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </Select>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Apre" type="datetime-local" value={toLocalInput(draft.opens_at)} onChange={(e) => setDraft({ ...draft, opens_at: fromLocalInput(e.target.value) })} />
              <Field label="Chiude" type="datetime-local" value={toLocalInput(draft.closes_at)} onChange={(e) => setDraft({ ...draft, closes_at: fromLocalInput(e.target.value) })} />
            </div>
            <p className="soft text-[13px]">Senza orari, l&apos;area segue i tempi della campagna. Superficie: {hectares(draft.geometry).toFixed(1)} ha.</p>
            {error && <Notice tone="error">{error}</Notice>}
            <Button type="submit" size="lg" className="w-full" disabled={busy}>Salva l&apos;area</Button>
          </form>
        )}
      </Sheet>
    </div>
  );
}
