/**
 * VaniEdge-Pro Telephony Platform
 * POST /api/voice/process
 * 
 * Handles speech recognition results from Twilio <Gather>, classifies intent,
 * and routes to either Conversational TwiML, Warm Transfer, or Tier 2 Recording.
 */

import { NextRequest } from "next/server";
import { getTenantById } from "@/lib/telephony/tenant-store";
import { classifyWithAi } from "@/lib/telephony/intent-classifier";
import {
  createCallSession,
  getCallSession,
  appendTranscript,
  executeTier2Fallback,
  executeTier3WarmTransfer,
  transitionCallPhase,
  persistSessionToDatabase,
} from "@/lib/telephony/failover-engine";
import { TwiMLBuilder } from "@/lib/telephony/twiml-builder";
import { TwilioVoiceWebhookSchema } from "@/lib/telephony/types";
import { parseTelephonyRequestBody } from "@/lib/telephony/request-parser";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  let callSid = req.nextUrl.searchParams.get("callSid") || "";
  let tenantId = req.nextUrl.searchParams.get("tenantId") || "apex-hvac";

  try {
    const bodyParams = await parseTelephonyRequestBody(req);

    const parsed = TwilioVoiceWebhookSchema.safeParse(bodyParams);
    if (parsed.success) {
      if (parsed.data.CallSid) callSid = parsed.data.CallSid;
    }

    if (!callSid) {
      callSid = `CALL_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    }

    const tenant = getTenantById(tenantId);
    let session = getCallSession(callSid);
    if (!session) {
      session = createCallSession({
        callSid,
        tenantId: tenant.id,
        from: (bodyParams.From as string) || (bodyParams.from as string) || "+10000000000",
        to: (bodyParams.To as string) || (bodyParams.to as string) || tenant.phone,
      });
    }

    const speechResult = bodyParams.SpeechResult || bodyParams.speech || "";
    const digits = bodyParams.Digits || bodyParams.digits || "";

    // 1. If silence or no speech detected
    if (!speechResult && !digits) {
      const builder = new TwiMLBuilder(tenant.voiceConfig.pollyVoice);
      builder.say("I didn't hear anything. If you're experiencing an emergency or need to book service, please speak after the tone.");
      const origin = req.nextUrl.origin;
      builder.gather({
        action: `${origin}/api/voice/process?callSid=${encodeURIComponent(callSid)}&tenantId=${encodeURIComponent(tenant.id)}`,
        input: "speech dtmf",
        timeout: 4,
      });
      builder.say("We did not receive any input. Thank you for calling. Goodbye.");
      builder.hangup();
      return builder.toResponse();
    }

    const userInput = speechResult || `Keypress DTMF: ${digits}`;
    appendTranscript(session, "caller", userInput);
    transitionCallPhase(session, "processing_ai");

    // 2. Classify intent via Hybrid Engine (Regex -> Groq -> Gemini)
    const intentResult = await classifyWithAi({
      callerSpeech: userInput,
      tenant,
      timeoutMs: 1400,
    });

    const elapsed = Date.now() - startTime;
    session.latencyMs.total = elapsed;
    session.intent = intentResult.intent;
    appendTranscript(session, "agent", intentResult.replyText);

    const origin = req.nextUrl.origin;

    // 3. Action Routing: Warm Transfer on Emergency or Live Human Request
    if (intentResult.action === "transfer" || intentResult.emergencyDetected) {
      const whisperUrl = `${origin}/api/voice/whisper?emergency=${encodeURIComponent(
        intentResult.emergencyKeyword || "urgent"
      )}&tenantId=${encodeURIComponent(tenant.id)}`;

      const fallbackActionUrl = `${origin}/api/voice/transfer-status?callSid=${encodeURIComponent(
        callSid
      )}&tenantId=${encodeURIComponent(tenant.id)}`;

      const { twimlResponse } = executeTier3WarmTransfer({
        session,
        tenant,
        whisperUrl,
        fallbackActionUrl,
        emergencyReason: intentResult.emergencyKeyword,
      });
      await persistSessionToDatabase(session);
      return twimlResponse;
    }

    // 4. Action Routing: Conversational Dialog with Polly Neural Voice
    const builder = new TwiMLBuilder(tenant.voiceConfig.pollyVoice);
    builder.say(intentResult.replyText);

    // Follow-up gather if inquiry continues
    const nextActionUrl = `${origin}/api/voice/process?callSid=${encodeURIComponent(
      callSid
    )}&tenantId=${encodeURIComponent(tenant.id)}`;

    builder.gather({
      action: nextActionUrl,
      input: "speech dtmf",
      speechTimeout: "auto",
      timeout: 4,
    });

    // If caller finishes speaking or stays silent after agent reply
    builder.say("Thank you for calling. If you need any further assistance, feel free to call back anytime. Goodbye.");
    builder.hangup();

    if (session) {
      transitionCallPhase(session, "gathering_intent");
      await persistSessionToDatabase(session);
    }

    return builder.toResponse();
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error(`[Voice Process Error]: ${errorMsg}`);

    const tenant = getTenantById(tenantId);
    let session = getCallSession(callSid);

    // Tier 2 Fallback Circuit Breaker
    if (session) {
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

    // Static safe TwiML fallback
    return new Response(
      `<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="Polly.Joanna-Neural">We encountered a temporary connection issue. Please state your message right after the tone.</Say><Record maxLength="60"/><Hangup/></Response>`,
      { status: 200, headers: { "Content-Type": "text/xml" } }
    );
  }
}
