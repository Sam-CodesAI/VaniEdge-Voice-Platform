/**
 * VaniEdge-Pro Telephony Platform
 * POST /api/voice/transfer-status
 * 
 * Handles Twilio <Dial> action callback.
 * If technician does not answer (busy / no-answer / timeout), catches the call
 * and gracefully routes caller to high-priority recording without dropping them.
 */

import { NextRequest } from "next/server";
import { getTenantById } from "@/lib/telephony/tenant-store";
import { getCallSession, appendTranscript, executeTier2Fallback } from "@/lib/telephony/failover-engine";
import { TwiMLBuilder } from "@/lib/telephony/twiml-builder";
import { parseTelephonyRequestBody } from "@/lib/telephony/request-parser";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const callSid = req.nextUrl.searchParams.get("callSid") || "";
  const tenantId = req.nextUrl.searchParams.get("tenantId") || "apex-hvac";
  const tenant = getTenantById(tenantId);
  const session = getCallSession(callSid);

  let dialStatus = "completed";
  try {
    const bodyParams = await parseTelephonyRequestBody(req);
    dialStatus = bodyParams.DialCallStatus || "completed";
  } catch {
    // default to completed
  }

  // If technician answered and call ended naturally
  if (dialStatus === "completed" || dialStatus === "answered") {
    const builder = new TwiMLBuilder(tenant.voiceConfig.pollyVoice);
    builder.say("Thank you for calling. Have a great day.");
    builder.hangup();
    return builder.toResponse();
  }

  // If technician didn't answer (no-answer, busy, failed, canceled)
  if (session) {
    appendTranscript(
      session,
      "system",
      `[Transfer Fallback] Technician did not answer (DialStatus: ${dialStatus}). Routing to Tier 2 recording.`
    );

    const recordingActionUrl = `${req.nextUrl.origin}/api/voice/recording?callSid=${encodeURIComponent(
      callSid
    )}&tenantId=${encodeURIComponent(tenant.id)}`;

    const { twimlResponse } = executeTier2Fallback({
      session,
      tenant,
      recordingActionUrl,
      reason: "api_error",
    });

    return twimlResponse;
  }

  const builder = new TwiMLBuilder(tenant.voiceConfig.pollyVoice);
  builder.say(
    "Our technician is currently on another call. Please leave your name and address after the tone."
  );
  builder.record({ action: `${req.nextUrl.origin}/api/voice/recording`, playBeep: true });
  builder.hangup();
  return builder.toResponse();
}
