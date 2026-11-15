export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
// Le integrazioni meno recenti espongono la chiave pubblica come ANON_KEY.
export const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
export const supabaseConfigured = Boolean(supabaseUrl && supabaseKey);

/** Identificativo del progetto Supabase collegato, ricavato dall'indirizzo. */
export const projectRef = supabaseUrl.match(/^https?:\/\/([^.]+)\.supabase\.co/)?.[1] ?? supabaseUrl.replace(/^https?:\/\//, "");
/** Da quale variabile arriva la chiave pubblica. */
export const keySource = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ? "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY" : process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? "NEXT_PUBLIC_SUPABASE_ANON_KEY" : "nessuna";
