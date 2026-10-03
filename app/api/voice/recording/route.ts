/**
 * VaniEdge-Pro Telephony Platform
 * POST /api/voice/recording
 * 
 * Handles Twilio Voicemail Recording Callbacks.
 * Captures audio recording URL, attaches to call session,
 * and triggers immediate email notification via Gmail SMTP.
 */

import { NextRequest } from "next/server";
import { getTenantById } from "@/lib/telephony/tenant-store";
import {
  getCallSession,
  appendTranscript,
  transitionCallPhase,
  persistSessionToDatabase,
} from "@/lib/telephony/failover-engine";
import { TwiMLBuilder } from "@/lib/telephony/twiml-builder";
import { sendGmailMessage } from "@/lib/email/gmail";
import { parseTelephonyRequestBody } from "@/lib/telephony/request-parser";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const callSid = req.nextUrl.searchParams.get("callSid") || "";
  const tenantId = req.nextUrl.searchParams.get("tenantId") || "apex-hvac";
  const tenant = getTenantById(tenantId);
  const session = getCallSession(callSid);

  let recordingUrl = "";
  let recordingDuration = "0";
  let transcriptionText = "";

  try {
    const bodyParams = await parseTelephonyRequestBody(req);
    recordingUrl = bodyParams.RecordingUrl || "";
    recordingDuration = bodyParams.RecordingDuration || "0";
    transcriptionText = bodyParams.TranscriptionText || "";
  } catch {
    // default
  }

  if (session && recordingUrl) {
    session.recordingUrl = recordingUrl;
    transitionCallPhase(session, "completed");
    appendTranscript(
      session,
      "system",
      `[Voicemail Captured] Duration: ${recordingDuration}s | URL: ${recordingUrl} ${
        transcriptionText ? `| Text: "${transcriptionText}"` : ""
      }`
    );
    await persistSessionToDatabase(session);

    // Dispatch instant email alert to technician/owner via Gmail SMTP
    const callerPhone = session.from || "Unknown Number";
    sendGmailMessage({
      to: process.env.ADMIN_NOTIFY_EMAIL || "samarthknimangre@gmail.com",
      subject: `🚨 [Urgent Voicemail] New Lead for ${tenant.name} from ${callerPhone}`,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; color: #1e293b;">
          <h2 style="color: #0f172a;">🚨 New Priority Voicemail Received</h2>
          <p><strong>Business:</strong> ${tenant.name}</p>
          <p><strong>Caller Phone:</strong> <a href="tel:${callerPhone}">${callerPhone}</a></p>
          <p><strong>Duration:</strong> ${recordingDuration} seconds</p>
          <p><strong>Call SID:</strong> <code>${session.callSid}</code></p>
          <div style="background: #f1f5f9; padding: 15px; border-radius: 8px; margin: 15px 0;">
            <p style="margin: 0 0 10px 0;"><strong>Audio Recording Link:</strong></p>
            <a href="${recordingUrl}" target="_blank" style="color: #2563eb; text-decoration: underline;">Listen to Recording (${recordingUrl}.mp3)</a>
          </div>
          ${
            transcriptionText
              ? `<div style="background: #e2e8f0; padding: 15px; border-radius: 8px;">
                   <strong>Automated Transcript:</strong>
                   <p style="margin: 5px 0 0 0; font-style: italic;">"${transcriptionText}"</p>
                 </div>`
              : ""
          }
          <p style="color: #64748b; font-size: 12px; margin-top: 20px;">VaniEdge-Pro Telephony Engine • Bridge Builders AI</p>
        </div>
      `,
    }).catch((err: unknown) => console.warn("[Recording] Email alert failed:", err));
  }

  const builder = new TwiMLBuilder(tenant.voiceConfig.pollyVoice);
  builder.say("Thank you. Your message has been received and our on-call dispatcher has been alerted. Goodbye.");
  builder.hangup();

  return builder.toResponse();
}
