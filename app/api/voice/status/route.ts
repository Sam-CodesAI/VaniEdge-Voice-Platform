/**
 * VaniEdge-Pro Telephony Platform
 * POST /api/voice/status
 * 
 * Handles Twilio Call StatusCallbacks.
 * Monitors duration and disconnect reasons; triggers Tier 4 SMS Rescue
 * if call was dropped prematurely (<15s) or encountered a busy/failed state.
 */

import { NextRequest, NextResponse } from "next/server";
import { getTenantById } from "@/lib/telephony/tenant-store";
import {
  getCallSession,
  executeTier4SmsRescue,
  transitionCallPhase,
  appendTranscript,
  persistSessionToDatabase,
} from "@/lib/telephony/failover-engine";
import { TwilioStatusCallbackSchema } from "@/lib/telephony/types";
import { parseTelephonyRequestBody } from "@/lib/telephony/request-parser";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const bodyParams = await parseTelephonyRequestBody(req);

    const parsed = TwilioStatusCallbackSchema.safeParse(bodyParams);
    const callSid = parsed.success ? parsed.data.CallSid : bodyParams.CallSid || "";
    const callStatus = parsed.success ? parsed.data.CallStatus : bodyParams.CallStatus || "completed";
    const durationSec = parseInt(bodyParams.CallDuration || bodyParams.Duration || "0", 10);

    const session = getCallSession(callSid);
    const tenantId = session?.tenantId || req.nextUrl.searchParams.get("tenantId") || "apex-hvac";
    const tenant = getTenantById(tenantId);

    // 1. Detect Dropped Calls & Trigger Tier 4 SMS Rescue
    // Criteria:
    // a) Call status is busy, failed, or no-answer
    // b) Call completed with duration under 15 seconds (caller abandoned or disconnected)
    const isAborted = callStatus === "busy" || callStatus === "failed" || callStatus === "no-answer";
    const isShortDrop = callStatus === "completed" && durationSec < 15 && durationSec > 0;

    let rescueTriggered = false;

    if (session && (isAborted || isShortDrop) && !session.smsRescueSent) {
      const reason = isAborted ? "api_error" : "caller_hangup";
      const rescueRes = await executeTier4SmsRescue({
        session,
        tenant,
        reason,
      });

      rescueTriggered = rescueRes.success;
      appendTranscript(
        session,
        "system",
        `[Status Callback] Call ended (Status: ${callStatus}, Duration: ${durationSec}s). SMS Rescue: ${
          rescueTriggered ? "DISPATCHED" : "SUPPRESSED (" + (rescueRes.reason || "cooldown") + ")"
        }`
      );
    } else if (session) {
      transitionCallPhase(session, "completed");
      appendTranscript(
        session,
        "system",
        `[Status Callback] Call completed normally (Duration: ${durationSec}s).`
      );
    }

    if (session) {
      await persistSessionToDatabase(session);
    }

    return NextResponse.json({
      status: "ok",
      callSid,
      callStatus,
      durationSec,
      rescueTriggered,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error(`[Voice Status Callback Error]: ${errorMsg}`);
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
