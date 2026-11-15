"use client";

import { useEffect } from "react";
import { formatDuration, formatMeters } from "@/domain/walk";
import { Button, Label, Sheet } from "@/ui/kit";

export interface Cheer {
  id: number;
  big: string;
  small: string;
  color?: string;
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
      <svg viewBox="0 0 100 100" className="absolute size-[26rem] max-w-none animate-burst" aria-hidden>
        <path d="M50 4 90 27v46L50 96 10 73V27z" fill="none" stroke={color} strokeWidth="2.5" />
      </svg>
      <svg viewBox="0 0 100 100" className="absolute size-[26rem] max-w-none animate-burst [animation-delay:160ms]" aria-hidden>
        <path d="M50 4 90 27v46L50 96 10 73V27z" fill={color} fillOpacity="0.18" />
      </svg>
      <div className="glass-ink mx-6 w-72 max-w-full animate-pop rounded-panel px-7 py-7 text-center">
        <div className="display text-[52px] leading-none" style={{ color }}>{cheer.big}</div>
        <div className="mx-auto mt-3 text-sm leading-snug text-paper/85">{cheer.small}</div>
      </div>
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
}

/** Riepilogo al rientro: che cosa ha portato questa uscita al territorio di tutti. */
export function Recap({ summary, onClose, onDrafts }: { summary: WalkSummary | null; onClose: () => void; onDrafts: () => void }) {
  const s = summary;
  const title = !s ? "" : s.fresh > 0 ? "Hai acceso la mappa." : s.observations + s.confirms > 0 ? "Bel giro." : "Rientro.";
  return (
    <Sheet open={!!s} onClose={onClose} kicker="Fine dell'uscita" title={<span className="serif text-[40px] italic">{title}</span>}>
      {s && (
        <>
          <div className="on-ink rounded-card p-5">
            <div className="grid grid-cols-3 divide-x divide-white/10">
              <div className="pr-3"><div className="display text-[26px] leading-none whitespace-nowrap">{formatMeters(s.meters)}</div><Label className="mt-2 block">a piedi</Label></div>
              <div className="px-3"><div className="display text-[26px] leading-none whitespace-nowrap">{formatDuration(s.ms)}</div><Label className="mt-2 block">in giro</Label></div>
              <div className="pl-3"><div className="display text-[26px] leading-none text-glow">{s.fresh}</div><Label className="mt-2 block">zone accese</Label></div>
            </div>
          </div>
          <ul className="mt-4 divide-y divide-line text-[15px]">
            <li className="flex justify-between py-3"><span>Rilievi raccolti</span><span className="num">{s.observations}</span></li>
            <li className="flex justify-between py-3"><span>Rilievi degli altri confermati</span><span className="num">{s.confirms}</span></li>
            <li className="flex justify-between py-3"><span>Zone attraversate</span><span className="num">{s.cells}</span></li>
            <li className="flex justify-between py-3"><span>Punti in arrivo per tutti</span><span className="num text-leaf">+{s.potential}</span></li>
          </ul>
          <p className="soft mt-3 text-sm">
            {s.potential > 0 ? "I punti entrano nel totale comune quando un altro team conferma i tuoi rilievi." : "Ogni zona accesa aiuta gli altri team a sapere dove non serve tornare."}
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
