import test from "node:test";
import assert from "node:assert/strict";
import {
  validateTwilioSignature,
  computeTwilioSignature,
  checkEventDuplicate,
} from "../lib/telephony/security";

test("Twilio Webhook Security Test Suite", async (t) => {
  const dummyAuthToken = "test_auth_token_secret_123456789";
  const canonicalUrl = "https://vaniedge.ai/api/voice/incoming";
  const legitimatePayload = {
    CallSid: "CA1234567890abcdef1234567890abcdef",
    From: "+18005550100",
    To: "+18149613703",
    Direction: "inbound",
  };

  await t.test("Requirement 1: Valid HMAC-SHA1 signature passes verification", () => {
    const validSig = computeTwilioSignature(canonicalUrl, legitimatePayload, dummyAuthToken);

    const result = validateTwilioSignature({
      url: canonicalUrl,
      body: legitimatePayload,
      signature: validSig,
      authToken: dummyAuthToken,
    });

    assert.equal(result.valid, true, "Legitimate signature should be valid");
  });

  await t.test("Requirement 2: Missing signature header is rejected with 401", () => {
    const result = validateTwilioSignature({
      url: canonicalUrl,
      body: legitimatePayload,
      signature: null,
      authToken: dummyAuthToken,
    });

    assert.equal(result.valid, false);
    assert.equal(result.statusCode, 401);
    assert.match(result.reason || "", /missing/i);
  });

  await t.test("Requirement 3: Tampered or invalid signature is rejected with 401", () => {
    const forgedSig = "invalid_base64_forged_signature==";

    const result = validateTwilioSignature({
      url: canonicalUrl,
      body: legitimatePayload,
      signature: forgedSig,
      authToken: dummyAuthToken,
    });

    assert.equal(result.valid, false);
    assert.equal(result.statusCode, 401);
  });

  await t.test("Requirement 4: Altered payload parameter fails signature verification", () => {
    const validSig = computeTwilioSignature(canonicalUrl, legitimatePayload, dummyAuthToken);

    // Attacker modifies caller number
    const tamperedPayload = {
      ...legitimatePayload,
      From: "+18005550999",
    };

    const result = validateTwilioSignature({
      url: canonicalUrl,
      body: tamperedPayload,
      signature: validSig,
      authToken: dummyAuthToken,
    });

    assert.equal(result.valid, false, "Tampered payload must fail signature check");
  });

  await t.test("Requirement 5: Mismatched webhook URL fails signature verification", () => {
    const validSig = computeTwilioSignature(canonicalUrl, legitimatePayload, dummyAuthToken);

    // Attacker sends signature to a different endpoint
    const wrongUrl = "https://vaniedge.ai/api/voice/process";

    const result = validateTwilioSignature({
      url: wrongUrl,
      body: legitimatePayload,
      signature: validSig,
      authToken: dummyAuthToken,
    });

    assert.equal(result.valid, false, "Signature bound to a different URL must be rejected");
  });

  await t.test("Requirement 6: Fails closed in production when TWILIO_AUTH_TOKEN is missing", () => {
    const oldNodeEnv = process.env.NODE_ENV;
    const oldToken = process.env.TWILIO_AUTH_TOKEN;

    try {
      (process.env as Record<string, string | undefined>).NODE_ENV = "production";
      delete process.env.TWILIO_AUTH_TOKEN;

      const result = validateTwilioSignature({
        url: canonicalUrl,
        body: legitimatePayload,
        signature: "some_signature",
        authToken: undefined,
      });

      assert.equal(result.valid, false, "Must fail closed in production without auth token");
      assert.equal(result.statusCode, 500);
      assert.match(result.reason || "", /production/i);
    } finally {
      (process.env as Record<string, string | undefined>).NODE_ENV = oldNodeEnv;
      process.env.TWILIO_AUTH_TOKEN = oldToken;
    }
  });

  await t.test("Requirement 7: Duplicate event deduplication protects status callbacks", () => {
    const eventKey = "status:CA999999999:completed:24";

    const isFirstTime = checkEventDuplicate(eventKey, 5000);
    assert.equal(isFirstTime, false, "First event must not be flagged as duplicate");

    const isDuplicate = checkEventDuplicate(eventKey, 5000);
    assert.equal(isDuplicate, true, "Second event with identical key must be flagged as duplicate");
  });
});
