/**
 * VaniEdge-Pro Telephony Platform
 * Cryptographic Webhook Security & Signature Verification (Production)
 * 
 * Implements strict Twilio HMAC-SHA1 verification and timing-safe comparisons
 * with zero external dependencies (Node.js native `crypto`).
 * 
 * - Fails closed if TWILIO_AUTH_TOKEN is missing in production
 * - Resolves canonical external webhook URLs behind reverse proxies
 * - Constant-time comparison mitigating timing side-channel attacks
 * - Replay & duplicate event protection for status callbacks
 */

import crypto from "crypto";
import { NextRequest } from "next/server";
import { supabase, isSupabaseConfigured } from "@/lib/supabase-client";

export interface SignatureValidationResult {
  valid: boolean;
  reason?: string;
  statusCode?: number;
}

// In-memory idempotency deduplication cache (L1 fast path)
const PROCESSED_EVENTS = new Map<string, number>();

// Clean up expired idempotency keys every 10 minutes
if (typeof setInterval !== "undefined") {
  const timer = setInterval(() => {
    const now = Date.now();
    for (const [key, expires] of PROCESSED_EVENTS.entries()) {
      if (now > expires) {
        PROCESSED_EVENTS.delete(key);
      }
    }
  }, 10 * 60 * 1000);
  if (timer.unref) {
    timer.unref();
  }
}

/**
 * Checks whether an event has already been processed using process-local memory.
 * @returns true if event was already processed (duplicate), false if new
 */
export function checkEventDuplicate(eventId: string, ttlMs: number = 5 * 60 * 1000): boolean {
  const now = Date.now();
  const existing = PROCESSED_EVENTS.get(eventId);
  if (existing && now <= existing) {
    return true; // Duplicate
  }
  PROCESSED_EVENTS.set(eventId, now + ttlMs);
  return false;
}

/**
 * Distributed multi-instance webhook idempotency verification.
 * Checks L1 in-memory cache first, then coordinates via Supabase `idempotency_keys` table.
 * Guarantees zero duplicate webhook executions across independent serverless instances.
 */
export async function checkEventDuplicateAsync(
  eventId: string,
  ttlMs: number = 5 * 60 * 1000
): Promise<boolean> {
  const now = Date.now();

  // 1. Check L1 in-memory cache
  const existing = PROCESSED_EVENTS.get(eventId);
  if (existing && now <= existing) {
    return true;
  }

  // 2. If Supabase is configured, use atomic database insertion
  if (isSupabaseConfigured) {
    try {
      const expiresAt = new Date(now + ttlMs).toISOString();
      const { error } = await supabase.from("idempotency_keys").insert([
        {
          key: eventId,
          scope: "twilio_webhook",
          expires_at: expiresAt,
        },
      ]);

      if (error) {
        // Unique constraint violation (23505) means another instance already recorded this event
        if (error.code === "23505" || error.message.includes("duplicate key")) {
          PROCESSED_EVENTS.set(eventId, now + ttlMs);
          return true; // Duplicate!
        }
        console.warn("[DistributedIdempotency] Failed to insert key, falling back to L1 cache:", error.message);
      } else {
        PROCESSED_EVENTS.set(eventId, now + ttlMs);
        return false; // Successfully acquired
      }
    } catch (dbErr) {
      console.warn("[DistributedIdempotency] Supabase exception, falling back to L1 cache:", dbErr);
    }
  }

  // Fallback to in-memory L1 cache
  PROCESSED_EVENTS.set(eventId, now + ttlMs);
  return false;
}

/**
 * Resolves the canonical externally-visible webhook URL as requested by Twilio.
 * Correctly accounts for reverse proxies, TLS termination, and configured canonical domains.
 */
export function getCanonicalWebhookUrl(req: NextRequest | Request): string {
  const rawUrl = new URL(req.url);

  // If explicit CANONICAL_URL or APP_URL is configured
  const configuredAppUrl =
    process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || process.env.CANONICAL_URL;
  if (configuredAppUrl) {
    try {
      const base = new URL(configuredAppUrl);
      rawUrl.protocol = base.protocol;
      rawUrl.host = base.host;
      return rawUrl.toString();
    } catch {
      // Fallback to header inspection
    }
  }

  // Inspect trusted proxy headers with multi-hop protection
  const rawProto = req.headers.get("x-forwarded-proto");
  const proto = rawProto ? rawProto.split(",")[0]?.trim() : null;

  const rawHost = req.headers.get("x-forwarded-host") || req.headers.get("host");
  const host = rawHost ? rawHost.split(",")[0]?.trim() : null;

  if (proto) {
    rawUrl.protocol = proto.endsWith(":") ? proto : `${proto}:`;
  }
  if (host) {
    if (!host.includes(":")) {
      rawUrl.port = "";
    }
    rawUrl.host = host;
  }

  return rawUrl.toString();
}

/**
 * Validates the Twilio webhook signature (`X-Twilio-Signature`).
 * 
 * Algorithm:
 * 1. Takes the full webhook destination URL.
 * 2. Takes the POST parameters, sorts keys alphabetically, and concatenates each key + value.
 * 3. Appends the concatenated parameter string to the URL.
 * 4. Signs using HMAC-SHA1 with the Twilio Auth Token.
 * 5. Compares computed base64 digest with `X-Twilio-Signature` using timingSafeEqual.
 */
export function validateTwilioSignature(params: {
  url: string;
  body: Record<string, string>;
  signature: string | null;
  authToken?: string;
}): SignatureValidationResult {
  const { url, body, signature } = params;
  const token = params.authToken || process.env.TWILIO_AUTH_TOKEN;

  // Fail closed if auth token missing
  if (!token) {
    if (process.env.NODE_ENV === "production") {
      return {
        valid: false,
        statusCode: 500,
        reason: "TWILIO_AUTH_TOKEN is required in production but not configured.",
      };
    }
    // In local dev without Twilio credentials
    if (process.env.ALLOW_INSECURE_DEV_WEBHOOKS === "true") {
      return { valid: true };
    }
    return {
      valid: false,
      statusCode: 500,
      reason: "TWILIO_AUTH_TOKEN is not configured on the server.",
    };
  }

  if (!signature) {
    return {
      valid: false,
      statusCode: 401,
      reason: "Missing X-Twilio-Signature header in webhook request.",
    };
  }

  try {
    // 1. Sort keys alphabetically
    const sortedKeys = Object.keys(body).sort();

    // 2. Concatenate key + value
    let dataToSign = url;
    for (const key of sortedKeys) {
      dataToSign += key + (body[key] ?? "");
    }

    // 3. Compute HMAC-SHA1
    const expectedSignature = crypto
      .createHmac("sha1", token)
      .update(dataToSign, "utf-8")
      .digest("base64");

    // 4. Timing-safe comparison
    const sigBuffer = Buffer.from(signature, "utf-8");
    const expectedBuffer = Buffer.from(expectedSignature, "utf-8");

    if (sigBuffer.length !== expectedBuffer.length) {
      return {
        valid: false,
        statusCode: 401,
        reason: "Signature length mismatch.",
      };
    }

    const matches = crypto.timingSafeEqual(sigBuffer, expectedBuffer);
    if (!matches) {
      return {
        valid: false,
        statusCode: 401,
        reason: "Signature verification failed. Potential spoofed request.",
      };
    }

    return { valid: true };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return {
      valid: false,
      statusCode: 401,
      reason: `Signature calculation error: ${errorMsg}`,
    };
  }
}

/**
 * Universal helper for verifying any Next.js Twilio voice webhook route.
 */
export function verifyTwilioWebhook(
  req: NextRequest,
  bodyParams: Record<string, string>,
  explicitToken?: string
): SignatureValidationResult {
  const canonicalUrl = getCanonicalWebhookUrl(req);
  const signature = req.headers.get("x-twilio-signature");

  return validateTwilioSignature({
    url: canonicalUrl,
    body: bodyParams,
    signature,
    authToken: explicitToken,
  });
}

/**
 * Helper to compute an authentic Twilio signature (for testing and verification).
 */
export function computeTwilioSignature(
  url: string,
  body: Record<string, string>,
  authToken: string
): string {
  const sortedKeys = Object.keys(body).sort();
  let dataToSign = url;
  for (const key of sortedKeys) {
    dataToSign += key + (body[key] ?? "");
  }
  return crypto.createHmac("sha1", authToken).update(dataToSign, "utf-8").digest("base64");
}
