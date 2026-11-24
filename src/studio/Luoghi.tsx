"use client";

import { useMemo, useState } from "react";
import { metersBetween, formatMeters } from "@/domain/walk";
import { categoryOf, PLACE_CATEGORIES, type Place, type PlaceCategory, type Route } from "@/domain/types";
import { deletePlace, deleteRoute, mediaUrl, savePlace, saveRoute, uploadMedia } from "@/lib/data";
import { useAction } from "@/lib/hooks";
import MapView from "@/ui/MapView";
import { Area, Button, Card, cx, Empty, Field, Label, Notice, PlusIcon, Segmented, Sheet, Tag } from "@/ui/kit";
import { backdrop, PALETTE, Swatches, type Ctx } from "./shared";
import SurveyEditor from "./SurveyEditor";
import { PointSheet, type PointRef } from "@/ui/Layers";

type PlaceDraft = Omit<Place, "id" | "campaign_id" | "created_at"> & { id?: string };
type RouteDraft = { id?: string; name: string; description: string; color: string; stops: string[] };

const blankPlace = (lng: number, lat: number): PlaceDraft => ({
  name: "", description: "", prompt: "", category: "storico", lng, lat, radius_m: 40, points: 30, images: [], survey: [],
});

/** Lunghezza a piedi di un percorso, in linea d'aria tra le tappe. */
export function routeLength(stops: string[], places: Place[]): number {
  const pts = stops.map((id) => places.find((p) => p.id === id)).filter((p): p is Place => !!p);
  let m = 0;
  for (let i = 1; i < pts.length; i++) m += metersBetween([pts[i - 1].lng, pts[i - 1].lat], [pts[i].lng, pts[i].lat]);
  return m;
}
/** Tempo indicativo: 4 km/h più dieci minuti di osservazione a tappa. */
export const routeMinutes = (meters: number, stops: number) => Math.round((meters / 4000) * 60 + stops * 10);

export default function Luoghi({ data, refresh }: Ctx) {
  const c = data.campaign;
  const { busy, error, run, setError } = useAction();
  const [tab, setTab] = useState<"luoghi" | "percorsi">("luoghi");
  const [picking, setPicking] = useState(false);
  const [place, setPlace] = useState<PlaceDraft | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [route, setRoute] = useState<RouteDraft | null>(null);
  const [uploading, setUploading] = useState(false);
  /** Luogo importato senza coordinate che si sta posizionando. */
  const [placing, setPlacing] = useState<Place | null>(null);
  const [point, setPoint] = useState<PointRef | null>(null);
  const unplaced = data.places.filter((p) => p.placed === false);
  const placedPlaces = data.places.filter((p) => p.placed !== false);

  const visitsBy = useMemo(() => {
    const m = new Map<string, number>();
    for (const v of data.visits) m.set(v.place_id, (m.get(v.place_id) ?? 0) + 1);
    return m;
  }, [data.visits]);
  const obsBy = useMemo(() => {
    const m = new Map<string, number>();
    for (const o of data.observations) if (o.place_id) m.set(o.place_id, (m.get(o.place_id) ?? 0) + 1);
    return m;
  }, [data.observations]);

  // durante la modifica di un percorso si vede solo quello
  const shownRoutes: Route[] = route
    ? [{ id: route.id ?? "nuovo", campaign_id: c.id, name: route.name, description: "", color: route.color, stops: route.stops, created_at: "" }]
    : data.routes;

  const onMapClick = placing
    ? (p: [number, number]) => {
        const pl = placing;
        setPlacing(null);
        run(async () => { await savePlace({ ...pl, lng: p[0], lat: p[1], placed: true }); await refresh(); });
      }
    : picking
    ? (p: [number, number]) => {
        setPicking(false);
        setPlace((d) => (d ? { ...d, lng: p[0], lat: p[1] } : blankPlace(p[0], p[1])));
      }
    : undefined;
  const onPlaceClick = (id: string) => {
    if (route) {
      setRoute({ ...route, stops: route.stops.includes(id) ? route.stops.filter((s) => s !== id) : [...route.stops, id] });
      return;
    }
    setSelected(id);
    setTab("luoghi");
  };

  const upload = async (files: FileList | null) => {
    if (!files?.length || !place) return;
    setUploading(true);
    setError(null);
    try {
      const paths: string[] = [];
      for (const f of Array.from(files).slice(0, 8)) paths.push(await uploadMedia(c.id, f));
      setPlace((d) => (d ? { ...d, images: [...d.images, ...paths] } : d));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading(false);
    }
  };

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (!place) return;
    run(async () => {
      const survey = (place.survey ?? []).filter((q) => q.label.trim()).map((q) => ({ ...q, label: q.label.trim(), options: q.options?.map((o) => o.trim()).filter(Boolean) }));
      await savePlace({ ...place, survey, campaign_id: c.id, name: place.name.trim(), description: place.description.trim(), prompt: place.prompt.trim() });
      await refresh();
      setPlace(null);
    });
  };
  const saveR = () => route && run(async () => {
    await saveRoute({ ...route, campaign_id: c.id, name: route.name.trim() || `Percorso ${data.routes.length + 1}` });
    await refresh();
    setRoute(null);
  });
  const move = (i: number, d: -1 | 1) => {
    if (!route) return;
    const s = [...route.stops];
    [s[i], s[i + d]] = [s[i + d], s[i]];
    setRoute({ ...route, stops: s });
  };

  const placeName = (id: string) => data.places.find((p) => p.id === id)?.name ?? "luogo eliminato";
  const totalPoints = data.places.reduce((s, p) => s + p.points, 0);

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
      <div className="relative h-[76dvh] min-h-[480px] overflow-hidden rounded-panel border hairline">
        <MapView
          className="size-full" center={[c.center_lng, c.center_lat]} zoom={c.zoom} areas={data.areas} fit {...backdrop(c)}
          places={data.places} routes={shownRoutes} layers={data.datasets.filter((d) => d.kind === "punti" || d.kind === "linee")} onLayerPointClick={(x) => setPoint({ datasetId: x.datasetId, index: x.index })} activeRouteId={route ? route.id ?? "nuovo" : null}
          selectedPlaceId={place?.id ?? selected} reached={[...visitsBy.keys()]}
          pin={place && !place.id ? [place.lng, place.lat] : null}
          onClick={onMapClick} onPlaceClick={onPlaceClick}
        />
        <div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center px-4">
          <div className="glass pointer-events-auto flex max-w-full flex-wrap items-center justify-center gap-1.5 rounded-[28px] p-1.5">
            {placing ? (
              <>
                <span className="px-3 text-sm">Tocca la mappa dove si trova «{placing.name}»</span>
                <Button size="sm" variant="ghost" onClick={() => setPlacing(null)}>Annulla</Button>
              </>
            ) : picking ? (
              <>
                <span className="px-3 text-sm">Tocca la mappa dove si trova il luogo</span>
                <Button size="sm" variant="ghost" onClick={() => setPicking(false)}>Annulla</Button>
              </>
            ) : route ? (
              <>
                <span className="px-3 text-sm">Tocca i luoghi sulla mappa per aggiungerli o toglierli – {route.stops.length} tappe</span>
                <Button size="sm" variant="ghost" onClick={() => setRoute(null)}>Annulla</Button>
                <Button size="sm" variant="glow" disabled={busy || route.stops.length < 2} onClick={saveR}>Salva il percorso</Button>
              </>
            ) : (
              <>
                <Button onClick={() => { setPlace(null); setPicking(true); setSelected(null); }}><PlusIcon /> Aggiungi un luogo</Button>
                <Button variant="ghost" disabled={data.places.length < 2} onClick={() => { setTab("percorsi"); setRoute({ name: "", description: "", color: PALETTE[(data.routes.length + 3) % PALETTE.length], stops: [] }); }}>
                  Nuovo percorso
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-end justify-between gap-3">
          <div>
            <Label>Esplorazione</Label>
            <h2 className="display mt-1 text-[26px]">{placedPlaces.length} luoghi, {data.routes.length} percorsi</h2>
          </div>
          <span className="soft text-[13px] whitespace-nowrap">{totalPoints} pt per team</span>
        </div>
        <Segmented value={tab} onChange={setTab} options={[{ id: "luoghi", label: "Luoghi" }, { id: "percorsi", label: "Percorsi" }]} />
        {error && !place && <Notice tone="error">{error}</Notice>}

        {tab === "luoghi" && unplaced.length > 0 && (
          <Card className="!border-sun !p-4">
            <Label>Da posizionare – {unplaced.length}</Label>
            <p className="soft mt-1 text-[13px]">Importati senza coordinate: tocca un luogo, poi il punto sulla mappa. Finché non è posizionato nessuno lo vede.</p>
            <ul className="mt-3 max-h-64 space-y-1.5 overflow-y-auto">
              {unplaced.map((pl) => (
                <li key={pl.id}>
                  <button onClick={() => { setPicking(false); setPlacing(pl); }}
                    className={cx("flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-left text-sm transition", placing?.id === pl.id ? "border-ink bg-ink text-paper" : "hairline hover:bg-ink/5")}>
                    <span className="size-2.5 shrink-0 rounded-full" style={{ background: categoryOf(pl.category).color }} />
                    <span className="min-w-0 flex-1 truncate">{pl.name}</span>
                    <span className="soft truncate text-xs">{String(pl.attributes?.localita ?? pl.attributes?.comune ?? "")}</span>
                  </button>
                </li>
              ))}
            </ul>
          </Card>
        )}
        {tab === "luoghi" && (placedPlaces.length === 0 ? (
          unplaced.length > 0 ? null : <Empty title="Nessun luogo, per ora.">Un luogo è una meta: un ponte storico, un giardino, un murale, un&apos;ansa del fiume. Raggiungerlo e raccogliere lì un rilievo vale punti per tutti.</Empty>
        ) : placedPlaces.map((pl) => {
          const cat = categoryOf(pl.category), cover = mediaUrl(pl.images[0] ?? null);
          return (
            <Card key={pl.id} className={cx("flex cursor-pointer gap-3 !p-3 transition", selected === pl.id && "!border-ink shadow-soft")} onClick={() => setSelected(pl.id === selected ? null : pl.id)}>
              {cover
                ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={cover} alt="" className="size-16 shrink-0 rounded-2xl object-cover" />
                : <span className="grid size-16 shrink-0 place-items-center rounded-2xl" style={{ background: `color-mix(in srgb, ${cat.color} 15%, transparent)` }}><span className="size-4 rounded-full" style={{ background: cat.color }} /></span>}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2"><Tag color={cat.color}>{cat.label}</Tag><span className="num soft ml-auto text-[13px]">{pl.points} pt</span></div>
                <h3 className="mt-1 truncate text-[16px] tracking-[-0.02em]">{pl.name}</h3>
                <p className="soft text-[13px]">{visitsBy.get(pl.id) ?? 0} arrivi, {obsBy.get(pl.id) ?? 0} rilievi, {pl.survey?.length ? `indagine di ${pl.survey.length} domande` : "senza indagine"}{pl.source ? `, da ${pl.source}` : ""}</p>
                {selected === pl.id && (
                  <div className="mt-2.5 flex gap-2">
                    <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); setError(null); setPlace({ ...pl }); }}>Modifica</Button>
                    <Button size="sm" variant="danger" disabled={busy} onClick={(e) => { e.stopPropagation(); if (confirm(`Eliminare «${pl.name}»? Arrivi e legami con i rilievi si perdono.`)) run(async () => { await deletePlace(pl.id); await refresh(); }); }}>Elimina</Button>
                  </div>
                )}
              </div>
            </Card>
          );
        }))}

        {tab === "percorsi" && route && (
          <Card className="space-y-3">
            <Field label="Nome del percorso" value={route.name} onChange={(e) => setRoute({ ...route, name: e.target.value })} maxLength={60} placeholder="Lungo la Dora, dai ponti ai giardini" autoFocus />
            <Area label="Descrizione" value={route.description} onChange={(e) => setRoute({ ...route, description: e.target.value })} maxLength={300} placeholder="Che cosa si scopre seguendolo?" />
            <div><Label className="mb-2 block">Colore</Label><Swatches value={route.color} onChange={(color) => setRoute({ ...route, color })} /></div>
            <div>
              <div className="mb-2 flex items-baseline justify-between"><Label>Tappe in ordine</Label>
                <span className="soft text-[13px]">{formatMeters(routeLength(route.stops, data.places))} – ≈ {routeMinutes(routeLength(route.stops, data.places), route.stops.length)} min</span></div>
              {route.stops.length === 0 ? <p className="soft text-sm">Tocca i luoghi sulla mappa, oppure aggiungili da qui sotto.</p> : (
                <ol className="space-y-1.5">
                  {route.stops.map((id, i) => (
                    <li key={id} className="flex items-center gap-2 rounded-2xl border hairline py-1.5 pr-1.5 pl-3">
                      <span className="num grid size-6 shrink-0 place-items-center rounded-full text-[12px] text-white" style={{ background: route.color }}>{i + 1}</span>
                      <span className="min-w-0 flex-1 truncate text-sm">{placeName(id)}</span>
                      <Button size="sm" variant="ghost" className="!px-2" aria-label="Sposta su" disabled={i === 0} onClick={() => move(i, -1)}>↑</Button>
                      <Button size="sm" variant="ghost" className="!px-2" aria-label="Sposta giù" disabled={i === route.stops.length - 1} onClick={() => move(i, 1)}>↓</Button>
                      <Button size="sm" variant="ghost" className="!px-2" aria-label="Togli" onClick={() => setRoute({ ...route, stops: route.stops.filter((s) => s !== id) })}>✕</Button>
                    </li>
                  ))}
                </ol>
              )}
              <div className="mt-2 flex flex-wrap gap-1.5">
                {data.places.filter((p) => !route.stops.includes(p.id)).map((p) => (
                  <button key={p.id} type="button" onClick={() => setRoute({ ...route, stops: [...route.stops, p.id] })}
                    className="inline-flex h-8 items-center gap-1.5 rounded-full border hairline px-3 text-[13px] transition hover:bg-ink/5">
                    <PlusIcon />{p.name}
                  </button>
                ))}
              </div>
            </div>
            {error && <Notice tone="error">{error}</Notice>}
            <div className="flex gap-2">
              <Button className="flex-1" disabled={busy || route.stops.length < 2} onClick={saveR}>Salva il percorso</Button>
              {route.id && <Button variant="danger" disabled={busy} onClick={() => confirm("Eliminare il percorso? I luoghi restano.") && run(async () => { await deleteRoute(route.id!); await refresh(); setRoute(null); })}>Elimina</Button>}
            </div>
          </Card>
        )}
        {tab === "percorsi" && !route && (data.routes.length === 0 ? (
          <Empty title="Nessun percorso." action={<Button disabled={data.places.length < 2} onClick={() => setRoute({ name: "", description: "", color: PALETTE[3], stops: [] })}><PlusIcon /> Crea un percorso</Button>}>
            {data.places.length < 2 ? "Servono almeno due luoghi per tracciare un percorso." : "Un percorso mette in fila i luoghi: sul campo la bussola guida da una tappa alla successiva."}
          </Empty>
        ) : data.routes.map((r) => {
          const m = routeLength(r.stops, data.places);
          return (
            <Card key={r.id} className="cursor-pointer !p-4 transition hover:shadow-soft" onClick={() => setRoute({ ...r })}>
              <div className="flex items-center gap-2.5">
                <span className="h-1.5 w-6 rounded-full" style={{ background: r.color }} />
                <h3 className="min-w-0 flex-1 truncate text-[16px] tracking-[-0.02em]">{r.name}</h3>
                <span className="soft text-[13px]">{r.stops.length} tappe</span>
              </div>
              <p className="soft mt-1.5 text-[13px]">{formatMeters(m)} – ≈ {routeMinutes(m, r.stops.length)} min – {r.stops.map(placeName).join(" → ")}</p>
            </Card>
          );
        }))}
      </div>

      <PointSheet point={point} datasets={data.datasets} onClose={() => setPoint(null)} />

      {/* ------------------------------------------------------- luogo */}
      <Sheet open={!!place && !picking} onClose={() => setPlace(null)} kicker={place?.id ? "Modifica luogo" : "Nuovo luogo"} title="Una meta da raggiungere" wide>
        {place && (
          <form onSubmit={save} className="space-y-5">
            <Field label="Nome" value={place.name} onChange={(e) => setPlace({ ...place, name: e.target.value })} required maxLength={70} placeholder="Ponte Mosca" autoFocus />
            <div>
              <Label className="mb-2 block">Tipo di luogo</Label>
              <div className="flex flex-wrap gap-1.5">
                {PLACE_CATEGORIES.map((cat) => (
                  <button key={cat.id} type="button" aria-pressed={place.category === cat.id} onClick={() => setPlace({ ...place, category: cat.id as PlaceCategory })}
                    className={cx("h-9 rounded-full border px-3.5 text-sm transition", place.category === cat.id ? "text-white" : "hairline hover:bg-ink/5")}
                    style={place.category === cat.id ? { background: cat.color, borderColor: cat.color } : undefined}>{cat.label}</button>
                ))}
              </div>
            </div>
            <Area label="Racconto del luogo" value={place.description} onChange={(e) => setPlace({ ...place, description: e.target.value })} maxLength={1200}
              placeholder="Che cos'è, perché conta, che cosa lo rende riconoscibile." />
            <Area label="Che cosa raccogliere qui" value={place.prompt} onChange={(e) => setPlace({ ...place, prompt: e.target.value })} maxLength={300}
              placeholder="Fotografa le arcate dal lungofiume e conta chi attraversa in cinque minuti." />

            <div>
              <div className="mb-2 flex items-baseline justify-between"><Label>Immagini – la prima è la copertina</Label><span className="soft text-xs">{place.images.length}/8</span></div>
              <div className="grid grid-cols-4 gap-2">
                {place.images.map((path, i) => (
                  <div key={path} className="group relative aspect-square overflow-hidden rounded-2xl bg-paper-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={mediaUrl(path) ?? ""} alt="" className="size-full object-cover" />
                    {i === 0 && <span className="label glass absolute bottom-1.5 left-1.5 rounded-full px-2 py-0.5 !text-[9px]">copertina</span>}
                    <div className="absolute inset-x-1.5 top-1.5 flex justify-between opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100">
                      {i > 0 ? <button type="button" className="glass rounded-full px-2 py-0.5 text-[11px]" onClick={() => setPlace({ ...place, images: [path, ...place.images.filter((x) => x !== path)] })}>copertina</button> : <span />}
                      <button type="button" aria-label="Togli l'immagine" className="glass grid size-6 place-items-center rounded-full text-[11px]" onClick={() => setPlace({ ...place, images: place.images.filter((x) => x !== path) })}>✕</button>
                    </div>
                  </div>
                ))}
                {place.images.length < 8 && (
                  <label className="grid aspect-square cursor-pointer place-items-center rounded-2xl border border-dashed hairline text-center transition hover:bg-ink/5">
                    <span className="soft text-xs">{uploading ? "Carico…" : <><PlusIcon /><br />Aggiungi</>}</span>
                    <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" disabled={uploading} onChange={(e) => { upload(e.target.files); e.target.value = ""; }} />
                  </label>
                )}
              </div>
            </div>

            <SurveyEditor value={place.survey ?? []} category={place.category} onChange={(survey) => setPlace({ ...place, survey })} />

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <Label className="mb-2 block">Raggio di arrivo – {place.radius_m} m</Label>
                <input type="range" min={10} max={200} step={5} value={place.radius_m} onChange={(e) => setPlace({ ...place, radius_m: Number(e.target.value) })} className="w-full accent-ink" />
                <span className="soft text-xs">Entro questa distanza il luogo risulta raggiunto.</span>
              </label>
              <Field label="Punti per team" type="number" min={0} max={1000} step={5} value={place.points} onChange={(e) => setPlace({ ...place, points: Number(e.target.value) })}
                hint="Metà all'arrivo, metà all'indagine (o al primo rilievo) confermata sul posto." />
            </div>

            <div className="flex items-center justify-between gap-3 rounded-2xl bg-paper-2 px-4 py-3 text-sm">
              <span className="num soft">{place.lat.toFixed(5)}, {place.lng.toFixed(5)}</span>
              <Button size="sm" variant="outline" onClick={() => setPicking(true)}>Sposta sulla mappa</Button>
            </div>
            {error && <Notice tone="error">{error}</Notice>}
            <Button type="submit" size="lg" className="w-full" disabled={busy || uploading}>Salva il luogo</Button>
          </form>
        )}
      </Sheet>
    </div>
  );
}
