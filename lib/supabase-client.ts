import { createClient, SupabaseClient } from "@supabase/supabase-js";

const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
const rawAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "";
const rawServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

export const isSupabaseConfigured = Boolean(
  rawUrl &&
  (rawAnonKey || rawServiceKey) &&
  rawUrl !== "https://placeholder.supabase.co" &&
  !rawUrl.includes("your-project")
);

const supabaseUrl = isSupabaseConfigured ? rawUrl : "https://placeholder.supabase.co";
// Prefer server-side service role key if available in Node.js server context, otherwise anon key
const serverKey = rawServiceKey || rawAnonKey || "placeholder-anon-key";

/**
 * Server-side Supabase client with admin/service-role capabilities when SUPABASE_SERVICE_ROLE_KEY is provided.
 */
export const supabase: SupabaseClient = createClient(supabaseUrl, serverKey, {
  auth: { persistSession: false },
});

/**
 * Public/Anonymous client for client-side or low-privilege queries adhering strictly to RLS policies.
 */
export const supabasePublic: SupabaseClient = createClient(
  supabaseUrl,
  rawAnonKey || "placeholder-anon-key",
  { auth: { persistSession: false } }
);
