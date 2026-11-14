"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { phaseOf, PHASE_LABEL, formatDate, fromLocalInput, toLocalInput } from "@/domain/time";
import { ROLE_LABEL } from "@/domain/types";
import { createCampaign, explain, listCampaigns, signOut, useSession, type CampaignLink } from "@/lib/data";
import { useAction } from "@/lib/hooks";
import { Area, ArrowIcon, Button, Empty, Field, Label, LinkButton, Logo, Notice, PlusIcon, Sheet, Spinner, Tag } from "@/ui/kit";

const PHASE_COLOR = { draft: "var(--color-mute)", upcoming: "var(--color-desk)", live: "var(--color-leaf)", paused: "var(--color-sun)", ended: "var(--color-graphite)" };

export default function Studio() {
  const router = useRouter();
  const { user, name } = useSession();
  const [items, setItems] = useState<CampaignLink[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const { busy, error, run } = useAction();

  const inTwoWeeks = () => new Date(Date.now() + 14 * 86400000).toISOString();
  const [form, setForm] = useState({ name: "", description: "", starts: toLocalInput(new Date().toISOString()), ends: toLocalInput(inTwoWeeks()) });

  useEffect(() => {
    if (!user) return;
    listCampaigns(user.id).then(setItems, (e) => { setLoadError(explain(e)); setItems([]); });
  }, [user]);

  const create = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    run(async () => {
      const c = await createCampaign({
        owner_id: user.id, name: form.name.trim(), description: form.description.trim(),
        starts_at: fromLocalInput(form.starts)!, ends_at: fromLocalInput(form.ends)!,
      });
      router.push(`/studio/${c.id}?vista=aree`);
    });
  };

  return (
    <main className="on-paper min-h-dvh px-5 pb-32 sm:px-8">
      <header className="mx-auto flex max-w-6xl items-center justify-between py-6">
        <Link href="/"><Logo /></Link>
        <div className="flex items-center gap-2">
          <span className="soft hidden text-sm sm:inline">{name}</span>
          <Button variant="ghost" size="sm" onClick={signOut}>Esci</Button>
        </div>
      </header>

      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-end justify-between gap-4 pt-10 pb-10">
          <div>
            <Label>Studio</Label>
            <h1 className="display mt-2 text-[clamp(2.5rem,6vw,4.5rem)]">Le tue campagne</h1>
          </div>
          <div className="flex gap-2">
            <LinkButton href="/entra" variant="outline">Entra con un codice</LinkButton>
            <Button onClick={() => setOpen(true)}><PlusIcon /> Nuova campagna</Button>
          </div>
        </div>

        {loadError && <div className="mb-6"><Notice tone="error">{loadError}</Notice></div>}

        {items === null ? (
          <Spinner />
        ) : items.length === 0 ? (
          <Empty title="Nessuna campagna, per ora." action={<Button onClick={() => setOpen(true)}><PlusIcon /> Crea la prima</Button>}>
            Una campagna è un&apos;attività di esplorazione: ha un territorio, dei tempi e dei team.
          </Empty>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map(({ campaign: c, role }) => {
              const phase = phaseOf(c);
              const staff = role !== "player";
              return (
                <Link
                  key={c.id} href={staff ? `/studio/${c.id}` : `/campo/${c.id}`}
                  className="surface group flex min-h-56 flex-col rounded-panel border hairline p-6 transition duration-500 hover:-translate-y-1 hover:shadow-float"
                >
                  <div className="flex items-center justify-between">
                    <Tag color={PHASE_COLOR[phase]}>{PHASE_LABEL[phase]}</Tag>
                    <span className="label soft">{ROLE_LABEL[role]}</span>
                  </div>
                  <h2 className="display mt-auto pt-10 text-[28px]">{c.name}</h2>
                  <p className="soft mt-1.5 text-sm">{formatDate(c.starts_at)} → {formatDate(c.ends_at)}</p>
                  <div className="mt-5 flex items-center justify-between border-t hairline pt-4">
                    <span className="num text-sm tracking-[0.15em]">{c.join_code}</span>
                    <span className="inline-flex items-center gap-1.5 text-sm transition group-hover:gap-2.5">
                      {staff ? "Apri la regia" : "Vai sul campo"} <ArrowIcon />
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      <Sheet open={open} onClose={() => setOpen(false)} kicker="Nuova campagna" title="Che cosa esploriamo?">
        <form onSubmit={create} className="space-y-3">
          <Field label="Nome" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required maxLength={60} placeholder="Aurora, quartiere creativo" autoFocus />
          <Area label="Obiettivo" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} maxLength={400} placeholder="Che cosa volete capire di questo territorio?" />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Inizio" type="datetime-local" value={form.starts} onChange={(e) => setForm({ ...form, starts: e.target.value })} required />
            <Field label="Fine" type="datetime-local" value={form.ends} min={form.starts} onChange={(e) => setForm({ ...form, ends: e.target.value })} required />
          </div>
          {error && <Notice tone="error">{error}</Notice>}
          <Button type="submit" size="lg" className="w-full" disabled={busy}>{busy ? "Creo…" : "Crea e disegna le aree"}</Button>
        </form>
      </Sheet>
    </main>
  );
}
