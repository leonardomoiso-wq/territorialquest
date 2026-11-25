"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Details, emptyEntry, FormPicker, FormTag, type Entry } from "@/campo/Collect";
import { Celebration, Recap, type Cheer, type WalkSummary } from "@/campo/Moments";
import Story from "@/campo/Story";
import Survey, { SurveyAnswers, type SurveyResult } from "@/campo/Survey";
import { useWalk, vibrate } from "@/campo/useWalk";
import { QUALITY_LABEL, skyAt, useAutoQuality, useHeading, useReducedMotion, useViewPrefs, useWakeLock, type Quality } from "@/campo/explore";
import { formOf, kindOf, lensLabel, pathLength, summary, type Form } from "@/domain/forms";
import { categoryColors, figuresFor, formatValue, pointsOf } from "@/domain/datasets";
import { areaAt, cellOf, toRes } from "@/domain/geo";
import { BASE, indicators, MISSION_KIND, missionProgress, novelty, scoreObservations } from "@/domain/scoring";
import { ago, areaOpen, isOnline, phaseOf, PHASE_LABEL, remaining } from "@/domain/time";
import { categoryOf, FIELD_ROLES, type FieldRole, type Observation, type Place } from "@/domain/types";
import { bearing, formatDuration, formatMeters, metersBetween, nearestDark, windOf } from "@/domain/walk";
import { routeLength, routeMinutes } from "@/studio/Luoghi";
import { Spark } from "@/ui/charts";
import { Community, ContributeSheet, contributionsFor, type Target } from "@/ui/Contribute";
import { LayersIcon, LayersPanel, PointSheet, useLayers, type PointRef } from "@/ui/Layers";
import { addObservation, checkIn, uploadMedia, chooseTeam, heartbeat, mediaUrl, useCampaign, useSession, validateObservation } from "@/lib/data";
import { addDraft, listDrafts, removeDraft, type Draft } from "@/lib/drafts";
import { useAction, useNow } from "@/lib/hooks";
import { backdrop, KindTag, nameOf, teamOf, themeOf } from "@/studio/shared";
import MapView from "@/ui/MapView";
import { Button, cx, Dot, Empty, IconButton, Label, LinkButton, Meter, Notice, PlusIcon, Ring, Segmented, Sheet, Spinner, Tag } from "@/ui/kit";

type Panel = null | "form" | "new" | "validate" | "missions" | "team" | "detail" | "drafts" | "place" | "routes" | "survey" | "near" | "layers" | "view";
type LngLat = [number, number];

const NEAR = 80; // metri: «sei sul posto»

const Icon = ({ d, className }: { d: string; className?: string }) => (
  <svg viewBox="0 0 24 24" className={cx("size-5", className)} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={d} /></svg>
);
const ICON = {
  camera: "M4 8h3l1.500-2h7L17 8h3v11H4zM12 16.500a3.500 3.500 0 1 0 0-7 3.500 3.500 0 0 0 0 7z",
  check: "M5 12.500 10 17.500 19 7",
  tray: "M4 13l2.500-7h11L20 13v5H4zM4 13h5l1 2h4l1-2h5",
  near: "M12 21s-6.500-5.600-6.500-11A6.500 6.500 0 0 1 18.500 10c0 5.400-6.500 11-6.500 11zM12 12.500a2.500 2.500 0 1 0 0-5 2.500 2.500 0 0 0 0 5z",
  walk: "M13 4.500a1.500 1.500 0 1 0 0-.010M9 21l2-6-2.500-2.500L10 8l3 1 2 3h3M11 15l3 2 1 4",
  target: "M12 3v3M12 18v3M3 12h3M18 12h3M12 15.500a3.500 3.500 0 1 0 0-7 3.500 3.500 0 0 0 0 7z",
  route: "M6 19a2 2 0 1 0 0-.010M18 7a2 2 0 1 0 0-.010M6 17V11a4 4 0 0 1 4-4h6",
  view: "M3 17 12 21l9-4M3 12l9 4 9-4M12 3 3 7.500l9 4 9-4z",
  help: "M9.500 9a2.500 2.500 0 1 1 3.500 2.300c-.700.300-1 .900-1 1.700M12 17v.010",
};

/** Pulsante tondo con etichetta sotto, per le colonne ai lati della vista esplora. */
function SideButton({ label, d, count, onClick, children }: { label: string; d?: string; count?: number; onClick: () => void; children?: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-label={`${label}${count ? `: ${count}` : ""}`}
      className="pointer-events-auto flex w-14 flex-col items-center gap-1 transition active:scale-95">
      <span className="glass relative grid size-12 place-items-center rounded-full">
        {children ?? (d && <Icon d={d} />)}
        {!!count && <span className="num absolute -top-0.5 -right-0.5 min-w-5 rounded-full bg-ink px-1 text-center text-[11px] leading-5 text-paper">{count}</span>}
      </span>
      <span className="label rounded-full bg-paper/80 px-1.5 !text-[9px] leading-4 backdrop-blur">{label}</span>
    </button>
  );
}

/** Pulsante a icona con contatore, per il dock in cammino. */
function Counter({ label, d, count, onClick }: { label: string; d: string; count: number; onClick: () => void }) {
  return (
    <button type="button" aria-label={`${label}${count ? `: ${count}` : ""}`} title={label} onClick={onClick}
      className="relative grid size-10 shrink-0 place-items-center rounded-full transition hover:bg-ink/6 active:scale-95">
      <Icon d={d} />
      {count > 0 && <span className="num absolute -top-0.5 -right-0.5 min-w-4 rounded-full bg-ink px-1 text-center text-[10px] leading-4 text-paper">{count}</span>}
    </button>
  );
}

export default function Campo() {
  const { id } = useParams<{ id: string }>();
  const { user } = useSession();
  const { data, error, refresh, loading } = useCampaign(id);
  const now = useNow(20000);
  const { busy, error: actionError, run, setError } = useAction();

  const [panel, setPanel] = useState<Panel>(null);
  const [picking, setPicking] = useState(false);
  const [pin, setPin] = useState<LngLat | null>(null);
  const [position, setPosition] = useState<LngLat | null>(null);
  const [follow, setFollow] = useState(true);
  const [detail, setDetail] = useState<Observation | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [cheer, setCheer] = useState<Cheer | null>(null);
  const [recap, setRecap] = useState<WalkSummary | null>(null);
  const [seenNotice, setSeenNotice] = useState<string | null>(null);
  const [entry, setEntry] = useState<Entry>(() => emptyEntry("immagine"));
  const [path, setPath] = useState<LngLat[]>([]);
  const [role, setRole] = useState<FieldRole | null>(null);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [placeId, setPlaceId] = useState<string | null>(null);
  /** Luogo presso cui si sta raccogliendo il rilievo. */
  const [atPlace, setAtPlace] = useState<string | null>(null);
  const [routeId, setRouteId] = useState<string | null>(() => (typeof window !== "undefined" ? window.localStorage.getItem(`tq-route-${id}`) : null));
  const checking = useRef(new Set<string>());
  const [story, setStory] = useState(() => typeof window !== "undefined" && !window.localStorage.getItem(`tq-story-${id}`));
  const lastBeat = useRef(0);

  const me = data?.members.find((m) => m.user_id === user?.id);
  const layerState = useLayers(data?.datasets ?? []);
  const [point, setPoint] = useState<PointRef | null>(null);
  const [contribTarget, setContribTarget] = useState<Target | null>(null);
  const ind = useMemo(() => (data ? indicators(data) : null), [data]);
  /** Celle già accese da qualcuno: attraversate oppure osservate. */
  const lit = useMemo(() => {
    const s = new Set<string>(ind?.walkedCells ?? []);
    for (const cell of ind?.coveredCells.keys() ?? []) s.add(cell);
    return s;
  }, [ind]);

  const celebrate = useCallback((big: string, small: string, color?: string, stamp?: boolean) => setCheer({ id: Date.now(), big, small, color, stamp }), []);
  /** Ritaglio che vola nello stemma della squadra dopo una raccolta. */
  const [fly, setFly] = useState<{ id: number; color: string } | null>(null);
  const toss = useCallback((color: string) => setFly({ id: Date.now(), color }), []);
  useEffect(() => { if (!fly) return; const t = setTimeout(() => setFly(null), 1500); return () => clearTimeout(t); }, [fly]);
  const view = useViewPrefs();
  const reducedMotion = useReducedMotion();
  const [compassOn, setCompassOn] = useState(false);
  const lastSpeedWarn = useRef(0);
  const onLit = useCallback(() => celebrate("Accesa", "Zona nuova: nessuno era ancora passato di qui."), [celebrate]);
  const { walk, start, stop, track } = useWalk(id, user?.id, me?.team_id ?? null, lit, onLit);
  const exploring = !!walk && view.explore;
  const slow = useAutoQuality(exploring && view.quality === "auto");
  const compass = useHeading(exploring && compassOn);
  useWakeLock(!!walk);
  const walkingRef = useRef(false);
  useEffect(() => { walkingRef.current = !!walk; }, [walk]);
  const trackRef = useRef(track);
  useEffect(() => { trackRef.current = track; }, [track]);

  // posizione e presenza: il master vede chi è sul campo
  useEffect(() => {
    if (!me) return;
    const beat = (p?: LngLat) => { lastBeat.current = Date.now(); heartbeat(id, p?.[0], p?.[1]); };
    beat();
    const watch = navigator.geolocation?.watchPosition(
      (g) => {
        const p: LngLat = [g.coords.longitude, g.coords.latitude];
        setPosition(p);
        trackRef.current(p, g.coords.accuracy ?? 0);
        // oltre i 10 km/h si guarda la strada, non il telefono
        if (walkingRef.current && (g.coords.speed ?? 0) > 2.8 && Date.now() - lastSpeedWarn.current > 300000) {
          lastSpeedWarn.current = Date.now();
          setToast("Vai veloce: guarda la strada, la mappa ti aspetta.");
        }
        if (Date.now() - lastBeat.current > 45000) beat(p);
      },
      () => undefined,
      { enableHighAccuracy: true, maximumAge: 5000 },
    );
    const t = setInterval(() => beat(), 60000);
    return () => { clearInterval(t); if (watch != null) navigator.geolocation.clearWatch(watch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, me?.id]);

  useEffect(() => { listDrafts(id).then(setDrafts); }, [id]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(t);
  }, [toast]);

  /** Luoghi già raggiunti dal mio team (o da me, se sono senza team). */
  const reached = useMemo(() => new Set((data?.visits ?? []).filter((v) => (me?.team_id ? v.team_id === me.team_id : v.user_id === me?.user_id)).map((v) => v.place_id)), [data?.visits, me?.team_id, me?.user_id]);

  // camminando, entrare nel raggio di un luogo registra l'arrivo da solo
  useEffect(() => {
    if (!walk || !position || !data || !me) return;
    const pl = data.places.find((x) => !reached.has(x.id) && !checking.current.has(x.id) && metersBetween(position, [x.lng, x.lat]) <= x.radius_m);
    if (!pl) return;
    checking.current.add(pl.id);
    checkIn(pl.id, position[0], position[1]).then(
      async (r) => {
        await refresh();
        vibrate([30, 50, 30, 50, 60]);
        celebrate(r.first_for_team ? `+${Math.round(pl.points / 2)}` : "Arrivato", `${pl.name}${pl.prompt ? `: ${pl.prompt}` : ". Raccogli qui un rilievo per completarlo."}`, categoryOf(pl.category).color, true);
        setPlaceId(pl.id);
      },
      () => checking.current.delete(pl.id),
    );
  }, [walk, position, data, me, reached, refresh, celebrate]);

  const walked = useMemo(() => [...(ind?.walkedCells ?? []), ...(walk?.cells ?? [])], [ind, walk]);
  const endCheer = useCallback(() => setCheer(null), []);

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
  const openPanel: Panel = story ? null : needsTeam && panel === null ? "team" : panel;
  const walking = !!walk;

  const distance = (o: Observation) => (position ? metersBetween(position, [o.lng, o.lat]) : Infinity);
  const toValidate = data.observations
    .filter((o) => o.status === "pending" && o.author_id !== me.user_id && (staff || !o.team_id || o.team_id !== me.team_id))
    .sort((a, b) => distance(a) - distance(b));
  const nearby = toValidate.filter((o) => distance(o) <= NEAR);
  const missions = data.missions.map((m) => missionProgress(m, data, now)).filter((p) => p.state !== "expired" && p.state !== "upcoming");
  const notice = data.announcements.find((a) => !a.team_id || a.team_id === me.team_id);
  const showNotice = notice && notice.id !== seenNotice && now.getTime() - new Date(notice.created_at).getTime() < 6 * 3600000;

  // la prossima zona spenta dà una direzione a chi cammina
  // accese alla risoluzione della griglia (su territori vasti le celle sono più grandi)
  const litNow = new Set([...lit, ...(walk?.cells ?? [])].map((c) => toRes(c, ind.resolution)));
  const activeRoute = data.routes.find((r) => r.id === routeId) ?? null;
  const stops = (activeRoute?.stops ?? []).map((sid) => data.places.find((p) => p.id === sid)).filter((p): p is Place => !!p);
  const nextStop = stops.find((p) => !reached.has(p.id)) ?? null;
  const stopTarget = nextStop && position ? { meters: metersBetween(position, [nextStop.lng, nextStop.lat]), bearing: bearing(position, [nextStop.lng, nextStop.lat]) } : null;
  const target = walking && position && !activeRoute ? nearestDark(position, ind.territory, litNow) : null;
  const currentPlace = data.places.find((p) => p.id === placeId) ?? null;

  /* ------------------------------------------------ vicino a te (raggio 300 m) */
  const AROUND = 300;
  const hereNow = position ? areaAt(position[0], position[1], data.areas) : null;
  const figures = hereNow ? figuresFor(data.datasets, hereNow.name) : [];
  const placesAround = position ? data.places.filter((p) => p.placed !== false).map((p) => ({ p, m: metersBetween(position, [p.lng, p.lat]) })).filter((x) => x.m <= AROUND).sort((a, b) => a.m - b.m) : [];
  const toValidateAround = toValidate.filter((o) => distance(o) <= AROUND);
  const layerAround = position ? layerState.layers.filter((d) => d.kind === "punti").flatMap((d) => { const colors = categoryColors(d); return pointsOf(d).map((x) => ({ ...x, datasetId: d.id, dataset: d.name, color: colors.get(x.category) ?? d.color, m: metersBetween(position, [x.lng, x.lat]) })); }).filter((x) => x.m <= AROUND).sort((a, b) => a.m - b.m) : [];
  const aroundCount = placesAround.length + toValidateAround.length;
  /** Luoghi completati dal mio team: arrivo e rilievo confermato. */
  const completed = [...ind.places.values()].filter((x) => [...x.detailed].some((k) => k === me.team_id || k === `persona:${me.user_id}`) && reached.has(x.place.id)).map((x) => x.place.id);
  /** Compagni di team con un segnale recente, visibili durante l'uscita. */
  const mates = walking && me.team_id ? data.members.filter((m) => m.team_id === me.team_id && m.user_id !== me.user_id && m.last_lng != null && m.last_lat != null && isOnline(m.last_seen_at, now)) : [];
  const placeDistance = (p: Place) => (position ? metersBetween(position, [p.lng, p.lat]) : null);
  const followRoute = (rid: string | null) => {
    setRouteId(rid);
    try { if (rid) localStorage.setItem(`tq-route-${id}`, rid); else localStorage.removeItem(`tq-route-${id}`); } catch { /* memoria non disponibile */ }
  };
  const arrive = (p: Place) => position && run(async () => {
    const r = await checkIn(p.id, position[0], position[1]);
    await refresh();
    vibrate([30, 50, 30, 50, 60]);
    celebrate(r.first_for_team ? `+${Math.round(p.points / 2)}` : "Arrivato", r.first_for_team ? `Hai raggiunto ${p.name}. L'altra metà arriva con un rilievo confermato.` : `${p.name}: il tuo team era già passato.`, categoryOf(p.category).color, true);
  });
  const sendSurvey = (p: Place, r: SurveyResult) => run(async () => {
    const answers = { ...r.answers };
    for (const [qid, file] of Object.entries(r.photos)) answers[qid] = await uploadMedia(c.id, file);
    const firstPhoto = (p.survey ?? []).find((q) => q.type === "foto" && typeof answers[q.id] === "string");
    await addObservation(data, me, {
      kind: "field", form: "indagine", lens: null, path: null, place_id: p.id, theme_id: null, feeling: null, source_url: null,
      title: `Indagine – ${p.name}`, note: r.note.trim(), data: { survey: p.survey ?? [], answers },
      lng: p.lng, lat: p.lat, file: null, media_path: firstPhoto ? (answers[firstPhoto.id] as string) : null,
    });
    await refresh();
    vibrate([20, 40, 20, 40, 60]);
    toss(categoryOf(p.category).color);
    celebrate("Indagine", `Inviata. Quando un altro team la conferma, ${p.name} vale altri ${Math.round(p.points / 2)} pt per tutti.`, categoryOf(p.category).color);
    setPanel(null);
  });
  const collectHere = (p: Place) => { setAtPlace(p.id); setPin([p.lng, p.lat]); setPanel("form"); setError(null); };

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

  /* -------------------------------------------------------- vista esplora */
  const rich = view.quality === "ricca" || (view.quality === "auto" && !slow);
  const motion = !reducedMotion && view.quality !== "essenziale";
  const litPct = ind.territory.size ? Math.round(([...ind.territory].filter((x) => litNow.has(x)).length / ind.territory.size) * 100) : 0;
  const nearestPlaces = position ? data.places.filter((p) => p.placed !== false && !reached.has(p.id)).map((p) => ({ p, m: metersBetween(position, [p.lng, p.lat]) })).sort((a, b) => a.m - b.m).slice(0, 3) : [];
  const toggleCompass = async () => {
    if (compassOn) { setCompassOn(false); return; }
    if (await compass.enable()) { setCompassOn(true); setFollow(true); }
    else setToast("Bussola non disponibile: ruota la mappa con due dita.");
  };

  const closeStory = () => { try { localStorage.setItem(`tq-story-${id}`, "1"); } catch { /* memoria non disponibile */ } setStory(false); };
  const pick = (f: Form) => {
    setEntry(emptyEntry(f, entry));
    setDraftId(null);
    setPath([]);
    setPin(f === "flusso" ? null : atPlace ? pin : position);
    setPanel(null);
    if (atPlace && f !== "flusso") { setPanel("new"); return; }
    setPicking(true);
    setFollow(false);
    setError(null);
  };
  const cancel = () => { setPicking(false); setPanel(null); setPin(null); setPath([]); setDraftId(null); setAtPlace(null); };
  const submit = () => {
    if (!here) return;
    run(async () => {
      const { file, form, lens, title, note, theme_id, feeling, source_url, data: extra } = entry;
      await addObservation(data, me, {
        kind, form, lens, title: title.trim(), note: note.trim(), theme_id: theme_id || null,
        feeling: form === "percezione" ? feeling || null : null,
        source_url: extra.onSite === false ? source_url.trim() || null : null,
        path: tracing ? path : null, data: extra as Record<string, unknown>, place_id: atPlace,
        lng: here[0], lat: here[1], file,
      });
      if (draftId) { await removeDraft(draftId); setDrafts((d) => d.filter((x) => x.id !== draftId)); }
      await refresh();
      vibrate([20, 40, 20]);
      toss(formOf(form).color);
      celebrate(`+${worth}`, previous === 0 ? "Zona nuova per questo tema. I punti arrivano a tutti alla prima conferma." : "Salvato. I punti arrivano a tutti quando un altro team conferma.", formOf(form).color);
      cancel();
    });
  };
  const validate = (o: Observation, q: number, status: "validated" | "flagged" = "validated") =>
    run(async () => {
      await validateObservation(o.id, q, status);
      await refresh();
      if (status === "validated") { vibrate([20, 40, 20]); celebrate("Confermato", "Il punteggio di tutti è cresciuto."); }
      else setToast("Segnalato alla regia.");
    });

  // scatto rapido: la foto si prende camminando, i dettagli dopo
  const snap = async (file: File | undefined) => {
    if (!file) return;
    const d = await addDraft(id, file, position ?? [c.center_lng, c.center_lat]);
    setDrafts((list) => [...list, d]);
    vibrate(30);
    toss("#4a6b43");
    setToast("Foto salvata. La completi quando ti fermi.");
  };
  const complete = (d: Draft) => {
    setEntry({ ...emptyEntry("immagine", entry), file: new File([d.blob], d.name, { type: d.blob.type || "image/jpeg" }) });
    setDraftId(d.id);
    setPin([d.lng, d.lat]);
    setPath([]);
    setPanel("new");
  };
  const discard = async (d: Draft) => { await removeDraft(d.id); setDrafts((list) => list.filter((x) => x.id !== d.id)); };

  const begin = () => { setFollow(true); start(); };
  const end = async () => {
    const w = await stop();
    if (!w) return;
    const mine = data.observations.filter((o) => o.author_id === me.user_id && o.created_at >= w.startedAt);
    const ids = new Set(mine.map((o) => o.id));
    const potential = scoreObservations(data.observations).filter((s) => ids.has(s.observation.id)).reduce((sum, s) => sum + s.potential + s.value, 0);
    setRecap({
      ms: Date.now() - new Date(w.startedAt).getTime(), meters: w.meters, cells: w.cells.length, fresh: w.fresh.length,
      observations: mine.length, potential: Math.round(potential), drafts: drafts.length,
      places: data.visits.filter((v) => v.user_id === me.user_id && v.created_at >= w.startedAt).length,
      confirms: data.observations.filter((o) => o.validated_by === me.user_id && (o.validated_at ?? "") >= w.startedAt).length,
    });
    refresh();
  };

  return (
    <main className="fixed inset-0 overflow-hidden bg-paper-2">
      <MapView
        className="absolute inset-0" center={[c.center_lng, c.center_lat]} zoom={c.zoom} areas={data.areas} observations={data.observations}
        grid fog fit controls={false} walked={walked} {...backdrop(c)}
        places={data.places} routes={data.routes} reached={reached} activeRouteId={routeId} selectedPlaceId={placeId}
        onPlaceClick={(pid) => { setPlaceId(pid); setPanel("place"); }}
        focus={walking && follow && !picking ? position : null} onDrag={() => setFollow(false)}
        pin={(picking || panel === "new") && !tracing ? pin : null}
        draft={(picking || panel === "new") && tracing ? path : undefined} draftLine
        players={[
          ...mates.map((m) => ({ id: m.id, name: m.profile?.display_name ?? "", color: myTeam?.color ?? "#4a6b43", lng: m.last_lng!, lat: m.last_lat!, online: true })),
          ...(position ? [{ id: "me", name: "Tu", color: myTeam?.color ?? "#2b2118", lng: position[0], lat: position[1], online: true }] : []),
        ]}
        reach={position && canCollect ? NEAR : null} completed={completed}
        explore={exploring ? { heading: compassOn ? compass.heading : 0, rich, motion, sky: rich ? skyAt(now) : undefined } : null}
        layers={layerState.layers}
        onLayerPointClick={(x) => setPoint({ datasetId: x.datasetId, index: x.index })}
        onClick={picking ? (p) => (tracing ? setPath((ps) => [...ps, p]) : setPin(p)) : undefined}
        onObservationClick={(oid) => { const o = data.observations.find((x) => x.id === oid); if (o) { setDetail(o); setPanel("detail"); } }}
      />

      {/* ------------------------------------------------------------ HUD */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-3 p-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:p-5">
        <Link href={staff ? `/studio/${id}` : "/studio"} className="glass pointer-events-auto flex min-w-0 items-center gap-2.5 rounded-full py-2 pr-4 pl-3">
          <Dot color={phase === "live" ? "var(--color-leaf)" : phase === "paused" ? "var(--color-sun)" : "var(--color-mute)"} live={phase === "live"} />
          <span className="min-w-0">
            <span className="block truncate text-sm leading-tight">{c.name}</span>
            <span className="label soft block !text-[9px]">{PHASE_LABEL[phase]}{phase === "live" ? ` – ${remaining(c.ends_at, now)}` : ""}</span>
          </span>
        </Link>
        <div className="hidden flex-col items-center gap-1 pt-2 md:flex">
          <span className="ruler h-2.5 w-48 text-ink/60" />
          <span className="label rounded-full bg-paper/70 px-2 py-0.5 backdrop-blur">Mappa accesa {ind.territory.size ? Math.round(([...ind.territory].filter((x) => litNow.has(x)).length / ind.territory.size) * 100) : 0}%</span>
        </div>
        <button onClick={() => setPanel("missions")} className="glass pointer-events-auto flex items-center gap-2 rounded-full py-2 pr-4 pl-3">
          <span className="size-2 rounded-full bg-glow" />
          <span className="num text-sm">{ind.score.toLocaleString("it-IT")}</span>
          <span className="label soft whitespace-nowrap">pt<span className="hidden sm:inline"> insieme</span></span>
        </button>
      </div>

      <div className="pointer-events-none absolute inset-x-0 top-[4.5rem] z-20 flex flex-col items-center gap-2 px-3 sm:top-24">
        {walking && (
          <div className="glass-ink pointer-events-auto flex items-center gap-3 rounded-full py-1.5 pr-1.5 pl-3 text-sm">
            <Dot color="var(--color-glow)" live />
            <span className="num">{formatDuration(now.getTime() - new Date(walk.startedAt).getTime())}</span>
            <span className="num">{formatMeters(walk.meters)}</span>
            <span><b className="num font-medium text-glow">{walk.fresh.length}</b> accese</span>
            <button type="button" onClick={end} className="rounded-full bg-paper px-3 py-1 text-[13px] font-medium text-ink transition active:scale-95">Rientra</button>
          </div>
        )}
        {walking && !picking && nearby.length > 0 && (
          <button onClick={() => setPanel("validate")} className="glass pointer-events-auto flex max-w-md animate-rise items-center gap-3 rounded-3xl px-4 py-2.5 text-left">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-ink text-paper"><Icon d={ICON.check} /></span>
            <span className="min-w-0"><span className="label soft block">Sei sul posto – conferma</span><span className="block truncate text-sm">{nearby[0].title}{nearby.length > 1 ? ` e altri ${nearby.length - 1}` : ""}</span></span>
          </button>
        )}
        {!picking && activeRoute && (
          <button onClick={() => { if (nextStop) { setPlaceId(nextStop.id); setPanel("place"); } else setPanel("routes"); }}
            className="glass pointer-events-auto flex max-w-[calc(100vw-1.5rem)] items-center gap-3 rounded-full py-2 pr-4 pl-2.5 text-left text-sm">
            <span className="grid size-8 shrink-0 place-items-center rounded-full text-white" style={{ background: activeRoute.color, transform: stopTarget ? `rotate(${stopTarget.bearing}deg)` : undefined }} aria-hidden>
              {nextStop ? <svg viewBox="0 0 16 16" className="size-4"><path d="M8 2 13 13 8 10.500 3 13z" fill="currentColor" /></svg> : <Icon d={ICON.check} className="!size-4" />}
            </span>
            <span className="min-w-0 truncate">
              {nextStop
                ? <>Tappa {stops.indexOf(nextStop) + 1}/{stops.length} – <b className="font-medium">{nextStop.name}</b>{stopTarget && <> – {formatMeters(stopTarget.meters)} verso {windOf(stopTarget.bearing)}</>}</>
                : <>Percorso completato – <b className="font-medium">{activeRoute.name}</b></>}
            </span>
          </button>
        )}
        {walking && !picking && nearby.length === 0 && target && target.meters > 25 && (
          <div className="glass pointer-events-auto flex items-center gap-3 rounded-full py-2 pr-4 pl-2.5 text-sm">
            <span className="grid size-8 place-items-center rounded-full bg-ink text-glow" style={{ transform: `rotate(${target.bearing}deg)` }} aria-hidden>
              <svg viewBox="0 0 16 16" className="size-4"><path d="M8 2 13 13 8 10.500 3 13z" fill="currentColor" /></svg>
            </span>
            <span>Zona spenta a <b className="num font-medium">{formatMeters(target.meters)}</b>, verso {windOf(target.bearing)}</span>
          </div>
        )}
        {!canCollect && (
          <div className="glass-ink pointer-events-auto rounded-full px-4 py-2 text-sm">
            {me.status === "suspended" ? "La regia ha sospeso il tuo profilo." : phase === "paused" ? "Raccolta in pausa: aspetta il via della regia." : phase === "upcoming" ? `Si parte tra ${remaining(c.starts_at, now)}.` : phase === "draft" ? "La campagna non è ancora partita." : "La campagna è conclusa. Grazie!"}
          </div>
        )}
        {showNotice && !picking && (
          <button onClick={() => setSeenNotice(notice.id)} title="Tocca per chiudere"
            className={cx("glass pointer-events-auto max-w-md animate-rise text-left", walking ? "flex !max-w-[min(28rem,calc(100vw-1.5rem))] items-center gap-2 rounded-full px-4 py-2" : "rounded-3xl px-4 py-3")}>
            <span className="label soft shrink-0">{walking ? "Regia" : `Dalla regia – ${ago(notice.created_at, now)}`}</span>
            <span className={cx("text-sm", walking ? "min-w-0 truncate" : "mt-0.5 block")}>{notice.body}</span>
          </button>
        )}
        {toast && <div className="glass-ink pointer-events-auto animate-rise rounded-full px-4 py-2 text-sm" role="status">{toast}</div>}
      </div>

      {layerState.all.length > 0 && !picking && !walking && (
        <IconButton label="Strati di dati" onClick={() => setPanel("layers")} className="absolute top-1/2 right-3 z-20 !size-11 -translate-y-1/2"><LayersIcon /></IconButton>
      )}
      {/* ------------------------------------------- colonne della vista in cammino */}
      {walking && !picking && (
        <>
          <div className="pointer-events-none absolute bottom-36 left-2 z-20 flex flex-col gap-2.5 sm:left-4">
            <SideButton label="Conferma" d={ICON.check} count={toValidate.length} onClick={() => setPanel("validate")} />
            {drafts.length > 0 && <SideButton label="Foto" d={ICON.tray} count={drafts.length} onClick={() => setPanel("drafts")} />}
            {data.places.length > 0 && <SideButton label="Percorsi" d={ICON.route} onClick={() => setPanel("routes")} />}
            <SideButton label="Come" d={ICON.help} onClick={() => setStory(true)} />
          </div>
          <div className="pointer-events-none absolute right-2 bottom-36 z-20 flex flex-col gap-2.5 sm:right-4">
            {exploring && (
              <SideButton label={compassOn ? "Bussola" : "Nord"} onClick={toggleCompass}>
                <svg viewBox="0 0 24 24" className="size-6" style={{ transform: `rotate(${compassOn ? -(compass.heading ?? 0) : 0}deg)`, transition: motion ? "transform .3s" : undefined }} aria-hidden>
                  <path d="M12 3 15 12h-6z" fill="#b8573f" /><path d="M12 21 9 12h6z" fill="currentColor" opacity=".35" />
                </svg>
              </SideButton>
            )}
            <SideButton label="Vista" d={ICON.view} onClick={() => setPanel("view")} />
            {layerState.all.length > 0 && <SideButton label="Strati" onClick={() => setPanel("layers")}><LayersIcon /></SideButton>}
            {!follow && position && <SideButton label="Su di me" d={ICON.target} onClick={() => setFollow(true)} />}
          </div>
        </>
      )}

      {/* ----------------------------------------------------------- dock */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex justify-center px-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className={cx("pointer-events-auto flex max-w-full items-center gap-1.5", (picking || !walking) && "glass rounded-full p-1.5")}>
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
            walking ? (
              <div className="flex w-[min(30rem,calc(100vw-1rem))] items-end justify-between gap-2">
                {/* stemma della squadra: la mappa accesa di tutti, non un livello personale */}
                <button key={fly?.id ?? "stemma"} type="button" onClick={() => setPanel("missions")} aria-label={`Squadra: mappa accesa al ${litPct}%`}
                  className={cx("flex w-20 flex-col items-center gap-1 transition active:scale-95", fly && "animate-thump")}>
                  <span className="grid size-14 place-items-center rounded-full p-[3px] shadow-[var(--shadow-soft)]"
                    style={{ background: `conic-gradient(${myTeam?.color ?? "#2b2118"} ${litPct * 3.6}deg, rgb(245 241 230 / .85) 0)` }}>
                    <span className="grid size-full place-items-center rounded-full bg-paper">
                      <span className="num text-[15px] font-medium leading-none">{litPct}<span className="text-[10px]">%</span></span>
                    </span>
                  </span>
                  <span className="label max-w-full truncate rounded-full bg-paper/85 px-1.5 !text-[9px] leading-4 backdrop-blur">{myTeam?.name ?? "Accesa"}</span>
                </button>

                {/* raccogli: il gesto principale, al centro e grande */}
                <div className="relative mb-1">
                  <button type="button" disabled={!canCollect} onClick={() => { setError(null); setPanel("form"); }} aria-label="Raccogli"
                    className="grid size-[76px] place-items-center rounded-full bg-ink text-paper shadow-[0_0_0_4px_var(--color-paper),0_0_0_7px_var(--color-glow),0_14px_28px_-10px_rgb(43_33_24/.5)] transition active:scale-95 disabled:opacity-40">
                    <span className="flex flex-col items-center gap-0.5"><PlusIcon /><span className="text-[11px] font-medium tracking-wide">Raccogli</span></span>
                  </button>
                  <label className={cx("absolute -top-2 -right-4 grid size-11 cursor-pointer place-items-center rounded-full bg-paper text-ink shadow-[var(--shadow-soft)] transition active:scale-95", !canCollect && "pointer-events-none opacity-40")} title="Scatto rapido">
                    <Icon d={ICON.camera} />
                    <span className="sr-only">Scatto rapido</span>
                    <input type="file" accept="image/*" capture="environment" className="sr-only" disabled={!canCollect} onChange={(e) => { snap(e.target.files?.[0]); e.target.value = ""; }} />
                  </label>
                </div>

                {/* vicino a te: i prossimi luoghi da raggiungere */}
                <button type="button" onClick={() => setPanel("near")} className="glass mb-3 flex h-12 w-24 items-center justify-center gap-1.5 rounded-full px-3 transition active:scale-95" aria-label={`Vicino a te: ${aroundCount}`}>
                  {nearestPlaces.length ? nearestPlaces.map(({ p }) => <span key={p.id} className="size-3 rounded-full ring-2 ring-paper" style={{ background: categoryOf(p.category).color }} />) : <Icon d={ICON.near} />}
                  <span className="min-w-0 truncate text-[12px] leading-tight">{nearestPlaces[0] ? formatMeters(nearestPlaces[0].m) : "Vicino"}</span>
                </button>
              </div>
            ) : (
            <>
              <Button variant="glow" className="h-12 !px-5" disabled={!canCollect} onClick={begin}><Icon d={ICON.walk} /> Inizia un&apos;uscita</Button>
              <button type="button" aria-label="Nuovo rilievo" title="Nuovo rilievo" disabled={!canCollect} onClick={() => { setError(null); setPanel("form"); }}
                className="grid size-10 shrink-0 place-items-center rounded-full transition hover:bg-ink/6 active:scale-95 disabled:opacity-40">
                <PlusIcon />
              </button>
              <Counter label="Conferma i rilievi degli altri" d={ICON.check} count={toValidate.length} onClick={() => setPanel("validate")} />
              {drafts.length > 0 && <Counter label="Foto da completare" d={ICON.tray} count={drafts.length} onClick={() => setPanel("drafts")} />}
              <Counter label="Vicino a te" d={ICON.near} count={aroundCount} onClick={() => setPanel("near")} />
              {data.places.length > 0 && <Counter label="Luoghi e percorsi" d={ICON.route} count={0} onClick={() => setPanel("routes")} />}
              <button type="button" aria-label="Come si gioca" title="Come si gioca" onClick={() => setStory(true)} className="hidden size-10 shrink-0 place-items-center rounded-full text-[15px] font-medium transition hover:bg-ink/6 sm:grid">?</button>
            </>
            )
          )}
        </div>
      </div>

      <Sheet open={openPanel === "view"} onClose={() => setPanel(null)} kicker="In cammino" title="Vista">
        <div className="space-y-5">
          <div>
            <Label className="mb-2 block">Mappa</Label>
            <Segmented value={view.explore ? "esplora" : "piatta"} onChange={(v) => view.setExplore(v === "esplora")}
              options={[{ id: "esplora", label: "Esplora" }, { id: "piatta", label: "Piatta" }]} />
            <p className="soft mt-2 text-sm">Esplora inclina la mappa e la fa seguire i tuoi passi. Piatta è la carta vista dall&apos;alto.</p>
          </div>
          <div>
            <Label className="mb-2 block">Grafica</Label>
            <Segmented<Quality> value={view.quality} onChange={view.setQuality}
              options={(["auto", "ricca", "essenziale"] as Quality[]).map((q) => ({ id: q, label: QUALITY_LABEL[q] }))} />
            <p className="soft mt-2 text-sm">
              {view.quality === "auto" ? (slow ? "Il telefono fatica: edifici e cielo sono spenti." : "Edifici e cielo restano accesi finché il telefono va fluido.")
                : view.quality === "ricca" ? "Edifici in rilievo, cielo dell'ora del giorno, celle che si accendono."
                : "Niente rilievo, cielo e animazioni: consuma meno batteria."}
            </p>
          </div>
          <p className="soft text-xs">Durante l&apos;uscita lo schermo resta acceso. La posizione viene usata per accendere le zone, il tracciato non viene salvato.</p>
        </div>
      </Sheet>

      {fly && motion && (
        <div key={fly.id} className="pointer-events-none fixed z-[54] animate-fly" aria-hidden>
          <div className="h-24 w-20 rounded-[3px] border-4 border-paper shadow-[0_12px_24px_-8px_rgb(43_33_24/.45)]" style={{ background: fly.color }} />
        </div>
      )}

      <Sheet open={openPanel === "layers"} onClose={() => setPanel(null)} kicker="Sulla mappa" title="Strati di dati"><LayersPanel state={layerState} /></Sheet>
      <PointSheet point={point} datasets={data.datasets} position={position} onClose={() => setPoint(null)}
        contributions={data.contributions} campaignId={c.id} onContribute={(t) => { setPoint(null); setContribTarget(t); }} />
      <ContributeSheet target={contribTarget} onClose={() => setContribTarget(null)} onDone={refresh} />

      {/* ----------------------------------------------------- vicino a te */}
      <Sheet open={openPanel === "near"} onClose={() => setPanel(null)} kicker={`Entro ${AROUND} m`} title="Vicino a te" wide>
        {!position ? <Empty title="Posizione non disponibile.">Consenti la posizione al browser per vedere che cosa hai intorno.</Empty> : (
          <div className="space-y-6">
            {hereNow && (
              <section className="on-ink rounded-card p-5">
                <Label>Sei in</Label>
                <h3 className="display mt-1 text-[30px]">{hereNow.name}</h3>
                {figures.length === 0 ? <p className="soft mt-2 text-sm">Nessun dato del territorio per quest&apos;area.</p> : (
                  <ul className="mt-4 grid gap-x-6 gap-y-3 sm:grid-cols-2">
                    {figures.slice(0, 10).map((f) => (
                      <li key={f.dataset.id + f.column.key} className="min-w-0">
                        <span className="label soft block truncate !text-[9px]">{f.column.label}{f.year ? ` ${f.year}` : ""}</span>
                        <span className="flex items-baseline justify-between gap-3">
                          <span className="display num text-[22px]">{formatValue(f.value, f.column.unit)}</span>
                          {f.series.length > 2 && <Spark points={f.series} unit={f.column.unit} />}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                {figures.length > 10 && <p className="soft mt-3 text-xs">e altri {figures.length - 10} indicatori nella mappa pubblica</p>}
              </section>
            )}
            <section>
              <Label className="mb-2 block">Luoghi – {placesAround.length}</Label>
              {placesAround.length === 0 ? <p className="soft text-sm">Nessun luogo da raggiungere qui intorno.</p> : (
                <ul className="divide-y divide-line">
                  {placesAround.map(({ p, m }) => (
                    <li key={p.id}><button className="flex w-full items-center gap-3 py-2.5 text-left" onClick={() => { setPlaceId(p.id); setPanel("place"); }}>
                      <span className="size-3 shrink-0 rounded-full" style={{ background: categoryOf(p.category).color, boxShadow: completed.includes(p.id) ? "0 0 0 3px #d6993e" : reached.has(p.id) ? "0 0 0 3px #4a6b43" : undefined }} />
                      <span className="min-w-0 flex-1 truncate">{p.name}</span>
                      <span className="soft text-sm">{completed.includes(p.id) ? "completato" : reached.has(p.id) ? "raggiunto" : formatMeters(m)}</span>
                    </button></li>
                  ))}
                </ul>
              )}
            </section>
            <section>
              <Label className="mb-2 block">Da confermare – {toValidateAround.length}</Label>
              {toValidateAround.length === 0 ? <p className="soft text-sm">Nessun rilievo di altri team qui intorno.</p> : (
                <Button variant="outline" onClick={() => setPanel("validate")}>Conferma i {toValidateAround.length} rilievi vicini</Button>
              )}
            </section>
            {layerAround.length > 0 && (
              <section>
                <Label className="mb-2 block">Servizi e punti utili – {layerAround.length}</Label>
                <ul className="divide-y divide-line">
                  {layerAround.slice(0, 12).map((x, i) => (
                    <li key={i}><button className="flex w-full items-center gap-3 py-2 text-left text-sm" onClick={() => setPoint({ datasetId: x.datasetId, index: x.index })}>
                      <span className="size-2.5 shrink-0 rounded-full" style={{ background: x.color }} />
                      <span className="min-w-0 flex-1 truncate">{x.label}{x.category && x.category !== x.label ? <span className="soft">, {x.category}</span> : null}</span>
                      <span className="soft">{formatMeters(x.m)}</span>
                    </button></li>
                  ))}
                </ul>
              </section>
            )}
            <p className="soft text-xs">Il cerchio ocra sulla mappa è il tuo raggio d&apos;azione: dentro, i luoghi si raggiungono e i rilievi degli altri si confermano.</p>
          </div>
        )}
      </Sheet>

      {/* ---------------------------------------------------------- luogo */}
      <Sheet open={openPanel === "place" && !!currentPlace} onClose={() => setPanel(null)}
        kicker={currentPlace ? `${categoryOf(currentPlace.category).label} – ${currentPlace.points} pt per team` : ""} title={currentPlace?.name ?? ""} wide>
        {currentPlace && (() => {
          const p = currentPlace, d = placeDistance(p), prog = ind.places.get(p.id);
          const arrived = reached.has(p.id);
          const detailed = !!prog && [...prog.detailed].some((k) => k === me.team_id || k === `persona:${me.user_id}`);
          const close = d != null && d <= p.radius_m + 25;
          return (
            <div className="space-y-4">
              {p.images.length > 0 && (
                <div className="-mx-6 flex snap-x snap-mandatory gap-2 overflow-x-auto px-6 sm:-mx-8 sm:px-8">
                  {p.images.map((path) => /* eslint-disable-next-line @next/next/no-img-element */ <img key={path} src={mediaUrl(path) ?? ""} alt="" className="h-52 w-[85%] shrink-0 snap-center rounded-card object-cover sm:w-[70%]" />)}
                </div>
              )}
              {p.description && !(p.attributes && Object.keys(p.attributes).length) && <p className="text-[15px] leading-snug">{p.description}</p>}
              {p.attributes && Object.keys(p.attributes).length > 0 && (
                <dl className="divide-y divide-line rounded-2xl border hairline text-sm">
                  {Object.entries(p.attributes).filter(([k, v]) => v !== null && v !== "" && !/^(lat|lon|lng|cod)$/i.test(k)).slice(0, 10).map(([k, v]) => (
                    <div key={k} className="flex gap-3 px-3.5 py-2"><dt className="soft min-w-0 flex-1">{k.replace(/_/g, " ")}</dt><dd className="text-right">{String(v)}</dd></div>
                  ))}
                  {p.source && <div className="soft px-3.5 py-2 text-xs">Fonte: {p.source}</div>}
                </dl>
              )}
              {p.prompt && (
                <div className="rounded-2xl border-l-4 bg-paper-2 py-3 pr-4 pl-4" style={{ borderColor: categoryOf(p.category).color }}>
                  <span className="label soft">Che cosa raccogliere qui</span>
                  <p className="serif mt-1 text-[22px] leading-tight italic">{p.prompt}</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-2">
                <div className={cx("rounded-2xl border p-3", arrived ? "border-leaf bg-leaf/8" : "hairline")}>
                  <span className="label soft">1 – Arrivo</span>
                  <p className="mt-1 text-[15px]">{arrived ? "Raggiunto ✓" : d != null ? `A ${formatMeters(d)}` : "Posizione sconosciuta"}</p>
                  <p className="num soft text-xs">+{Math.round(p.points / 2)} pt</p>
                </div>
                <div className={cx("rounded-2xl border p-3", detailed ? "border-leaf bg-leaf/8" : "hairline")}>
                  <span className="label soft">2 – {(p.survey?.length ?? 0) > 0 ? "Indagine confermata" : "Rilievo confermato"}</span>
                  <p className="mt-1 text-[15px]">{detailed ? "Completato ✓" : "Da raccogliere"}</p>
                  <p className="num soft text-xs">+{Math.round(p.points / 2)} pt</p>
                </div>
              </div>
              <Community items={contributionsFor(data.contributions, { place_id: p.id })}
                onAdd={() => { setPanel(null); setContribTarget({ campaignId: c.id, name: p.name, at: [p.lng, p.lat], place_id: p.id }); }} />
              <p className="soft text-xs">Arrivo entro {p.radius_m} m. {prog ? `${prog.reached.size} ${prog.reached.size === 1 ? "team è passato" : "team sono passati"} di qui.` : ""}</p>
              {actionError && <Notice tone="error">{actionError}</Notice>}
              <div className="flex flex-wrap gap-2">
                {!arrived && <Button size="lg" variant={close ? "glow" : "outline"} className="flex-1" disabled={busy || !canCollect || d == null} onClick={() => arrive(p)}>{close ? "Sono arrivato" : "Registra l'arrivo"}</Button>}
                {(p.survey?.length ?? 0) > 0 && (
                  <Button size="lg" className="flex-1" disabled={!canCollect || !(arrived || close)} onClick={() => { setError(null); setPanel("survey"); }}>
                    Avvia l&apos;indagine – {p.survey!.length} domande
                  </Button>
                )}
                <Button size="lg" variant={(p.survey?.length ?? 0) > 0 ? "outline" : "primary"} className="flex-1" disabled={!canCollect} onClick={() => collectHere(p)}><PlusIcon /> Rilievo libero</Button>
              </div>
              {(p.survey?.length ?? 0) > 0 && !(arrived || close) && <p className="soft text-xs">L&apos;indagine sul sito si apre quando sei entro {p.radius_m} m dal luogo.</p>}
            </div>
          );
        })()}
      </Sheet>

      <Sheet open={openPanel === "routes"} onClose={() => setPanel(null)} kicker="Esplorazione" title="Luoghi e percorsi" wide>
        <div className="on-ink rounded-card p-5">
          <div className="flex items-baseline gap-2">
            <span className="display num text-[44px] leading-none text-glow">{reached.size}/{data.places.length}</span>
            <span className="label soft">luoghi raggiunti dal tuo team</span>
          </div>
          <Meter value={data.places.length ? reached.size / data.places.length : 0} className="mt-4" color="var(--color-glow)" />
        </div>
        {data.routes.length > 0 && <Label className="mt-6 mb-2 block">Percorsi</Label>}
        <ul className="space-y-2">
          {data.routes.map((r) => {
            const done = r.stops.filter((sid) => reached.has(sid)).length, m = routeLength(r.stops, data.places), on = r.id === routeId;
            return (
              <li key={r.id} className={cx("rounded-card border p-4", on ? "border-ink" : "hairline")}>
                <div className="flex items-center gap-2.5">
                  <span className="h-1.5 w-6 rounded-full" style={{ background: r.color }} />
                  <span className="min-w-0 flex-1 truncate text-[17px] tracking-[-0.02em]">{r.name}</span>
                  <span className="num soft text-sm">{done}/{r.stops.length}</span>
                </div>
                {r.description && <p className="soft mt-1 text-sm">{r.description}</p>}
                <p className="soft mt-1 text-xs">{formatMeters(m)} – ≈ {routeMinutes(m, r.stops.length)} min</p>
                <Meter value={r.stops.length ? done / r.stops.length : 0} className="mt-3" color={r.color} />
                <div className="mt-3 flex gap-2">
                  <Button size="sm" variant={on ? "outline" : "primary"} onClick={() => { followRoute(on ? null : r.id); if (!on) { setPanel(null); if (!walking) { setFollow(true); start(); } } }}>{on ? "Smetti di seguirlo" : walking ? "Segui questo percorso" : "Parti con questo percorso"}</Button>
                </div>
              </li>
            );
          })}
        </ul>
        <Label className="mt-6 mb-2 block">Tutti i luoghi</Label>
        <ul className="divide-y divide-line">
          {[...data.places].sort((a, b) => (placeDistance(a) ?? 0) - (placeDistance(b) ?? 0)).map((p) => (
            <li key={p.id}>
              <button className="flex w-full items-center gap-3 py-3 text-left" onClick={() => { setPlaceId(p.id); setPanel("place"); }}>
                <span className="size-3 shrink-0 rounded-full" style={{ background: categoryOf(p.category).color, boxShadow: reached.has(p.id) ? "0 0 0 3px var(--color-glow)" : undefined }} />
                <span className="min-w-0 flex-1 truncate">{p.name}</span>
                <span className="soft text-sm">{reached.has(p.id) ? "raggiunto" : placeDistance(p) != null ? formatMeters(placeDistance(p)!) : ""}</span>
              </button>
            </li>
          ))}
        </ul>
      </Sheet>

      <Survey place={currentPlace} open={openPanel === "survey"} busy={busy} error={actionError} onClose={() => setPanel("place")}
        onSubmit={(r) => currentPlace && sendSurvey(currentPlace, r)} />

      {/* ------------------------------------------------- nuovo rilievo */}
      <FormPicker open={openPanel === "form"} onClose={() => setPanel(null)} onPick={pick} />
      <Details
        open={openPanel === "new"} entry={entry} setEntry={setEntry} themes={data.themes} worth={worth} previous={previous}
        placeNote={placeNote} areaClosed={areaClosed} busy={busy} error={actionError} placeName={data.places.find((p) => p.id === atPlace)?.name}
        onClose={cancel} onMove={() => { setPanel(null); setPicking(true); }} onSubmit={submit}
      />

      {/* ----------------------------------------------- foto da completare */}
      <Sheet open={openPanel === "drafts"} onClose={() => setPanel(null)} kicker="Scatti rapidi" title="Da completare" wide>
        {drafts.length === 0 ? <Empty title="Niente in sospeso.">Gli scatti rapidi presi durante un&apos;uscita aspettano qui la loro didascalia.</Empty> : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {drafts.map((d) => <DraftCard key={d.id} draft={d} onOpen={() => complete(d)} onDiscard={() => discard(d)} />)}
          </ul>
        )}
        <p className="soft mt-4 text-xs">Le foto restano su questo dispositivo finché non le completi e le invii.</p>
      </Sheet>

      {/* ------------------------------------------------------- valida */}
      <Sheet open={openPanel === "validate"} onClose={() => setPanel(null)} kicker="Validazione tra team" title="Conferma i rilievi degli altri" wide>
        {actionError && <div className="mb-3"><Notice tone="error">{actionError}</Notice></div>}
        {toValidate.length === 0 ? (
          <Empty title="Tutto confermato.">Quando un altro team inserisce un rilievo, lo trovi qui. Confermarlo fa crescere il punteggio di tutti.</Empty>
        ) : (
          <ul className="space-y-3">
            {toValidate.slice(0, 30).map((o) => {
              const img = mediaUrl(o.media_path), team = teamOf(data, o.team_id), th = themeOf(data, o.theme_id), m = distance(o);
              return (
                <li key={o.id} className={cx("surface rounded-card border p-4", m <= NEAR ? "border-ink" : "hairline")}>
                  <div className="flex gap-3">
                    {img && /* eslint-disable-next-line @next/next/no-img-element */ <img src={img} alt="" className="size-16 shrink-0 rounded-xl object-cover" loading="lazy" />}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap gap-1.5"><FormTag form={o.form} /><KindTag o={o} />{th && <Tag color={th.color}>{th.name}</Tag>}</div>
                      <h4 className="mt-1.5 text-[17px] tracking-[-0.02em]">{o.title}</h4>
                      {summary(o) && <p className="text-sm" style={{ color: formOf(o.form).color }}>{summary(o)}</p>}
                      {o.note && <p className="soft text-sm">{o.note}</p>}
                      {o.form === "indagine" && <div className="mt-2"><SurveyAnswers data={o.data} mediaUrl={mediaUrl} /></div>}
                      <p className="label soft mt-1.5 inline-flex flex-wrap items-center gap-1.5">
                        {team && <Dot color={team.color} />}{team?.name ?? nameOf(data, o.author_id)} – {ago(o.created_at, now)}
                        {Number.isFinite(m) && <span className={cx(m <= NEAR && "text-ink")}> – {m <= NEAR ? "sei sul posto" : `a ${formatMeters(m)}`}</span>}
                      </p>
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
            <span className="label soft">pt di tutti – +{ind.potential} in attesa</span>
          </div>
          <div className="mt-5 grid grid-cols-4 gap-2 text-center">
            {([["Copertura", ind.coverage, "var(--color-glow)"], ["Equilibrio", ind.balance, "#8fb3d1"], ["Affidabilità", ind.reliability, "#e08a6e"], ["Scambio", ind.exchange, "#e8c07a"]] as const).map(([l, v, col]) => (
              <div key={l}><Ring value={v} color={col} size={56} /><div className="label soft mt-1.5 !text-[9px]">{l}</div></div>
            ))}
          </div>
          <p className="soft mt-5 border-t border-white/10 pt-4 text-sm">
            <b className="num font-medium text-paper">{formatMeters(ind.walkedMeters + (walk?.meters ?? 0))}</b> camminati insieme – <b className="num font-medium text-paper">{litNow.size}</b> zone accese
          </p>
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
                <span className="label soft mt-1.5 block">{MISSION_KIND[mission.kind].label} – {state === "done" ? "raggiunta da tutti" : `ancora ${remaining(mission.ends_at, now)}`}</span>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-6 flex flex-wrap gap-2 border-t hairline pt-4">
          <Button variant="outline" size="sm" onClick={() => setPanel("team")}>{myTeam ? `Team ${myTeam.name}` : "Scegli il team"} e ruolo</Button>
          <Button variant="ghost" size="sm" onClick={() => { setPanel(null); setStory(true); }}>Come si gioca</Button>
          <LinkButton href={`/mappa/${id}`} variant="ghost" size="sm">Che cosa è emerso</LinkButton>
        </div>
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
      <Sheet open={openPanel === "detail" && !!detail} onClose={() => setPanel(null)} kicker={detail ? `${nameOf(data, detail.author_id)} – ${ago(detail.created_at, now)}` : ""} title={detail?.title ?? ""}>
        {detail && (
          <div className="space-y-3">
            {mediaUrl(detail.media_path) && /* eslint-disable-next-line @next/next/no-img-element */ <img src={mediaUrl(detail.media_path)!} alt="" className="max-h-72 w-full rounded-2xl object-cover" />}
            <div className="flex flex-wrap gap-1.5">
              <FormTag form={detail.form} />
              <KindTag o={detail} />
              {lensLabel(detail.lens) && <Tag>{lensLabel(detail.lens)}</Tag>}
              {themeOf(data, detail.theme_id) && <Tag color={themeOf(data, detail.theme_id)!.color}>{themeOf(data, detail.theme_id)!.name}</Tag>}
              <Tag>{detail.status === "validated" ? `validato – qualità ${["", "bassa", "media", "alta"][detail.quality ?? 2]}` : detail.status === "pending" ? "in attesa di conferma" : "segnalato"}</Tag>
            </div>
            {detail.form === "percezione" && detail.feeling
              ? <p className="serif text-2xl italic">«{detail.feeling}»</p>
              : summary(detail) && <p className="display text-2xl" style={{ color: formOf(detail.form).color }}>{summary(detail)}</p>}
            {detail.form === "percezione" && summary(detail) && <p className="soft text-sm">{summary(detail)}</p>}
            {detail.form === "indagine" && <SurveyAnswers data={detail.data} mediaUrl={mediaUrl} />}
            {detail.note && <p className="text-[15px]">{detail.note}</p>}
            {detail.source_url && <a className="text-sm underline underline-offset-2" href={detail.source_url} target="_blank" rel="noreferrer">Apri la fonte</a>}
          </div>
        )}
      </Sheet>

      <Recap summary={recap} onClose={() => setRecap(null)} onDrafts={() => { setRecap(null); setPanel("drafts"); }} />
      <Celebration cheer={cheer} onEnd={endCheer} />
      {story && <Story campaign={c.name} onDone={closeStory} />}
    </main>
  );
}

/** Miniatura di uno scatto rapido in attesa di didascalia. */
function DraftCard({ draft, onOpen, onDiscard }: { draft: Draft; onOpen: () => void; onDiscard: () => void }) {
  // L'indirizzo temporaneo dell'immagine nasce quando l'elemento compare e si libera a caricamento avvenuto.
  const show = (el: HTMLImageElement | null) => { if (el && !el.dataset.set) { el.dataset.set = "1"; el.src = URL.createObjectURL(draft.blob); } };
  return (
    <li className="surface overflow-hidden rounded-card border hairline">
      <button onClick={onOpen} className="relative block w-full">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img ref={show} alt="Scatto rapido" className="aspect-square w-full bg-paper-2 object-cover" onLoad={(e) => URL.revokeObjectURL(e.currentTarget.src)} />
        <span className="label glass absolute top-2 left-2 rounded-full px-2 py-1">{new Date(draft.created_at).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}</span>
      </button>
      <div className="flex gap-1.5 p-2">
        <Button size="sm" variant="ghost" className="flex-1 !px-2" onClick={onDiscard}>Scarta</Button>
        <Button size="sm" className="flex-1 !px-2" onClick={onOpen}>Completa</Button>
      </div>
    </li>
  );
}
