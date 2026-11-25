"use client";

import { atlasOf, filled, type AtlasEntry } from "@/domain/atlas";
import type { CampaignData } from "@/domain/types";
import { Icon, type IconName } from "@/ui/icons";
import { cx, Label } from "@/ui/kit";
import { Tinted } from "@/ui/Tinted";

const day = (iso: string) => new Date(iso).toLocaleDateString("it-IT", { day: "numeric", month: "short" });

/** Casella: illustrazione ricolorata se trovata, sagoma tenue con l'invito se ancora vuota. */
function Box({ e, asset, icon }: { e: AtlasEntry; asset: string; icon: IconName }) {
  const found = e.count > 0;
  const fallback = (
    <span className={cx("mx-auto my-3 grid aspect-square w-3/5 place-items-center rounded-full", found ? "text-white" : "border-2 border-dashed border-line text-mute")}
      style={found ? { background: e.color } : undefined}>
      <Icon name={icon} className="!size-1/2" strokeWidth={1.4} />
    </span>
  );
  return (
    <li className={cx("ritaglio flex flex-col p-2 pb-2.5", !found && "opacity-90")}>
      <div className="grid aspect-square place-items-center">
        <Tinted name={asset} accent={e.color} muted={!found} small className="w-full" fallback={fallback} alt={found ? e.label : ""} />
      </div>
      <span className="mt-1 text-[13px] leading-tight font-medium" style={found ? { color: e.color } : undefined}>{e.label}</span>
      {found
        ? <span className="soft text-[11px] leading-snug">×{e.count} – dal {day(e.first!)}</span>
        : <span className="soft line-clamp-2 text-[11px] leading-snug">{e.hint}</span>}
    </li>
  );
}

function Section({ title, list, asset, icon }: { title: string; list: AtlasEntry[]; asset: (id: string) => string; icon: (id: string) => IconName }) {
  return (
    <section>
      <div className="mb-2 flex items-baseline justify-between">
        <Label>{title}</Label>
        <span className="num soft text-sm">{filled(list)} di {list.length}</span>
      </div>
      <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4">
        {list.map((e) => <Box key={e.id} e={e} asset={asset(e.id)} icon={icon(e.id)} />)}
      </ul>
    </section>
  );
}

/**
 * Atlante collettivo: forme di raccolta, tipi di luogo e ambienti trovati da tutti i team insieme.
 * Le caselle vuote sono un invito a cercare ciò che manca.
 */
export function Atlante({ data }: { data: Pick<CampaignData, "observations" | "visits" | "places" | "areas" | "walks"> }) {
  const a = atlasOf(data);
  const all = [...a.forms, ...a.places, ...a.environments];
  return (
    <div className="space-y-7">
      <p className="text-[15px] leading-snug">
        Il gruppo ha riempito <b className="num font-medium">{filled(all)}</b> caselle su <b className="num font-medium">{all.length}</b>.
        <span className="soft"> L&apos;atlante è di tutti: ogni team aggiunge le sue scoperte.</span>
      </p>
      <Section title="Forme di raccolta" list={a.forms} asset={(id) => `atlante/forma-${id}`} icon={(id) => `forma-${id}`} />
      <Section title="Tipi di luogo" list={a.places} asset={(id) => `atlante/luogo-${id}`} icon={(id) => `luogo-${id}` as IconName} />
      <Section title="Ambienti" list={a.environments} asset={(id) => `atlante/ambiente-${id}`} icon={(id) => `ambiente-${id}` as IconName} />
    </div>
  );
}
