/**
 * VaniEdge-Pro Telephony Platform
 * Cryptographic Webhook Security & Signature Verification (Production)
 * 
 * Implements strict Twilio HMAC-SHA1 verification and timing-safe comparisons
 * with zero external dependencies (Node.js native `crypto`).
 */

import crypto from "crypto";

export interface SignatureValidationResult {
  valid: boolean;
  reason?: string;
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

  if (!token) {
    return {
      valid: false,
      reason: "TWILIO_AUTH_TOKEN is not configured on the server.",
    };
  }

  if (!signature) {
    return {
      valid: false,
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
        reason: "Signature length mismatch.",
      };
    }

    const matches = crypto.timingSafeEqual(sigBuffer, expectedBuffer);
    if (!matches) {
      return {
        valid: false,
        reason: "Signature verification failed. Potential spoofed request.",
      };
    }

    return { valid: true };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return {
      valid: false,
      reason: `Signature calculation error: ${errorMsg}`,
    };
  }
}

/**
 * Helper to compute an authentic Twilio signature.
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
