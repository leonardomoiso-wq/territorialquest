"use client";

import { useState } from "react";
import { formatValue, SERIES } from "@/domain/datasets";
import { cx } from "@/ui/kit";

/**
 * Grafici piccoli a mano in SVG: barre di confronto e serie nel tempo.
 * Palette categorica fissa (SERIES) assegnata alla chiave, mai al rango;
 * etichette dirette e tabella dei valori sempre disponibili.
 */

/** Colore stabile per una chiave (es. un Comune), dall'ordine dato. */
export const colorFor = (key: string, order: string[]) => SERIES[Math.max(0, order.indexOf(key)) % SERIES.length];

export function Bars({ data, unit, highlight, max = 14 }: {
  data: { key: string; value: number; year?: number | null }[]; unit?: string; highlight?: string | null; max?: number;
}) {
  const rows = data.slice(0, max);
  const top = Math.max(...rows.map((r) => Math.abs(r.value)), 0) || 1;
  return (
    <ul className="space-y-1.5" aria-label="Confronto">
      {rows.map((r) => (
        <li key={r.key} className="grid grid-cols-[minmax(6rem,9rem)_1fr_auto] items-center gap-3 text-[13px]" title={`${r.key}: ${formatValue(r.value, unit)}${r.year ? ` (${r.year})` : ""}`}>
          <span className={cx("truncate", highlight && r.key !== highlight && "soft")}>{r.key}</span>
          <span className="relative h-3.5">
            <span className="absolute inset-y-0 left-0 rounded-r-[4px] transition-[width] duration-700"
              style={{ width: `${Math.max(1.5, (Math.abs(r.value) / top) * 100)}%`, background: !highlight || r.key === highlight ? "var(--color-leaf)" : "color-mix(in srgb, var(--color-leaf) 32%, transparent)" }} />
          </span>
          <span className="num w-20 text-right">{formatValue(r.value, unit)}</span>
        </li>
      ))}
      {data.length > max && <li className="soft text-xs">e altri {data.length - max}</li>}
    </ul>
  );
}

export function Lines({ series, unit, order, height = 180 }: {
  series: { key: string; points: { t: number; v: number }[] }[]; unit?: string; order: string[]; height?: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 640, H = height, L = 44, R = 96, T = 10, B = 24;
  const all = series.flatMap((s) => s.points);
  if (all.length === 0) return null;
  const t0 = Math.min(...all.map((p) => p.t)), t1 = Math.max(...all.map((p) => p.t));
  const vMax = Math.max(...all.map((p) => p.v)), vMin = Math.min(0, ...all.map((p) => p.v));
  const x = (t: number) => L + ((t - t0) / Math.max(1, t1 - t0)) * (W - L - R);
  const y = (v: number) => T + (1 - (v - vMin) / Math.max(1e-9, vMax - vMin)) * (H - T - B);
  const ticks = [vMin, (vMin + vMax) / 2, vMax];
  const years = [...new Set(all.map((p) => p.t))].sort((a, b) => a - b);
  const near = hover === null ? null : years.reduce((a, b) => (Math.abs(b - hover) < Math.abs(a - hover) ? b : a));
  // etichette dirette a destra, distanziate per non sovrapporsi
  const ends = series.map((s) => ({ key: s.key, y: y(s.points[s.points.length - 1].v) })).sort((a, b) => a.y - b.y);
  for (let i = 1; i < ends.length; i++) if (ends[i].y - ends[i - 1].y < 13) ends[i].y = ends[i - 1].y + 13;

  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Serie nel tempo"
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => { const b = (e.currentTarget as SVGSVGElement).getBoundingClientRect(); const px = ((e.clientX - b.left) / b.width) * W; setHover(t0 + ((px - L) / (W - L - R)) * (t1 - t0)); }}>
        {ticks.map((v) => (
          <g key={v}>
            <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke="currentColor" strokeOpacity="0.1" />
            <text x={L - 6} y={y(v) + 4} textAnchor="end" className="fill-current text-[10px] opacity-60">{formatValue(Math.round(v))}</text>
          </g>
        ))}
        <text x={L} y={H - 6} className="fill-current text-[10px] opacity-60">{t0}</text>
        <text x={W - R} y={H - 6} textAnchor="end" className="fill-current text-[10px] opacity-60">{t1}</text>
        {series.map((s) => (
          <polyline key={s.key} fill="none" stroke={colorFor(s.key, order)} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"
            points={s.points.map((p) => `${x(p.t)},${y(p.v)}`).join(" ")} />
        ))}
        {ends.map((e) => (
          <g key={e.key}>
            <circle cx={W - R + 6} cy={e.y} r="3.5" fill={colorFor(e.key, order)} />
            <text x={W - R + 13} y={e.y + 4} className="fill-current text-[11px]">{e.key}</text>
          </g>
        ))}
        {near !== null && (
          <g>
            <line x1={x(near)} x2={x(near)} y1={T} y2={H - B} stroke="currentColor" strokeOpacity="0.35" />
            {series.map((s) => { const p = s.points.find((q) => q.t === near); return p ? <circle key={s.key} cx={x(p.t)} cy={y(p.v)} r="4" fill={colorFor(s.key, order)} stroke="var(--color-card)" strokeWidth="2" /> : null; })}
          </g>
        )}
      </svg>
      {near !== null && (
        <figcaption className="num -mt-1 flex flex-wrap gap-x-3 text-[12px]">
          <b className="font-medium">{near}</b>
          {series.map((s) => { const p = s.points.find((q) => q.t === near); return p ? <span key={s.key}><span className="mr-1 inline-block size-2 rounded-full" style={{ background: colorFor(s.key, order) }} />{s.key} {formatValue(p.v, unit)}</span> : null; })}
        </figcaption>
      )}
    </figure>
  );
}

/** Mini serie per le schede: solo la forma, con primo e ultimo valore. */
export function Spark({ points, unit }: { points: { t: number; v: number }[]; unit?: string }) {
  if (points.length < 2) return null;
  const W = 120, H = 30;
  const t0 = points[0].t, t1 = points[points.length - 1].t;
  const vs = points.map((p) => p.v), lo = Math.min(...vs), hi = Math.max(...vs);
  const d = points.map((p) => `${((p.t - t0) / Math.max(1, t1 - t0)) * W},${H - 3 - ((p.v - lo) / Math.max(1e-9, hi - lo)) * (H - 6)}`).join(" ");
  return (
    <span className="inline-flex items-center gap-2" title={`${t0}: ${formatValue(points[0].v, unit)} → ${t1}: ${formatValue(points[points.length - 1].v, unit)}`}>
      <span className="num soft text-[10px]">{t0}</span>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-6 w-24" aria-hidden><polyline points={d} fill="none" stroke="var(--color-leaf)" strokeWidth="2" strokeLinejoin="round" /></svg>
      <span className="num soft text-[10px]">{t1}</span>
    </span>
  );
}

/** Tabella dei valori: alternativa accessibile a ogni grafico. */
export function ValueTable({ columns, rows }: { columns: { key: string; label: string; unit?: string }[]; rows: Record<string, unknown>[] }) {
  return (
    <div className="max-h-80 overflow-auto rounded-2xl border hairline">
      <table className="w-full text-left text-[12px]">
        <thead className="sticky top-0 bg-paper-2"><tr>{columns.map((c) => <th key={c.key} className="label px-3 py-2 !text-[9px] whitespace-nowrap">{c.label}{c.unit ? ` (${c.unit})` : ""}</th>)}</tr></thead>
        <tbody className="divide-y divide-line">
          {rows.map((r, i) => <tr key={i}>{columns.map((c) => <td key={c.key} className="num px-3 py-1.5 whitespace-nowrap">{formatValue(r[c.key] as number | string | null)}</td>)}</tr>)}
        </tbody>
      </table>
    </div>
  );
}
