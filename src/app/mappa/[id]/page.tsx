"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { FormTag } from "@/campo/Collect";
import { SurveyAnswers } from "@/campo/Survey";
import { figuresFor, formatValue } from "@/domain/datasets";
import { formOf, summary } from "@/domain/forms";
import { categoryOf, type Contribution, type Observation, type Place } from "@/domain/types";
import { formatMeters } from "@/domain/walk";
import { explain, loadPublicMap, mediaUrl, type PublicMap } from "@/lib/data";
import { backdrop } from "@/studio/shared";
import { Spark } from "@/ui/charts";
import { Community, ContributeSheet, contributionsFor, type Target } from "@/ui/Contribute";
import { LayersIcon, LayersPanel, PointSheet, useLayers, type PointRef } from "@/ui/Layers";
import MapView, { type MapMode } from "@/ui/MapView";
import { Button, cx, Empty, Label, LinkButton, Logo, Notice, Segmented, Sheet, Spinner, Tag } from "@/ui/kit";
import { PUBLIC_LAYER } from "@/domain/palette";

type Layer = "territorio" | "siti" | "luoghi" | "contributi" | "dati";
type Item = { kind: "obs"; o: Observation } | { kind: "contrib"; c: Contribution } | { kind: "place"; p: Place } | { kind: "area"; name: string };

const LAYERS: { id: Layer; label: string; color: string }[] = [
  { id: "territorio", label: "Territorio", color: PUBLIC_LAYER.territorio },
  { id: "siti", label: "Indagini sui siti", color: PUBLIC_LAYER.siti },
  { id: "luoghi", label: "Luoghi e percorsi", color: PUBLIC_LAYER.luoghi },
  { id: "contributi", label: "Contributi", color: PUBLIC_LAYER.contributi },
  { id: "dati", label: "Dati del territorio", color: PUBLIC_LAYER.dati },
];
const date = (iso: string) => new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "long", year: "numeric" }).format(new Date(iso));

export default function Mappa() {
  const { id } = useParams<{ id: string }>();
  const [map, setMap] = useState<PublicMap | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [on, setOn] = useState<Set<Layer>>(new Set(["territorio", "siti", "luoghi", "contributi", "dati"]));
  const layerState = useLayers(map?.datasets ?? []);
  const [point, setPoint] = useState<PointRef | null>(null);
  const [layersOpen, setLayersOpen] = useState(false);
  const [target, setTarget] = useState<Target | null>(null);
  const [mode, setMode] = useState<MapMode>("2d");
  const [item, setItem] = useState<Item | null>(null);
  const [list, setList] = useState(false);
  const [intro, setIntro] = useState(true);
  // su telefono la presentazione parte chiusa: la mappa viene prima
  useEffect(() => { if (window.innerWidth < 640) { const t = setTimeout(() => setIntro(false), 0); return () => clearTimeout(t); } }, []);

  useEffect(() => {
    loadPublicMap(id).then(setMap, (e) => { setError(explain(e)); setMap(null); });
  }, [id]);

  const obs = useMemo(() => (map?.observations ?? []).filter((o) => (o.form === "indagine" ? on.has("siti") : on.has("territorio"))), [map, on]);
  // i contributi su un punto esistente stanno nella sua scheda, non come segnaposto a sé
  const contribs = on.has("contributi") ? (map?.contributions ?? []).filter((x) => !x.place_id && !x.dataset_id) : [];

  if (map === undefined) return <main className="on-ink min-h-dvh"><Spinner label="Apro la mappa" /></main>;
  if (!map) {
    return (
      <main className="on-paper grid min-h-dvh place-items-center p-6">
        <div className="w-full max-w-md space-y-4">
          {error && <Notice tone="error">{error}</Notice>}
          <Empty title="Questa mappa non è pubblica." action={<LinkButton href="/accedi">Accedi</LinkButton>}>
            La regia non l&apos;ha ancora resa visibile a tutti. Se partecipi alla campagna, accedi per vederla.
          </Empty>
        </div>
      </main>
    );
  }

  const c = map.campaign;
  const team = (tid: string | null) => map.teams.find((t) => t.id === tid);
  const theme = (tid: string | null) => map.themes.find((t) => t.id === tid);
  const place = (pid: string | null | undefined) => map.places.find((p) => p.id === pid);
  const toggle = (l: Layer) => setOn((s) => { const n = new Set(s); if (n.has(l)) n.delete(l); else n.add(l); return n; });
  const sites = map.observations.filter((o) => o.form === "indagine").length;

  const entries: { key: string; at: string; item: Item }[] = [
    ...obs.map((o) => ({ key: o.id, at: o.created_at, item: { kind: "obs" as const, o } })),
    ...contribs.map((x) => ({ key: x.id, at: x.created_at, item: { kind: "contrib" as const, c: x } })),
  ].sort((a, b) => b.at.localeCompare(a.at));

  return (
    <main className="fixed inset-0 overflow-hidden bg-paper-2">
      <MapView
        className="absolute inset-0" center={[c.center_lng, c.center_lat]} zoom={c.zoom} areas={map.areas} observations={obs} fit mode={mode}
        {...backdrop(c)} controls creditsLift="5.25rem"
        places={on.has("luoghi") ? map.places : []} routes={on.has("luoghi") ? map.routes : []} contributions={contribs}
        onObservationClick={(oid) => { const o = map.observations.find((x) => x.id === oid); if (o) setItem({ kind: "obs", o }); }}
        onContributionClick={(cid) => { const x = map.contributions.find((y) => y.id === cid); if (x) setItem({ kind: "contrib", c: x }); }}
        onPlaceClick={(pid) => { const p = place(pid); if (p) setItem({ kind: "place", p }); }}
        layers={on.has("dati") ? layerState.layers : []}
        onLayerPointClick={(x) => setPoint({ datasetId: x.datasetId, index: x.index })}
        onAreaClick={(aid) => { const a = map.areas.find((x) => x.id === aid); if (a) setItem({ kind: "area", name: a.name }); }}
      />

      {/* ------------------------------------------------------- intestazione */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex flex-col gap-2 p-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:p-5">
        <div className="glass pointer-events-auto w-full max-w-md rounded-[26px] p-4">
          <div className="flex items-center justify-between gap-3">
            <Link href="/" aria-label="Territorial Quest"><Logo className="[&>span]:hidden sm:[&>span]:inline" /></Link>
            <Label>{c.public_map ? "Mappa pubblica" : "Archivio della campagna"}</Label>
          </div>
          <h1 className="display mt-3 text-[clamp(1.6rem,6vw,2.2rem)]">{c.name}</h1>
          {intro && (c.public_intro || c.description) && <p className="soft mt-1.5 text-sm leading-snug">{c.public_intro || c.description}</p>}
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[13px]">
            <span><b className="num font-medium">{map.observations.length - sites}</b> rilievi validati</span>
            <span><b className="num font-medium">{sites}</b> indagini sui siti</span>
            <span><b className="num font-medium">{map.places.length}</b> luoghi</span>
            <span><b className="num font-medium">{map.contributions.length}</b> contributi</span>
            {map.stats.walked_m > 0 && <span><b className="num font-medium">{formatMeters(map.stats.walked_m)}</b> a piedi</span>}
          </div>
          {(c.public_intro || c.description) && (
            <button className="soft -mb-2 -ml-2 mt-0.5 h-10 px-2 text-[13px] underline-offset-2 hover:underline" onClick={() => setIntro(!intro)}>{intro ? "Riduci" : "Leggi la presentazione"}</button>
          )}
        </div>
        <div className="pointer-events-auto -mx-3 flex gap-1.5 overflow-x-auto px-3 pb-1 sm:mx-0 sm:px-0">
          {LAYERS.map((l) => (
            <button key={l.id} onClick={() => toggle(l.id)} aria-pressed={on.has(l.id)}
              className={cx("glass inline-flex h-9 shrink-0 items-center gap-2 rounded-full px-3.5 text-[13px] transition", !on.has(l.id) && "opacity-55")}>
              <span className="size-2.5 rounded-full" style={{ background: on.has(l.id) ? l.color : "transparent", boxShadow: `inset 0 0 0 1.5px ${l.color}` }} />{l.label}
            </button>
          ))}
          <div className="glass shrink-0 rounded-full p-0.5"><Segmented className="!border-0 !p-0" value={mode} onChange={setMode} options={[{ id: "2d", label: "Piano" }, { id: "model", label: "Modello" }]} /></div>
        </div>
      </div>


      {/* ---------------------------------------------------------------- dock */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex justify-center px-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="glass pointer-events-auto flex items-center gap-1.5 rounded-full p-1.5">
          <Button variant="ghost" onClick={() => setList(true)}>Elenco – {entries.length}</Button>
          {layerState.all.length > 0 && <Button variant="ghost" className="!px-3.5" onClick={() => setLayersOpen(true)} aria-label="Strati di dati"><LayersIcon /><span className="hidden sm:inline">Strati</span></Button>}
          {map.datasets.length > 0 && <Button variant="ghost" onClick={() => setItem({ kind: "area", name: "" })}>Fonti</Button>}
          {c.contributions_open && <LinkButton href={`/contribuisci/${id}`} prefetch={false} variant="glow">Contribuisci</LinkButton>}
        </div>
      </div>

      <Sheet open={layersOpen} onClose={() => setLayersOpen(false)} kicker={c.name} title="Strati di dati"><LayersPanel state={layerState} /></Sheet>
      <PointSheet point={point} datasets={map.datasets} onClose={() => setPoint(null)}
        contributions={map.contributions} campaignId={c.id} onContribute={(t) => { setPoint(null); setTarget(t); }} />
      <ContributeSheet target={target} onClose={() => setTarget(null)} />

      {/* ------------------------------------------------------------- elenco */}
      <Sheet open={list} onClose={() => setList(false)} kicker={c.name} title="Che cosa è emerso" wide>
        {entries.length === 0 ? <Empty title="Ancora niente di pubblicato.">I rilievi compaiono qui dopo la conferma di un altro team, i contributi dopo l&apos;approvazione della regia.</Empty> : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {entries.slice(0, 300).map(({ key, item: it }) => {
              const form = it.kind === "obs" ? it.o.form : it.kind === "contrib" ? it.c.form : null;
              const title = it.kind === "obs" ? it.o.title : it.kind === "contrib" ? it.c.title : "";
              const img = mediaUrl(it.kind === "obs" ? it.o.media_path : it.kind === "contrib" ? it.c.media_path : null);
              return (
                <li key={key}>
                  <button className="surface flex w-full gap-3 rounded-card border hairline p-3 text-left transition hover:shadow-soft" onClick={() => { setList(false); setItem(it); }}>
                    {img ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={img} alt="" className="size-16 shrink-0 rounded-xl object-cover" loading="lazy" />
                      : <span className="size-16 shrink-0 rounded-xl" style={{ background: `color-mix(in srgb, ${formOf(form).color} 16%, transparent)` }} />}
                    <span className="min-w-0">
                      <span className="flex flex-wrap gap-1"><FormTag form={form} />{it.kind === "contrib" && <Tag>Contributo</Tag>}</span>
                      <span className="mt-1 block truncate text-[15px] tracking-[-0.01em]">{title}</span>
                      <span className="soft block text-xs">{it.kind === "contrib" ? it.c.display_name : team(it.kind === "obs" ? it.o.team_id : null)?.name ?? "Regia"}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Sheet>

      {/* ------------------------------------------------------------ dettaglio */}
      <Sheet open={!!item} onClose={() => setItem(null)} wide
        kicker={!item ? "" : item.kind === "area" ? (item.name ? "Scheda del territorio" : "Dati del territorio") : item.kind === "obs" ? `${team(item.o.team_id)?.name ?? "Regia"} – ${date(item.o.created_at)}` : item.kind === "contrib" ? `Contributo di ${item.c.display_name} – ${date(item.c.created_at)}` : `${categoryOf(item.p.category).label} – luogo`}
        title={!item ? "" : item.kind === "area" ? item.name || "Fonti" : item.kind === "obs" ? item.o.title : item.kind === "contrib" ? item.c.title : item.p.name}>
        {item?.kind === "area" && (() => {
          const figs = item.name ? figuresFor(map.datasets, item.name) : [];
          const groups = [...new Set(figs.map((f) => f.dataset.id))].map((id) => figs.filter((f) => f.dataset.id === id));
          return (
            <div className="space-y-5">
              {item.name && figs.length === 0 && <p className="soft text-sm">Nessun indicatore per quest&apos;area: i dati si collegano alle aree che si chiamano come i Comuni dei file.</p>}
              {groups.map((g) => (
                <section key={g[0].dataset.id}>
                  <Label className="mb-2 block">{g[0].dataset.name}</Label>
                  <ul className="divide-y divide-line">
                    {g.map((f) => (
                      <li key={f.column.key} className="flex items-center gap-3 py-2 text-sm">
                        <span className="min-w-0 flex-1">{f.column.label}{f.year ? <span className="soft"> {f.year}</span> : null}</span>
                        {f.series.length > 2 && <Spark points={f.series} unit={f.column.unit} />}
                        <span className="num w-28 text-right">{formatValue(f.value, f.column.unit)}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
              <section>
                <Label className="mb-2 block">Fonti dei dati</Label>
                <ul className="space-y-1 text-[13px]">
                  {map.datasets.map((d) => <li key={d.id}><b className="font-medium">{d.name}</b>{d.source ? `: ${d.source}` : ""}{d.licence ? ` (${d.licence})` : ""}{d.note ? <span className="soft"> {d.note}</span> : null}</li>)}
                </ul>
              </section>
            </div>
          );
        })()}
        {item?.kind === "place" && (
          <div className="space-y-4">
            {item.p.images.length > 0 && (
              <div className="-mx-6 flex snap-x snap-mandatory gap-2 overflow-x-auto px-6 sm:-mx-8 sm:px-8">
                {item.p.images.map((path) => /* eslint-disable-next-line @next/next/no-img-element */ <img key={path} src={mediaUrl(path) ?? ""} alt="" className="h-56 w-[85%] shrink-0 snap-center rounded-card object-cover" />)}
              </div>
            )}
            {item.p.description && <p className="text-[15px] leading-snug">{item.p.description}</p>}
            <Community items={contributionsFor(map.contributions, { place_id: item.p.id })}
              onAdd={() => { const p = item.p; setItem(null); setTarget({ campaignId: c.id, name: p.name, at: [p.lng, p.lat], place_id: p.id }); }} />
            {(() => {
              const found = map.observations.filter((o) => o.place_id === item.p.id);
              return found.length > 0 && (
                <div>
                  <Label className="mb-2 block">Raccolto qui – {found.length}</Label>
                  <ul className="divide-y divide-line">{found.map((o) => <li key={o.id}><button className="flex w-full items-center gap-2 py-2.5 text-left text-sm" onClick={() => setItem({ kind: "obs", o })}><FormTag form={o.form} /><span className="truncate">{o.title}</span></button></li>)}</ul>
                </div>
              );
            })()}
          </div>
        )}
        {item?.kind === "obs" && (
          <div className="space-y-3">
            {mediaUrl(item.o.media_path) && /* eslint-disable-next-line @next/next/no-img-element */ <img src={mediaUrl(item.o.media_path)!} alt="" className="max-h-80 w-full rounded-card object-cover" />}
            <div className="flex flex-wrap gap-1.5">
              <FormTag form={item.o.form} />
              {theme(item.o.theme_id) && <Tag color={theme(item.o.theme_id)!.color}>{theme(item.o.theme_id)!.name}</Tag>}
              {place(item.o.place_id) && <button onClick={() => setItem({ kind: "place", p: place(item.o.place_id)! })}><Tag color={categoryOf(place(item.o.place_id)!.category).color}>{place(item.o.place_id)!.name}</Tag></button>}
              <Tag color="var(--color-leaf)">validato</Tag>
            </div>
            {item.o.form === "percezione" && item.o.feeling ? <p className="serif text-2xl italic">«{item.o.feeling}»</p>
              : item.o.form !== "indagine" && summary(item.o) && <p className="display text-xl" style={{ color: formOf(item.o.form).color }}>{summary(item.o)}</p>}
            {item.o.form === "indagine" && <SurveyAnswers data={item.o.data} mediaUrl={mediaUrl} />}
            {item.o.note && <p className="text-[15px] leading-snug">{item.o.note}</p>}
            {item.o.source_url && <a className="text-sm underline underline-offset-2" href={item.o.source_url} target="_blank" rel="noreferrer">Apri la fonte</a>}
          </div>
        )}
        {item?.kind === "contrib" && (
          <div className="space-y-3">
            {mediaUrl(item.c.media_path) && /* eslint-disable-next-line @next/next/no-img-element */ <img src={mediaUrl(item.c.media_path)!} alt="" className="max-h-80 w-full rounded-card object-cover" />}
            <div className="flex flex-wrap gap-1.5"><FormTag form={item.c.form} /><Tag>Contributo individuale</Tag></div>
            {item.c.feeling && <p className="serif text-2xl italic">«{item.c.feeling}»</p>}
            {item.c.note && <p className="text-[15px] leading-snug">{item.c.note}</p>}
            <p className="soft text-xs">Approvato dalla regia della campagna.</p>
          </div>
        )}
      </Sheet>
    </main>
  );
}
