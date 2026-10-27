/**
 * VaniEdge-Pro Telephony Platform
 * POST /api/voice/whisper
 * 
 * Plays private whisper audio to the on-call technician before bridging the call.
 * Enforces cryptographic Twilio request validation.
 */

import { NextRequest } from "next/server";
import { getTenantById } from "@/lib/telephony/tenant-store";
import { TwiMLBuilder } from "@/lib/telephony/twiml-builder";
import { verifyTwilioWebhook } from "@/lib/telephony/security";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const sigCheck = verifyTwilioWebhook(req, {});
  if (!sigCheck.valid) {
    console.warn(`[Voice Whisper] Rejected unauthorized webhook: ${sigCheck.reason}`);
    return new Response("Unauthorized", { status: sigCheck.statusCode || 401 });
  }

  const emergency = req.nextUrl.searchParams.get("emergency") || "emergency repair";
  const tenantId = req.nextUrl.searchParams.get("tenantId") || "apex-hvac";
  const tenant = getTenantById(tenantId);

  const builder = new TwiMLBuilder(tenant.voiceConfig.pollyVoice);
  builder.say(
    `Incoming priority call for ${tenant.name} regarding: ${emergency}. Connecting you to the caller now.`
  );

  return builder.toResponse();
}

export async function GET(req: NextRequest) {
  return POST(req);
}
