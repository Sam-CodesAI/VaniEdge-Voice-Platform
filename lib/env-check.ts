/**
 * VaniEdge Voice Platform
 * Configuration & Environment Pre-Flight Health Validator
 * 
 * Verifies required environment variables without printing secret values.
 */

export interface EnvValidationReport {
  isValid: boolean;
  isProduction: boolean;
  warnings: string[];
  errors: string[];
  configuredProviders: {
    twilio: boolean;
    elevenlabs: boolean;
    supabase: boolean;
    awsPolly: boolean;
  };
}

export function validateEnvironment(): EnvValidationReport {
  const isProduction = process.env.NODE_ENV === "production";
  const errors: string[] = [];
  const warnings: string[] = [];

  const hasTwilioSid = Boolean(process.env.TWILIO_ACCOUNT_SID);
  const hasTwilioToken = Boolean(process.env.TWILIO_AUTH_TOKEN);
  const hasTwilio = hasTwilioSid && hasTwilioToken;

  const hasElevenLabsKey = Boolean(process.env.ELEVENLABS_API_KEY);
  const hasElevenLabsAgent = Boolean(process.env.ELEVENLABS_AGENT_ID);
  const hasElevenLabs = hasElevenLabsKey || hasElevenLabsAgent;

  const hasSupabaseUrl = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && !process.env.NEXT_PUBLIC_SUPABASE_URL.includes("placeholder"));
  const hasSupabaseKey = Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY);
  const hasSupabase = hasSupabaseUrl && hasSupabaseKey;

  const hasPolly = Boolean(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY);

  if (isProduction) {
    if (!hasTwilioToken) {
      errors.push("TWILIO_AUTH_TOKEN is required in production for webhook cryptographic verification.");
    }
    if (!hasTwilioSid) {
      errors.push("TWILIO_ACCOUNT_SID is required in production for carrier voice telephony.");
    }
    if (!hasElevenLabs) {
      warnings.push("ELEVENLABS_API_KEY is not configured. Conversational AI agent will fall back to local responses.");
    }
    if (!hasSupabase) {
      warnings.push("Supabase credentials not configured; using local resilient disk storage for auth and tenants.");
    }
  } else {
    if (!hasTwilioToken) {
      warnings.push("TWILIO_AUTH_TOKEN is not configured; set ALLOW_INSECURE_DEV_WEBHOOKS=true for offline local testing.");
    }
  }

  return {
    isValid: errors.length === 0,
    isProduction,
    warnings,
    errors,
    configuredProviders: {
      twilio: hasTwilio,
      elevenlabs: hasElevenLabs,
      supabase: hasSupabase,
      awsPolly: hasPolly,
    },
  };
}
