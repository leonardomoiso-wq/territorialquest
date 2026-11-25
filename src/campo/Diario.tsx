"use client";

import { formOf } from "@/domain/forms";
import { scoreObservations } from "@/domain/scoring";
import { categoryOf, type CampaignData, type Membership } from "@/domain/types";
import { mediaUrl } from "@/lib/data";
import { Icon } from "@/ui/icons";
import { Empty, Label } from "@/ui/kit";
import { FormTag } from "@/campo/Collect";

type Entry =
  | { kind: "rilievo"; at: string; id: string; title: string; form: string | null | undefined; img: string | null; status: string; pts: number; potential: number }
  | { kind: "arrivo"; at: string; id: string; title: string; color: string };

const dayOf = (iso: string) => new Date(iso).toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" });
const timeOf = (iso: string) => new Date(iso).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });

/**
 * Diario personale della campagna: ciò che ho raccolto e i luoghi che ho raggiunto, giorno per giorno.
 * È il punto d'arrivo dei ritagli che volano dopo ogni raccolta.
 */
export function Diario({ data, me, drafts, onDrafts, onOpen }: {
  data: CampaignData; me: Membership; drafts: number; onDrafts: () => void; onOpen: (observationId: string) => void;
}) {
  const scored = new Map(scoreObservations(data.observations).map((s) => [s.observation.id, s]));
  const entries: Entry[] = [
    ...data.observations.filter((o) => o.author_id === me.user_id).map((o) => {
      const s = scored.get(o.id);
      return { kind: "rilievo" as const, at: o.created_at, id: o.id, title: o.title, form: o.form, img: mediaUrl(o.media_path), status: o.status, pts: s?.value ?? 0, potential: s?.potential ?? 0 };
    }),
    ...data.visits.filter((v) => v.user_id === me.user_id).flatMap((v) => {
      const p = data.places.find((x) => x.id === v.place_id);
      return p ? [{ kind: "arrivo" as const, at: v.created_at, id: v.id, title: p.name, color: categoryOf(p.category).color }] : [];
    }),
  ].sort((a, b) => b.at.localeCompare(a.at));

  const days = new Map<string, Entry[]>();
  for (const e of entries) days.set(dayOf(e.at), [...(days.get(dayOf(e.at)) ?? []), e]);
  const confirmed = entries.filter((e) => e.kind === "rilievo" && e.status === "validated").length;
  const total = entries.filter((e) => e.kind === "rilievo").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
        <span><b className="num font-medium">{total}</b> rilievi</span>
        <span><b className="num font-medium">{confirmed}</b> confermati da altri team</span>
        <span><b className="num font-medium">{entries.length - total}</b> luoghi raggiunti</span>
      </div>
      {drafts > 0 && (
        <button type="button" onClick={onDrafts} className="flex w-full items-center gap-3 rounded-card border border-dashed border-line p-3 text-left">
          <Icon name="tray" /><span className="flex-1 text-sm">{drafts} {drafts === 1 ? "foto aspetta" : "foto aspettano"} la didascalia</span><span className="text-sm underline">Completa</span>
        </button>
      )}
      {entries.length === 0 ? (
        <Empty title="Il diario è ancora bianco.">Ogni rilievo raccolto e ogni luogo raggiunto finiscono qui, giorno per giorno.</Empty>
      ) : [...days].map(([day, list]) => (
        <section key={day}>
          <Label className="mb-2 block">{day}</Label>
          <ul className="divide-y divide-line">
            {list.map((e) => e.kind === "arrivo" ? (
              <li key={e.id} className="flex items-center gap-3 py-2.5">
                <span className="grid size-12 shrink-0 place-items-center rounded-[3px] text-white" style={{ background: e.color }}><Icon name="flag" /></span>
                <span className="min-w-0 flex-1"><span className="soft block text-xs">Arrivo – {timeOf(e.at)}</span><span className="block truncate">{e.title}</span></span>
              </li>
            ) : (
              <li key={e.id}>
                <button type="button" onClick={() => onOpen(e.id)} className="flex w-full items-center gap-3 py-2.5 text-left">
                  {e.img
                    ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={e.img} alt="" loading="lazy" className="size-12 shrink-0 rounded-[3px] object-cover shadow-[0_0_0_2px_var(--color-edge)]" />
                    : <span className="grid size-12 shrink-0 place-items-center rounded-[3px] text-white" style={{ background: formOf(e.form).color }}><Icon name={`forma-${formOf(e.form).id}`} /></span>}
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2"><FormTag form={e.form} /><span className="soft text-xs">{timeOf(e.at)}</span></span>
                    <span className="mt-0.5 block truncate">{e.title}</span>
                  </span>
                  <span className="num shrink-0 text-right text-sm">
                    {e.status === "validated" ? <span className="text-leaf">+{e.pts}</span> : e.status === "flagged" ? <span className="soft">segnalato</span> : <span className="soft">in attesa</span>}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
      {total > 0 && <p className="soft text-xs">I punti dei rilievi arrivano al totale di tutti quando un altro team li conferma sul posto.</p>}
    </div>
  );
}
