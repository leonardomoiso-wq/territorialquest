"use client";

import { useMemo, useState } from "react";
import {
  classify, compare, distinct, formatValue, isRows, nameFromFile, parseGeoJSON, pointsOf, series, SERIES,
  type Column, type Dataset, type DatasetKind, type Draft, type GeoImport, type Row,
} from "@/domain/datasets";
import { PLACE_CATEGORIES, type PlaceCategory } from "@/domain/types";
import { deleteDataset, insertAreas, insertPlaces, saveDataset } from "@/lib/data";
import { useAction } from "@/lib/hooks";
import { Bars, Lines, ValueTable } from "@/ui/charts";
import { Area, Button, Card, cx, Empty, Field, Label, Notice, PlusIcon, SectionTitle, Segmented, Select, Sheet, Tag } from "@/ui/kit";
import { PALETTE, type Ctx } from "./shared";

const KINDS: { id: DatasetKind; label: string; hint: string }[] = [
  { id: "indicatori", label: "Indicatori", hint: "Valori per Comune, anche nel tempo: schede e confronti" },
  { id: "punti", label: "Strato di punti", hint: "Punti con coordinate da mostrare sulla mappa" },
  { id: "linee", label: "Linee", hint: "Tracciati da mostrare sulla mappa" },
  { id: "tabella", label: "Tabella", hint: "Scheda da consultare; un elenco può diventare luoghi" },
];
const kindLabel = (k: DatasetKind) => KINDS.find((x) => x.id === k)?.label ?? k;

type Pending =
  | { type: "csv"; file: string; draft: Draft & { source: string; licence: string; note: string; public: boolean } }
  | { type: "geo"; file: string; geo: GeoImport; nameKey: string; text: string };

export default function Fonti({ data, refresh }: Ctx) {
  const c = data.campaign;
  const { busy, error, run, setError } = useAction();
  const [pending, setPending] = useState<Pending[]>([]);
  const [open, setOpen] = useState<Dataset | null>(null);
  const [drag, setDrag] = useState(false);

  const read = async (files: FileList | File[]) => {
    setError(null);
    const out: Pending[] = [];
    for (const f of Array.from(files)) {
      const text = await f.text();
      try {
        if (/\.(geo)?json$/i.test(f.name)) {
          const geo = parseGeoJSON(text);
          out.push({ type: "geo", file: f.name, geo, nameKey: geo.nameKeys[0] ?? "", text });
        } else {
          out.push({ type: "csv", file: f.name, draft: { ...classify(f.name, text), source: "", licence: "", note: "", public: true } });
        }
      } catch (e) {
        setError(`${f.name}: non riesco a leggerlo (${(e as Error).message}).`);
      }
    }
    setPending((p) => [...p, ...out]);
  };

  const saveCsv = async (p: Extract<Pending, { type: "csv" }>, i: number) => {
    const d = p.draft;
    await saveDataset({
      campaign_id: c.id, name: d.name.trim(), kind: d.kind, source: d.source.trim(), licence: d.licence.trim(), note: d.note.trim(),
      key_column: d.key_column, time_column: d.time_column, category_column: d.category_column, label_column: d.label_column,
      columns: d.columns, rows: d.rows, public: d.public, color: SERIES[(data.datasets.length + i) % SERIES.length],
    });
  };
  const saveAll = () => run(async () => {
    const csv = pending.filter((p): p is Extract<Pending, { type: "csv" }> => p.type === "csv");
    for (const [i, p] of csv.entries()) await saveCsv(p, i);
    setPending((list) => list.filter((p) => p.type !== "csv"));
    await refresh();
  });
  const setDraft = (i: number, patch: Partial<Extract<Pending, { type: "csv" }>["draft"]>) =>
    setPending((list) => list.map((p, n) => (n === i && p.type === "csv" ? { ...p, draft: { ...p.draft, ...patch } } : p)));
  const drop = (i: number) => setPending((list) => list.filter((_, n) => n !== i));

  const byKind = (k: DatasetKind) => data.datasets.filter((d) => d.kind === k);

  return (
    <div className="space-y-10">
      <section>
        <SectionTitle kicker="Ricerca desk" title="Dati del territorio" />
        <label
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); read(e.dataTransfer.files); }}
          className={cx("flex cursor-pointer flex-col items-center justify-center gap-2 rounded-panel border-2 border-dashed p-10 text-center transition", drag ? "border-leaf bg-leaf/8" : "hairline hover:bg-ink/5")}>
          <span className="grid size-12 place-items-center rounded-full bg-ink text-paper"><PlusIcon /></span>
          <span className="text-[17px] tracking-[-0.02em]">Trascina qui i file, anche molti insieme</span>
          <span className="soft max-w-lg text-sm">CSV (indicatori per Comune, serie storiche, punti con coordinate, elenchi) e GeoJSON (confini comunali, tracciati, punti). Ogni file viene riconosciuto da solo: controlli e salvi.</span>
          <input type="file" multiple accept=".csv,.tsv,.txt,.json,.geojson" className="sr-only" onChange={(e) => { if (e.target.files) read(e.target.files); e.target.value = ""; }} />
        </label>
        {error && <div className="mt-3"><Notice tone="error">{error}</Notice></div>}
      </section>

      {pending.length > 0 && (
        <section>
          <SectionTitle kicker={`${pending.length} file da controllare`} title="Prima di salvare"
            action={pending.some((p) => p.type === "csv") ? <Button variant="glow" disabled={busy} onClick={saveAll}>{busy ? "Salvo…" : "Salva tutti i CSV"}</Button> : undefined} />
          <div className="space-y-3">
            {pending.map((p, i) => p.type === "csv"
              ? <CsvDraft key={p.file + i} p={p} onChange={(patch) => setDraft(i, patch)} onDrop={() => drop(i)} />
              : <GeoDraft key={p.file + i} p={p} busy={busy} onNameKey={(nameKey) => setPending((list) => list.map((x, n) => (n === i && x.type === "geo" ? { ...x, geo: parseGeoJSON(x.text, nameKey), nameKey } : x)))}
                  onAreas={() => run(async () => {
                    await insertAreas(p.geo.areas.map((a, k) => ({ campaign_id: c.id, name: a.name, color: PALETTE[k % PALETTE.length], geometry: a.geometry })));
                    await refresh();
                  })}
                  onLines={() => run(async () => {
                    await saveDataset({ campaign_id: c.id, name: nameFromFile(p.file), kind: "linee", rows: p.geo.lines, columns: [], public: true, color: "#a8651c" });
                    await refresh();
                  })}
                  onPoints={() => run(async () => {
                    await saveDataset({ campaign_id: c.id, name: nameFromFile(p.file), kind: "punti", rows: p.geo.points, label_column: "nome",
                      columns: [{ key: "nome", label: "Nome", type: "testo" }, { key: "lng", label: "Longitudine", type: "numero" }, { key: "lat", label: "Latitudine", type: "numero" }], public: true, color: SERIES[2] });
                    await refresh();
                  })}
                  onDrop={() => drop(i)} />)}
          </div>
        </section>
      )}

      {data.datasets.length === 0 && pending.length === 0 ? (
        <Empty title="Ancora nessuna fonte.">I dati desk danno contesto ai rilievi: popolazione, età, redditi, servizi, rischi. I giocatori li ritrovano nella scheda del Comune in cui camminano.</Empty>
      ) : (KINDS.map((k) => byKind(k.id).length > 0 && (
        <section key={k.id}>
          <SectionTitle kicker={k.hint} title={`${k.label} · ${byKind(k.id).length}`} />
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {byKind(k.id).map((d) => (
              <Card key={d.id} className="cursor-pointer !p-4 transition hover:shadow-soft" onClick={() => setOpen(d)}>
                <div className="flex items-center justify-between gap-2">
                  <h3 className="truncate text-[16px] tracking-[-0.02em]">{d.name}</h3>
                  <span className="size-2.5 shrink-0 rounded-full" style={{ background: d.color }} />
                </div>
                <p className="soft mt-1 text-[13px]">
                  {d.kind === "linee" ? `${(d.rows as GeoJSON.FeatureCollection).features?.length ?? 0} linee` : `${isRows(d.rows) ? d.rows.length : 0} righe`}
                  {d.key_column ? `, per ${d.key_column}` : ""}{d.time_column ? ` e ${d.time_column}` : ""}{d.category_column ? `, per ${d.category_column}` : ""}
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {d.public ? <Tag color="var(--color-leaf)">pubblico</Tag> : <Tag>solo campagna</Tag>}
                  {d.source && <Tag>{d.source}</Tag>}
                </div>
              </Card>
            ))}
          </div>
        </section>
      )))}

      <Viewer d={open} ctx={{ data, refresh } as Ctx} onClose={() => setOpen(null)} />
    </div>
  );
}

/* --------------------------------------------------------------- bozza CSV */
function CsvDraft({ p, onChange, onDrop }: {
  p: Extract<Pending, { type: "csv" }>; onChange: (patch: Partial<Extract<Pending, { type: "csv" }>["draft"]>) => void; onDrop: () => void;
}) {
  const d = p.draft;
  const [cols, setCols] = useState(false);
  const headers = d.columns.map((c) => c.key);
  const opt = (v: string | null, set: (x: string | null) => void, label: string) => (
    <Select label={label} value={v ?? ""} onChange={(e) => set(e.target.value || null)}>
      <option value="">nessuna</option>
      {headers.map((h) => <option key={h} value={h}>{h}</option>)}
    </Select>
  );
  return (
    <Card className="!p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Label>{p.file.replace(/^[0-9a-f]{8}-/, "")}</Label>
          <p className="soft mt-1 max-w-2xl text-sm">{d.reason}</p>
        </div>
        <Button size="sm" variant="ghost" onClick={onDrop}>Togli</Button>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-[2fr_1fr]">
        <Field label="Nome" value={d.name} onChange={(e) => onChange({ name: e.target.value })} />
        <Select label="Tipo" value={d.kind} onChange={(e) => onChange({ kind: e.target.value as DatasetKind })}>
          {KINDS.filter((k) => k.id !== "linee").map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}
        </Select>
        <Field label="Fonte" value={d.source} onChange={(e) => onChange({ source: e.target.value })} placeholder="Istat, ISPRA IdroGEO, OpenStreetMap…" />
        <Field label="Licenza" value={d.licence} onChange={(e) => onChange({ licence: e.target.value })} placeholder="CC BY 4.0, ODbL, CC0…" />
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {opt(d.key_column, (v) => onChange({ key_column: v }), "Chiave (es. Comune)")}
        {opt(d.time_column, (v) => onChange({ time_column: v }), "Tempo (es. anno)")}
        {opt(d.category_column, (v) => onChange({ category_column: v }), "Categoria")}
        {opt(d.label_column, (v) => onChange({ label_column: v }), "Nome dell'elemento")}
      </div>
      <label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" className="size-4 accent-ink" checked={d.public} onChange={(e) => onChange({ public: e.target.checked })} />Mostra anche sulla mappa pubblica</label>
      <button className="mt-3 text-sm underline-offset-2 hover:underline" onClick={() => setCols(!cols)}>{cols ? "Chiudi" : "Controlla"} le {d.columns.length} colonne e l&apos;anteprima</button>
      {cols && (
        <div className="mt-3 space-y-3">
          <div className="grid gap-2 md:grid-cols-2">
            {d.columns.map((c, n) => (
              <div key={c.key} className="grid grid-cols-[7rem_1fr_4.5rem] items-center gap-2 rounded-xl bg-paper-2 p-2 text-[13px]">
                <span className="num truncate" title={c.key}>{c.key}</span>
                <input aria-label={`Etichetta di ${c.key}`} value={c.label} onChange={(e) => onChange({ columns: d.columns.map((x, k) => (k === n ? { ...x, label: e.target.value } : x)) })}
                  className="h-8 rounded-lg border hairline bg-card px-2 outline-none focus:border-leaf" />
                <input aria-label={`Unità di ${c.key}`} value={c.unit ?? ""} placeholder={c.type === "numero" ? "unità" : "testo"} onChange={(e) => onChange({ columns: d.columns.map((x, k) => (k === n ? { ...x, unit: e.target.value || undefined } : x)) })}
                  className="h-8 rounded-lg border hairline bg-card px-2 outline-none focus:border-leaf" />
              </div>
            ))}
          </div>
          <ValueTable columns={d.columns} rows={d.rows.slice(0, 6)} />
          <p className="soft text-xs">Le etichette dei campi con nomi tecnici (per esempio ISPRA) sono ricavate dai nomi: verificale sulla documentazione della fonte.</p>
        </div>
      )}
    </Card>
  );
}

function GeoDraft({ p, busy, onNameKey, onAreas, onLines, onPoints, onDrop }: {
  p: Extract<Pending, { type: "geo" }>; busy: boolean; onNameKey: (k: string) => void; onAreas: () => void; onLines: () => void; onPoints: () => void; onDrop: () => void;
}) {
  const g = p.geo;
  return (
    <Card className="!p-5">
      <div className="flex items-start justify-between gap-3">
        <div><Label>{p.file.replace(/^[0-9a-f]{8}-/, "")}</Label>
          <p className="soft mt-1 text-sm">GeoJSON: {g.areas.length} aree, {g.lines.features.length} linee, {g.points.length} punti.</p></div>
        <Button size="sm" variant="ghost" onClick={onDrop}>Togli</Button>
      </div>
      {g.nameKeys.length > 0 && (
        <Select label="Proprietà con il nome" className="mt-3 max-w-xs" value={p.nameKey} onChange={(e) => onNameKey(e.target.value)}>
          {g.nameKeys.map((k) => <option key={k} value={k}>{k}</option>)}
        </Select>
      )}
      {g.areas.length > 0 && <p className="soft mt-3 text-sm">Esempi: {g.areas.slice(0, 6).map((a) => a.name).join(", ")}{g.areas.length > 6 ? "…" : ""}</p>}
      <div className="mt-4 flex flex-wrap gap-2">
        {g.areas.length > 0 && <Button disabled={busy} onClick={onAreas}>Crea {g.areas.length} aree</Button>}
        {g.lines.features.length > 0 && <Button variant="outline" disabled={busy} onClick={onLines}>Salva le linee come strato</Button>}
        {g.points.length > 0 && <Button variant="outline" disabled={busy} onClick={onPoints}>Salva i punti come strato</Button>}
      </div>
      <p className="soft mt-3 text-xs">Le aree prendono il nome dalla proprietà scelta: chiamandosi come i Comuni dei file di indicatori, ne ricevono le schede. Dei territori fatti di più parti si tiene la più grande.</p>
    </Card>
  );
}

/* -------------------------------------------------------- consultazione */
function Viewer({ d, ctx, onClose }: { d: Dataset | null; ctx: Ctx; onClose: () => void }) {
  const { data, refresh } = ctx;
  const { busy, error, run } = useAction();
  const [col, setCol] = useState<string>("");
  const [view, setView] = useState<"grafico" | "tabella">("grafico");
  const [highlight, setHighlight] = useState<string | null>(null);
  const [cats, setCats] = useState<string[]>([]);
  const [maxKm, setMaxKm] = useState("");
  const [category, setCategory] = useState<PlaceCategory>("storico");
  const [points, setPoints] = useState(20);
  const [done, setDone] = useState<string | null>(null);

  const numeric = useMemo(() => (d ? d.columns.filter((c) => c.type === "numero" && c.key !== d.key_column && c.key !== d.time_column && !/^(lat|lon|lng)$/i.test(c.key)) : []), [d]);
  const current = numeric.find((c) => c.key === col) ?? numeric[0];
  const rows = d && isRows(d.rows) ? d.rows : [];
  const keys = useMemo(() => (d?.key_column ? [...new Set(rows.map((r) => String(r[d.key_column!])))] : []), [d, rows]);
  const distCol = d?.columns.find((c) => /km_dal_tracciato|distanza/i.test(c.key))?.key;

  if (!d) return null;
  const pts = pointsOf(d);
  const chosen = pts.filter((p) => (!cats.length || cats.includes(p.category)) && (!maxKm || !distCol || Number(p.row[distCol]) <= Number(maxKm)));

  const toPlaces = (placed: boolean) => run(async () => {
    const list = placed ? chosen.map((p) => ({ lng: p.lng, lat: p.lat, row: p.row, label: p.label })) :
      rows.filter((r) => !cats.length || (d.category_column && cats.includes(String(r[d.category_column])))).map((r) => ({ lng: data.campaign.center_lng, lat: data.campaign.center_lat, row: r, label: String((d.label_column && r[d.label_column]) ?? "Luogo") }));
    if (!list.length) throw new Error("Nessuna riga selezionata.");
    const describe = (r: Row) => d.columns.filter((c) => c.key !== d.label_column && r[c.key] !== null && !/^(lat|lon|lng|cod)$/i.test(c.key))
      .map((c) => `${c.label}: ${formatValue(r[c.key], c.unit)}`).join(" · ");
    await insertPlaces(list.map((p) => ({
      campaign_id: data.campaign.id, name: p.label, category, description: describe(p.row), prompt: "", lng: p.lng, lat: p.lat,
      radius_m: 40, points, images: [], survey: [], source: d.name, attributes: p.row, placed,
    })));
    await refresh();
    setDone(placed ? `${list.length} luoghi creati: li trovi nella sezione Luoghi.` : `${list.length} luoghi da posizionare: nella sezione Luoghi tocca ognuno e poi la mappa.`);
  });

  return (
    <Sheet open={!!d} onClose={() => { setDone(null); setCats([]); onClose(); }} kicker={`${kindLabel(d.kind)}${d.source ? ` · ${d.source}` : ""}`} title={d.name} wide>
      <div className="space-y-5">
        {d.kind === "indicatori" && numeric.length > 0 && (
          <>
            <div className="flex flex-wrap items-end gap-3">
              <Select label="Indicatore" value={current?.key ?? ""} onChange={(e) => setCol(e.target.value)} className="min-w-64 flex-1">
                {numeric.map((c) => <option key={c.key} value={c.key}>{c.label}{c.unit ? ` (${c.unit})` : ""}</option>)}
              </Select>
              <Segmented value={view} onChange={setView} options={[{ id: "grafico", label: "Grafico" }, { id: "tabella", label: "Tabella" }]} />
            </div>
            {view === "tabella" ? <ValueTable columns={d.columns} rows={rows} /> : d.category_column ? (
              <CategoryView d={d} column={current!} />
            ) : d.time_column ? (
              <Lines series={series(d, current!.key).filter((s) => !highlight || s.key === highlight)} unit={current!.unit} order={keys} />
            ) : (
              <Bars data={compare(d, current!.key)} unit={current!.unit} highlight={highlight} />
            )}
            {!d.category_column && keys.length > 1 && view === "grafico" && (
              <div className="flex flex-wrap gap-1.5">
                <Label className="mr-1 self-center">Evidenzia</Label>
                {keys.map((k) => <button key={k} onClick={() => setHighlight(highlight === k ? null : k)} className={cx("h-7 rounded-full border px-2.5 text-[12px]", highlight === k ? "border-ink bg-ink text-paper" : "hairline")}>{k}</button>)}
              </div>
            )}
          </>
        )}

        {(d.kind === "punti" || (d.kind === "tabella" && d.label_column)) && (
          <div className="rounded-card border hairline p-4">
            <Label>{d.kind === "punti" ? "Trasforma punti in luoghi del gioco" : "Trasforma l'elenco in luoghi da posizionare"}</Label>
            <p className="soft mt-1 text-sm">
              {d.kind === "punti" ? "Lo strato resta così com'è; i punti scelti diventano anche luoghi da raggiungere, con le loro informazioni." :
                "Il file non ha coordinate: i luoghi nascono «da posizionare» e li collochi sulla mappa nella sezione Luoghi. Finché non sono posizionati, nessuno li vede."}
            </p>
            {distinct(d, d.category_column).length > 1 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {distinct(d, d.category_column).map(({ value, count }) => (
                  <button key={value} onClick={() => setCats(cats.includes(value) ? cats.filter((x) => x !== value) : [...cats, value])}
                    className={cx("h-8 rounded-full border px-3 text-[13px]", cats.includes(value) ? "border-ink bg-ink text-paper" : "hairline")}>{value} <span className="num opacity-60">{count}</span></button>
                ))}
              </div>
            )}
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <Select label="Tipo di luogo" value={category} onChange={(e) => setCategory(e.target.value as PlaceCategory)}>
                {PLACE_CATEGORIES.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
              </Select>
              <Field label="Punti per team" type="number" min={0} max={1000} value={points} onChange={(e) => setPoints(Number(e.target.value))} />
              {d.kind === "punti" && distCol && <Field label="Entro km dal tracciato" type="number" step="0.1" min={0} value={maxKm} onChange={(e) => setMaxKm(e.target.value)} placeholder="tutti" />}
            </div>
            {error && <div className="mt-3"><Notice tone="error">{error}</Notice></div>}
            {done && <div className="mt-3"><Notice tone="ok">{done}</Notice></div>}
            <Button className="mt-3" disabled={busy} onClick={() => toPlaces(d.kind === "punti")}>
              {d.kind === "punti" ? `Crea ${chosen.length} luoghi` : "Crea i luoghi da posizionare"}
            </Button>
          </div>
        )}

        {d.kind === "punti" && <p className="soft text-sm">{pts.length} punti sulla mappa{d.category_column ? `, per ${d.category_column}: ${distinct(d, d.category_column).slice(0, 6).map((x) => `${x.value} ${x.count}`).join(", ")}` : ""}.</p>}
        {d.kind === "tabella" && <ValueTable columns={d.columns} rows={rows} />}
        {d.kind === "linee" && <p className="soft text-sm">{(d.rows as GeoJSON.FeatureCollection).features?.length ?? 0} linee, mostrate sulla mappa come strato.</p>}

        <MetaEditor d={d} onSaved={refresh} onDeleted={async () => { await refresh(); onClose(); }} />
      </div>
    </Sheet>
  );
}

function CategoryView({ d, column }: { d: Dataset; column: Column }) {
  const rows = isRows(d.rows) ? d.rows : [];
  const keys = [...new Set(rows.map((r) => String(r[d.key_column!])))];
  const [key, setKey] = useState(keys[0]);
  const mine = rows.filter((r) => String(r[d.key_column!]) === key);
  const data = mine.map((r) => ({ key: String(r[d.category_column!]), value: typeof r[column.key] === "number" ? (r[column.key] as number) : 0 }));
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {keys.map((k) => <button key={k} onClick={() => setKey(k)} className={cx("h-7 rounded-full border px-2.5 text-[12px]", key === k ? "border-ink bg-ink text-paper" : "hairline")}>{k}</button>)}
      </div>
      <Bars data={data} unit={column.unit} max={30} />
    </div>
  );
}

function MetaEditor({ d, onSaved, onDeleted }: { d: Dataset; onSaved: () => Promise<void>; onDeleted: () => Promise<void> }) {
  const { busy, error, run } = useAction();
  const [m, setM] = useState({ name: d.name, source: d.source, licence: d.licence, note: d.note, public: d.public });
  return (
    <details className="rounded-card border hairline p-4">
      <summary className="cursor-pointer text-sm">Nome, fonte, licenza, visibilità</summary>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Field label="Nome" value={m.name} onChange={(e) => setM({ ...m, name: e.target.value })} />
        <Field label="Fonte" value={m.source} onChange={(e) => setM({ ...m, source: e.target.value })} />
        <Field label="Licenza" value={m.licence} onChange={(e) => setM({ ...m, licence: e.target.value })} />
        <label className="flex items-center gap-2 self-end pb-3 text-sm"><input type="checkbox" className="size-4 accent-ink" checked={m.public} onChange={(e) => setM({ ...m, public: e.target.checked })} />Sulla mappa pubblica</label>
      </div>
      <Area label="Note" className="mt-3" value={m.note} onChange={(e) => setM({ ...m, note: e.target.value })} placeholder="Limiti, date di riferimento, avvertenze." />
      {error && <div className="mt-3"><Notice tone="error">{error}</Notice></div>}
      <div className="mt-3 flex gap-2">
        <Button size="sm" disabled={busy} onClick={() => run(async () => { await saveDataset({ id: d.id, campaign_id: d.campaign_id!, kind: d.kind, ...m }); await onSaved(); })}>Salva</Button>
        <Button size="sm" variant="danger" disabled={busy} onClick={() => confirm(`Eliminare «${d.name}»? I luoghi già creati restano.`) && run(async () => { await deleteDataset(d.id); await onDeleted(); })}>Elimina la fonte</Button>
      </div>
    </details>
  );
}
