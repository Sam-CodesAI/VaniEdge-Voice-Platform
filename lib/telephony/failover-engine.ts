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
import fs from "node:fs";
import path from "node:path";
import { supabase, isSupabaseConfigured } from "@/lib/supabase-client";

// In-memory active session cache (survives warm serverless invocations)
const ACTIVE_SESSIONS = new Map<string, CallSession>();
const DISK_SESSIONS_PATH = path.join(process.cwd(), ".data", "call_sessions.json");
let sessionsLoaded = false;

function loadSessionsFromDisk(): void {
  if (sessionsLoaded) return;
  try {
    if (fs.existsSync(DISK_SESSIONS_PATH)) {
      const raw = fs.readFileSync(DISK_SESSIONS_PATH, "utf-8");
      const list = JSON.parse(raw) as CallSession[];
      if (Array.isArray(list)) {
        for (const s of list) {
          ACTIVE_SESSIONS.set(s.callSid, s);
        }
      }
    }
  } catch {
    // Ignore
  }
  sessionsLoaded = true;
}

function saveSessionsToDisk(): void {
  try {
    const dir = path.dirname(DISK_SESSIONS_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      DISK_SESSIONS_PATH,
      JSON.stringify(Array.from(ACTIVE_SESSIONS.values()), null, 2),
      "utf-8"
    );
  } catch {
    // Ignore
  }
}

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
  saveSessionsToDisk();
  return session;
}

/**
 * Retrieve an active call session by CallSid.
 */
export function getCallSession(callSid: string): CallSession | undefined {
  loadSessionsFromDisk();
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
  saveSessionsToDisk();
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
  saveSessionsToDisk();
  return session;
}

/**
 * Asynchronously persist session details to durable purpose-built call_sessions database table.
 */
export async function persistSessionToDatabase(session: CallSession): Promise<{ success: boolean; error?: string }> {
  // Ensure resilient local durable disk snapshot
  saveSessionsToDisk();

  if (!isSupabaseConfigured) {
    return { success: true };
  }

  try {
    const { error } = await supabase.from("call_sessions").upsert(
      {
        call_sid: session.callSid,
        tenant_id: session.tenantId,
        from_number: session.from,
        to_number: session.to,
        direction: session.direction,
        phase: session.phase,
        transcript: session.transcript,
        latency_ms: session.latencyMs,
        recording_url: session.recordingUrl || null,
        failover_triggered: Boolean(session.failoverTriggered),
        failover_reason: session.failoverReason || null,
        sms_rescue_sent: Boolean(session.smsRescueSent),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "call_sid" }
    );

    if (error) {
      console.error(`[FailoverEngine] Failed to persist call session ${session.callSid} to 'call_sessions' table:`, error.message);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[FailoverEngine] Could not persist session ${session.callSid} to DB:`, msg);
    return { success: false, error: msg };
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
