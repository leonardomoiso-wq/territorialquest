"use client";

import { useMemo, useState } from "react";
import { categoryColors, distinct, formatValue, isRows, withCategories, type Dataset } from "@/domain/datasets";
import { metersBetween, formatMeters } from "@/domain/walk";
import type { Contribution } from "@/domain/types";
import { Community, contributionsFor, type Target } from "@/ui/Contribute";
import { cx, Label, Sheet } from "@/ui/kit";

/** Strati di dati del territorio da mostrare sulla mappa: punti e linee, accendibili per file e per categoria. */
export function useLayers(datasets: Dataset[]) {
  const all = useMemo(() => datasets.filter((d) => d.kind === "punti" || d.kind === "linee"), [datasets]);
  const [off, setOff] = useState<Set<string>>(new Set());
  const [offCats, setOffCats] = useState<Record<string, Set<string>>>({});
  const layers = useMemo(() => all.filter((d) => !off.has(d.id)).map((d) => {
    const hidden = offCats[d.id];
    if (!hidden?.size) return d;
    const keep = new Set(distinct(d, d.category_column).map((x) => x.value).filter((v) => !hidden.has(v)));
    return withCategories(d, keep);
  }), [all, off, offCats]);
  const toggle = (id: string) => setOff((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const toggleCat = (id: string, cat: string) => setOffCats((m) => {
    const s = new Set(m[id] ?? []);
    if (s.has(cat)) s.delete(cat); else s.add(cat);
    return { ...m, [id]: s };
  });
  const setAll = (on: boolean) => { setOff(on ? new Set() : new Set(all.map((d) => d.id))); if (on) setOffCats({}); };
  return { all, layers, off, offCats, toggle, toggleCat, setAll };
}

type LayerState = ReturnType<typeof useLayers>;

const count = (d: Dataset) => (d.kind === "linee" ? (isRows(d.rows) ? 0 : d.rows.features?.length ?? 0) : isRows(d.rows) ? d.rows.length : 0);

/** Elenco degli strati con legenda: un file per riga, le sue categorie come interruttori colorati. */
export function LayersPanel({ state }: { state: LayerState }) {
  const { all, off, offCats, toggle, toggleCat, setAll } = state;
  if (!all.length) return <p className="soft text-sm">Nessuno strato: i file con coordinate si caricano dalla sezione Fonti della regia.</p>;
  return (
    <div className="space-y-4">
      <div className="flex gap-3 text-sm">
        <button className="underline-offset-2 hover:underline" onClick={() => setAll(true)}>Accendi tutti</button>
        <button className="soft underline-offset-2 hover:underline" onClick={() => setAll(false)}>Spegni tutti</button>
      </div>
      <ul className="space-y-3">
        {all.map((d) => {
          const on = !off.has(d.id);
          const colors = categoryColors(d);
          const cats = d.kind === "punti" ? distinct(d, d.category_column) : [];
          return (
            <li key={d.id} className={cx("rounded-[3px] border hairline p-3 transition", !on && "opacity-55")}>
              <label className="flex cursor-pointer items-center gap-3">
                <input type="checkbox" className="size-4 accent-ink" checked={on} onChange={() => toggle(d.id)} />
                {d.kind === "linee"
                  ? <span className="h-1.5 w-6 shrink-0 rounded-full" style={{ backgroundImage: `radial-gradient(circle, ${d.color} 2px, transparent 2.4px)`, backgroundSize: "6px 6px" }} />
                  : cats.length <= 1 && <span className="size-3 shrink-0 rounded-full" style={{ background: d.color }} />}
                <span className="min-w-0 flex-1 truncate text-[15px]">{d.name}</span>
                <span className="num soft text-xs">{count(d)}</span>
              </label>
              {on && cats.length > 1 && (
                <div className="mt-2.5 flex flex-wrap gap-1.5 pl-7">
                  {cats.map(({ value, count: n }) => {
                    const hidden = offCats[d.id]?.has(value);
                    return (
                      <button key={value} onClick={() => toggleCat(d.id, value)} aria-pressed={!hidden}
                        className={cx("inline-flex h-7 items-center gap-1.5 rounded-[2px] border-[1.5px] px-2 text-[12px] transition", hidden ? "hairline opacity-50" : "border-current/30")}>
                        <span className="size-2.5 rounded-full" style={{ background: hidden ? "transparent" : colors.get(value), boxShadow: `inset 0 0 0 1.5px ${colors.get(value)}` }} />
                        {value} <span className="num soft">{n}</span>
                      </button>
                    );
                  })}
                </div>
              )}
              {(d.source || d.licence) && <p className="soft mt-2 pl-7 text-[11px]">{d.source}{d.licence ? ` (${d.licence})` : ""}</p>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Punto toccato sulla mappa. */
export interface PointRef { datasetId: string; index: number }

/** Scheda di un punto: tutte le colonne con etichette leggibili, fonte e distanza. */
export function PointSheet({ point, datasets, position, onClose, contributions, campaignId, onContribute }: {
  point: PointRef | null; datasets: Dataset[]; position?: [number, number] | null; onClose: () => void;
  /** Contributi approvati della campagna: quelli del punto compaiono nella scheda. */
  contributions?: Contribution[];
  campaignId?: string;
  /** Apre il modulo per aggiungere foto, dati e informazioni al punto. */
  onContribute?: (t: Target) => void;
}) {
  const d = point ? datasets.find((x) => x.id === point.datasetId) : null;
  const row = d && isRows(d.rows) ? d.rows[point!.index] : null;
  const lat = d?.columns.find((c) => /^(lat|latitude|latitudine|y)$/i.test(c.key))?.key;
  const lng = d?.columns.find((c) => /^(lon|lng|long|longitude|longitudine|x)$/i.test(c.key))?.key;
  const title = row ? String((d!.label_column && row[d!.label_column]) || (d!.category_column && row[d!.category_column]) || d!.name) : "";
  const at = row && lat && lng && typeof row[lng] === "number" ? [row[lng] as number, row[lat] as number] as [number, number] : null;
  const m = at && position ? metersBetween(position, at) : null;
  return (
    <Sheet open={!!row} onClose={onClose} kicker={d ? `${d.name}${d.category_column && row?.[d.category_column] ? `, ${row[d.category_column]}` : ""}` : ""} title={title}>
      {d && row && (
        <div className="space-y-4">
          {m !== null && <p className="text-sm">A <b className="num font-medium">{formatMeters(m)}</b> da te</p>}
          <dl className="divide-y divide-line rounded-[3px] border hairline text-sm">
            {d.columns.filter((c) => c.key !== d.label_column && c.key !== lat && c.key !== lng && row[c.key] !== null && row[c.key] !== "").map((c) => (
              <div key={c.key} className="flex gap-3 px-3.5 py-2">
                <dt className="soft min-w-0 flex-1">{c.label}</dt>
                <dd className="text-right">
                  {c.key.toLowerCase() === "wikidata" && typeof row[c.key] === "string"
                    ? <a className="underline underline-offset-2" href={`https://www.wikidata.org/wiki/${row[c.key]}`} target="_blank" rel="noreferrer">{String(row[c.key])}</a>
                    : formatValue(row[c.key], c.unit)}
                </dd>
              </div>
            ))}
          </dl>
          {at && <p className="num soft text-xs">{at[1].toFixed(5)}, {at[0].toFixed(5)}</p>}
          {contributions && (
            <Community items={contributionsFor(contributions, { dataset_id: d.id, row_index: point!.index })}
              onAdd={onContribute && campaignId && at ? () => onContribute({ campaignId, name: title, at, dataset_id: d.id, row_index: point!.index, columns: d.columns, values: row as Record<string, unknown> }) : undefined} />
          )}
          <div>
            <Label className="block">Fonte</Label>
            <p className="mt-1 text-sm">{d.source || "non indicata"}{d.licence ? `, licenza ${d.licence}` : ""}</p>
            {d.note && <p className="soft mt-1 text-xs">{d.note}</p>}
          </div>
        </div>
      )}
    </Sheet>
  );
}

/** Icona degli strati (fogli sovrapposti). */
export const LayersIcon = () => (
  <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" aria-hidden>
    <path d="M12 3 21 8l-9 5-9-5zM3 12.500l9 5 9-5M3 16.500l9 5 9-5" />
  </svg>
);
