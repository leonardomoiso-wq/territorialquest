/**
 * Progetto Supabase di Territorial Quest.
 *
 * L'indirizzo e la chiave publishable sono pubblici per natura (finiscono nel browser);
 * la protezione dei dati la danno le regole di accesso del database.
 * Sono fissati qui perché l'integrazione Vercel–Supabase imposta da sola le variabili
 * NEXT_PUBLIC_SUPABASE_* verso un altro progetto. Per puntare altrove senza toccare il
 * codice si usano NEXT_PUBLIC_TQ_SUPABASE_URL e NEXT_PUBLIC_TQ_SUPABASE_KEY.
 */
const PROJECT_URL = "https://btmkmvcrzknuoklyukut.supabase.co";
const PROJECT_KEY = "sb_publishable_kKJEVRCbx48gQ4ifRIsa2A_Dz2J3-Sg";

const overrideUrl = process.env.NEXT_PUBLIC_TQ_SUPABASE_URL;
const overrideKey = process.env.NEXT_PUBLIC_TQ_SUPABASE_KEY;
const overridden = Boolean(overrideUrl && overrideKey);

export const supabaseUrl = overridden ? overrideUrl! : PROJECT_URL;
export const supabaseKey = overridden ? overrideKey! : PROJECT_KEY;
export const supabaseConfigured = Boolean(supabaseUrl && supabaseKey);

/** Identificativo del progetto Supabase collegato, ricavato dall'indirizzo. */
export const projectRef = supabaseUrl.match(/^https?:\/\/([^.]+)\.supabase\.co/)?.[1] ?? supabaseUrl.replace(/^https?:\/\//, "");
/** Da dove arrivano indirizzo e chiave. */
export const keySource = overridden ? "NEXT_PUBLIC_TQ_SUPABASE_URL / _KEY" : "progetto fissato nel codice";
