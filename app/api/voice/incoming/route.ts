/**
 * VaniEdge-Pro Telephony Platform
 * POST /api/voice/incoming
 * 
 * Inbound Twilio Webhook Handler.
 * Resolves multi-tenant business profile, checks signature security,
 * creates call session, and emits TCPA disclosure + greeting TwiML.
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyTwilioWebhook } from "@/lib/telephony/security";
import { getTenantByPhone } from "@/lib/telephony/tenant-store";
import { createInboundGreetingTwiML } from "@/lib/telephony/twiml-builder";
import { createCallSession, appendTranscript } from "@/lib/telephony/failover-engine";
import { TwilioVoiceWebhookSchema } from "@/lib/telephony/types";
import { parseTelephonyRequestBody } from "@/lib/telephony/request-parser";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    // 1. Universal body parsing (urlencoded, multipart, json)
    const bodyParams = await parseTelephonyRequestBody(req);

    // 2. Validate Twilio cryptographic signature strictly
    const sigCheck = verifyTwilioWebhook(req, bodyParams);
    if (!sigCheck.valid) {
      console.warn(`[Voice Incoming] Rejected webhook: ${sigCheck.reason}`);
      return NextResponse.json(
        { error: "Unauthorized", reason: sigCheck.reason },
        { status: sigCheck.statusCode || 401 }
      );
    }

    // 3. Validate payload schema
    const parsedPayload = TwilioVoiceWebhookSchema.safeParse(bodyParams);
    const callSid = parsedPayload.success ? parsedPayload.data.CallSid : (bodyParams.CallSid || "");
    const dialedNumber = parsedPayload.success ? parsedPayload.data.To : (bodyParams.To || "");
    const callerNumber = parsedPayload.success ? parsedPayload.data.From : (bodyParams.From || "");

    // 4. Resolve multi-tenant profile
    const tenant = getTenantByPhone(dialedNumber);

    // 5. Initialize Call Session
    const session = createCallSession({
      callSid,
      tenantId: tenant.id,
      from: callerNumber,
      to: dialedNumber || tenant.phone,
      direction: "inbound",
    });

    appendTranscript(
      session,
      "system",
      `Call initiated with tenant ${tenant.id}`
    );

    // 6. Build absolute URL for process handler
    const origin = req.nextUrl.origin;
    const processActionUrl = `${origin}/api/voice/process?callSid=${encodeURIComponent(
      callSid
    )}&tenantId=${encodeURIComponent(tenant.id)}`;

    // 7. Generate TwiML response
    return createInboundGreetingTwiML({
      businessName: tenant.name,
      greetingText: tenant.voiceConfig.greeting,
      tcpaNotice: tenant.voiceConfig.tcpaConsentNotice,
      processActionUrl,
      voice: tenant.voiceConfig.pollyVoice,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error(`[Voice Incoming Error]: ${errorMsg}`);

    // Fail-safe static TwiML
    return new Response(
      `<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="Polly.Joanna-Neural">Thank you for calling. Our lines are currently experiencing high volume. Please leave your name and number right after the tone.</Say><Record maxLength="60" playBeep="true"/><Hangup/></Response>`,
      {
        status: 200,
        headers: { "Content-Type": "text/xml" },
      }
    );
  }
}
