"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { areaAt, cellOf } from "@/domain/geo";
import { BASE, indicators, MISSION_KIND, missionProgress, novelty } from "@/domain/scoring";
import { ago, areaOpen, phaseOf, PHASE_LABEL, remaining } from "@/domain/time";
import { FIELD_ROLES, KIND_HINT, KIND_LABEL, type FieldRole, type Observation, type ObservationKind } from "@/domain/types";
import { addObservation, chooseTeam, heartbeat, mediaUrl, useCampaign, useSession, validateObservation } from "@/lib/data";
import { useAction, useNow } from "@/lib/hooks";
import { backdrop, KIND_COLOR, KindTag, nameOf, teamOf, themeOf } from "@/studio/shared";
import MapView from "@/ui/MapView";
import { Area, Button, cx, Dot, Empty, Field, IconButton, Label, LinkButton, Meter, Notice, PlusIcon, Ring, Sheet, Spinner, Tag } from "@/ui/kit";

const FEELINGS = ["Accogliente", "Vivace", "Tranquillo", "Trascurato", "Rumoroso", "Insicuro"];
type Panel = null | "new" | "validate" | "missions" | "team" | "detail";

export default function Campo() {
  const { id } = useParams<{ id: string }>();
  const { user } = useSession();
  const { data, error, refresh, loading } = useCampaign(id);
  const now = useNow(20000);
  const { busy, error: actionError, run, setError } = useAction();

  const [panel, setPanel] = useState<Panel>(null);
  const [picking, setPicking] = useState(false);
  const [pin, setPin] = useState<[number, number] | null>(null);
  const [position, setPosition] = useState<[number, number] | null>(null);
  const [detail, setDetail] = useState<Observation | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [seenNotice, setSeenNotice] = useState<string | null>(null);
  const [form, setForm] = useState({ kind: "field" as ObservationKind, theme_id: "", title: "", note: "", feeling: "", source_url: "" });
  const [file, setFile] = useState<File | null>(null);
  const [role, setRole] = useState<FieldRole | null>(null);
  const lastBeat = useRef(0);

  const me = data?.members.find((m) => m.user_id === user?.id);
  const ind = useMemo(() => (data ? indicators(data) : null), [data]);

  // posizione e presenza: il master vede chi è sul campo
  useEffect(() => {
    if (!me) return;
    const beat = (p?: [number, number]) => { lastBeat.current = Date.now(); heartbeat(id, p?.[0], p?.[1]); };
    beat();
    const watch = navigator.geolocation?.watchPosition(
      (g) => {
        const p: [number, number] = [g.coords.longitude, g.coords.latitude];
        setPosition(p);
        if (Date.now() - lastBeat.current > 45000) beat(p);
      },
      () => undefined,
      { enableHighAccuracy: true, maximumAge: 15000 },
    );
    const t = setInterval(() => beat(), 60000);
    return () => { clearInterval(t); if (watch != null) navigator.geolocation.clearWatch(watch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, me?.id]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(t);
  }, [toast]);

  if (loading || user === undefined) return <main className="on-ink min-h-dvh"><Spinner label="Preparo la mappa" /></main>;
  if (!data || !me || !ind) {
    return (
      <main className="on-paper grid min-h-dvh place-items-center p-6">
        <div className="w-full max-w-md space-y-4">
          {error && <Notice tone="error">{error}</Notice>}
          <Empty title="Non fai parte di questa campagna." action={<LinkButton href="/entra">Entra con un codice</LinkButton>} />
        </div>
      </main>
    );
  }

  const c = data.campaign;
  const phase = phaseOf(c, now);
  const staff = me.role !== "player";
  const canCollect = me.status === "active" && (staff || phase === "live");
  const myTeam = teamOf(data, me.team_id);
  const needsTeam = !staff && !me.team_id && data.teams.length > 0;
  const openPanel: Panel = needsTeam && panel === null ? "team" : panel;

  const toValidate = data.observations.filter(
    (o) => o.status === "pending" && o.author_id !== me.user_id && (staff || !o.team_id || o.team_id !== me.team_id),
  );
  const missions = data.missions.map((m) => missionProgress(m, data, now)).filter((p) => p.state !== "expired" && p.state !== "upcoming");
  const notice = data.announcements.find((a) => !a.team_id || a.team_id === me.team_id);
  const showNotice = notice && notice.id !== seenNotice && Date.now() - new Date(notice.created_at).getTime() < 6 * 3600000;

  // anteprima del valore: scoraggia i doppioni prima che vengano inseriti
  const here = pin ?? position;
  const previous = here
    ? data.observations.filter((o) => o.status !== "flagged" && o.cell === cellOf(here[0], here[1]) && (o.theme_id ?? "") === form.theme_id).length
    : 0;
  const worth = Math.round(BASE[form.kind] * novelty(previous) * 10) / 10;
  const hereArea = here ? areaAt(here[0], here[1], data.areas) : null;
  const areaClosed = hereArea ? !areaOpen(hereArea, now) : false;

  const startNew = () => { setPin(position); setPicking(true); setError(null); };
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin) return;
    run(async () => {
      await addObservation(data, me, {
        kind: form.kind, title: form.title.trim(), note: form.note.trim(), theme_id: form.theme_id || null,
        feeling: form.kind === "feel" ? form.feeling || null : null,
        source_url: form.kind === "desk" ? form.source_url.trim() || null : null,
        lng: pin[0], lat: pin[1], file,
      });
      await refresh();
      setToast(previous === 0 ? `Zona nuova! +${worth} pt appena un altro team conferma.` : `Rilievo salvato: +${worth} pt alla conferma di un altro team.`);
      setPanel(null); setPin(null); setFile(null);
      setForm({ ...form, title: "", note: "", feeling: "", source_url: "" });
    });
  };
  const validate = (o: Observation, q: number, status: "validated" | "flagged" = "validated") =>
    run(async () => { await validateObservation(o.id, q, status); await refresh(); setToast(status === "validated" ? "Confermato: il punteggio di tutti è cresciuto." : "Segnalato alla regia."); });

  return (
    <main className="fixed inset-0 overflow-hidden bg-paper-2">
      <MapView
        className="absolute inset-0" center={[c.center_lng, c.center_lat]} zoom={c.zoom} areas={data.areas} observations={data.observations} grid fit controls={false} {...backdrop(c)}
        pin={picking || panel === "new" ? pin : null}
        players={position ? [{ id: "me", name: "Tu", color: myTeam?.color ?? "#0b0b0c", lng: position[0], lat: position[1], online: true }] : []}
        onClick={picking ? (p) => setPin(p) : undefined}
        onObservationClick={(oid) => { const o = data.observations.find((x) => x.id === oid); if (o) { setDetail(o); setPanel("detail"); } }}
      />

      {/* ------------------------------------------------------------ HUD */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-3 p-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:p-5">
        <Link href={staff ? `/studio/${id}` : "/studio"} className="glass pointer-events-auto flex min-w-0 items-center gap-2.5 rounded-full py-2 pr-4 pl-3">
          <Dot color={phase === "live" ? "var(--color-leaf)" : phase === "paused" ? "var(--color-sun)" : "var(--color-mute)"} live={phase === "live"} />
          <span className="min-w-0">
            <span className="block truncate text-sm leading-tight">{c.name}</span>
            <span className="label soft block !text-[9px]">{PHASE_LABEL[phase]}{phase === "live" ? ` · ${remaining(c.ends_at, now)}` : ""}</span>
          </span>
        </Link>
        <div className="hidden flex-col items-center gap-1 pt-2 sm:flex">
          <span className="ruler h-2.5 w-48 text-ink/60" />
          <span className="label rounded-full bg-paper/70 px-2 py-0.5 backdrop-blur">Copertura {Math.round(ind.coverage * 100)}%</span>
        </div>
        <button onClick={() => setPanel("missions")} className="glass pointer-events-auto flex items-center gap-2 rounded-full py-2 pr-4 pl-3">
          <span className="size-2 rounded-full bg-glow" />
          <span className="num text-sm">{ind.score.toLocaleString("it-IT")}</span>
          <span className="label soft whitespace-nowrap">pt<span className="hidden sm:inline"> insieme</span></span>
        </button>
      </div>

      <div className="pointer-events-none absolute inset-x-0 top-20 z-20 flex flex-col items-center gap-2 px-4">
        {!canCollect && (
          <div className="glass-ink pointer-events-auto rounded-full px-4 py-2 text-sm">
            {me.status === "suspended" ? "La regia ha sospeso il tuo profilo." : phase === "paused" ? "Raccolta in pausa: aspetta il via della regia." : phase === "upcoming" ? `Si parte tra ${remaining(c.starts_at, now)}.` : phase === "draft" ? "La campagna non è ancora partita." : "La campagna è conclusa. Grazie!"}
          </div>
        )}
        {showNotice && (
          <button onClick={() => setSeenNotice(notice.id)} className="glass pointer-events-auto max-w-md animate-rise rounded-3xl px-4 py-3 text-left">
            <span className="label soft">Dalla regia · {ago(notice.created_at, now)}</span>
            <span className="mt-0.5 block text-sm">{notice.body}</span>
          </button>
        )}
        {toast && <div className="glass-ink pointer-events-auto animate-rise rounded-full px-4 py-2 text-sm" role="status">{toast}</div>}
      </div>

      {/* ----------------------------------------------------------- dock */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex justify-center px-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="glass pointer-events-auto flex max-w-full items-center gap-1.5 rounded-full p-1.5">
          {picking ? (
            <>
              <span className="hidden px-3 text-sm sm:inline">{pin ? "Sposta il punto toccando la mappa" : "Tocca la mappa dove hai osservato"}</span>
              {position && <Button size="sm" variant="ghost" onClick={() => setPin(position)}>Dove sono</Button>}
              <Button size="sm" variant="ghost" onClick={() => { setPicking(false); setPin(null); }}>Annulla</Button>
              <Button variant="glow" disabled={!pin} onClick={() => { setPicking(false); setPanel("new"); }}>Conferma<span className="hidden sm:inline"> il punto</span></Button>
            </>
          ) : (
            <>
              <Button className="sm:min-w-40" disabled={!canCollect} onClick={startNew}><PlusIcon /> Nuovo rilievo</Button>
              <Button variant="ghost" onClick={() => setPanel("validate")} className="!px-3.5">
                Valida{toValidate.length > 0 && <span className="num rounded-full bg-ink px-1.5 py-0.5 text-[10px] text-paper">{toValidate.length}</span>}
              </Button>
              <Button variant="ghost" onClick={() => setPanel("missions")} className="!hidden !px-3.5 sm:!inline-flex">Missioni</Button>
              <IconButton label={myTeam ? `Team ${myTeam.name}` : "Il mio team"} onClick={() => setPanel("team")} className="!shadow-none" style={{ background: myTeam?.color, color: myTeam ? "#fff" : undefined }}>
                <span className="text-[13px] font-medium">{(myTeam?.name ?? "?").slice(0, 2).toUpperCase()}</span>
              </IconButton>
            </>
          )}
        </div>
      </div>

      {/* ------------------------------------------------- nuovo rilievo */}
      <Sheet open={openPanel === "new"} onClose={() => { setPanel(null); setPin(null); }} kicker="Nuovo rilievo" title="Cosa hai osservato?" wide>
        <form onSubmit={submit} className="space-y-5">
          <div>
            <div className="grid grid-cols-3 gap-2">
              {(["field", "desk", "feel"] as ObservationKind[]).map((k) => (
                <button key={k} type="button" onClick={() => setForm({ ...form, kind: k })} aria-pressed={form.kind === k}
                  className={cx("rounded-2xl border p-3 text-left transition", form.kind === k ? "text-white" : "hairline hover:bg-ink/5")}
                  style={form.kind === k ? { background: KIND_COLOR[k], borderColor: KIND_COLOR[k] } : undefined}>
                  <span className="block text-[17px] tracking-[-0.02em]">{KIND_LABEL[k]}</span>
                  <span className={cx("mt-0.5 block text-xs leading-tight", form.kind !== k && "soft")}>{KIND_HINT[k]}</span>
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label className="mb-2 block">Tema</Label>
            <div className="flex flex-wrap gap-1.5">
              {data.themes.map((t) => (
                <button key={t.id} type="button" onClick={() => setForm({ ...form, theme_id: form.theme_id === t.id ? "" : t.id })} aria-pressed={form.theme_id === t.id}
                  className={cx("h-9 rounded-full border px-3.5 text-sm transition", form.theme_id === t.id ? "text-white" : "hairline hover:bg-ink/5")}
                  style={form.theme_id === t.id ? { background: t.color, borderColor: t.color } : undefined}>
                  {t.name}
                </button>
              ))}
            </div>
          </div>
          <Field label="Titolo" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required maxLength={80} placeholder="Giardino condiviso di via Cuneo" />
          {form.kind === "feel" && (
            <div>
              <Label className="mb-2 block">Come si sta qui?</Label>
              <div className="flex flex-wrap gap-1.5">
                {FEELINGS.map((f) => (
                  <button key={f} type="button" onClick={() => setForm({ ...form, feeling: form.feeling === f ? "" : f })} aria-pressed={form.feeling === f}
                    className={cx("h-9 rounded-full border px-3.5 text-sm transition", form.feeling === f ? "border-feel bg-feel text-white" : "hairline hover:bg-ink/5")}>{f}</button>
                ))}
              </div>
            </div>
          )}
          {form.kind === "desk" && <Field label="Fonte (link)" type="url" value={form.source_url} onChange={(e) => setForm({ ...form, source_url: e.target.value })} placeholder="https://…" />}
          <Area label="Note" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} maxLength={600} placeholder="Che cosa rende utile questo rilievo per la ricerca?" />
          <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-dashed hairline p-3.5 transition hover:bg-ink/5">
            <span className="grid size-10 place-items-center rounded-full bg-paper-2"><PlusIcon /></span>
            <span className="min-w-0 flex-1 text-sm">{file ? <span className="block truncate">{file.name}</span> : <>Aggiungi una foto <span className="soft">· dalla fotocamera o dalla galleria</span></>}</span>
            <input type="file" accept="image/*" className="sr-only" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </label>

          <div className="rounded-2xl bg-paper-2 p-4">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-sm">{previous === 0 ? "Zona nuova per questo tema: vale pieno." : `Qui ci sono già ${previous} ${previous === 1 ? "rilievo" : "rilievi"} su questo tema: vale meno.`}</span>
              <span className="num text-lg whitespace-nowrap">+{worth} pt</span>
            </div>
            <p className="soft mt-1 text-xs">I punti arrivano a tutti quando un altro team conferma il rilievo.{hereArea ? ` Area: ${hereArea.name}.` : " Fuori dalle aree definite."}</p>
          </div>
          {areaClosed && <Notice>Quest&apos;area è chiusa in questo momento: il rilievo viene salvato comunque e la regia lo vedrà.</Notice>}
          {actionError && <Notice tone="error">{actionError}</Notice>}
          <div className="flex gap-2">
            <Button variant="outline" size="lg" onClick={() => { setPanel(null); setPicking(true); }}>Sposta il punto</Button>
            <Button type="submit" size="lg" className="flex-1" disabled={busy || !pin}>{busy ? "Salvo…" : "Salva il rilievo"}</Button>
          </div>
        </form>
      </Sheet>

      {/* ------------------------------------------------------- valida */}
      <Sheet open={openPanel === "validate"} onClose={() => setPanel(null)} kicker="Validazione tra team" title="Conferma i rilievi degli altri" wide>
        {actionError && <div className="mb-3"><Notice tone="error">{actionError}</Notice></div>}
        {toValidate.length === 0 ? (
          <Empty title="Tutto confermato.">Quando un altro team inserisce un rilievo, lo trovi qui. Confermarlo fa crescere il punteggio di tutti.</Empty>
        ) : (
          <ul className="space-y-3">
            {toValidate.slice(0, 30).map((o) => {
              const img = mediaUrl(o.media_path), team = teamOf(data, o.team_id), th = themeOf(data, o.theme_id);
              return (
                <li key={o.id} className="surface rounded-card border hairline p-4">
                  <div className="flex gap-3">
                    {img && /* eslint-disable-next-line @next/next/no-img-element */ <img src={img} alt="" className="size-16 shrink-0 rounded-xl object-cover" loading="lazy" />}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap gap-1.5"><KindTag o={o} />{th && <Tag color={th.color}>{th.name}</Tag>}</div>
                      <h4 className="mt-1.5 text-[17px] tracking-[-0.02em]">{o.title}</h4>
                      {(o.note || o.feeling) && <p className="soft text-sm">{o.feeling ? `«${o.feeling}» ` : ""}{o.note}</p>}
                      <p className="label soft mt-1.5 inline-flex items-center gap-1.5">{team && <Dot color={team.color} />}{team?.name ?? nameOf(data, o.author_id)} · {ago(o.created_at, now)}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-1.5">
                    <Label className="mr-1">Qualità</Label>
                    {[[1, "Bassa"], [2, "Media"], [3, "Alta"]].map(([q, l]) => <Button key={q} size="sm" variant="outline" disabled={busy} onClick={() => validate(o, q as number)}>{l}</Button>)}
                    <Button size="sm" variant="ghost" className="ml-auto" disabled={busy} onClick={() => validate(o, 1, "flagged")}>Non pertinente</Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Sheet>

      {/* ----------------------------------------------------- missioni */}
      <Sheet open={openPanel === "missions"} onClose={() => setPanel(null)} kicker="Si vince insieme" title="Il punto della campagna" wide>
        <div className="on-ink rounded-card p-5">
          <div className="flex items-baseline gap-2">
            <span className="display num text-[52px] leading-none text-glow">{ind.score.toLocaleString("it-IT")}</span>
            <span className="label soft">pt di tutti · +{ind.potential} in attesa</span>
          </div>
          <div className="mt-5 grid grid-cols-4 gap-2 text-center">
            {([["Copertura", ind.coverage, "var(--color-glow)"], ["Equilibrio", ind.balance, "#7fb0ff"], ["Affidabilità", ind.reliability, "#ff9cc2"], ["Scambio", ind.exchange, "#f5c75a"]] as const).map(([l, v, col]) => (
              <div key={l}><Ring value={v} color={col} size={56} /><div className="label soft mt-1.5 !text-[9px]">{l}</div></div>
            ))}
          </div>
        </div>
        {myTeam && (
          <p className="soft mt-4 text-sm">
            <Dot color={myTeam.color} className="mr-1.5" />
            {myTeam.name} ha portato <b className="num font-medium text-ink">{Math.round(ind.byTeam[myTeam.id] ?? 0)} pt</b> al totale comune.
          </p>
        )}
        <Label className="mt-6 mb-3 block">Missioni</Label>
        {missions.length === 0 ? <p className="soft text-sm">Nessuna missione attiva in questo momento.</p> : (
          <ul className="space-y-4">
            {missions.map(({ mission, current, ratio, state }) => (
              <li key={mission.id}>
                <div className="flex items-baseline justify-between gap-3"><span>{mission.title}</span><span className="num soft text-sm">{current}/{mission.target}</span></div>
                {mission.description && <p className="soft text-sm">{mission.description}</p>}
                <Meter value={ratio} className="mt-2" color={state === "done" ? "var(--color-glow)" : undefined} />
                <span className="label soft mt-1.5 block">{MISSION_KIND[mission.kind].label} · {state === "done" ? "raggiunta da tutti" : `ancora ${remaining(mission.ends_at, now)}`}</span>
              </li>
            ))}
          </ul>
        )}
      </Sheet>

      {/* --------------------------------------------------------- team */}
      <Sheet open={openPanel === "team"} onClose={() => setPanel(needsTeam ? "team" : null)} kicker={needsTeam ? "Prima di partire" : "Il tuo posto nella campagna"} title="Con chi esplori?">
        {data.teams.length === 0 ? <p className="soft text-sm">La regia non ha ancora creato i team.</p> : (
          <div className="space-y-2">
            {data.teams.map((t) => (
              <button key={t.id} disabled={busy} onClick={() => run(async () => { await chooseTeam(id, t.id, role ?? me.field_role); await refresh(); setPanel(null); })}
                className={cx("flex w-full items-center gap-3 rounded-2xl border p-4 text-left transition hover:bg-ink/5", me.team_id === t.id ? "border-ink" : "hairline")}>
                <span className="size-4 rounded-full" style={{ background: t.color }} />
                <span className="flex-1 text-[17px] tracking-[-0.02em]">{t.name}</span>
                <span className="soft text-sm">{data.members.filter((m) => m.team_id === t.id).length} persone</span>
              </button>
            ))}
          </div>
        )}
        <Label className="mt-6 mb-2 block">Il tuo ruolo sul campo</Label>
        <div className="grid grid-cols-2 gap-2">
          {FIELD_ROLES.map((r) => {
            const active = (role ?? me.field_role) === r.id;
            return (
              <button key={r.id} onClick={() => { setRole(r.id); if (me.team_id) run(async () => { await chooseTeam(id, me.team_id, r.id); await refresh(); }); }}
                className={cx("rounded-2xl border p-3 text-left transition", active ? "border-ink bg-ink text-paper" : "hairline hover:bg-ink/5")}>
                <span className="block text-[15px]">{r.label}</span>
                <span className={cx("block text-xs leading-tight", !active && "soft")}>{r.hint}</span>
              </button>
            );
          })}
        </div>
        {actionError && <div className="mt-3"><Notice tone="error">{actionError}</Notice></div>}
      </Sheet>

      {/* ----------------------------------------------------- dettaglio */}
      <Sheet open={openPanel === "detail" && !!detail} onClose={() => setPanel(null)} kicker={detail ? `${nameOf(data, detail.author_id)} · ${ago(detail.created_at, now)}` : ""} title={detail?.title ?? ""}>
        {detail && (
          <div className="space-y-3">
            {mediaUrl(detail.media_path) && /* eslint-disable-next-line @next/next/no-img-element */ <img src={mediaUrl(detail.media_path)!} alt="" className="max-h-72 w-full rounded-2xl object-cover" />}
            <div className="flex flex-wrap gap-1.5">
              <KindTag o={detail} />
              {themeOf(data, detail.theme_id) && <Tag color={themeOf(data, detail.theme_id)!.color}>{themeOf(data, detail.theme_id)!.name}</Tag>}
              <Tag>{detail.status === "validated" ? `validato · qualità ${["", "bassa", "media", "alta"][detail.quality ?? 2]}` : detail.status === "pending" ? "in attesa di conferma" : "segnalato"}</Tag>
            </div>
            {detail.feeling && <p className="serif text-2xl italic">«{detail.feeling}»</p>}
            {detail.note && <p className="text-[15px]">{detail.note}</p>}
            {detail.source_url && <a className="text-sm underline underline-offset-2" href={detail.source_url} target="_blank" rel="noreferrer">Apri la fonte</a>}
          </div>
        )}
      </Sheet>
    </main>
  );
}
