/**
 * Cloudflare Worker Environment Bindings and Configuration Types
 */
export interface Env {
  // Twilio Production Credentials
  TWILIO_ACCOUNT_SID: string;
  TWILIO_AUTH_TOKEN: string;
  TWILIO_API_KEY_SID?: string;
  TWILIO_API_SECRET?: string;
  TWILIO_PHONE_NUMBER?: string;

  // ElevenLabs Conversational AI Credentials
  ELEVENLABS_API_KEY?: string;
  ELEVENLABS_AGENT_ID?: string;
  ELEVENLABS_VOICE_ID?: string;
  ELEVENLABS_MODEL_ID?: string;

  // Human Escalation Fallback (E.164 phone number)
  FALLBACK_HUMAN_NUMBER?: string;

  // Watchdog Failover Deadlines (in milliseconds)
  FAILOVER_CONNECT_TIMEOUT_MS?: string;
  FAILOVER_TTFT_TIMEOUT_MS?: string;

  // Audio Format Negotiation (default: ulaw_8000 for 8kHz Twilio Media Streams)
  ELEVENLABS_OUTPUT_FORMAT?: string;
  ELEVENLABS_INPUT_FORMAT?: string;

  // Environment & Security
  ENVIRONMENT?: string;
}
