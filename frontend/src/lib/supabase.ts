import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env["VITE_SUPABASE_URL"];
const supabaseAnonKey = import.meta.env["VITE_SUPABASE_ANON_KEY"];

let client: SupabaseClient | null = null;

export const supabaseConfigMissing = !supabaseUrl || !supabaseAnonKey;

export function getSupabaseClient(): SupabaseClient | null {
  if (supabaseConfigMissing) return null;
  client ??= createClient(supabaseUrl, supabaseAnonKey);
  return client;
}

export const supabaseConfigMessage =
  "Configurează VITE_SUPABASE_URL și VITE_SUPABASE_ANON_KEY în frontend/.env.local.";
