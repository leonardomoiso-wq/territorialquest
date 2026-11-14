import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseKey, supabaseUrl } from "./env";

let client: SupabaseClient | undefined;

/** Client Supabase per il browser (unica istanza). */
export const createClient = () => (client ??= createBrowserClient(supabaseUrl, supabaseKey));
