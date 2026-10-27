import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { authDb } from "../lib/auth-store";
import { tenantStore, isTenantOwnedByUser } from "../lib/tenant-store";
import { TicketDispatcher } from "../src/dispatch/tickets";
import { validateEnvironment } from "../lib/env-check";
import { assertSupabaseConfiguredForProduction } from "../lib/supabase-client";
import { checkRateLimit, resetRateLimits } from "../lib/rate-limit";
import { checkEventDuplicateAsync, getCanonicalWebhookUrl } from "../lib/telephony/security";
import { executeTier2Fallback, createCallSession } from "../lib/telephony/failover-engine";
import { getTenantById } from "../lib/telephony/tenant-store";
import { POST as dispatchPost } from "../app/api/dispatch/route";
import { POST as queryPost, PUT as queryPut } from "../app/api/query/route";
import { POST as ttsPost } from "../app/api/tts/route";
import { GET as metricsGet } from "../app/api/metrics/route";
import { GET as meGet } from "../app/api/auth/me/route";
import { POST as signoutPost } from "../app/api/auth/signout/route";
import { POST as rotatePost } from "../app/api/auth/credentials/rotate/route";
import { POST as agencyPost } from "../app/api/agency/tenants/route";
import { GET as agencyDetailGet, PUT as agencyDetailPut, DELETE as agencyDetailDelete } from "../app/api/agency/tenants/[id]/route";

describe("Production Readiness & Security Hardening Test Suite", () => {
  beforeEach(() => {
    resetRateLimits();
  });

  // ============================================================================
  // 1. Missing and Invalid Authentication
  // ============================================================================
  test("Auth Guard: Rejects missing, malformed, and invalid session credentials", async () => {
    // A. Missing token
    const reqNoAuth = new NextRequest("http://localhost:3000/api/auth/me", {
      method: "GET",
    });
    const resNoAuth = await meGet(reqNoAuth);
    assert.equal(resNoAuth.status, 401);
    const bodyNoAuth = (await resNoAuth.json()) as { error: string };
    assert.match(bodyNoAuth.error, /Missing authentication credentials/);

    // B. Invalid Bearer token
    const reqInvalidBearer = new NextRequest("http://localhost:3000/api/auth/me", {
      method: "GET",
      headers: { authorization: "Bearer invalid_token_123" },
    });
    const resInvalidBearer = await meGet(reqInvalidBearer);
    assert.equal(resInvalidBearer.status, 401);

    // C. Missing token on credential rotation
    const reqRotateNoAuth = new NextRequest("http://localhost:3000/api/auth/credentials/rotate", {
      method: "POST",
    });
    const resRotateNoAuth = await rotatePost(reqRotateNoAuth);
    assert.equal(resRotateNoAuth.status, 401);
  });

  // ============================================================================
  // 2. Expired and Revoked Sessions
  // ============================================================================
  test("Session Security: Correctly invalidates expired and revoked sessions", async () => {
    const { user, token } = await authDb.register(
      "Session Expiry Tester",
      `session_tester_${Date.now()}@vaniedge.ai`,
      "Password123!Secure"
    );

    // Initial valid lookup
    const activeUser = await authDb.getSessionUser(token);
    assert.ok(activeUser);
    assert.equal(activeUser.id, user.id);

    // A. Revoke session explicitly
    await authDb.revokeSession(token);
    const revokedUser = await authDb.getSessionUser(token);
    assert.equal(revokedUser, null, "Revoked session must not resolve to a user");

    // B. Create a new session and simulate expiry
    const token2 = await authDb.createSession(user.id);
    const sessionRecord = (authDb as any).sessions.get(token2);
    assert.ok(sessionRecord);
    // Backdate expiration
    sessionRecord.expiresAt = Date.now() - 1000;
    const expiredUser = await authDb.getSessionUser(token2);
    assert.equal(expiredUser, null, "Expired session must return null");

    // C. Bulk revocation across all user sessions
    const token3 = await authDb.createSession(user.id);
    const token4 = await authDb.createSession(user.id);
    await authDb.revokeAllUserSessions(user.id);
    assert.equal(await authDb.getSessionUser(token3), null);
    assert.equal(await authDb.getSessionUser(token4), null);
  });

  // ============================================================================
  // 3. Cross-Tenant Reads and Mutations
  // ============================================================================
  test("Tenant Isolation: Prevents cross-tenant access to tenants, queries, and dispatches", async () => {
    // Create User A and User B
    const userA = await authDb.register("User A", `user_a_${Date.now()}@agency.com`, "Pass1234!Owner");
    const userB = await authDb.register("User B", `user_b_${Date.now()}@agency.com`, "Pass1234!Attacker");

    // User A creates a tenant
    const createReq = new NextRequest("http://localhost:3000/api/agency/tenants", {
      method: "POST",
      headers: {
        authorization: `Bearer ${userA.token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        name: "User A Dental Clinic",
        category: "clinic",
      }),
    });
    const createRes = await agencyPost(createReq);
    assert.equal(createRes.status, 201);
    const { tenant } = (await createRes.json()) as { tenant: { id: string } };
    const tenantIdA = tenant.id;

    // Verify ownership helper
    assert.equal(await isTenantOwnedByUser(tenantIdA, userA.user.id, "user"), true);
    assert.equal(await isTenantOwnedByUser(tenantIdA, userB.user.id, "user"), false);

    // Attack 1: User B attempts to read User A's tenant -> 404 (Not Found)
    const getReq = new NextRequest(`http://localhost:3000/api/agency/tenants/${tenantIdA}`, {
      method: "GET",
      headers: { authorization: `Bearer ${userB.token}` },
    });
    const getRes = await agencyDetailGet(getReq, { params: Promise.resolve({ id: tenantIdA }) });
    assert.equal(getRes.status, 404, "Cross-tenant detail read must return 404");

    // Attack 2: User B attempts to update User A's tenant -> 404
    const putReq = new NextRequest(`http://localhost:3000/api/agency/tenants/${tenantIdA}`, {
      method: "PUT",
      headers: {
        authorization: `Bearer ${userB.token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ name: "Hacked Clinic Name" }),
    });
    const putRes = await agencyDetailPut(putReq, { params: Promise.resolve({ id: tenantIdA }) });
    assert.equal(putRes.status, 404, "Cross-tenant update must return 404");

    // Attack 3: User B attempts to delete User A's tenant -> 404
    const delReq = new NextRequest(`http://localhost:3000/api/agency/tenants/${tenantIdA}`, {
      method: "DELETE",
      headers: { authorization: `Bearer ${userB.token}` },
    });
    const delRes = await agencyDetailDelete(delReq, { params: Promise.resolve({ id: tenantIdA }) });
    assert.equal(delRes.status, 404, "Cross-tenant deletion must return 404");

    // Attack 4: User B attempts to query User A's knowledge -> 403 Forbidden
    const queryCrossReq = new NextRequest("http://localhost:3000/api/query", {
      method: "POST",
      headers: {
        authorization: `Bearer ${userB.token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        query: "What are the fees?",
        tenantId: tenantIdA,
      }),
    });
    const queryCrossRes = await queryPost(queryCrossReq);
    assert.equal(queryCrossRes.status, 403, "Cross-tenant query must return 403 Forbidden");

    // Attack 5: User B attempts to ingest into User A's knowledge -> 403 Forbidden
    const ingestCrossReq = new NextRequest("http://localhost:3000/api/query", {
      method: "PUT",
      headers: {
        authorization: `Bearer ${userB.token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        title: "Malicious Document",
        content: "Malicious injection",
        tenantId: tenantIdA,
      }),
    });
    const ingestCrossRes = await queryPut(ingestCrossReq);
    assert.equal(ingestCrossRes.status, 403, "Cross-tenant knowledge ingestion must return 403 Forbidden");

    // Attack 6: User B attempts to create dispatch ticket under User A's tenant -> 403 Forbidden
    const dispatchCrossReq = new NextRequest("http://localhost:3000/api/dispatch", {
      method: "POST",
      headers: {
        authorization: `Bearer ${userB.token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        callerName: "Malicious Caller",
        callerPhone: "+18005550199",
        category: "clinic",
        tenantId: tenantIdA,
      }),
    });
    const dispatchCrossRes = await dispatchPost(dispatchCrossReq);
    assert.equal(dispatchCrossRes.status, 403, "Cross-tenant ticket creation must return 403 Forbidden");

    // Legitimate operation: User A creates dispatch ticket under their own tenant -> 201 Created
    const dispatchLegitReq = new NextRequest("http://localhost:3000/api/dispatch", {
      method: "POST",
      headers: {
        authorization: `Bearer ${userA.token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        callerName: "Legitimate Patient",
        callerPhone: "+18005550199",
        category: "clinic",
        tenantId: tenantIdA,
      }),
    });
    const dispatchLegitRes = await dispatchPost(dispatchLegitReq);
    assert.equal(dispatchLegitRes.status, 201, "Legitimate owner dispatch must succeed with 201");
  });

  // ============================================================================
  // 4. Missing Production Environment Variables
  // ============================================================================
  test("Configuration Safety: Fails pre-flight when required production environment variables are missing", () => {
    const prevNodeEnv = process.env.NODE_ENV;
    const prevTwilioToken = process.env.TWILIO_AUTH_TOKEN;
    const prevSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const prevFallback = process.env.ALLOW_LOCAL_DISK_FALLBACK;

    try {
      (process.env as any).NODE_ENV = "production";
      delete process.env.ALLOW_LOCAL_DISK_FALLBACK;
      process.env.NEXT_PUBLIC_SUPABASE_URL = "https://placeholder.supabase.co";

      const report = validateEnvironment();
      assert.equal(report.isProduction, true);
      assert.equal(report.isValid, false, "Production without valid credentials must be marked INVALID");
      assert.ok(report.errors.some((e) => e.includes("Supabase credentials")));

      // Assert assertSupabaseConfiguredForProduction throws in production
      assert.throws(() => {
        assertSupabaseConfiguredForProduction();
      }, /Production persistence error/);
    } finally {
      (process.env as any).NODE_ENV = prevNodeEnv;
      process.env.TWILIO_AUTH_TOKEN = prevTwilioToken;
      process.env.NEXT_PUBLIC_SUPABASE_URL = prevSupabaseUrl;
      process.env.ALLOW_LOCAL_DISK_FALLBACK = prevFallback;
    }
  });

  // ============================================================================
  // 5. Database Outages and Failed Writes
  // ============================================================================
  test("Database Outage: Propagates durable write failures and prevents false success claims in production", async () => {
    const prevNodeEnv = process.env.NODE_ENV;
    const prevFallback = process.env.ALLOW_LOCAL_DISK_FALLBACK;

    try {
      (process.env as any).NODE_ENV = "production";
      delete process.env.ALLOW_LOCAL_DISK_FALLBACK;

      // When unconfigured in production without fallback flag, registration must throw rather than claim success
      await assert.rejects(
        async () => {
          await authDb.register(
            "Outage Tester",
            `outage_${Date.now()}@vaniedge.ai`,
            "Password123!Outage"
          );
        },
        /Durable database persistence is unconfigured in production/
      );

      // Tenant creation must also reject in production
      await assert.rejects(
        async () => {
          await tenantStore.create({
            id: `tnt_outage_${Date.now()}`,
            name: "Outage Clinic",
            category: "clinic",
            twilioPhone: "+18149613703",
            twilioSid: "AC_test",
            webhookUrl: "https://test.com",
            monthlyCalls: 0,
            status: "active",
          });
        },
        /Durable database persistence is unconfigured in production/
      );

      // Ticket creation must also reject in production
      const dispatcher = new TicketDispatcher();
      await assert.rejects(
        async () => {
          await dispatcher.createTicket({
            callerName: "Outage Caller",
            callerPhone: "+18005550199",
            category: "clinic",
            serviceType: "Toothache",
            details: "Urgent pain",
          });
        },
        /Durable database persistence is unconfigured in production/
      );
    } finally {
      (process.env as any).NODE_ENV = prevNodeEnv;
      process.env.ALLOW_LOCAL_DISK_FALLBACK = prevFallback;
    }
  });

  // ============================================================================
  // 6. Rate-Limit & Input Bounds: TTS and Metrics Endpoints
  // ============================================================================
  test("Endpoint Hardening: Enforces length bounds and rate limits on TTS and Metrics routes", async () => {
    process.env.RATE_LIMIT_ENABLED = "true";

    try {
      // A. TTS rejects oversized payloads (>1000 characters)
      const oversizedText = "a".repeat(1001);
      const reqOversized = new NextRequest("http://localhost:3000/api/tts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: oversizedText }),
      });
      const resOversized = await ttsPost(reqOversized);
      assert.equal(resOversized.status, 400);
      const bodyOversized = (await resOversized.json()) as { error: string };
      assert.equal(bodyOversized.error, "Validation failed");

      // B. TTS enforces sliding-window rate limit (20 req / min)
      for (let i = 0; i < 20; i++) {
        checkRateLimit("test-ip-tts", "tts", 20, 60000);
      }
      const reqRateLimited = new NextRequest("http://localhost:3000/api/tts", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-forwarded-for": "test-ip-tts",
        },
        body: JSON.stringify({ text: "Valid TTS text within limits" }),
      });
      const resRateLimited = await ttsPost(reqRateLimited);
      assert.equal(resRateLimited.status, 429);
      assert.ok(resRateLimited.headers.get("retry-after"));

      // C. Metrics endpoint rate limiting
      for (let i = 0; i < 30; i++) {
        checkRateLimit("test-ip-metrics", "metrics", 30, 60000);
      }
      const reqMetricsRate = new NextRequest("http://localhost:3000/api/metrics", {
        method: "GET",
        headers: { "x-forwarded-for": "test-ip-metrics" },
      });
      const resMetricsRate = await metricsGet(reqMetricsRate);
      assert.equal(resMetricsRate.status, 429);
    } finally {
      delete process.env.RATE_LIMIT_ENABLED;
    }
  });

  // ============================================================================
  // 7. Distributed Idempotency and Webhook Deduplication
  // ============================================================================
  test("Distributed Security: Webhook deduplication accurately detects duplicates", async () => {
    const eventId = `test_event_${Date.now()}`;

    // First call must acquire lock
    const isDup1 = await checkEventDuplicateAsync(eventId, 60000);
    assert.equal(isDup1, false, "Initial event processing must not be marked as duplicate");

    // Second call must detect duplicate
    const isDup2 = await checkEventDuplicateAsync(eventId, 60000);
    assert.equal(isDup2, true, "Immediate replay must be detected as duplicate");

    // Independent event must succeed
    const isDup3 = await checkEventDuplicateAsync(`independent_${Date.now()}`, 60000);
    assert.equal(isDup3, false);
  });

  // ============================================================================
  // 8. Canonical Webhook URL Resolution
  // ============================================================================
  test("Canonical Webhook URL: Correctly handles reverse proxies and multi-hop forward headers", () => {
    const prevAppUrl = process.env.APP_URL;
    const prevPublicUrl = process.env.NEXT_PUBLIC_APP_URL;
    const prevCanonicalUrl = process.env.CANONICAL_URL;

    try {
      delete process.env.APP_URL;
      delete process.env.NEXT_PUBLIC_APP_URL;
      delete process.env.CANONICAL_URL;

      const reqWithProxy = new NextRequest("http://internal-cluster:3000/api/voice/incoming?tenantId=clinic-1", {
        headers: {
          "x-forwarded-proto": "https, http",
          "x-forwarded-host": "vaniedge.vercel.app, proxy.internal",
        },
      });

      const canonical = getCanonicalWebhookUrl(reqWithProxy);
      assert.equal(canonical, "https://vaniedge.vercel.app/api/voice/incoming?tenantId=clinic-1");
    } finally {
      process.env.APP_URL = prevAppUrl;
      process.env.NEXT_PUBLIC_APP_URL = prevPublicUrl;
      process.env.CANONICAL_URL = prevCanonicalUrl;
    }
  });

  // ============================================================================
  // 9. Failover & Recovery State Transition
  // ============================================================================
  test("Failover Engine: Seamlessly executes Tier 2 Voicemail fallback on latency spike", () => {
    const session = createCallSession({
      callSid: `CA_test_${Date.now()}`,
      tenantId: "apex-hvac",
      from: "+18005550199",
      to: "+18149613703",
    });

    const tenant = getTenantById("apex-hvac");
    const fallbackResponse = executeTier2Fallback({
      session,
      tenant,
      recordingActionUrl: "/api/voice/recording",
      reason: "llm_timeout",
    });

    assert.equal(fallbackResponse.twimlResponse.status, 200);
    assert.ok(session.failoverTriggered);
    assert.equal(session.failoverReason, "llm_timeout");
    assert.equal(session.phase, "recording_fallback");
  });
});
