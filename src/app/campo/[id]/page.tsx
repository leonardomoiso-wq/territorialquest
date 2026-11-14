"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { areaAt, cellOf } from "@/domain/geo";
import { BASE, indicators, MISSION_KIND, missionProgress, novelty } from "@/domain/scoring";
import { ago, areaOpen, phaseOf, PHASE_LABEL, remaining } from "@/domain/time";
import { Details, emptyEntry, FormPicker, FormTag, type Entry } from "@/campo/Collect";
import { formOf, kindOf, lensLabel, pathLength, summary, type Form } from "@/domain/forms";
import { FIELD_ROLES, type FieldRole, type Observation } from "@/domain/types";
import { addObservation, chooseTeam, heartbeat, mediaUrl, useCampaign, useSession, validateObservation } from "@/lib/data";
import { useAction, useNow } from "@/lib/hooks";
import { backdrop, KindTag, nameOf, teamOf, themeOf } from "@/studio/shared";
import MapView from "@/ui/MapView";
import { Button, cx, Dot, Empty, IconButton, Label, LinkButton, Meter, Notice, PlusIcon, Ring, Sheet, Spinner, Tag } from "@/ui/kit";

type Panel = null | "form" | "new" | "validate" | "missions" | "team" | "detail";

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
  const [entry, setEntry] = useState<Entry>(() => emptyEntry("immagine"));
  const [path, setPath] = useState<[number, number][]>([]);
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
  const tracing = entry.form === "flusso";
  const here = tracing ? path[0] ?? null : pin ?? position;
  const kind = kindOf(entry.form, entry.data.onSite !== false);
  const previous = here
    ? data.observations.filter((o) => o.status !== "flagged" && o.cell === cellOf(here[0], here[1]) && (o.theme_id ?? "") === entry.theme_id).length
    : 0;
  const worth = Math.round(BASE[kind] * novelty(previous) * 10) / 10;
  const hereArea = here ? areaAt(here[0], here[1], data.areas) : null;
  const areaClosed = hereArea ? !areaOpen(hereArea, now) : false;
  const placeNote = `${tracing && path.length > 1 ? `Tracciato di ${pathLength(path)} m. ` : ""}${hereArea ? `Area: ${hereArea.name}.` : "Fuori dalle aree definite."}`;

  const pick = (f: Form) => {
    setEntry(emptyEntry(f, entry));
    setPath([]);
    setPin(f === "flusso" ? null : position);
    setPanel(null);
    setPicking(true);
    setError(null);
  };
  const cancel = () => { setPicking(false); setPanel(null); setPin(null); setPath([]); };
  const submit = () => {
    if (!here) return;
    run(async () => {
      const { file, form, lens, title, note, theme_id, feeling, source_url, data: extra } = entry;
      await addObservation(data, me, {
        kind, form, lens, title: title.trim(), note: note.trim(), theme_id: theme_id || null,
        feeling: form === "percezione" ? feeling || null : null,
        source_url: extra.onSite === false ? source_url.trim() || null : null,
        path: tracing ? path : null, data: extra as Record<string, unknown>,
        lng: here[0], lat: here[1], file,
      });
      await refresh();
      setToast(previous === 0 ? `Zona nuova! +${worth} pt appena un altro team conferma.` : `Rilievo salvato: +${worth} pt alla conferma di un altro team.`);
      cancel();
    });
  };
  const validate = (o: Observation, q: number, status: "validated" | "flagged" = "validated") =>
    run(async () => { await validateObservation(o.id, q, status); await refresh(); setToast(status === "validated" ? "Confermato: il punteggio di tutti è cresciuto." : "Segnalato alla regia."); });

  return (
    <main className="fixed inset-0 overflow-hidden bg-paper-2">
      <MapView
        className="absolute inset-0" center={[c.center_lng, c.center_lat]} zoom={c.zoom} areas={data.areas} observations={data.observations} grid fit controls={false} {...backdrop(c)}
        pin={(picking || panel === "new") && !tracing ? pin : null}
        draft={(picking || panel === "new") && tracing ? path : undefined} draftLine
        players={position ? [{ id: "me", name: "Tu", color: myTeam?.color ?? "#0b0b0c", lng: position[0], lat: position[1], online: true }] : []}
        onClick={picking ? (p) => (tracing ? setPath((ps) => [...ps, p]) : setPin(p)) : undefined}
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
            tracing ? (
              <>
                <span className="px-3 text-sm">{path.length < 2 ? "Tocca la mappa lungo il percorso" : `${pathLength(path)} m`}</span>
                <Button size="sm" variant="ghost" onClick={() => setPath(path.slice(0, -1))} disabled={!path.length}>Indietro</Button>
                <Button size="sm" variant="ghost" onClick={cancel}>Annulla</Button>
                <Button variant="glow" disabled={path.length < 2} onClick={() => { setPicking(false); setPanel("new"); }}>Conferma</Button>
              </>
            ) : (
              <>
                <span className="hidden px-3 text-sm sm:inline">{pin ? "Sposta il punto toccando la mappa" : "Tocca la mappa dove hai osservato"}</span>
                {position && <Button size="sm" variant="ghost" onClick={() => setPin(position)}>Dove sono</Button>}
                <Button size="sm" variant="ghost" onClick={cancel}>Annulla</Button>
                <Button variant="glow" disabled={!pin} onClick={() => { setPicking(false); setPanel("new"); }}>Conferma<span className="hidden sm:inline"> il punto</span></Button>
              </>
            )
          ) : (
            <>
              <Button className="sm:min-w-40" disabled={!canCollect} onClick={() => { setError(null); setPanel("form"); }}><PlusIcon /> Nuovo rilievo</Button>
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
      <FormPicker open={openPanel === "form"} onClose={() => setPanel(null)} onPick={pick} />
      <Details
        open={openPanel === "new"} entry={entry} setEntry={setEntry} themes={data.themes} worth={worth} previous={previous}
        placeNote={placeNote} areaClosed={areaClosed} busy={busy} error={actionError}
        onClose={cancel} onMove={() => { setPanel(null); setPicking(true); }} onSubmit={submit}
      />

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
                      <div className="flex flex-wrap gap-1.5"><FormTag form={o.form} /><KindTag o={o} />{th && <Tag color={th.color}>{th.name}</Tag>}</div>
                      <h4 className="mt-1.5 text-[17px] tracking-[-0.02em]">{o.title}</h4>
                      {summary(o) && <p className="text-sm" style={{ color: formOf(o.form).color }}>{summary(o)}</p>}
                      {o.note && <p className="soft text-sm">{o.note}</p>}
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
              <FormTag form={detail.form} />
              <KindTag o={detail} />
              {lensLabel(detail.lens) && <Tag>{lensLabel(detail.lens)}</Tag>}
              {themeOf(data, detail.theme_id) && <Tag color={themeOf(data, detail.theme_id)!.color}>{themeOf(data, detail.theme_id)!.name}</Tag>}
              <Tag>{detail.status === "validated" ? `validato · qualità ${["", "bassa", "media", "alta"][detail.quality ?? 2]}` : detail.status === "pending" ? "in attesa di conferma" : "segnalato"}</Tag>
            </div>
            {detail.form === "percezione" && detail.feeling
              ? <p className="serif text-2xl italic">«{detail.feeling}»</p>
              : summary(detail) && <p className="display text-2xl" style={{ color: formOf(detail.form).color }}>{summary(detail)}</p>}
            {detail.form === "percezione" && summary(detail) && <p className="soft text-sm">{summary(detail)}</p>}
            {detail.note && <p className="text-[15px]">{detail.note}</p>}
            {detail.source_url && <a className="text-sm underline underline-offset-2" href={detail.source_url} target="_blank" rel="noreferrer">Apri la fonte</a>}
          </div>
        )}
      </Sheet>
    </main>
  );
}
