/**
 * VaniEdge-Pro Telephony Platform
 * Core Data Models, Zod Validation Schemas, and Session Lifecycles
 */

import { z } from "zod";

// ==============================================================================
// 1. TELEPHONY PHASES & INTENTS
// ==============================================================================

export type CallPhase =
  | "initiated"
  | "greeting"
  | "gathering_intent"
  | "processing_ai"
  | "transferring_live"
  | "recording_fallback"
  | "completed"
  | "failed"
  | "sms_rescued";

export type IntentType =
  | "routine_inquiry"
  | "book_appointment"
  | "emergency_transfer"
  | "human_transfer"
  | "pricing_inquiry"
  | "unclear";

export interface IntentResult {
  intent: IntentType;
  confidence: number;
  summary: string;
  emergencyDetected: boolean;
  emergencyKeyword?: string;
  entities?: Record<string, string>;
  replyText: string;
  action: "gather" | "transfer" | "record" | "hangup";
}

// ==============================================================================
// 2. MULTI-TENANT CONFIGURATION SCHEMAS
// ==============================================================================

export const DayScheduleSchema = z.object({
  open: z.string().regex(/^\d{2}:\d{2}$/, "Format must be HH:MM"),
  close: z.string().regex(/^\d{2}:\d{2}$/, "Format must be HH:MM"),
  closed: z.boolean().optional(),
});

export const BusinessScheduleSchema = z.object({
  timezone: z.string().default("America/Denver"),
  schedule: z.record(
    z.enum(["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]),
    DayScheduleSchema
  ),
});

export const KnowledgeBaseSchema = z.object({
  serviceArea: z.array(z.string()).min(1),
  pricingRules: z.array(
    z.object({
      service: z.string(),
      price: z.string(),
      note: z.string().optional(),
    })
  ),
  emergencyKeywords: z.array(z.string()),
  faq: z.array(
    z.object({
      question: z.string(),
      answer: z.string(),
    })
  ),
});

export const VoiceConfigSchema = z.object({
  personaName: z.string().default("Sarah"),
  pollyVoice: z.string().default("Polly.Joanna-Neural"),
  language: z.string().default("en-US"),
  greeting: z.string(),
  tcpaConsentNotice: z
    .string()
    .default("Notice: This call is recorded for quality assurance and dispatch accuracy."),
});

export const TenantProfileSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  industry: z.enum(["home_services", "healthcare", "professional", "emergency", "general"]),
  phone: z.string().min(10), // E.164 Twilio phone number
  emergencyNumbers: z.object({
    primaryDispatcher: z.string().min(10),
    onCallTechnician: z.string().min(10),
    officeFallback: z.string().optional(),
  }),
  businessHours: BusinessScheduleSchema,
  knowledgeBase: KnowledgeBaseSchema,
  voiceConfig: VoiceConfigSchema,
  bookingUrl: z.string().url(),
  smsRescueTemplate: z.string(),
});

export type DaySchedule = z.infer<typeof DayScheduleSchema>;
export type BusinessSchedule = z.infer<typeof BusinessScheduleSchema>;
export type KnowledgeBase = z.infer<typeof KnowledgeBaseSchema>;
export type VoiceConfig = z.infer<typeof VoiceConfigSchema>;
export type TenantProfile = z.infer<typeof TenantProfileSchema>;

// ==============================================================================
// 3. TELEPHONY WEBHOOK PAYLOAD SCHEMAS (Twilio / TeXML)
// ==============================================================================

export const TwilioVoiceWebhookSchema = z.object({
  CallSid: z.string(),
  AccountSid: z.string().optional(),
  From: z.string().default(""),
  To: z.string().default(""),
  CallStatus: z.string().default("in-progress"),
  ApiVersion: z.string().optional(),
  Direction: z.string().default("inbound"),
  ForwardedFrom: z.string().optional(),
  CallerName: z.string().optional(),
  Digits: z.string().optional(),
  SpeechResult: z.string().optional(),
  Confidence: z.string().optional(),
  RecordingUrl: z.string().optional(),
  RecordingSid: z.string().optional(),
  RecordingDuration: z.string().optional(),
  DialCallStatus: z.string().optional(),
  DialCallDuration: z.string().optional(),
});

export type TwilioVoiceWebhook = z.infer<typeof TwilioVoiceWebhookSchema>;

export const TwilioStatusCallbackSchema = z.object({
  CallSid: z.string(),
  AccountSid: z.string().optional(),
  From: z.string().default(""),
  To: z.string().default(""),
  CallStatus: z.string(), // "queued", "ringing", "in-progress", "completed", "busy", "failed", "no-answer"
  CallDuration: z.string().optional(),
  Duration: z.string().optional(),
  RecordingUrl: z.string().optional(),
  RecordingSid: z.string().optional(),
  Timestamp: z.string().optional(),
  SequenceNumber: z.string().optional(),
});

export type TwilioStatusCallback = z.infer<typeof TwilioStatusCallbackSchema>;

// ==============================================================================
// 4. CALL SESSION & LIFECYCLE STATE
// ==============================================================================

export interface CallTranscriptItem {
  role: "agent" | "caller" | "system";
  text: string;
  timestamp: number;
}

export interface CallLatencyMetrics {
  stt?: number;
  llm?: number;
  tts?: number;
  total: number;
}

export interface CallSession {
  callSid: string;
  tenantId: string;
  from: string;
  to: string;
  direction: "inbound" | "outbound";
  phase: CallPhase;
  intent?: IntentType;
  transcript: CallTranscriptItem[];
  latencyMs: CallLatencyMetrics;
  failoverTriggered: boolean;
  failoverReason?: "llm_timeout" | "caller_hangup" | "tech_no_answer" | "api_error";
  smsRescueSent: boolean;
  whatsappRescueSent: boolean;
  recordingUrl?: string;
  createdAt: number;
  updatedAt: number;
}
