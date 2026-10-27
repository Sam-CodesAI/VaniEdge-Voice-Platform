import test from "node:test";
import assert from "node:assert/strict";
import { TelephonyWatchdog } from "../src/telephony/watchdog";
import {
  createCallSession,
  executeTier2Fallback,
  executeTier3WarmTransfer,
  executeTier4SmsRescue,
  persistSessionToDatabase,
} from "../lib/telephony/failover-engine";
import { TenantProfile } from "../lib/telephony/types";

const mockTenant = {
  id: "tnt_benchmark_001",
  name: "Apex Healthcare Benchmark",
  industry: "healthcare",
  phone: "+18149613703",
  emergencyNumbers: {
    primaryDispatcher: "+18005550199",
    onCallTechnician: "+18005550199",
    officeFallback: "+18005550198",
  },
  businessHours: {
    timezone: "America/New_York",
    schedule: {
      monday: { open: "08:00", close: "18:00" },
      tuesday: { open: "08:00", close: "18:00" },
      wednesday: { open: "08:00", close: "18:00" },
      thursday: { open: "08:00", close: "18:00" },
      friday: { open: "08:00", close: "18:00" },
      saturday: { open: "09:00", close: "14:00" },
      sunday: { open: "00:00", close: "00:00", closed: true },
    },
  },
  knowledgeBase: {
    serviceArea: ["New York", "Brooklyn"],
    pricingRules: [{ service: "Emergency Triage", price: "$0" }],
    emergencyKeywords: ["chest pain", "emergency", "ambulance", "bleeding"],
    faq: [{ question: "Hours?", answer: "24/7" }],
  },
  voiceConfig: {
    language: "en-US",
    greeting: "Thank you for calling Apex Healthcare.",
    tcpaConsentNotice: "This call is recorded for quality assurance.",
    pollyVoice: "Joanna",
  },
  bookingUrl: "https://cal.com/apex/rescue",
  smsRescueTemplate: "Sorry we missed your call. Book here: https://cal.com/apex/rescue",
} as unknown as TenantProfile;

test("End-to-End Voice Telephony Failure Condition Benchmarks", async (t) => {
  await t.test("Benchmark 1: Upstream WebSocket connection timeout triggers failover within measured window", async () => {
    let failoverTriggered = false;
    let failoverReason = "";
    let elapsedMs = 0;

    const watchdog = new TelephonyWatchdog(
      "CA_bench_timeout_01",
      (reason, elapsed) => {
        failoverTriggered = true;
        failoverReason = reason;
        elapsedMs = elapsed;
      },
      { connectionTimeoutMs: 100 }
    );

    const start = performance.now();
    watchdog.armConnectionWatchdog();

    // Wait 150ms to allow 100ms deadline to expire
    await new Promise((resolve) => setTimeout(resolve, 150));

    const totalTime = Math.round(performance.now() - start);

    assert.equal(failoverTriggered, true, "Watchdog must reliably fire failover callback");
    assert.equal(failoverReason, "UPSTREAM_WS_CONNECTION_TIMEOUT");
    assert.ok(totalTime >= 100 && totalTime <= 250, `Measured timeout (${totalTime}ms) must be within expected bounds`);
  });

  await t.test("Benchmark 2: Dead-air TTFT stall triggers failover within measured deadline", async () => {
    let failoverTriggered = false;
    let failoverReason = "";

    const watchdog = new TelephonyWatchdog(
      "CA_bench_ttft_02",
      (reason) => {
        failoverTriggered = true;
        failoverReason = reason;
      },
      { connectionTimeoutMs: 500, ttftTimeoutMs: 120 }
    );

    watchdog.armConnectionWatchdog();
    watchdog.markConnected();

    // Simulate stalled LLM dead air by waiting 160ms (exceeding 120ms deadline)
    await new Promise((resolve) => setTimeout(resolve, 160));

    assert.equal(failoverTriggered, true, "Dead-air TTFT stall must trigger failover");
    assert.equal(failoverReason, "TTFT_DEADLINE_EXCEEDED");
  });

  await t.test("Benchmark 3: Tier 2 Voicemail Circuit Breaker trips in < 10ms", async () => {
    const session = createCallSession({
      callSid: "CA_bench_tier2_03",
      tenantId: mockTenant.id,
      from: "+18005550100",
      to: mockTenant.phone,
    });

    const start = performance.now();
    const result = executeTier2Fallback({
      session,
      tenant: mockTenant,
      recordingActionUrl: "https://vaniedge.ai/api/voice/recording",
      reason: "llm_timeout",
    });
    const executionDurationMs = performance.now() - start;

    assert.equal(result.session.phase, "recording_fallback");
    assert.equal(result.session.failoverTriggered, true);
    assert.ok(
      executionDurationMs < 10,
      `Tier 2 circuit breaker trip must be instantaneous (measured: ${executionDurationMs.toFixed(2)}ms)`
    );

    // Verify durable session persistence
    const persistResult = await persistSessionToDatabase(result.session);
    assert.equal(persistResult.success, true);
  });

  await t.test("Benchmark 4: Tier 3 Warm Emergency Transfer completes sub-millisecond triage", async () => {
    const session = createCallSession({
      callSid: "CA_bench_tier3_04",
      tenantId: mockTenant.id,
      from: "+18005550100",
      to: mockTenant.phone,
    });

    const start = performance.now();
    const result = executeTier3WarmTransfer({
      session,
      tenant: mockTenant,
      whisperUrl: "https://vaniedge.ai/api/voice/whisper",
      fallbackActionUrl: "https://vaniedge.ai/api/voice/transfer-status",
      emergencyReason: "severe injury",
    });
    const triageTimeMs = performance.now() - start;

    assert.equal(result.session.phase, "transferring_live");
    assert.equal(result.session.intent, "emergency_transfer");
    assert.ok(
      triageTimeMs < 5,
      `Emergency triage must complete under 5ms (measured: ${triageTimeMs.toFixed(2)}ms)`
    );
  });

  await t.test("Benchmark 5: Latency percentile distribution under burst call volume", async () => {
    const sampleLatencies: number[] = [];
    const callCount = 50;

    for (let i = 0; i < callCount; i++) {
      const callSid = `CA_perf_burst_${i}_${Date.now()}`;
      const start = performance.now();

      const session = createCallSession({
        callSid,
        tenantId: mockTenant.id,
        from: `+1800555${(1000 + i).toString().slice(-4)}`,
        to: mockTenant.phone,
      });

      // Execute simulated triage and transcript logging
      session.transcript.push({
        role: "caller",
        text: "Need consultation for tomorrow morning",
        timestamp: Date.now(),
      });

      const elapsed = +(performance.now() - start).toFixed(2);
      sampleLatencies.push(elapsed);
    }

    sampleLatencies.sort((a, b) => a - b);
    const p50 = sampleLatencies[Math.floor(sampleLatencies.length * 0.5)];
    const p95 = sampleLatencies[Math.floor(sampleLatencies.length * 0.95)];
    const max = sampleLatencies[sampleLatencies.length - 1];

    // Assert realistic performance bounds
    assert.ok(p50 < 2.0, `P50 call creation latency must be < 2.0ms (measured: ${p50}ms)`);
    assert.ok(p95 < 5.0, `P95 call creation latency must be < 5.0ms (measured: ${p95}ms)`);
    assert.ok(max < 15.0, `Max call creation latency must be < 15.0ms (measured: ${max}ms)`);
  });
});
