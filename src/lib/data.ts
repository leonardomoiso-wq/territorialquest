"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { areaAt, cellOf } from "@/domain/geo";
import type {
  Announcement, Area, Campaign, CampaignData, FieldRole, Membership, Mission, Contribution, Observation, ObservationKind, Place, Polygon, Route, Team, Theme, Visit, Walk,
} from "@/domain/types";
import { createClient } from "@/utils/supabase/client";
import type { Dataset } from "@/domain/datasets";
import { projectRef } from "@/utils/supabase/env";

const db = () => createClient();

/** Traduce gli errori più comuni in un messaggio leggibile. */
export function explain(error: unknown): string {
  const m = (error as { message?: string })?.message ?? String(error);
  if (/row-level security/i.test(m)) return "Operazione non consentita: la raccolta è chiusa o non hai i permessi.";
  if (/Invalid login credentials/i.test(m)) return "Email o password non corretti.";
  if (/already registered/i.test(m)) return "Questa email è già registrata: accedi.";
  if (/Email not confirmed/i.test(m)) return "Conferma l'indirizzo dal link che ti abbiamo inviato per email.";
  if (/duplicate key.*join_code/i.test(m)) return "Codice campagna già in uso: scegline un altro.";
  if (/schema cache|does not exist|PGRST20[25]/i.test(m)) {
    const what = m.match(/(?:table|function|column) '?"?([\w.]+)/i)?.[1];
    return `Il database collegato (${projectRef || "progetto sconosciuto"}) non è aggiornato${what ? `: manca ${what}` : ""}. Controlla in /stato.`;
  }
  if (/Failed to fetch|NetworkError/i.test(m)) return "Connessione assente. Riprova tra poco.";
  return m;
}

async function unwrap<T = unknown>(q: PromiseLike<{ data: unknown; error: unknown }>): Promise<T> {
  const { data, error } = await q;
  if (error) throw new Error(explain(error));
  return data as T;
}

/* --------------------------------------------------------------- sessione */
export function useSession() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  useEffect(() => {
    const supabase = db();
    supabase.auth.getUser().then(({ data }) => setUser(data.user ?? null));
    const { data } = supabase.auth.onAuthStateChange((_e, session) => setUser(session?.user ?? null));
    return () => data.subscription.unsubscribe();
  }, []);
  const name =
    (user?.user_metadata?.display_name as string | undefined) || user?.email?.split("@")[0] || "";
  return { user, name, loading: user === undefined };
}

export async function signIn(email: string, password: string) {
  const { error } = await db().auth.signInWithPassword({ email, password });
  if (error) throw new Error(explain(error));
  await db().rpc("ensure_profile").then(() => undefined, () => undefined);
}

/** Restituisce true se serve confermare l'email prima di entrare. */
export async function signUp(email: string, password: string, displayName: string): Promise<boolean> {
  const { data, error } = await db().auth.signUp({
    email,
    password,
    options: { data: { display_name: displayName }, emailRedirectTo: `${location.origin}/accedi` },
  });
  if (error) throw new Error(explain(error));
  if (data.session) await db().rpc("ensure_profile").then(() => undefined, () => undefined);
  return !data.session;
}

export async function signOut() {
  await db().auth.signOut();
  location.href = "/";
}

/* --------------------------------------------------------------- campagne */
export interface CampaignLink {
  campaign: Campaign;
  role: Membership["role"];
}

export async function listCampaigns(userId: string): Promise<CampaignLink[]> {
  const rows = await unwrap<{ role: Membership["role"]; campaign: Campaign | null }[]>(
    db().from("memberships").select("role, campaign:campaigns(*)").eq("user_id", userId),
  );
  return rows
    .filter((r): r is { role: Membership["role"]; campaign: Campaign } => !!r.campaign)
    .map((r) => ({ role: r.role, campaign: r.campaign }))
    .sort((a, b) => b.campaign.created_at.localeCompare(a.campaign.created_at));
}

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const newJoinCode = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join("");

export async function createCampaign(input: {
  owner_id: string; name: string; description: string; starts_at: string; ends_at: string;
}): Promise<Campaign> {
  return unwrap<Campaign>(
    db().from("campaigns").insert({ ...input, join_code: newJoinCode() }).select().single(),
  );
}

export const updateCampaign = (id: string, patch: Partial<Campaign>) =>
  unwrap(db().from("campaigns").update(patch).eq("id", id).select().single());
export const deleteCampaign = (id: string) => unwrap(db().from("campaigns").delete().eq("id", id));

export async function loadCampaign(id: string): Promise<CampaignData | null> {
  const s = db();
  const [campaign, teams, members, areas, themes, missions, observations, announcements, walks, places, routes, visits, contributions, datasets] = await Promise.all([
    s.from("campaigns").select("*").eq("id", id).maybeSingle(),
    s.from("teams").select("*").eq("campaign_id", id).order("created_at"),
    s.from("memberships").select("*, profile:profiles(id, display_name)").eq("campaign_id", id).order("joined_at"),
    s.from("areas").select("*").eq("campaign_id", id).order("created_at"),
    s.from("themes").select("*").eq("campaign_id", id).order("sort"),
    s.from("missions").select("*").eq("campaign_id", id).order("starts_at"),
    s.from("observations").select("*").eq("campaign_id", id).order("created_at", { ascending: false }).limit(5000),
    s.from("announcements").select("*").eq("campaign_id", id).order("created_at", { ascending: false }).limit(50),
    s.from("walks").select("*").eq("campaign_id", id).order("started_at", { ascending: false }).limit(2000),
    s.from("places").select("*").eq("campaign_id", id).order("created_at"),
    s.from("routes").select("*").eq("campaign_id", id).order("created_at"),
    s.from("visits").select("*").eq("campaign_id", id).limit(5000),
    s.from("contributions").select("*").eq("campaign_id", id).order("created_at", { ascending: false }).limit(2000),
    s.from("datasets").select("*").eq("campaign_id", id).order("created_at"),
  ]);
  const failed = [campaign, teams, members, areas, themes, missions, observations, announcements].find((r) => r.error);
  if (failed?.error) throw new Error(explain(failed.error));
  if (!campaign.data) return null;
  return {
    campaign: campaign.data as Campaign,
    teams: (teams.data ?? []) as Team[],
    members: (members.data ?? []) as Membership[],
    areas: (areas.data ?? []) as Area[],
    themes: (themes.data ?? []) as Theme[],
    missions: (missions.data ?? []) as Mission[],
    observations: (observations.data ?? []) as Observation[],
    announcements: (announcements.data ?? []) as Announcement[],
    // Se la tabella delle uscite non esiste ancora, la campagna si apre comunque.
    walks: (walks.data ?? []) as Walk[],
    places: (places.data ?? []) as Place[],
    routes: (routes.data ?? []) as Route[],
    visits: (visits.data ?? []) as Visit[],
    contributions: (contributions.data ?? []) as Contribution[],
    datasets: (datasets.data ?? []) as Dataset[],
  };
}

const LIVE_TABLES = ["campaigns", "teams", "memberships", "areas", "missions", "observations", "announcements", "walks", "places", "routes", "visits", "contributions", "datasets"];

/** Dati della campagna, aggiornati in tempo reale. */
export function useCampaign(id: string | undefined) {
  const [data, setData] = useState<CampaignData | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = useCallback(async () => {
    if (!id) return;
    try {
      setData(await loadCampaign(id));
      setError(null);
    } catch (e) {
      setError(explain(e));
      setData((d) => (d === undefined ? null : d));
    }
  }, [id]);

  useEffect(() => {
    if (!id) return;
    const soon = (delay = 250) => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(refresh, delay);
    };
    soon(0);
    const supabase = db();
    const channel = supabase.channel(`campaign:${id}`);
    for (const table of LIVE_TABLES) {
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table, filter: `${table === "campaigns" ? "id" : "campaign_id"}=eq.${id}` },
        () => soon(),
      );
    }
    channel.subscribe();
    // Rete di sicurezza se il canale in tempo reale non è disponibile.
    const poll = setInterval(() => document.visibilityState === "visible" && refresh(), 20000);
    return () => {
      clearInterval(poll);
      if (timer.current) clearTimeout(timer.current);
      supabase.removeChannel(channel);
    };
  }, [id, refresh]);

  return { data, error, refresh, loading: data === undefined };
}

/* ------------------------------------------------------- team e giocatori */
export const saveTeam = (t: Partial<Team> & { campaign_id: string; name: string }) =>
  t.id ? unwrap(db().from("teams").update({ name: t.name, color: t.color }).eq("id", t.id))
       : unwrap(db().from("teams").insert({ campaign_id: t.campaign_id, name: t.name, color: t.color }));
export const deleteTeam = (id: string) => unwrap(db().from("teams").delete().eq("id", id));

export const updateMember = (id: string, patch: Partial<Pick<Membership, "team_id" | "role" | "status" | "field_role">>) =>
  unwrap(db().from("memberships").update(patch).eq("id", id));
export const removeMember = (id: string) => unwrap(db().from("memberships").delete().eq("id", id));

export const joinCampaign = (code: string) => unwrap<string>(db().rpc("join_campaign", { code }));
export const chooseTeam = (campaignId: string, teamId: string | null, role: FieldRole | null) =>
  unwrap(db().rpc("choose_team", { c: campaignId, t: teamId, r: role }));
export const heartbeat = (campaignId: string, lng?: number, lat?: number) =>
  db().rpc("heartbeat", { c: campaignId, lng: lng ?? null, lat: lat ?? null }).then(() => undefined, () => undefined);

/* ------------------------------------------------------------ aree, tempi */
export const saveArea = (a: {
  id?: string; campaign_id: string; name: string; color: string; geometry: Polygon;
  team_id: string | null; opens_at: string | null; closes_at: string | null;
  environment?: string; terrain?: Record<string, string>;
}) => {
  const { id, name, color, geometry, team_id, opens_at, closes_at, campaign_id, environment, terrain } = a;
  const row = { name, color, geometry, team_id, opens_at, closes_at, campaign_id, environment: environment ?? "urbano", terrain: terrain ?? {} };
  return id ? unwrap(db().from("areas").update(row).eq("id", id)) : unwrap(db().from("areas").insert(row));
};
export const paintArea = (id: string, terrain: Record<string, string>) =>
  unwrap(db().from("areas").update({ terrain }).eq("id", id));
export const deleteArea = (id: string) => unwrap(db().from("areas").delete().eq("id", id));

export const saveMission = (m: Partial<Mission> & { campaign_id: string; title: string }) => {
  const { id, ...row } = m;
  return id ? unwrap(db().from("missions").update(row).eq("id", id)) : unwrap(db().from("missions").insert(row));
};
export const deleteMission = (id: string) => unwrap(db().from("missions").delete().eq("id", id));

export const announce = (campaign_id: string, author_id: string, body: string, team_id: string | null) =>
  unwrap(db().from("announcements").insert({ campaign_id, author_id, body, team_id }));

/* ----------------------------------------------------------- osservazioni */
export async function uploadMedia(campaignId: string, file: File): Promise<string> {
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
  const path = `${campaignId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await db().storage.from("media").upload(path, file, { contentType: file.type, cacheControl: "31536000" });
  if (error) throw new Error(explain(error));
  return path;
}
export const mediaUrl = (path: string | null) =>
  path ? db().storage.from("media").getPublicUrl(path).data.publicUrl : null;

export async function addObservation(
  data: CampaignData,
  me: Membership,
  input: {
    kind: ObservationKind; form: string; lens: string | null; path: [number, number][] | null; data: Record<string, unknown>;
    place_id?: string | null;
    title: string; note: string; feeling: string | null; theme_id: string | null;
    source_url: string | null; lng: number; lat: number; file: File | null;
    /** Media già caricato (es. foto dell'indagine). */
    media_path?: string | null;
  },
) {
  const { file, media_path: given, ...rest } = input;
  const media_path = given ?? (file ? await uploadMedia(data.campaign.id, file) : null);
  return unwrap(
    db().from("observations").insert({
      ...rest,
      media_path,
      campaign_id: data.campaign.id,
      author_id: me.user_id,
      team_id: me.team_id,
      area_id: areaAt(input.lng, input.lat, data.areas)?.id ?? null,
      cell: cellOf(input.lng, input.lat),
    }),
  );
}

export const validateObservation = (id: string, quality: number, status: "validated" | "flagged" | "pending" = "validated") =>
  unwrap(db().rpc("validate_observation", { obs: id, q: quality, new_status: status }));
export const deleteObservation = (id: string) => unwrap(db().from("observations").delete().eq("id", id));

/* ------------------------------------------------------------------- temi */
export const saveTheme = (t: { id?: string; campaign_id: string; name: string; color: string; sort: number }) => {
  const { id, ...row } = t;
  return id ? unwrap(db().from("themes").update(row).eq("id", id)) : unwrap(db().from("themes").insert(row));
};
export const deleteTheme = (id: string) => unwrap(db().from("themes").delete().eq("id", id));

/* ----------------------------------------------------------------- uscite */
export const startWalk = (campaign_id: string, user_id: string, team_id: string | null) =>
  unwrap<Walk>(db().from("walks").insert({ campaign_id, user_id, team_id }).select().single());
export const updateWalk = (id: string, patch: Partial<Pick<Walk, "distance_m" | "cells" | "ended_at">>) =>
  unwrap(db().from("walks").update(patch).eq("id", id));

/* ------------------------------------------------------- luoghi e percorsi */
export const savePlace = (p: Partial<Place> & { campaign_id: string; name: string; lng: number; lat: number }) => {
  const { id, created_at: _created, ...row } = p;
  void _created;
  return id ? unwrap(db().from("places").update(row).eq("id", id)) : unwrap(db().from("places").insert(row));
};
export const deletePlace = (id: string) => unwrap(db().from("places").delete().eq("id", id));

export const saveRoute = (r: Partial<Route> & { campaign_id: string; name: string }) => {
  const { id, created_at: _created, ...row } = r;
  void _created;
  return id ? unwrap(db().from("routes").update(row).eq("id", id)) : unwrap(db().from("routes").insert(row));
};
export const deleteRoute = (id: string) => unwrap(db().from("routes").delete().eq("id", id));

/** Arrivo a un luogo: il database verifica la distanza. */
export const checkIn = (place: string, lng: number, lat: number) =>
  unwrap<{ distance: number; first_for_team: boolean }>(db().rpc("check_in", { p: place, lng, lat }));

/* ------------------------------------------------- recupero della password */
export const setRecovery = (question: string, answer: string) => unwrap(db().rpc("set_recovery", { question, answer }));
export const hasRecovery = () => unwrap<boolean>(db().rpc("has_recovery"));
export const recoveryQuestion = (email: string) => unwrap<string | null>(db().rpc("recovery_question", { email }));
/** true se la risposta era corretta e la password è stata cambiata. */
export const resetPassword = (email: string, answer: string, newPassword: string) =>
  unwrap<boolean>(db().rpc("reset_password", { email, answer, new_password: newPassword }));

/* ------------------------------------------- mappa pubblica e contributi */
/** Ciò che una campagna mostra al pubblico: solo contenuti validati, senza nomi. */
export interface PublicMap {
  campaign: Pick<Campaign, "id" | "name" | "description" | "starts_at" | "ends_at" | "center_lng" | "center_lat" | "zoom" | "basemap" | "basemap_url" | "basemap_opacity" | "overlay" | "public_map" | "contributions_open" | "public_intro">;
  areas: Area[];
  themes: Pick<Theme, "id" | "name" | "color">[];
  teams: Pick<Team, "id" | "name" | "color">[];
  places: Place[];
  routes: Route[];
  observations: Observation[];
  contributions: Contribution[];
  stats: { walked_m: number; visits: number; teams: number };
  datasets: Dataset[];
}
export async function loadPublicMap(id: string): Promise<PublicMap | null> {
  const map = await unwrap<PublicMap | null>(db().rpc("public_map", { c: id }));
  if (!map) return null;
  // i dati del territorio arrivano a parte: se la funzione non c'è ancora, la mappa si apre comunque
  const datasets = await unwrap<Dataset[]>(db().rpc("public_datasets", { c: id })).catch(() => [] as Dataset[]);
  return { ...map, places: map.places.filter((p) => p.placed !== false), datasets };
}

export async function addContribution(campaignId: string, userId: string, input: {
  display_name: string; form: Contribution["form"]; title: string; note: string; feeling: string | null;
  data: Record<string, unknown>; lng: number; lat: number; file: File | null;
  place_id?: string | null; dataset_id?: string | null; row_index?: number | null;
}) {
  const { file, ...rest } = input;
  const media_path = file ? await uploadMedia(campaignId, file) : null;
  return unwrap(db().from("contributions").insert({ ...rest, media_path, campaign_id: campaignId, user_id: userId }));
}
export const myContributions = (campaignId: string, userId: string) =>
  unwrap<Contribution[]>(db().from("contributions").select("*").eq("campaign_id", campaignId).eq("user_id", userId).order("created_at", { ascending: false }));
export const reviewContribution = (id: string, reviewer: string, status: Contribution["status"], review_note: string | null) =>
  unwrap(db().from("contributions").update({ status, review_note, reviewed_by: reviewer, reviewed_at: new Date().toISOString() }).eq("id", id));
export const deleteContribution = (id: string) => unwrap(db().from("contributions").delete().eq("id", id));

/* --------------------------------------------------------- accesso di regia */
export const isOrganizer = () => unwrap<boolean>(db().rpc("is_organizer"));
/** true se il codice di regia è corretto. */
export const claimOrganizer = (code: string) => unwrap<boolean>(db().rpc("claim_organizer", { code }));

/* ------------------------------------------------------- dati del territorio */
export const saveDataset = (d: Partial<Dataset> & { campaign_id: string; name: string; kind: Dataset["kind"] }) => {
  const { id, created_at: _c, ...row } = d;
  void _c;
  return id ? unwrap(db().from("datasets").update(row).eq("id", id)) : unwrap(db().from("datasets").insert(row));
};
export const deleteDataset = (id: string) => unwrap(db().from("datasets").delete().eq("id", id));
/** Inserisce molti luoghi in una volta (importazione). */
export const insertPlaces = (rows: (Partial<Place> & { campaign_id: string; name: string; lng: number; lat: number })[]) =>
  unwrap(db().from("places").insert(rows));
/** Inserisce molte aree in una volta (confini da GeoJSON). */
export const insertAreas = (rows: { campaign_id: string; name: string; color: string; geometry: Polygon }[]) =>
  unwrap(db().from("areas").insert(rows));
