"use client";

import { useMemo, useState } from "react";
import { indicators, MISSION_KIND, missionProgress } from "@/domain/scoring";
import { ago, isOnline, remaining } from "@/domain/time";
import { announce } from "@/lib/data";
import { useAction } from "@/lib/hooks";
import MapView, { type MapMode, type MapPlayer } from "@/ui/MapView";
import { Area, Button, Card, Dot, Label, Meter, Notice, Ring, Segmented, Select, Sheet } from "@/ui/kit";
import { FormTag } from "@/campo/Collect";
import { summary } from "@/domain/forms";
import { formatMeters } from "@/domain/walk";
import { LayersIcon, LayersPanel, PointSheet, useLayers, type PointRef } from "@/ui/Layers";
import { backdrop, nameOf, teamOf, type Ctx } from "./shared";

export default function Regia({ data, me, now }: Ctx) {
  const ind = useMemo(() => indicators(data), [data]);
  const players = data.members.filter((m) => m.role === "player");
  const online = players.filter((m) => isOnline(m.last_seen_at, now));
  const onMap: MapPlayer[] = data.members
    .filter((m) => m.last_lng != null && m.last_lat != null)
    .map((m) => ({
      id: m.id, name: m.profile?.display_name ?? "", color: teamOf(data, m.team_id)?.color ?? "#3d4046",
      lng: m.last_lng!, lat: m.last_lat!, online: isOnline(m.last_seen_at, now),
    }));
  const missions = data.missions.map((m) => missionProgress(m, data, now)).filter((p) => p.state === "active" || p.state === "done");
  const pending = data.observations.filter((o) => o.status === "pending").length;

  const [mode, setMode] = useState<MapMode>("2d");
  const layerState = useLayers(data.datasets);
  const [point, setPoint] = useState<PointRef | null>(null);
  const [layersOpen, setLayersOpen] = useState(false);
  const [body, setBody] = useState("");
  const [target, setTarget] = useState("");
  const { busy, error, run } = useAction();
  const send = (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim()) return;
    run(async () => { await announce(data.campaign.id, me.user_id, body.trim(), target || null); setBody(""); });
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_380px]">
      <div className="space-y-4">
        <div className="relative h-[62dvh] min-h-[420px] overflow-hidden rounded-panel border hairline">
          <MapView
            className="size-full" center={[data.campaign.center_lng, data.campaign.center_lat]} zoom={data.campaign.zoom}
            areas={data.areas} observations={data.observations} players={onMap} grid fit mode={mode} walked={ind.walkedCells} places={data.places} routes={data.routes} layers={layerState.layers} onLayerPointClick={(x) => setPoint({ datasetId: x.datasetId, index: x.index })} reached={[...ind.places.values()].filter((p) => p.reached.size).map((p) => p.place.id)} {...backdrop(data.campaign)}
          />
          {layerState.all.length > 0 && (
            <button onClick={() => setLayersOpen(true)} className="glass absolute top-28 left-4 inline-flex h-10 items-center gap-2 rounded-full px-4 text-[13px] font-medium">
              <LayersIcon /> Strati {layerState.layers.length}/{layerState.all.length}
            </button>
          )}
          <div className="glass absolute top-16 left-4 rounded-full p-1">
            <Segmented className="!border-0 !p-0" value={mode} onChange={setMode} options={[{ id: "2d", label: "Piano" }, { id: "model", label: "Modello" }]} />
          </div>
          <div className="glass absolute top-4 left-4 flex items-center gap-4 rounded-full py-2 pr-5 pl-4">
            <Dot color="var(--color-leaf)" live={online.length > 0} />
            <span className="text-sm"><b className="num font-medium">{online.length}</b> sul campo ora</span>
            <span className="soft text-sm">{players.length} giocatori</span>
          </div>
          <div className="glass absolute bottom-4 left-4 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-2xl px-4 py-2.5 text-[13px]">
            <span className="inline-flex items-center gap-1.5"><Dot color="var(--color-field)" />Field {ind.byKind.field}</span>
            <span className="inline-flex items-center gap-1.5"><Dot color="var(--color-desk)" />Desk {ind.byKind.desk}</span>
            <span className="inline-flex items-center gap-1.5"><Dot color="var(--color-feel)" />Feel {ind.byKind.feel}</span>
            <span className="soft">{ind.cellsCovered}/{ind.cellsTotal} celle</span>
            <span className="soft">{formatMeters(ind.walkedMeters)} a piedi</span>
          </div>
        </div>

        <Card>
          <div className="mb-4 flex items-center justify-between">
            <Label>Attività recente</Label>
            {pending > 0 && <span className="soft text-[13px]">{pending} in attesa di validazione</span>}
          </div>
          {data.observations.length === 0 ? (
            <p className="soft py-6 text-center text-sm">Ancora nessun rilievo. Avvia la campagna e condividi il codice.</p>
          ) : (
            <ul className="divide-y divide-line">
              {data.observations.slice(0, 8).map((o) => (
                <li key={o.id} className="flex items-center gap-3 py-2.5">
                  <FormTag form={o.form} />
                  <span className="min-w-0 flex-1 truncate text-[15px]">{o.title}{summary(o) && <span className="soft"> – {summary(o)}</span>}</span>
                  <span className="soft hidden items-center gap-1.5 text-[13px] sm:inline-flex">
                    {teamOf(data, o.team_id) && <Dot color={teamOf(data, o.team_id)!.color} />}
                    {nameOf(data, o.author_id)}
                  </span>
                  <span className="label soft w-20 shrink-0 text-right whitespace-nowrap">{ago(o.created_at, now)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Sheet open={layersOpen} onClose={() => setLayersOpen(false)} kicker="Sulla mappa" title="Strati di dati"><LayersPanel state={layerState} /></Sheet>
      <PointSheet point={point} datasets={data.datasets} onClose={() => setPoint(null)} />
      <div className="space-y-4">
        <div className="on-ink rounded-panel p-6">
          <Label>Punteggio collettivo</Label>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="display num text-[64px] leading-none text-glow">{ind.score.toLocaleString("it-IT")}</span>
            <span className="label soft">pt</span>
          </div>
          <p className="soft mt-2 text-[13px]">+{ind.potential} pt in attesa di una validazione</p>
          <div className="mt-6 grid grid-cols-4 gap-2 text-center">
            {[
              ["Copertura", ind.coverage, "var(--color-glow)"],
              ["Equilibrio", ind.balance, "#8fb3d1"],
              ["Affidabilità", ind.reliability, "#e08a6e"],
              ["Scambio", ind.exchange, "#e8c07a"],
            ].map(([label, v, color]) => (
              <div key={label as string}>
                <Ring value={v as number} color={color as string} size={58} />
                <div className="label soft mt-1.5 !text-[9px]">{label}</div>
              </div>
            ))}
          </div>
        </div>

        <Card>
          <Label>Missioni in corso</Label>
          {missions.length === 0 ? (
            <p className="soft mt-3 text-sm">Nessuna missione attiva. Creane una nella sezione Tempi.</p>
          ) : (
            <ul className="mt-3 space-y-4">
              {missions.map(({ mission, current, ratio, state }) => (
                <li key={mission.id}>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-[15px]">{mission.title}</span>
                    <span className="num soft text-[13px]">{current}/{mission.target}</span>
                  </div>
                  <Meter value={ratio} className="mt-2" color={state === "done" ? "var(--color-glow)" : undefined} />
                  <div className="label soft mt-1.5">
                    {MISSION_KIND[mission.kind].label} – {state === "done" ? "raggiunta" : `ancora ${remaining(mission.ends_at, now)}`}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <Label>Giocatori</Label>
          {players.length === 0 ? (
            <p className="soft mt-3 text-sm">Nessun giocatore è ancora entrato.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {[...players].sort((a, b) => (b.last_seen_at ?? "").localeCompare(a.last_seen_at ?? "")).slice(0, 8).map((m) => (
                <li key={m.id} className="flex items-center gap-2.5 text-sm">
                  <Dot color={isOnline(m.last_seen_at, now) ? "var(--color-leaf)" : "var(--color-line)"} live={isOnline(m.last_seen_at, now)} />
                  <span className="min-w-0 flex-1 truncate">{m.profile?.display_name}</span>
                  <span className="soft text-[13px]">{teamOf(data, m.team_id)?.name ?? "senza team"}</span>
                  <span className="label soft w-20 shrink-0 text-right whitespace-nowrap">{ago(m.last_seen_at, now)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <Label>Messaggio ai team</Label>
          <form onSubmit={send} className="mt-3 space-y-2.5">
            <Area value={body} onChange={(e) => setBody(e.target.value)} placeholder="Es. La zona nord è ancora scoperta: chi può passarci?" maxLength={280} aria-label="Messaggio" />
            <div className="flex gap-2">
              <Select value={target} onChange={(e) => setTarget(e.target.value)} aria-label="Destinatari" className="flex-1">
                <option value="">A tutti</option>
                {data.teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </Select>
              <Button type="submit" disabled={busy || !body.trim()} className="h-11">Invia</Button>
            </div>
            {error && <Notice tone="error">{error}</Notice>}
          </form>
          {data.announcements.length > 0 && (
            <ul className="mt-4 space-y-2 border-t hairline pt-3">
              {data.announcements.slice(0, 3).map((a) => (
                <li key={a.id} className="text-[13px]">
                  <span className="label soft">{teamOf(data, a.team_id)?.name ?? "Tutti"} – {ago(a.created_at, now)}</span>
                  <p className="mt-0.5">{a.body}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
