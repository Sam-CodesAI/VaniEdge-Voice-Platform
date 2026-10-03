/**
 * VaniEdge-Pro Telephony Platform
 * 3-Tier Resilient Failover State Machine
 * 
 * Manages call lifecycle states, latency circuit breakers, and automated
 * Tier 2 (Voicemail Recording), Tier 3 (Warm Transfer), and Tier 4 (SMS Rescue).
 */

import { CallSession, CallPhase, TenantProfile } from "./types";
import { createVoicemailRecordingTwiML, createEmergencyTransferTwiML } from "./twiml-builder";
import { sendSmsRescue } from "./sms-service";
import { supabase } from "@/lib/supabase-client";

// In-memory active session cache (survives warm serverless invocations)
const ACTIVE_SESSIONS = new Map<string, CallSession>();

/**
 * Creates and initializes a new call session.
 */
export function createCallSession(params: {
  callSid: string;
  tenantId: string;
  from: string;
  to: string;
  direction?: "inbound" | "outbound";
}): CallSession {
  const session: CallSession = {
    callSid: params.callSid,
    tenantId: params.tenantId,
    from: params.from,
    to: params.to,
    direction: params.direction || "inbound",
    phase: "initiated",
    transcript: [],
    latencyMs: { total: 0 },
    failoverTriggered: false,
    smsRescueSent: false,
    whatsappRescueSent: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  ACTIVE_SESSIONS.set(params.callSid, session);
  return session;
}

/**
 * Retrieve an active call session by CallSid.
 */
export function getCallSession(callSid: string): CallSession | undefined {
  return ACTIVE_SESSIONS.get(callSid);
}

/**
 * Transition a call session to a new phase.
 */
export function transitionCallPhase(
  session: CallSession,
  newPhase: CallPhase,
  updates?: Partial<CallSession>
): CallSession {
  session.phase = newPhase;
  session.updatedAt = Date.now();
  if (updates) {
    Object.assign(session, updates);
  }
  ACTIVE_SESSIONS.set(session.callSid, session);
  return session;
}

/**
 * Append a dialog turn to the session transcript.
 */
export function appendTranscript(
  session: CallSession,
  role: "agent" | "caller" | "system",
  text: string
): CallSession {
  session.transcript.push({
    role,
    text,
    timestamp: Date.now(),
  });
  session.updatedAt = Date.now();
  ACTIVE_SESSIONS.set(session.callSid, session);
  return session;
}

/**
 * Asynchronously persist session details to Supabase (non-blocking).
 */
export async function persistSessionToDatabase(session: CallSession): Promise<void> {
  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
      console.warn(`[FailoverEngine] NEXT_PUBLIC_SUPABASE_URL not configured. Cannot persist session ${session.callSid}.`);
      return;
    }

    const { error } = await supabase.from("site_settings").upsert(
      {
        key: `call_session_${session.callSid}`,
        value: session,
        updated_at: new Date().toISOString(),
        is_public: false,
      },
      { onConflict: "key" }
    );

    if (error) {
      console.error(`[FailoverEngine] Supabase error persisting session ${session.callSid}: ${error.message}`);
    }
  } catch (err) {
    console.error(`[FailoverEngine] Failed to persist session ${session.callSid} to DB:`, err);
  }
}

// ==============================================================================
// 3-TIER FAILOVER EXECUTORS
// ==============================================================================

/**
 * Tier 2: Latency Circuit Breaker Fallback
 * Seamlessly routes caller to voicemail recording when an upstream AI or speech service times out.
 */
export function executeTier2Fallback(params: {
  session: CallSession;
  tenant: TenantProfile;
  recordingActionUrl: string;
  reason: "llm_timeout" | "api_error";
}): { twimlResponse: Response; session: CallSession } {
  const { session, tenant, recordingActionUrl, reason } = params;

  transitionCallPhase(session, "recording_fallback", {
    failoverTriggered: true,
    failoverReason: reason,
  });

  appendTranscript(
    session,
    "system",
    `[Tier 2 Fallback Activated] Reason: ${reason}. Routing to audio recording.`
  );

  const promptText = `I want to make sure we don't miss your details. Please state your name, your service address, and what you are experiencing right after the tone, and our on-duty dispatcher will follow up with you promptly.`;

  const twimlResponse = createVoicemailRecordingTwiML({
    promptText,
    recordingActionUrl,
    voice: tenant.voiceConfig.pollyVoice,
  });

  return { twimlResponse, session };
}

/**
 * Tier 3: Emergency Warm-Transfer Dial
 * Connects caller to the on-call technician with private whisper audio.
 */
export function executeTier3WarmTransfer(params: {
  session: CallSession;
  tenant: TenantProfile;
  whisperUrl: string;
  fallbackActionUrl: string;
  emergencyReason?: string;
}): { twimlResponse: Response; session: CallSession } {
  const { session, tenant, whisperUrl, fallbackActionUrl, emergencyReason } = params;

  transitionCallPhase(session, "transferring_live", {
    intent: "emergency_transfer",
  });

  appendTranscript(
    session,
    "system",
    `[Tier 3 Warm Transfer Initiated] Target: ${tenant.emergencyNumbers.onCallTechnician}. Reason: ${
      emergencyReason || "Emergency Triage"
    }`
  );

  const emergencyExplanation = emergencyReason
    ? `I have flagged your request regarding ${emergencyReason} as high priority.`
    : `I am escalating your request directly to our on-call team.`;

  const twimlResponse = createEmergencyTransferTwiML({
    emergencyExplanation,
    transferNumber: tenant.emergencyNumbers.onCallTechnician,
    whisperUrl,
    fallbackActionUrl,
    voice: tenant.voiceConfig.pollyVoice,
  });

  return { twimlResponse, session };
}

/**
 * Tier 4: Omnichannel SMS Rescue
 * Fired when a call is dropped, hung up abruptly (<15s), or technician doesn't answer.
 */
export async function executeTier4SmsRescue(params: {
  session: CallSession;
  tenant: TenantProfile;
  reason: "caller_hangup" | "tech_no_answer" | "api_error";
}): Promise<{ success: boolean; reason?: string }> {
  const { session, tenant, reason } = params;

  if (session.smsRescueSent) {
    return { success: false, reason: "SMS rescue already sent for this session." };
  }

  // Avoid texting landlines or empty numbers
  if (!session.from || session.from.length < 10) {
    return { success: false, reason: "Invalid caller phone number for SMS." };
  }

  session.failoverTriggered = true;
  session.failoverReason = reason;

  const result = await sendSmsRescue({
    toPhone: session.from,
    fromPhone: session.to || tenant.phone,
    message: tenant.smsRescueTemplate,
    tenantId: tenant.id,
  });

  if (result.success) {
    session.smsRescueSent = true;
    transitionCallPhase(session, "sms_rescued");
    appendTranscript(session, "system", `[Tier 4 SMS Rescue Sent] to ${session.from}`);
  }

  return result;
}
