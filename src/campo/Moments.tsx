"use client";

import { useEffect } from "react";
import { formOf } from "@/domain/forms";
import { cellRing } from "@/domain/geo";
import { formatDuration, formatMeters } from "@/domain/walk";
import { Icon } from "@/ui/icons";
import { Tinted } from "@/ui/Tinted";
import { BASE } from "@/domain/palette";
import { Button, Sheet } from "@/ui/kit";

export interface Cheer {
  id: number;
  big: string;
  small: string;
  color?: string;
  /** Arrivo a un luogo: il timbro si calca sulla carta. */
  stamp?: boolean;
}

/** Momento di ricompensa: breve, a tutto schermo, non blocca il cammino. */
export function Celebration({ cheer, onEnd }: { cheer: Cheer | null; onEnd: () => void }) {
  useEffect(() => {
    if (!cheer) return;
    const t = setTimeout(onEnd, 1900);
    return () => clearTimeout(t);
  }, [cheer, onEnd]);
  if (!cheer) return null;
  const color = cheer.color ?? "var(--color-glow)";
  return (
    <div key={cheer.id} className="pointer-events-none fixed inset-0 z-[55] grid place-items-center" role="status" aria-live="polite">
      {cheer.stamp ? (
        <svg viewBox="0 0 100 100" className="absolute size-[17rem] max-w-none animate-stamp" aria-hidden>
          <circle cx="50" cy="50" r="44" fill="none" stroke={color} strokeWidth="5" />
          <circle cx="50" cy="50" r="36" fill={color} fillOpacity="0.14" stroke={color} strokeWidth="1.5" strokeDasharray="3 3" />
          <path d="M33 51 45 63 68 38" fill="none" stroke={color} strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : (
        <>
          <svg viewBox="0 0 100 100" className="absolute size-[26rem] max-w-none animate-burst" aria-hidden>
            <path d="M50 4 90 27v46L50 96 10 73V27z" fill="none" stroke={color} strokeWidth="2.5" />
          </svg>
          <svg viewBox="0 0 100 100" className="absolute size-[26rem] max-w-none animate-burst [animation-delay:160ms]" aria-hidden>
            <path d="M50 4 90 27v46L50 96 10 73V27z" fill={color} fillOpacity="0.18" />
          </svg>
        </>
      )}
      {/* un tocco chiude subito il momento */}
      <button type="button" onClick={onEnd} className={"glass-ink pointer-events-auto mx-6 w-72 max-w-full animate-pop rounded-panel px-7 py-7 text-center" + (cheer.stamp ? " mt-[19rem]" : "")}>
        <div className="display text-[52px] leading-none" style={{ color }}>{cheer.big}</div>
        <div className="mx-auto mt-3 text-sm leading-snug text-paper/85">{cheer.small}</div>
      </button>
    </div>
  );
}

export interface WalkSummary {
  ms: number;
  meters: number;
  cells: number;
  fresh: number;
  observations: number;
  confirms: number;
  potential: number;
  drafts: number;
  places: number;
  /** Celle attraversate (per la mini mappa del taccuino) e colore della squadra. */
  cellIds?: string[];
  color?: string;
  /** Luoghi raggiunti e rilievi raccolti in questa uscita. */
  placeList?: { name: string; color: string; lng: number; lat: number }[];
  items?: { title: string; form: string | null }[];
}

/** Mini mappa del taccuino: le celle attraversate disegnate a mano, con i luoghi raggiunti. Non c'è tracciato GPS. */
function Sketch({ cells, color, places }: { cells: string[]; color: string; places: { lng: number; lat: number; color: string }[] }) {
  const rings = cells.map(cellRing);
  const pts = [...rings.flat(), ...places.map((p) => [p.lng, p.lat] as [number, number])];
  if (!pts.length) return null;
  const lat0 = pts.reduce((s, p) => s + p[1], 0) / pts.length;
  const k = Math.cos((lat0 * Math.PI) / 180);
  const xs = pts.map((p) => p[0] * k), ys = pts.map((p) => p[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const span = Math.max(maxX - minX, maxY - minY) || 1e-4;
  const W = 300, H = 170, pad = 14, scale = Math.min((W - pad * 2) / (maxX - minX || span), (H - pad * 2) / (maxY - minY || span));
  const ox = (W - (maxX - minX) * scale) / 2, oy = (H - (maxY - minY) * scale) / 2;
  const at = (p: [number, number]) => [ox + (p[0] * k - minX) * scale, H - (oy + (p[1] - minY) * scale)];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" aria-label="Le zone attraversate in questa uscita">
      {rings.map((r, i) => (
        <path key={i} d={`M${r.map((p) => at(p).map((v) => v.toFixed(1)).join(" ")).join("L")}z`}
          fill={color} fillOpacity={0.28} stroke={color} strokeOpacity={0.75} strokeWidth={1.2} strokeLinejoin="round" />
      ))}
      {places.map((p, i) => { const [x, y] = at([p.lng, p.lat]); return (
        <g key={i} transform={`translate(${x} ${y})`}>
          <line y1={0} y2={-14} stroke="var(--color-ink)" strokeWidth={1.6} strokeLinecap="round" />
          <rect x={-6} y={-22} width={12} height={9} rx={1.5} fill={p.color} stroke="var(--color-ink)" strokeWidth={1.2} />
        </g>
      ); })}
    </svg>
  );
}

/** Riepilogo al rientro, come la pagina di un taccuino di campo: che cosa ha portato l'uscita al territorio di tutti. */
export function Recap({ summary, onClose, onDrafts }: { summary: WalkSummary | null; onClose: () => void; onDrafts: () => void }) {
  const s = summary;
  const title = !s ? "" : s.places > 0 ? "Meta raggiunta." : s.fresh > 0 ? "Hai acceso la mappa." : s.observations + s.confirms > 0 ? "Bel giro." : "Rientro.";
  const today = new Date().toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" });
  return (
    <Sheet open={!!s} onClose={onClose} kicker="Fine dell'uscita" title={<span className="serif text-[40px] italic">{title}</span>}>
      {s && (
        <>
          {/* pagina di taccuino: righe, margine rosso, appunti */}
          <div className="relative overflow-hidden rounded-[3px] bg-card py-4 pr-4 pl-10 shadow-[0_0_0_1px_var(--color-line),0_10px_22px_-14px_rgb(20_22_26/.4)]"
            style={{ backgroundImage: "repeating-linear-gradient(to bottom, transparent 0 27px, color-mix(in srgb, var(--color-river) 22%, transparent) 27px 28px)" }}>
            <span className="absolute inset-y-0 left-7 w-px bg-alert/45" aria-hidden />
            {/* testata strappata: un foglio di carta sovrapposto alla pagina */}
            <Tinted name="texture/strappo" accent={BASE["paper-2"]} ink={BASE.line} paper={BASE.edge} ratio={3.34}
              className="pointer-events-none absolute -top-1 left-0 z-10 w-full drop-shadow-[0_3px_3px_rgb(20_22_26/.18)]" />
            <p className="label soft relative z-20 pt-1 pb-6 leading-7">{today}</p>
            {!!s.cellIds?.length && <div className="my-1"><Sketch cells={s.cellIds} color={s.color ?? "var(--color-leaf)"} places={s.placeList ?? []} /></div>}
            <p className="leading-7"><b className="num font-medium">{formatMeters(s.meters)}</b> a piedi in <b className="num font-medium">{formatDuration(s.ms)}</b>, <b className="num font-medium text-glow">{s.fresh}</b> zone accese per la prima volta.</p>
            {!!s.placeList?.length && <p className="leading-7">Raggiunti: {s.placeList.map((p) => p.name).join(", ")}.</p>}
            {!!s.items?.length && (
              <ul className="leading-7">
                {s.items.slice(0, 6).map((x, i) => <li key={i} className="flex items-center gap-2"><Icon name={`forma-${formOf(x.form).id}`} className="!size-4" /><span className="truncate">{x.title}</span></li>)}
                {s.items.length > 6 && <li className="soft">e altri {s.items.length - 6}</li>}
              </ul>
            )}
            <p className="leading-7">Per il gruppo: <b className="num font-medium text-leaf">+{s.potential}</b> punti in arrivo{s.confirms > 0 ? `, ${s.confirms} rilievi di altri confermati` : ""}.</p>
          </div>
          <p className="soft mt-3 text-sm">
            {s.potential > 0 ? "I punti entrano nel totale comune quando un'altra squadra conferma i tuoi rilievi." : "Ogni zona accesa aiuta le altre squadre a sapere dove non serve tornare."}
          </p>
          <div className="mt-6 flex gap-2">
            {s.drafts > 0 && <Button size="lg" variant="outline" onClick={onDrafts}>Completa {s.drafts} foto</Button>}
            <Button size="lg" className="flex-1" onClick={onClose}>Chiudi</Button>
          </div>
        </>
      )}
    </Sheet>
  );
}
