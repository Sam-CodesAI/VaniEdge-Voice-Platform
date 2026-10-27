import test from "node:test";
import assert from "node:assert/strict";
import { WatchdogEngine } from "../src/stream/watchdog";

test("Voice Streaming & Failover Watchdog Reliability Test Suite", async (t) => {
  await t.test("Requirement 1: Upstream connection timeout triggers failover", async () => {
    let failoverReason = "";
    let failoverDispatched = false;

    const watchdog = new WatchdogEngine({
      callSid: "CA_test_connect_timeout",
      streamSid: "MZ_stream_001",
      connectTimeoutMs: 50, // Short timeout for unit test
      ttftTimeoutMs: 100,
      onFailover: async (reason) => {
        failoverReason = reason;
        failoverDispatched = true;
      },
    });

    assert.equal(watchdog.getState(), "INITIALIZING");
    watchdog.armConnectWatchdog();

    // Wait for connect timeout to fire
    await new Promise((resolve) => setTimeout(resolve, 80));

    assert.equal(failoverDispatched, true);
    assert.equal(failoverReason, "connect_timeout");
    assert.equal(watchdog.isFailedOver(), true);
    assert.equal(watchdog.getState(), "FAILED_OVER");
  });

  await t.test("Requirement 2: Successful upstream connection disarms connect watchdog", async () => {
    let failoverDispatched = false;

    const watchdog = new WatchdogEngine({
      callSid: "CA_test_connect_success",
      streamSid: "MZ_stream_002",
      connectTimeoutMs: 100,
      ttftTimeoutMs: 200,
      onFailover: async () => {
        failoverDispatched = true;
      },
    });

    watchdog.armConnectWatchdog();
    // Simulate upstream connection within deadline
    watchdog.onUpstreamConnected(35);

    assert.equal(watchdog.getState(), "STREAM_READY");

    // Wait past the original timeout
    await new Promise((resolve) => setTimeout(resolve, 150));

    assert.equal(failoverDispatched, false, "Connect watchdog must not fire after successful connection");
  });

  await t.test("Requirement 3: TTFT dead-air timeout triggers failover when agent stalls", async () => {
    let failoverReason = "";
    let bufferCleared = false;

    const watchdog = new WatchdogEngine({
      callSid: "CA_test_ttft_timeout",
      streamSid: "MZ_stream_003",
      connectTimeoutMs: 200,
      ttftTimeoutMs: 50, // Short deadline
      onFailover: async (reason) => {
        failoverReason = reason;
      },
      onClearAudioBuffer: () => {
        bufferCleared = true;
      },
    });

    watchdog.onUpstreamConnected(20);
    // User stops speaking; deadline starts
    watchdog.onUserTurnCompleted();
    assert.equal(watchdog.getState(), "AWAITING_AGENT_RESPONSE");

    // Wait for TTFT deadline breach
    await new Promise((resolve) => setTimeout(resolve, 80));

    assert.equal(failoverReason, "ttft_timeout");
    assert.equal(bufferCleared, true, "Audio buffer must be cleared when failover occurs");
    assert.equal(watchdog.getState(), "FAILED_OVER");
  });

  await t.test("Requirement 4: First audio frame cancels TTFT watchdog", async () => {
    let failoverDispatched = false;

    const watchdog = new WatchdogEngine({
      callSid: "CA_test_ttft_success",
      streamSid: "MZ_stream_004",
      connectTimeoutMs: 200,
      ttftTimeoutMs: 100,
      onFailover: async () => {
        failoverDispatched = true;
      },
    });

    watchdog.onUpstreamConnected(15);
    watchdog.onUserTurnCompleted();

    // Agent replies in 30ms (well under 100ms threshold)
    await new Promise((resolve) => setTimeout(resolve, 30));
    watchdog.onAgentAudioReceived();

    assert.equal(watchdog.getState(), "AGENT_SPEAKING");

    // Wait past original deadline
    await new Promise((resolve) => setTimeout(resolve, 120));
    assert.equal(failoverDispatched, false, "TTFT watchdog must not fire once audio is received");
  });

  await t.test("Requirement 5: Failover execution is strictly idempotent", async () => {
    let dispatchCount = 0;

    const watchdog = new WatchdogEngine({
      callSid: "CA_test_idempotency",
      streamSid: "MZ_stream_005",
      onFailover: async () => {
        dispatchCount++;
      },
    });

    // Trigger failover multiple times concurrently
    await Promise.all([
      watchdog.triggerFailover("connect_timeout", 100),
      watchdog.triggerFailover("socket_error", 100),
      watchdog.triggerFailover("ttft_timeout", 100),
    ]);

    assert.equal(dispatchCount, 1, "Failover callback must execute exactly once per call");
  });

  await t.test("Requirement 6: User interruption clears audio buffer and switches to LISTENING", () => {
    let bufferCleared = false;

    const watchdog = new WatchdogEngine({
      callSid: "CA_test_interruption",
      streamSid: "MZ_stream_006",
      onFailover: async () => {},
      onClearAudioBuffer: () => {
        bufferCleared = true;
      },
    });

    watchdog.onUpstreamConnected(20);
    watchdog.onAgentAudioReceived();
    assert.equal(watchdog.getState(), "AGENT_SPEAKING");

    watchdog.onUserInterruption();
    assert.equal(bufferCleared, true);
    assert.equal(watchdog.getState(), "LISTENING");
  });
});
