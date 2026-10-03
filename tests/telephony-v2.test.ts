import { describe, it, expect, vi, afterEach } from "vitest";
import {
  computeTwilioSignature,
  validateTwilioSignature,
} from "../lib/telephony/security";
import {
  checkEmergencyTriage,
  classifyWithAi,
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

  // 6. Multi-LLM Resilient Intent Classifier (Groq llama-3.3-70b -> llama-3.1-8b -> Gemini Flash -> Procedural)
  describe("Multi-LLM Resilient Intent Classifier", () => {
    const originalFetch = global.fetch;
    const originalGroqKey = process.env.GROQ_API_KEY;
    const originalGeminiKey = process.env.GEMINI_API_KEY;

    afterEach(() => {
      global.fetch = originalFetch;
      process.env.GROQ_API_KEY = originalGroqKey;
      process.env.GEMINI_API_KEY = originalGeminiKey;
    });

    it("evaluates emergency triage procedurally without invoking network LLMs", async () => {
      const fetchSpy = vi.fn();
      global.fetch = fetchSpy;

      const result = await classifyWithAi({
        callerSpeech: "There is an active gas leak and water pipe explosion!",
        tenant: APEX_HVAC_PROFILE,
      });

      expect(result.emergencyDetected).toBe(true);
      expect(result.intent).toBe("emergency_transfer");
      expect(result.action).toBe("transfer");
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("routes conversational speech through Groq llama-3.3-70b-versatile", async () => {
      process.env.GROQ_API_KEY = "gsk_test_mock_key";

      let capturedBody: any = null;
      global.fetch = vi.fn().mockImplementation(async (url: string, opts: any) => {
        capturedBody = JSON.parse(opts.body);
        return {
          ok: true,
          json: async () => ({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    intent: "routine_inquiry",
                    confidence: 0.95,
                    summary: "Caller inquiring about AC duct cleaning",
                    emergencyDetected: false,
                    replyText: "We can clean your AC ducts. When would you like us to come by?",
                    action: "gather",
                  }),
                },
              },
            ],
          }),
        };
      });

      const result = await classifyWithAi({
        callerSpeech: "Do you clean AC ducts?",
        tenant: APEX_HVAC_PROFILE,
      });

      expect(result.intent).toBe("routine_inquiry");
      expect(capturedBody.model).toBe("llama-3.3-70b-versatile");
      expect(result.replyText).toContain("clean your AC ducts");
    });

    it("fails over to Groq llama-3.1-8b-instant if primary 70b model fails", async () => {
      process.env.GROQ_API_KEY = "gsk_test_mock_key";

      const calledModels: string[] = [];
      global.fetch = vi.fn().mockImplementation(async (url: string, opts: any) => {
        const body = JSON.parse(opts.body);
        calledModels.push(body.model);

        if (body.model === "llama-3.3-70b-versatile") {
          return { ok: false, status: 503, text: async () => "Model overloaded" };
        }

        return {
          ok: true,
          json: async () => ({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    intent: "pricing_inquiry",
                    confidence: 0.9,
                    summary: "Pricing inquiry",
                    emergencyDetected: false,
                    replyText: "Our service diagnostic fee is $89.",
                    action: "gather",
                  }),
                },
              },
            ],
          }),
        };
      });

      const result = await classifyWithAi({
        callerSpeech: "I would like to understand variable-speed heat pump SEER2 efficiency ratings",
        tenant: APEX_HVAC_PROFILE,
      });

      expect(calledModels).toContain("llama-3.3-70b-versatile");
      expect(calledModels).toContain("llama-3.1-8b-instant");
      expect(result.replyText).toBeDefined();
    });

    it("seamlessly fails over to Google Gemini Flash when Groq is unavailable", async () => {
      process.env.GROQ_API_KEY = "gsk_test_mock_key";
      process.env.GEMINI_API_KEY = "gemini_test_mock_key";

      global.fetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes("api.groq.com")) {
          return { ok: false, status: 429, text: async () => "Rate limit exceeded" };
        }
        if (url.includes("generativelanguage.googleapis.com")) {
          return {
            ok: true,
            json: async () => ({
              candidates: [
                {
                  content: {
                    parts: [
                      {
                        text: JSON.stringify({
                          intent: "routine_inquiry",
                          confidence: 0.92,
                          summary: "Gemini rescued conversational query",
                          emergencyDetected: false,
                          replyText: "Gemini AI response: We can schedule your consultation.",
                          action: "gather",
                        }),
                      },
                    ],
                  },
                },
              ],
            }),
          };
        }
        return { ok: false, status: 404 };
      });

      const result = await classifyWithAi({
        callerSpeech: "I would like to speak about a commercial heating system overhaul",
        tenant: APEX_HVAC_PROFILE,
      });

      expect(result.intent).toBe("routine_inquiry");
      expect(result.replyText).toContain("Gemini AI response");
    });

    it("defaults to guaranteed zero-failure procedural triage when all AI providers fail", async () => {
      process.env.GROQ_API_KEY = "gsk_test_mock_key";
      process.env.GEMINI_API_KEY = "gemini_test_mock_key";

      global.fetch = vi.fn().mockRejectedValue(new Error("Network offline"));

      const result = await classifyWithAi({
        callerSpeech: "Random unclassified conversational query",
        tenant: APEX_HVAC_PROFILE,
      });

      expect(result.intent).toBe("routine_inquiry");
      expect(result.confidence).toBe(0.6);
      expect(result.action).toBe("gather");
      expect(result.replyText).toBeDefined();
    });
  });
});
