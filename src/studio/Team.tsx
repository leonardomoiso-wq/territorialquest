"use client";

import { useMemo, useState } from "react";
import { indicators } from "@/domain/scoring";
import { ago, isOnline } from "@/domain/time";
import { FIELD_ROLES, type Membership, type Role, type Team as TeamT } from "@/domain/types";
import { deleteTeam, removeMember, saveTeam, updateMember } from "@/lib/data";
import { useAction } from "@/lib/hooks";
import { Button, Card, Dot, Empty, Field, Label, Notice, PlusIcon, SectionTitle, Sheet, Tag } from "@/ui/kit";
import { PALETTE, Swatches, type Ctx } from "./shared";

const selectClass = "h-8 rounded-full border hairline bg-transparent px-2.5 text-[13px] outline-none focus:border-leaf";

export default function Team({ data, me, now, refresh }: Ctx) {
  const c = data.campaign;
  const ind = useMemo(() => indicators(data), [data]);
  const [draft, setDraft] = useState<(Partial<TeamT> & { name: string; color: string }) | null>(null);
  const [copied, setCopied] = useState(false);
  const { busy, error, run } = useAction();
  const act = (fn: () => Promise<unknown>) => run(async () => { await fn(); await refresh(); });

  const link = typeof location !== "undefined" ? `${location.origin}/entra?codice=${c.join_code}` : "";
  const copy = async () => { await navigator.clipboard?.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  const staff = data.members.filter((m) => m.role !== "player");
  const players = data.members.filter((m) => m.role === "player");
  const unassigned = players.filter((m) => !m.team_id);

  const Row = ({ m }: { m: Membership }) => {
    const online = isOnline(m.last_seen_at, now);
    const count = data.observations.filter((o) => o.author_id === m.user_id).length;
    return (
      <li className={`flex flex-wrap items-center gap-x-3 gap-y-2 py-3 ${m.status === "suspended" ? "opacity-50" : ""}`}>
        <Dot color={online ? "var(--color-leaf)" : "var(--color-line)"} live={online} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[15px]">{m.profile?.display_name ?? "Senza nome"}{m.user_id === me.user_id && <span className="soft"> (tu)</span>}</div>
          <div className="label soft mt-0.5">
            {m.field_role ? FIELD_ROLES.find((r) => r.id === m.field_role)?.label : "ruolo libero"} – {count} rilievi – {online ? "sul campo" : ago(m.last_seen_at, now)}
          </div>
        </div>
        <select aria-label="Team" className={selectClass} value={m.team_id ?? ""} disabled={busy} onChange={(e) => act(() => updateMember(m.id, { team_id: e.target.value || null }))}>
          <option value="">Senza squadra</option>
          {data.teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <select aria-label="Ruolo" className={selectClass} value={m.role} disabled={busy || m.user_id === c.owner_id} onChange={(e) => act(() => updateMember(m.id, { role: e.target.value as Role }))}>
          <option value="player">Giocatore</option>
          <option value="tutor">Tutor</option>
          <option value="master">Master</option>
        </select>
        {m.user_id !== c.owner_id && (
          <>
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => act(() => updateMember(m.id, { status: m.status === "active" ? "suspended" : "active" }))}>
              {m.status === "active" ? "Sospendi" : "Riattiva"}
            </Button>
            <Button size="sm" variant="danger" disabled={busy} onClick={() => confirm(`Rimuovere ${m.profile?.display_name ?? "il giocatore"} dalla campagna?`) && act(() => removeMember(m.id))}>Rimuovi</Button>
          </>
        )}
      </li>
    );
  };

  return (
    <div className="space-y-10">
      <section className="on-ink grid gap-6 rounded-panel p-7 sm:grid-cols-[1fr_auto] sm:items-center">
        <div>
          <Label>Codice per entrare</Label>
          <div className="num mt-2 text-[clamp(2.5rem,7vw,4.5rem)] leading-none tracking-[0.2em] text-glow">{c.join_code}</div>
          <p className="soft mt-3 max-w-md text-sm">Condividilo con i giocatori: lo inseriscono in «Entra con un codice» dopo aver creato il profilo.</p>
        </div>
        <Button variant="outline" onClick={copy}>{copied ? "Link copiato ✓" : "Copia il link di invito"}</Button>
      </section>

      {error && <Notice tone="error">{error}</Notice>}

      <section>
        <SectionTitle kicker={`${players.length} giocatori`} title="Team" action={<Button onClick={() => setDraft({ name: "", color: PALETTE[data.teams.length % PALETTE.length] })}><PlusIcon /> Nuova squadra</Button>} />
        {data.teams.length === 0 ? (
          <Empty title="Ancora nessuna squadra.">Crea le squadre: i giocatori sceglieranno il proprio entrando, oppure li assegni tu da qui.</Empty>
        ) : (
          <div className="grid grid-cols-1 gap-4 [&>*]:min-w-0 lg:grid-cols-2">
            {data.teams.map((t) => {
              const members = players.filter((m) => m.team_id === t.id);
              const obs = data.observations.filter((o) => o.team_id === t.id);
              const validatedForOthers = data.observations.filter((o) => o.status === "validated" && o.team_id !== t.id && members.some((m) => m.user_id === o.validated_by)).length;
              return (
                <Card key={t.id} className="!p-6">
                  <div className="flex items-center gap-3">
                    <span className="size-4 rounded-full" style={{ background: t.color }} />
                    <h3 className="display flex-1 text-[24px]">{t.name}</h3>
                    <Button size="sm" variant="ghost" onClick={() => setDraft({ ...t })}>Modifica</Button>
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-3 border-y hairline py-4">
                    <div><div className="num text-xl">{obs.length}</div><div className="label soft mt-0.5">rilievi</div></div>
                    <div><div className="num text-xl">{Math.round(ind.byTeam[t.id] ?? 0)}</div><div className="label soft mt-0.5">pt portati</div></div>
                    <div><div className="num text-xl">{validatedForOthers}</div><div className="label soft mt-0.5">aiuti dati</div></div>
                  </div>
                  {members.length ? <ul className="divide-y divide-line">{members.map((m) => <Row key={m.id} m={m} />)}</ul> : <p className="soft pt-4 text-sm">Nessun giocatore in questa squadra.</p>}
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {unassigned.length > 0 && (
        <section>
          <SectionTitle kicker="Da assegnare" title="Senza squadra" />
          <Card><ul className="divide-y divide-line">{unassigned.map((m) => <Row key={m.id} m={m} />)}</ul></Card>
        </section>
      )}

      <section>
        <SectionTitle kicker="Chi coordina" title="Staff" />
        <Card>
          <ul className="divide-y divide-line">
            {staff.map((m) => (
              <li key={m.id} className="flex items-center gap-3 py-3">
                <span className="flex-1 text-[15px]">{m.profile?.display_name}{m.user_id === me.user_id && <span className="soft"> (tu)</span>}</span>
                <Tag>{m.role === "master" ? "Master" : "Tutor"}</Tag>
                {m.user_id !== c.owner_id && <Button size="sm" variant="ghost" disabled={busy} onClick={() => act(() => updateMember(m.id, { role: "player" }))}>Rendi giocatore</Button>}
              </li>
            ))}
          </ul>
        </Card>
      </section>

      <Sheet open={!!draft} onClose={() => setDraft(null)} kicker={draft?.id ? "Modifica squadra" : "Nuova squadra"} title="Chi esplora insieme">
        {draft && (
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); run(async () => { await saveTeam({ ...draft, campaign_id: c.id, name: draft.name.trim() }); await refresh(); setDraft(null); }); }}>
            <Field label="Nome" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} required maxLength={40} autoFocus />
            <div><Label className="mb-2 block">Colore</Label><Swatches value={draft.color} onChange={(color) => setDraft({ ...draft, color })} /></div>
            {error && <Notice tone="error">{error}</Notice>}
            <div className="flex gap-2 pt-2">
              <Button type="submit" size="lg" className="flex-1" disabled={busy}>Salva la squadra</Button>
              {draft.id && <Button size="lg" variant="danger" disabled={busy} onClick={() => confirm("Eliminare il team? I giocatori restano senza team.") && run(async () => { await deleteTeam(draft.id!); await refresh(); setDraft(null); })}>Elimina</Button>}
            </div>
          </form>
        )}
      </Sheet>
    </div>
  );
}
