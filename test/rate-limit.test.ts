import test from "node:test";
import assert from "node:assert/strict";
import { checkRateLimit, resetRateLimits } from "../lib/rate-limit";

test("Rate Limiting Security Test Suite", async (t) => {
  t.beforeEach(() => {
    resetRateLimits();
    process.env.RATE_LIMIT_ENABLED = "true";
  });

  await t.test("allows requests up to the configured limit", () => {
    const ip = "192.168.1.10";
    const action = "test_action";
    const max = 3;
    const windowMs = 5000;

    const res1 = checkRateLimit(ip, action, max, windowMs);
    assert.equal(res1.success, true);
    assert.equal(res1.remaining, 2);

    const res2 = checkRateLimit(ip, action, max, windowMs);
    assert.equal(res2.success, true);
    assert.equal(res2.remaining, 1);

    const res3 = checkRateLimit(ip, action, max, windowMs);
    assert.equal(res3.success, true);
    assert.equal(res3.remaining, 0);

    // 4th request must be rejected (429 condition)
    const res4 = checkRateLimit(ip, action, max, windowMs);
    assert.equal(res4.success, false);
    assert.equal(res4.remaining, 0);
    assert.ok(res4.resetMs > 0);
  });

  await t.test("isolates rate limits between different IPs and actions", () => {
    const ipA = "10.0.0.1";
    const ipB = "10.0.0.2";
    const action = "login";

    // Exhaust ipA
    checkRateLimit(ipA, action, 1, 5000);
    const blockedA = checkRateLimit(ipA, action, 1, 5000);
    assert.equal(blockedA.success, false);

    // ipB should remain unblocked
    const allowedB = checkRateLimit(ipB, action, 1, 5000);
    assert.equal(allowedB.success, true);
  });
});
