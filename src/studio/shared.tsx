"use client";

import type { CampaignData, Membership, Observation } from "@/domain/types";
import { KIND_LABEL } from "@/domain/types";
import { Tag } from "@/ui/kit";

export interface Ctx {
  data: CampaignData;
  me: Membership;
  now: Date;
  refresh: () => Promise<void>;
}

export const PALETTE = ["#17804f", "#2f6fe0", "#e2578f", "#e8a81c", "#7a63d2", "#d8693b", "#0f9aa8", "#3d4046"];
export const KIND_COLOR = { field: "var(--color-field)", desk: "var(--color-desk)", feel: "var(--color-feel)" } as const;

export const nameOf = (data: CampaignData, userId: string) =>
  data.members.find((m) => m.user_id === userId)?.profile?.display_name ?? "Qualcuno";
export const teamOf = (data: CampaignData, id: string | null) => data.teams.find((t) => t.id === id) ?? null;
export const themeOf = (data: CampaignData, id: string | null) => data.themes.find((t) => t.id === id) ?? null;

export function KindTag({ o }: { o: Pick<Observation, "kind"> }) {
  return <Tag color={KIND_COLOR[o.kind]}>{KIND_LABEL[o.kind]}</Tag>;
}

export function Swatches({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Colore">
      {PALETTE.map((c) => (
        <button
          key={c} type="button" role="radio" aria-checked={value === c} aria-label={c} onClick={() => onChange(c)}
          className="size-8 rounded-full transition hover:scale-110"
          style={{ background: c, boxShadow: value === c ? `0 0 0 2px var(--color-paper), 0 0 0 4px ${c}` : undefined }}
        />
      ))}
    </div>
  );
}
