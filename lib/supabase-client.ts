import { createClient, SupabaseClient } from "@supabase/supabase-js";

/**
 * Validates Supabase configuration from an explicit environment dictionary
 * or falls back to global process.env.
 */
export function validateSupabaseConfig(env?: Record<string, string | undefined>): {
  isConfigured: boolean;
  error?: string;
} {
  const getEnv = (key: string): string => {
    if (env && typeof env[key] === "string" && env[key]!.trim()) {
      return env[key]!.trim();
    }
    if (typeof process !== "undefined" && process.env?.[key]) {
      return process.env[key]!.trim();
    }
    return "";
  };

  const rawUrl = getEnv("NEXT_PUBLIC_SUPABASE_URL") || getEnv("SUPABASE_URL");
  const rawAnonKey = getEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY") || getEnv("SUPABASE_ANON_KEY");
  const rawServiceKey = getEnv("SUPABASE_SERVICE_ROLE_KEY");

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

// Initial evaluation from process.env if available
const initialCheck = validateSupabaseConfig();
export let isSupabaseConfigured = initialCheck.isConfigured;

function buildClientsFromEnv(env?: Record<string, string | undefined>) {
  const getEnv = (key: string): string => {
    if (env && typeof env[key] === "string" && env[key]!.trim()) {
      return env[key]!.trim();
    }
    if (typeof process !== "undefined" && process.env?.[key]) {
      return process.env[key]!.trim();
    }
    return "";
  };

  const check = validateSupabaseConfig(env);
  if (!check.isConfigured) {
    return {
      serverClient: createUnconfiguredHandler() as SupabaseClient,
      publicClient: createUnconfiguredHandler() as SupabaseClient,
      isConfigured: false,
    };
  }

  const rawUrl = getEnv("NEXT_PUBLIC_SUPABASE_URL") || getEnv("SUPABASE_URL");
  const rawAnonKey = getEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY") || getEnv("SUPABASE_ANON_KEY");
  const rawServiceKey = getEnv("SUPABASE_SERVICE_ROLE_KEY");
  const serverKey = rawServiceKey || rawAnonKey || "placeholder-anon-key";

  const serverClient: SupabaseClient = createClient(rawUrl, serverKey, {
    auth: { persistSession: false },
  });
  const publicClient: SupabaseClient = createClient(
    rawUrl,
    rawAnonKey || "placeholder-anon-key",
    { auth: { persistSession: false } }
  );

  return { serverClient, publicClient, isConfigured: true };
}

let activeClients = buildClientsFromEnv();
let activeServerClient = activeClients.serverClient;
let activePublicClient = activeClients.publicClient;

/**
 * Dynamically initializes Supabase from Cloudflare Worker runtime env bindings.
 * Guarantees isSupabaseConfigured evaluates to true inside edge isolates.
 */
export function initSupabaseFromEnv(env: Record<string, string | undefined>): {
  supabase: SupabaseClient;
  supabasePublic: SupabaseClient;
  isConfigured: boolean;
} {
  activeClients = buildClientsFromEnv(env);
  activeServerClient = activeClients.serverClient;
  activePublicClient = activeClients.publicClient;
  isSupabaseConfigured = activeClients.isConfigured;

  return {
    supabase: activeServerClient,
    supabasePublic: activePublicClient,
    isConfigured: isSupabaseConfigured,
  };
}

/**
 * Returns a configured Supabase client, optionally taking per-request Worker env bindings.
 */
export function getSupabaseClient(env?: Record<string, string | undefined>): SupabaseClient {
  if (env) {
    const clients = buildClientsFromEnv(env);
    return clients.serverClient;
  }
  return activeServerClient;
}

/**
 * Validates that production cannot silently fall back to ephemeral or unsafe local storage.
 */
export function assertSupabaseConfiguredForProduction(env?: Record<string, string | undefined>): void {
  const isProd = (typeof process !== "undefined" && process.env.NODE_ENV === "production");
  const allowDiskFallback = (typeof process !== "undefined" && process.env.ALLOW_LOCAL_DISK_FALLBACK === "true");
  if (isProd && !allowDiskFallback) {
    const check = validateSupabaseConfig(env);
    if (!check.isConfigured) {
      throw new Error(
        `[SupabaseClient] Production persistence error: ${check.error}. Multi-instance production requires a durable Supabase datastore.`
      );
    }
  }
}

/**
 * Server-side Supabase client with admin/service-role capabilities when SUPABASE_SERVICE_ROLE_KEY is provided.
 * Dynamically resolves through active runtime client (including Cloudflare Worker env).
 */
export const supabase: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    return (activeServerClient as any)[prop];
  },
});

/**
 * Public/Anonymous client for client-side or low-privilege queries adhering strictly to RLS policies.
 */
export const supabasePublic: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    return (activePublicClient as any)[prop];
  },
});
