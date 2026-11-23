"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { phaseOf, PHASE_LABEL, remaining } from "@/domain/time";
import { updateCampaign, useCampaign, useSession } from "@/lib/data";
import { useAction, useNow } from "@/lib/hooks";
import Aree from "@/studio/Aree";
import Fonti from "@/studio/Fonti";
import Luoghi from "@/studio/Luoghi";
import Pubblico from "@/studio/Pubblico";
import Regia from "@/studio/Regia";
import { Dati, Rilievi } from "@/studio/Rilievi";
import Team from "@/studio/Team";
import Tempi from "@/studio/Tempi";
import { Button, cx, Dot, Empty, LinkButton, Logo, Notice, Spinner } from "@/ui/kit";

const VIEWS = [
  { id: "regia", label: "Regia" },
  { id: "tempi", label: "Tempi" },
  { id: "aree", label: "Aree" },
  { id: "luoghi", label: "Luoghi" },
  { id: "fonti", label: "Fonti" },
  { id: "team", label: "Team" },
  { id: "rilievi", label: "Rilievi" },
  { id: "pubblico", label: "Pubblico" },
  { id: "dati", label: "Dati" },
] as const;
type View = (typeof VIEWS)[number]["id"];

function Panel() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const view = (useSearchParams().get("vista") as View) || "regia";
  const { user } = useSession();
  const { data, error, refresh, loading } = useCampaign(id);
  const now = useNow(15000);
  const { busy, run } = useAction();

  if (loading || user === undefined) return <main className="on-paper min-h-dvh"><Spinner label="Apro la regia" /></main>;
  const me = data?.members.find((m) => m.user_id === user?.id);
  if (!data || !me) {
    return (
      <main className="on-paper grid min-h-dvh place-items-center p-6">
        <div className="w-full max-w-md space-y-4">
          {error && <Notice tone="error">{error}</Notice>}
          <Empty title="Campagna non trovata." action={<LinkButton href="/studio">Torna alle campagne</LinkButton>}>Potrebbe essere stata eliminata, oppure non ne fai parte.</Empty>
        </div>
      </main>
    );
  }
  if (me.role === "player") {
    return (
      <main className="on-paper grid min-h-dvh place-items-center p-6">
        <Empty title="Quest'area è della regia." action={<LinkButton href={`/campo/${id}`}>Vai sul campo</LinkButton>}>Solo master e tutor gestiscono la campagna.</Empty>
      </main>
    );
  }

  const c = data.campaign;
  const phase = phaseOf(c, now);
  const ctx = { data, me, now, refresh };
  const pending = data.observations.filter((o) => o.status === "pending").length;
  const queue = data.contributions.filter((x) => (x.status ?? "pending") === "pending").length;
  const setStatus = (status: "live" | "paused") => run(async () => { await updateCampaign(c.id, { status }); await refresh(); });
  const phaseColor = phase === "live" ? "var(--color-leaf)" : phase === "paused" ? "var(--color-sun)" : "var(--color-mute)";

  return (
    <main className="on-paper min-h-dvh pb-16">
      <header className="sticky top-0 z-30 border-b hairline bg-paper/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1500px] items-center gap-4 px-5 py-3 sm:px-8">
          <Link href="/studio" aria-label="Tutte le campagne"><Logo /></Link>
          <span className="soft hidden sm:inline">/</span>
          <h1 className="min-w-0 flex-1 truncate text-[17px] tracking-[-0.02em]">{c.name}</h1>
          <span className="hidden items-center gap-2 text-sm md:inline-flex">
            <Dot color={phaseColor} live={phase === "live"} />
            {PHASE_LABEL[phase]}
            {phase === "live" && <span className="soft">– {remaining(c.ends_at, now)}</span>}
          </span>
          <span className="num hidden rounded-full border hairline px-3 py-1.5 text-[13px] tracking-[0.15em] lg:inline">{c.join_code}</span>
          {c.status === "live"
            ? <Button variant="outline" size="sm" onClick={() => setStatus("paused")} disabled={busy}>Pausa</Button>
            : <Button variant="glow" size="sm" onClick={() => setStatus("live")} disabled={busy}>{c.status === "paused" ? "Riprendi" : "Avvia"}</Button>}
          <LinkButton href={`/mappa/${id}`} size="sm" variant="outline" className="hidden sm:inline-flex">Mappa</LinkButton>
          <LinkButton href={`/campo/${id}`} size="sm">Campo</LinkButton>
        </div>
        <nav className="mx-auto flex max-w-[1500px] gap-1 overflow-x-auto px-4 sm:px-7" aria-label="Sezioni">
          {VIEWS.map((v) => (
            <button
              key={v.id} onClick={() => router.replace(`/studio/${id}?vista=${v.id}`, { scroll: false })}
              aria-current={view === v.id ? "page" : undefined}
              className={cx("relative h-11 px-3 text-sm whitespace-nowrap transition", view === v.id ? "text-ink" : "soft hover:text-ink")}
            >
              {v.label}
              {v.id === "rilievi" && pending > 0 && <span className="num ml-1.5 rounded-full bg-ink px-1.5 py-0.5 text-[10px] text-paper">{pending}</span>}
              {v.id === "pubblico" && queue > 0 && <span className="num ml-1.5 rounded-full bg-ink px-1.5 py-0.5 text-[10px] text-paper">{queue}</span>}
              {view === v.id && <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-ink" />}
            </button>
          ))}
        </nav>
      </header>

      <div className="mx-auto max-w-[1500px] animate-fade px-5 pt-6 sm:px-8" key={view}>
        {error && <div className="mb-4"><Notice tone="error">{error}</Notice></div>}
        {view === "regia" && <Regia {...ctx} />}
        {view === "tempi" && <Tempi {...ctx} />}
        {view === "aree" && <Aree {...ctx} />}
        {view === "luoghi" && <Luoghi {...ctx} />}
        {view === "fonti" && <Fonti {...ctx} />}
        {view === "team" && <Team {...ctx} />}
        {view === "rilievi" && <Rilievi {...ctx} />}
        {view === "pubblico" && <Pubblico {...ctx} />}
        {view === "dati" && <Dati {...ctx} />}
      </div>
    </main>
  );
}

export default function StudioCampaign() {
  return (
    <Suspense>
      <Panel />
    </Suspense>
  );
}
