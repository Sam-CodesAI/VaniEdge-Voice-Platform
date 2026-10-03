/**
 * VaniEdge-Pro Telephony Platform
 * Idempotent SMS & Omnichannel Dispatcher
 * 
 * Sends Twilio SMS with strict 1-hour cooldown deduplication per recipient,
 * ensuring callers are never spammed during failover cascades.
 */

// In-memory cooldown cache: phone -> timestamp
const SMS_COOLDOWN_CACHE = new Map<string, number>();
const COOLDOWN_WINDOW_MS = 60 * 60 * 1000; // 1 hour

export interface SmsSendParams {
  toPhone: string;
  fromPhone?: string;
  message: string;
  tenantId?: string;
  forceBypassCooldown?: boolean;
}

export interface SmsSendResult {
  success: boolean;
  messageSid?: string;
  isSimulated?: boolean;
  reason?: string;
}

/**
 * Normalizes phone numbers to standard E.164 digits format.
 */
function normalizePhone(phone: string): string {
  const digits = phone.replace(/[^\d+]/g, "");
  if (!digits.startsWith("+") && digits.length === 10) {
    return `+1${digits}`;
  }
  return digits;
}

/**
 * Checks if a recipient is currently in the cooldown window.
 */
export function isRecipientOnCooldown(toPhone: string): boolean {
  const normalized = normalizePhone(toPhone);
  const lastSent = SMS_COOLDOWN_CACHE.get(normalized);
  if (!lastSent) return false;
  return Date.now() - lastSent < COOLDOWN_WINDOW_MS;
}

/**
 * Dispatches an SMS rescue message via Twilio REST API.
 */
export async function sendSmsRescue(params: SmsSendParams): Promise<SmsSendResult> {
  const { toPhone, fromPhone, message, forceBypassCooldown = false } = params;
  const normalizedTo = normalizePhone(toPhone);

  // 1. Check Cooldown
  if (!forceBypassCooldown && isRecipientOnCooldown(normalizedTo)) {
    return {
      success: false,
      reason: `Recipient ${normalizedTo} is on 1-hour cooldown. Suppressing duplicate SMS.`,
    };
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const defaultFrom = process.env.TWILIO_PHONE_NUMBER || "+18149613703";
  const senderNumber = fromPhone ? normalizePhone(fromPhone) : defaultFrom;

  // 2. Dev / Simulated Bypass (or +1-555 fictional test numbers)
  const isFictionalTestNumber = normalizedTo.startsWith("+1555") || normalizedTo.startsWith("1555");
  if (!accountSid || !authToken || accountSid.includes("your-twilio") || isFictionalTestNumber) {
    console.log(`[SMS Simulator] To: ${normalizedTo} | From: ${senderNumber} | Text: "${message}"`);
    SMS_COOLDOWN_CACHE.set(normalizedTo, Date.now());
    return {
      success: true,
      messageSid: `SM_SIMULATED_${Date.now()}`,
      isSimulated: true,
    };
  }

  try {
    const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    const formParams = new URLSearchParams({
      To: normalizedTo,
      From: senderNumber,
      Body: message,
    });

    const authHeader = "Basic " + Buffer.from(`${accountSid}:${authToken}`).toString("base64");

    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formParams.toString(),
    });

    if (!res.ok) {
      const errJson = (await res.json().catch(() => ({}))) as {
        message?: string;
        code?: number;
      };
      const errMsg = errJson.message || `Twilio HTTP ${res.status}`;
      console.error(`[SMS Service] Failed to send SMS to ${normalizedTo}: ${errMsg}`);
      return {
        success: false,
        reason: errMsg,
      };
    }

    const data = (await res.json()) as { sid?: string };
    const sid = data.sid || `SM_${Date.now()}`;

    // Record cooldown
    SMS_COOLDOWN_CACHE.set(normalizedTo, Date.now());
    console.log(`[SMS Service] Dispatched SMS rescue to ${normalizedTo} (SID: ${sid})`);

    return {
      success: true,
      messageSid: sid,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error(`[SMS Service] Network error sending SMS: ${errorMsg}`);
    return {
      success: false,
      reason: errorMsg,
    };
  }
}

/**
 * Clear cooldown for testing purposes.
 */
export function resetCooldownForTesting(toPhone?: string): void {
  if (toPhone) {
    SMS_COOLDOWN_CACHE.delete(normalizePhone(toPhone));
  } else {
    SMS_COOLDOWN_CACHE.clear();
  }
}
