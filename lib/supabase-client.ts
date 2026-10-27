import { createClient, SupabaseClient } from "@supabase/supabase-js";

const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
const rawAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "";
const rawServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

export function validateSupabaseConfig(): { isConfigured: boolean; error?: string } {
  if (!rawUrl) {
    return { isConfigured: false, error: "Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_URL" };
  }
  if (!rawAnonKey && !rawServiceKey) {
    return { isConfigured: false, error: "Missing SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY" };
  }
  if (
    rawUrl === "https://placeholder.supabase.co" ||
    rawUrl.includes("your-project") ||
    rawAnonKey === "placeholder-anon-key"
  ) {
    return { isConfigured: false, error: "Supabase credentials are set to default placeholders" };
  }
  return { isConfigured: true };
}

const configStatus = validateSupabaseConfig();
export const isSupabaseConfigured = configStatus.isConfigured;

/**
 * Creates an unconfigured dummy builder that fails safely with an explicit error
 * rather than issuing network requests to invalid placeholder URLs.
 */
function createUnconfiguredHandler(): any {
  const unconfiguredError = {
    message: "Supabase client is not configured: valid SUPABASE_URL and keys are required.",
    details: "Unconfigured client",
    hint: "Configure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your environment.",
    code: "PGRST_UNCONFIGURED",
  };

  const builder: any = {
    select: () => builder,
    insert: () => builder,
    update: () => builder,
    upsert: () => builder,
    delete: () => builder,
    eq: () => builder,
    neq: () => builder,
    in: () => builder,
    order: () => builder,
    limit: () => builder,
    single: () => Promise.resolve({ data: null, error: unconfiguredError }),
    then: (onfulfilled: (value: any) => any) =>
      Promise.resolve(onfulfilled({ data: null, error: unconfiguredError })),
  };

  return {
    from: () => builder,
    auth: {
      getUser: () => Promise.resolve({ data: { user: null }, error: unconfiguredError }),
      getSession: () => Promise.resolve({ data: { session: null }, error: unconfiguredError }),
    },
  };
}

const realSupabaseUrl = isSupabaseConfigured ? rawUrl : "https://placeholder.supabase.co";
const serverKey = rawServiceKey || rawAnonKey || "placeholder-anon-key";

const rawServerClient: SupabaseClient = createClient(realSupabaseUrl, serverKey, {
  auth: { persistSession: false },
});

const rawPublicClient: SupabaseClient = createClient(
  realSupabaseUrl,
  rawAnonKey || "placeholder-anon-key",
  { auth: { persistSession: false } }
);

/**
 * Server-side Supabase client with admin/service-role capabilities when SUPABASE_SERVICE_ROLE_KEY is provided.
 * Fails safely with explicit PostgrestError when unconfigured.
 */
export const supabase: SupabaseClient = isSupabaseConfigured
  ? rawServerClient
  : (createUnconfiguredHandler() as SupabaseClient);

/**
 * Public/Anonymous client for client-side or low-privilege queries adhering strictly to RLS policies.
 */
export const supabasePublic: SupabaseClient = isSupabaseConfigured
  ? rawPublicClient
  : (createUnconfiguredHandler() as SupabaseClient);
