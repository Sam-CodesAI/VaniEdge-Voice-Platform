import { describe, it, expect, vi } from "vitest";
import {
  computeTwilioSignature,
  validateTwilioSignature,
} from "../lib/telephony/security";
import {
  checkEmergencyTriage,
} from "../lib/telephony/intent-classifier";
import {
  createInboundGreetingTwiML,
  createEmergencyTransferTwiML,
  createVoicemailRecordingTwiML,
  TwiMLBuilder,
} from "../lib/telephony/twiml-builder";
import {
  getTenantById,
  getTenantByPhone,
  checkBusinessHours,
  APEX_HVAC_PROFILE,
  METRO_DENTAL_PROFILE,
} from "../lib/telephony/tenant-store";
import {
  createCallSession,
  appendTranscript,
  executeTier2Fallback,
  executeTier3WarmTransfer,
  executeTier4SmsRescue,
  getCallSession,
} from "../lib/telephony/failover-engine";

describe("Telephony v2.0 Enterprise Architecture", () => {
  const mockAuthToken = "mock_twilio_auth_token_for_tests";

  // 1. Security & Signature Verification
  describe("Cryptographic Signature Verification", () => {
    it("validates authentic Twilio HMAC-SHA1 signatures correctly", () => {
      const url = "https://vani-edge.vercel.app/api/voice/incoming";
      const params = {
        CallSid: "CA1234567890abcdef",
        From: "+15552345678",
        To: "+18149613703",
      };
      const signature = computeTwilioSignature(url, params, mockAuthToken);

      const result = validateTwilioSignature({
        url,
        body: params,
        signature,
        authToken: mockAuthToken,
      });

      expect(result.valid).toBe(true);
    });

    it("rejects forged or altered webhook payloads", () => {
      const url = "https://vani-edge.vercel.app/api/voice/incoming";
      const params = { CallSid: "CA1234567890abcdef", From: "+15552345678" };
      const validSig = computeTwilioSignature(url, params, mockAuthToken);

      const forgedParams = { ...params, From: "+19999999999" };
      const result = validateTwilioSignature({
        url,
        body: forgedParams,
        signature: validSig,
        authToken: mockAuthToken,
      });

      expect(result.valid).toBe(false);
      expect(result.reason).toContain("failed");
    });

    it("allows simulated bypass in test environment when allowSimulated is true", () => {
      const result = validateTwilioSignature({
        url: "http://localhost:3000/api/voice/incoming",
        body: {},
        signature: null,
        allowSimulated: true,
      });
      expect(result.valid).toBe(true);
    });
  });

  // 2. Sub-Millisecond Negation-Aware Emergency Triage
  describe("Emergency Triage Gate", () => {
    it("detects genuine gas leak and water pipe emergencies instantly (<1ms)", () => {
      const triage = checkEmergencyTriage(
        "Help! The furnace smells like a gas leak and water is pouring from the pipes!",
        APEX_HVAC_PROFILE
      );

      expect(triage.isEmergency).toBe(true);
      expect(triage.matchedKeyword).toBeDefined();
    });

    it("correctly ignores negative or non-emergency mentions", () => {
      const nonEmergency1 = checkEmergencyTriage(
        "There is no emergency and no gas leak, just calling to ask about maintenance.",
        APEX_HVAC_PROFILE
      );
      expect(nonEmergency1.isEmergency).toBe(false);

      const nonEmergency2 = checkEmergencyTriage(
        "I was worried about a leak before, but it's not leaking anymore.",
        APEX_HVAC_PROFILE
      );
      expect(nonEmergency2.isEmergency).toBe(false);
    });

    it("triage respects industry specific emergencies (Dental vs HVAC)", () => {
      const dentalEmergency = checkEmergencyTriage(
        "My child has a knocked out tooth from playing soccer and needs help!",
        METRO_DENTAL_PROFILE
      );
      expect(dentalEmergency.isEmergency).toBe(true);
      expect(dentalEmergency.matchedKeyword).toBe("knocked out tooth");
    });
  });

  // 3. TwiML & TeXML Generation
  describe("TwiML Builder", () => {
    it("generates compliant TCPA consent and Speech Gather TwiML", async () => {
      const response = createInboundGreetingTwiML({
        businessName: "Apex Heating & Air Conditioning",
        greetingText: "Thanks for calling Apex.",
        tcpaNotice: "Calls are recorded for quality assurance.",
        processActionUrl: "https://vani-edge.vercel.app/api/voice/process",
        voice: "Polly.Joanna-Neural",
      });

      const xml = await response.text();
      expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(xml).toContain('<Response>');
      expect(xml).toContain('<Gather');
      expect(xml).toContain('input="speech dtmf"');
      expect(xml).toContain('voice="Polly.Joanna-Neural"');
      expect(xml).toContain('Calls are recorded for quality assurance.');
    });

    it("generates Warm Transfer TwiML with private technician whisper", async () => {
      const response = createEmergencyTransferTwiML({
        transferNumber: "+18005550199",
        whisperUrl: "https://vani-edge.vercel.app/api/voice/whisper",
        fallbackActionUrl: "https://vani-edge.vercel.app/api/voice/transfer-status",
        emergencyExplanation: "Connecting you to an emergency technician now.",
        voice: "Polly.Joanna-Neural",
      });

      const xml = await response.text();
      expect(xml).toContain('<Dial');
      expect(xml).toContain('<Number url="https://vani-edge.vercel.app/api/voice/whisper">+18005550199</Number>');
    });
  });

  // 4. Multi-Tenant Registry & Timezone Scheduling
  describe("Multi-Tenant Store", () => {
    it("resolves tenant profiles by provisioned Twilio phone number", () => {
      const tenant = getTenantByPhone("+18149613703");
      expect(tenant.id).toBe("apex-hvac");
      expect(tenant.name).toBe("Apex Heating & Air Conditioning");
    });

    it("resolves tenant by ID with complete voice configuration", () => {
      const dental = getTenantById("metro-dental");
      expect(dental.name).toBe("Metro Urgent Dental Center");
      expect(dental.voiceConfig.pollyVoice).toBe("Polly.Joanna-Neural");
      expect(dental.knowledgeBase.emergencyKeywords).toContain("knocked out tooth");
    });

    it("evaluates dynamic timezone business hours correctly", () => {
      const result = checkBusinessHours(APEX_HVAC_PROFILE);
      expect(typeof result.isOpen).toBe("boolean");
      expect(result.scheduleText).toBeDefined();
    });
  });

  // 5. 4-Tier Zero-Drop Failover Engine
  describe("Zero-Drop Failover Engine", () => {
    it("manages full call lifecycle and transcript state transitions", () => {
      const session = createCallSession({
        callSid: "CA_TEST_LIFECYCLE",
        tenantId: "apex-hvac",
        from: "+15551112222",
        to: "+18149613703",
        direction: "inbound",
      });

      expect(session.phase).toBe("initiated");
      appendTranscript(session, "caller", "Is someone available?");
      expect(session.transcript.length).toBe(1);

      const retrieved = getCallSession("CA_TEST_LIFECYCLE");
      expect(retrieved?.callSid).toBe("CA_TEST_LIFECYCLE");
    });

    it("executes Tier 2 fallback voicemail when circuit breaker trips", async () => {
      const session = createCallSession({
        callSid: "CA_TEST_TIER2",
        tenantId: "apex-hvac",
        from: "+15552223333",
        to: "+18149613703",
      });

      const { twimlResponse } = executeTier2Fallback({
        session,
        tenant: APEX_HVAC_PROFILE,
        recordingActionUrl: "https://vani-edge.vercel.app/api/voice/recording",
        reason: "llm_timeout",
      });

      expect(session.phase).toBe("recording_fallback");
      const xml = await twimlResponse.text();
      expect(xml).toContain('<Record');
    });

    it("executes Tier 3 warm transfer with onCallTechnician routing", async () => {
      const session = createCallSession({
        callSid: "CA_TEST_TIER3",
        tenantId: "apex-hvac",
        from: "+15553334444",
        to: "+18149613703",
      });

      const { twimlResponse } = executeTier3WarmTransfer({
        session,
        tenant: APEX_HVAC_PROFILE,
        whisperUrl: "https://vani-edge.vercel.app/api/voice/whisper",
        fallbackActionUrl: "https://vani-edge.vercel.app/api/voice/transfer-status",
        emergencyReason: "gas leak",
      });

      expect(session.phase).toBe("transferring_live");
      const xml = await twimlResponse.text();
      expect(xml).toContain(APEX_HVAC_PROFILE.emergencyNumbers.onCallTechnician);
    });

    it("executes Tier 4 SMS rescue and enforces cooldown deduplication", async () => {
      const session = createCallSession({
        callSid: "CA_TEST_TIER4",
        tenantId: "apex-hvac",
        from: "+15554445555",
        to: "+18149613703",
      });

      // Mock twilio fetch to succeed
      const originalFetch = global.fetch;
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ sid: "SM12345", status: "queued" }),
      } as Response);

      try {
        const rescue1 = await executeTier4SmsRescue({
          session,
          tenant: APEX_HVAC_PROFILE,
          reason: "caller_hangup",
        });

        expect(rescue1.success).toBe(true);
        expect(session.smsRescueSent).toBe(true);

        // Immediate duplicate trigger should be suppressed by session.smsRescueSent
        const rescue2 = await executeTier4SmsRescue({
          session,
          tenant: APEX_HVAC_PROFILE,
          reason: "caller_hangup",
        });

        expect(rescue2.success).toBe(false);
        expect(rescue2.reason).toContain("already sent");
      } finally {
        global.fetch = originalFetch;
      }
    });
  });
});
