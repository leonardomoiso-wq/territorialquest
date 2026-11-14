"use client";

import { useMemo, useRef, useState } from "react";
import { ENVIRONMENTS, environmentOf, modelCells, type Environment } from "@/domain/environment";
import { cellsOf, closeRing, hectares } from "@/domain/geo";
import { areaOpen, fromLocalInput, toLocalInput } from "@/domain/time";
import type { Area as AreaT, Basemap, Overlay, Polygon } from "@/domain/types";
import { deleteArea, paintArea, saveArea, updateCampaign, uploadMedia } from "@/lib/data";
import { useAction } from "@/lib/hooks";
import MapView, { type MapApi, type MapMode } from "@/ui/MapView";
import { Button, Card, cx, Field, Label, Notice, PlusIcon, Segmented, Select, Sheet, Tag } from "@/ui/kit";
import { backdrop, PALETTE, Swatches, teamOf, type Ctx } from "./shared";

interface Draft {
  id?: string;
  name: string;
  color: string;
  team_id: string | null;
  opens_at: string | null;
  closes_at: string | null;
  geometry: Polygon;
  environment: string;
  terrain?: Record<string, string>;
}
type Tool = null | "draw" | "shape" | "paint";
type Ring = [number, number][];

const BASEMAPS: { id: Basemap; label: string; hint: string }[] = [
  { id: "mappa", label: "Mappa", hint: "Strade ed edifici in scala di grigi" },
  { id: "satellite", label: "Satellite", hint: "Immagini aeree" },
  { id: "custom", label: "Tessere", hint: "Un servizio a tua scelta" },
  { id: "nessuno", label: "Nessuno", hint: "Solo il modello" },
];

function EnvChips({ value, onChange }: { value: string; onChange: (e: Environment) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Ambiente">
      {ENVIRONMENTS.map((e) => (
        <button key={e.id} type="button" role="radio" aria-checked={value === e.id} title={e.hint} onClick={() => onChange(e.id)}
          className={cx("inline-flex h-8 items-center gap-2 rounded-full border px-3 text-[13px] transition", value === e.id ? "border-ink bg-ink text-paper" : "hairline hover:bg-ink/5")}>
          <span className="size-2.5 rounded-full" style={{ background: e.color }} />{e.label}
        </button>
      ))}
    </div>
  );
}

export default function Aree({ data, now, refresh }: Ctx) {
  const c = data.campaign;
  const { busy, error, run } = useAction();
  const api = useRef<MapApi | null>(null);
  const view = useRef<{ center: [number, number]; zoom: number } | null>(null);

  const [mode, setMode] = useState<MapMode>("2d");
  const [tool, setTool] = useState<Tool>(null);
  const [points, setPoints] = useState<Ring>([]);
  const [ring, setRing] = useState<Ring>([]);
  const [brush, setBrush] = useState<Environment>("verde");
  const [painted, setPainted] = useState<Record<string, Environment>>({});
  const [selected, setSelected] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [sheet, setSheet] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  // sfondo: copia locale, così cursori e scelte si vedono subito sulla mappa
  const [bg, setBg] = useState(() => ({
    basemap: (c.basemap ?? "mappa") as Basemap, basemap_url: c.basemap_url ?? "", basemap_opacity: c.basemap_opacity ?? 1,
    overlay: (c.overlay ?? null) as Overlay | null,
  }));
  const saveBg = (next: typeof bg) =>
    run(async () => { await updateCampaign(c.id, { ...next, basemap_url: next.basemap_url.trim() || null }); await refresh(); });
  const setAndSave = (patch: Partial<typeof bg>) => { const next = { ...bg, ...patch }; setBg(next); saveBg(next); };

  // anteprima: aree con le celle appena dipinte
  const cellArea = useMemo(() => new Map(modelCells(data.areas).map((m) => [m.cell, m.areaId])), [data.areas]);
  const areas: AreaT[] = useMemo(
    () => data.areas.map((a) => {
      const mine = Object.entries(painted).filter(([cell]) => cellArea.get(cell) === a.id);
      return mine.length ? { ...a, terrain: { ...a.terrain, ...Object.fromEntries(mine) } } : a;
    }),
    [data.areas, painted, cellArea],
  );
  const paintedCount = Object.keys(painted).length;
  const selectedArea = data.areas.find((a) => a.id === selected) ?? null;

  const stop = () => { setTool(null); setPoints([]); setRing([]); setPainted({}); setNote(null); };
  const startPaint = () => { stop(); setTool("paint"); setMode("model"); setSelected(null); };
  const paint = (cell: string) => { if (cellArea.has(cell)) setPainted((p) => (p[cell] === brush ? p : { ...p, [cell]: brush })); };
  const recognise = () => {
    const found = api.current?.classify([...cellArea.keys()]) ?? {};
    const n = Object.keys(found).length;
    setPainted((p) => ({ ...p, ...found }));
    setNote(n ? `${n} celle riconosciute dalla mappa: controlla e salva.` : "Nessun elemento riconosciuto: serve lo sfondo «Mappa» visibile e uno zoom ravvicinato.");
  };
  const savePaint = () => run(async () => {
    for (const a of areas) if (a.terrain !== data.areas.find((x) => x.id === a.id)?.terrain) await paintArea(a.id, a.terrain ?? {});
    await refresh();
    stop();
  });

  const finishDraw = () => {
    if (points.length < 3) return;
    setDraft({
      name: `Area ${data.areas.length + 1}`, color: PALETTE[data.areas.length % PALETTE.length], team_id: null,
      opens_at: null, closes_at: null, geometry: closeRing(points), environment: "urbano",
    });
  };
  const saveShape = () => selectedArea && run(async () => {
    await saveArea({ ...selectedArea, geometry: closeRing(ring) });
    await refresh();
    stop();
  });
  const saveDraft = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft) return;
    run(async () => {
      await saveArea({ ...draft, campaign_id: c.id, name: draft.name.trim() });
      await refresh();
      setDraft(null);
      stop();
    });
  };
  const saveView = () => view.current && run(async () => {
    const { center, zoom } = view.current!;
    await updateCampaign(c.id, { center_lng: center[0], center_lat: center[1], zoom });
    setNote("Vista di partenza salvata.");
  });
  const upload = (file: File | undefined) => file && api.current && run(async () => {
    const path = await uploadMedia(c.id, file);
    setAndSave({ overlay: { path, coordinates: api.current!.corners(), opacity: 0.7 } });
  });

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
      <div className="relative h-[76dvh] min-h-[480px] overflow-hidden rounded-panel border hairline">
        <MapView
          className="size-full" center={[c.center_lng, c.center_lat]} zoom={c.zoom} areas={areas} observations={data.observations}
          grid fit mode={mode} vivid selectedAreaId={selected}
          {...backdrop({ ...bg, basemap_url: bg.basemap_url || null })}
          draft={tool === "draw" ? points : undefined}
          edit={tool === "shape" ? ring : undefined} onEdit={setRing}
          onClick={tool === "draw" ? (p) => setPoints((ps) => [...ps, p]) : undefined}
          onPaint={tool === "paint" ? paint : undefined}
          onAreaClick={(id) => !tool && setSelected(id === selected ? null : id)}
          onMove={(center, zoom) => { view.current = { center, zoom }; }}
          onReady={(a) => { api.current = a; }}
        />

        <div className="pointer-events-none absolute inset-x-0 top-4 flex flex-wrap items-start gap-2 px-4">
          <div className="glass pointer-events-auto rounded-full p-1">
            <Segmented className="!border-0 !p-0" value={mode} onChange={setMode} options={[{ id: "2d", label: "Piano" }, { id: "3d", label: "3D reale" }, { id: "model", label: "Modello" }]} />
          </div>
          <button onClick={() => setSheet(true)} className="glass pointer-events-auto inline-flex h-10 items-center gap-2 rounded-full px-4 text-[13px] font-medium">
            <svg viewBox="0 0 16 16" className="size-4" aria-hidden><path d="M8 1.5 14.5 5 8 8.5 1.5 5zM1.5 8 8 11.5 14.5 8M1.5 11 8 14.5 14.5 11" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" /></svg>
            Sfondo · {BASEMAPS.find((b) => b.id === bg.basemap)?.label}{bg.overlay ? " + immagine" : ""}
          </button>
          <label className="glass pointer-events-auto hidden h-10 items-center gap-3 rounded-full px-4 text-[13px] sm:inline-flex">
            Trasparenza
            <input type="range" min={0} max={1} step={0.05} value={1 - bg.basemap_opacity} aria-label="Trasparenza dello sfondo" className="w-28 accent-ink"
              onChange={(e) => setBg({ ...bg, basemap_opacity: 1 - Number(e.target.value) })} onPointerUp={() => saveBg(bg)} onKeyUp={() => saveBg(bg)} />
          </label>
        </div>

        {tool === "paint" && (
          <div className="pointer-events-none absolute inset-x-0 bottom-20 flex justify-center px-4">
            <div className="glass pointer-events-auto max-w-full rounded-3xl p-2.5"><EnvChips value={brush} onChange={setBrush} /></div>
          </div>
        )}

        <div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center px-4">
          <div className="glass pointer-events-auto flex max-w-full flex-wrap items-center justify-center gap-1.5 rounded-[28px] p-1.5">
            {tool === "draw" && (
              <>
                <span className="px-3 text-sm">{points.length < 3 ? `Tocca la mappa per i vertici (${points.length}/3)` : `${points.length} vertici`}</span>
                <Button size="sm" variant="ghost" onClick={() => setPoints(points.slice(0, -1))} disabled={!points.length}>Annulla ultimo</Button>
                <Button size="sm" variant="ghost" onClick={stop}>Esci</Button>
                <Button size="sm" variant="glow" onClick={finishDraw} disabled={points.length < 3}>Chiudi l&apos;area</Button>
              </>
            )}
            {tool === "shape" && (
              <>
                <span className="px-3 text-sm">Trascina i vertici · doppio clic per toglierne uno</span>
                <Button size="sm" variant="ghost" onClick={stop}>Annulla</Button>
                <Button size="sm" variant="glow" onClick={saveShape} disabled={busy || ring.length < 3}>Salva la forma</Button>
              </>
            )}
            {tool === "paint" && (
              <>
                <span className="px-3 text-sm">Trascina sulle celle per dipingere{paintedCount ? ` · ${paintedCount} modificate` : ""}</span>
                <Button size="sm" variant="ghost" onClick={recognise}>Riconosci dalla mappa</Button>
                <Button size="sm" variant="ghost" onClick={stop}>Annulla</Button>
                <Button size="sm" variant="glow" onClick={savePaint} disabled={busy || !paintedCount}>Salva il modello</Button>
              </>
            )}
            {!tool && (
              <>
                <Button onClick={() => { stop(); setTool("draw"); setSelected(null); }}><PlusIcon /> Disegna un&apos;area</Button>
                <Button variant="ghost" onClick={startPaint} disabled={!data.areas.length}>Dipingi gli ambienti</Button>
                <Button variant="ghost" onClick={saveView} disabled={busy}>Salva la vista</Button>
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
        {note && <Notice tone="ok">{note}</Notice>}
        {error && !draft && !sheet && <Notice tone="error">{error}</Notice>}
        {data.areas.length === 0 && (
          <p className="soft rounded-card border border-dashed hairline p-5 text-sm">
            Sposta la mappa sul territorio da esplorare, premi «Disegna un&apos;area» e tocca i vertici del perimetro. Poi passa a «Modello» e dipingi gli ambienti: verde, acqua, città.
          </p>
        )}
        {data.areas.map((a) => {
          const team = teamOf(data, a.team_id);
          const count = data.observations.filter((o) => o.area_id === a.id).length;
          const env = environmentOf(a.environment);
          return (
            <Card key={a.id} className={cx("cursor-pointer transition", selected === a.id && "!border-ink shadow-soft")} onClick={() => !tool && setSelected(a.id === selected ? null : a.id)}>
              <div className="flex items-center gap-2.5">
                <span className="size-3 shrink-0 rounded-full" style={{ background: a.color }} />
                <h3 className="min-w-0 flex-1 truncate text-[17px] tracking-[-0.02em]">{a.name}</h3>
                <Tag color={areaOpen(a, now) ? "var(--color-leaf)" : "var(--color-mute)"}>{areaOpen(a, now) ? "aperta" : "chiusa"}</Tag>
              </div>
              <div className="soft mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px]">
                <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full" style={{ background: env.color }} />{env.label}</span>
                <span>{hectares(a.geometry).toFixed(1)} ha</span>
                <span>{cellsOf(a.geometry).length} celle</span>
                <span>{count} rilievi</span>
                <span>{team ? team.name : "tutti i team"}</span>
              </div>
              {selected === a.id && !tool && (
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); setDraft({ ...a, environment: a.environment ?? "urbano" }); }}>Dati</Button>
                  <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); setRing(a.geometry.coordinates[0].slice(0, -1)); setTool("shape"); }}>Forma</Button>
                  <Button size="sm" variant="danger" disabled={busy} onClick={(e) => { e.stopPropagation(); if (confirm(`Eliminare «${a.name}»? I rilievi restano.`)) run(async () => { await deleteArea(a.id); await refresh(); }); }}>Elimina</Button>
                </div>
              )}
            </Card>
          );
        })}

        <Card className="!p-4">
          <Label>Ambienti del modello</Label>
          <ul className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2">
            {ENVIRONMENTS.map((e) => (
              <li key={e.id} className="flex items-center gap-2 text-[13px]"><span className="size-3 rounded-[4px]" style={{ background: e.color }} />{e.label}</li>
            ))}
          </ul>
          <p className="soft mt-3 text-xs">Sul campo e in regia le celle partono spente e prendono il colore del loro ambiente quando vengono esplorate.</p>
        </Card>
      </div>

      {/* ------------------------------------------------------------ area */}
      <Sheet open={!!draft} onClose={() => setDraft(null)} kicker={draft?.id ? "Modifica area" : "Nuova area"} title="Dove si esplora">
        {draft && (
          <form onSubmit={saveDraft} className="space-y-4">
            <Field label="Nome" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} required maxLength={50} autoFocus />
            <div><Label className="mb-2 block">Ambiente prevalente</Label><EnvChips value={draft.environment} onChange={(environment) => setDraft({ ...draft, environment })} /></div>
            <div><Label className="mb-2 block">Colore del perimetro</Label><Swatches value={draft.color} onChange={(color) => setDraft({ ...draft, color })} /></div>
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

      {/* ---------------------------------------------------------- sfondo */}
      <Sheet open={sheet} onClose={() => setSheet(false)} kicker="Sotto il modello" title="Sfondo della mappa" wide>
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {BASEMAPS.map((b) => (
              <button key={b.id} type="button" aria-pressed={bg.basemap === b.id} onClick={() => setAndSave({ basemap: b.id })}
                className={cx("rounded-2xl border p-3 text-left transition", bg.basemap === b.id ? "border-ink bg-ink text-paper" : "hairline hover:bg-ink/5")}>
                <span className="block text-[15px]">{b.label}</span>
                <span className={cx("mt-0.5 block text-xs leading-tight", bg.basemap !== b.id && "soft")}>{b.hint}</span>
              </button>
            ))}
          </div>

          {bg.basemap === "custom" && (
            <div>
              <Field label="Indirizzo delle tessere (XYZ)" value={bg.basemap_url} onChange={(e) => setBg({ ...bg, basemap_url: e.target.value })} onBlur={() => saveBg(bg)}
                placeholder="https://esempio.it/tiles/{z}/{x}/{y}.png" spellCheck={false} />
              <p className="soft mt-2 text-xs">
                Qualunque servizio che pubblichi tessere {"{z}/{x}/{y}"}: geoportali regionali, MapTiler, Mapbox. Per Google Maps serve la loro Map Tiles API, con chiave e fatturazione attive; verifica sempre la licenza d&apos;uso del fornitore.
              </p>
            </div>
          )}

          <label className="block">
            <Label className="mb-2 block">Trasparenza dello sfondo · {Math.round((1 - bg.basemap_opacity) * 100)}%</Label>
            <input type="range" min={0} max={1} step={0.05} value={1 - bg.basemap_opacity} className="w-full accent-ink"
              onChange={(e) => setBg({ ...bg, basemap_opacity: 1 - Number(e.target.value) })} onPointerUp={() => saveBg(bg)} onKeyUp={() => saveBg(bg)} />
          </label>

          <div className="rounded-card border hairline p-4">
            <Label>Immagine caricata</Label>
            <p className="soft mt-1 text-sm">Una planimetria, un&apos;ortofoto, una carta storica. Viene posata sulla vista corrente della mappa: inquadra prima la zona, con il nord in alto.</p>
            {bg.overlay ? (
              <div className="mt-4 space-y-3">
                <label className="block">
                  <Label className="mb-2 block">Opacità dell&apos;immagine · {Math.round(bg.overlay.opacity * 100)}%</Label>
                  <input type="range" min={0.05} max={1} step={0.05} value={bg.overlay.opacity} className="w-full accent-ink"
                    onChange={(e) => setBg({ ...bg, overlay: { ...bg.overlay!, opacity: Number(e.target.value) } })} onPointerUp={() => saveBg(bg)} onKeyUp={() => saveBg(bg)} />
                </label>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" disabled={busy} onClick={() => api.current && setAndSave({ overlay: { ...bg.overlay!, coordinates: api.current.corners() } })}>Riposiziona sulla vista attuale</Button>
                  <Button size="sm" variant="danger" disabled={busy} onClick={() => setAndSave({ overlay: null })}>Rimuovi</Button>
                </div>
              </div>
            ) : (
              <label className="mt-4 flex cursor-pointer items-center gap-3 rounded-2xl border border-dashed hairline p-3.5 transition hover:bg-ink/5">
                <span className="grid size-10 place-items-center rounded-full bg-paper-2"><PlusIcon /></span>
                <span className="text-sm">{busy ? "Carico…" : <>Carica un&apos;immagine <span className="soft">· JPG, PNG o WebP fino a 10 MB</span></>}</span>
                <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={busy} onChange={(e) => upload(e.target.files?.[0])} />
              </label>
            )}
          </div>
          {error && <Notice tone="error">{error}</Notice>}
        </div>
      </Sheet>
    </div>
  );
}
