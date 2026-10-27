import test from "node:test";
import assert from "node:assert/strict";
import { authDb, DurableAuthDatabase } from "../lib/auth-store";

test("VaniEdge Auth Security & Persistence Test Suite", async (t) => {
  await t.test("Requirement 1: Demo credentials must NOT be seeded in production", async () => {
    // Attempting to authenticate with the hardcoded developer or demo credentials must fail
    await assert.rejects(
      async () => {
        await authDb.authenticate("developer@vaniedge.ai", "password123");
      },
      /No account found/i,
      "Hardcoded developer demo credentials should not exist"
    );

    await assert.rejects(
      async () => {
        await authDb.authenticate("demo@vaniedge.ai", "password123");
      },
      /No account found/i,
      "Hardcoded demo account should not exist"
    );
  });

  await t.test("Requirement 2: Registration, established password hashing, and constant-time check", async () => {
    const testEmail = `operator_${Date.now()}@example.com`;
    const plainPassword = "SuperSecurePassword#2026!";

    const { user, token } = await authDb.register(
      "Test Operator",
      testEmail,
      plainPassword,
      "Apex Diagnostics",
      "email"
    );

    assert.ok(user.id.startsWith("usr_"));
    assert.equal(user.email, testEmail);
    assert.ok(token.startsWith("vsk_"));

    // Verify password is not stored plaintext
    assert.notEqual(user.passwordHash, plainPassword);
    // Salt must be high entropy (64 hex characters = 32 bytes)
    assert.equal(user.salt.length, 64, "Salt must be 32 bytes (64 hex chars)");
    // scrypt hash must be 128 hex characters = 64 bytes
    assert.equal(user.passwordHash.length, 128, "Password hash must be 64 bytes (128 hex chars)");

    // Safe user must strip sensitive fields
    const safe = authDb.safeUser(user);
    // @ts-expect-error - verifying field removal
    assert.equal(safe.passwordHash, undefined);
    // @ts-expect-error - verifying field removal
    assert.equal(safe.salt, undefined);

    // Authenticate with correct password
    const authResult = await authDb.authenticate(testEmail, plainPassword);
    assert.equal(authResult.user.id, user.id);
    assert.ok(authResult.token.startsWith("vsk_"));

    // Authenticate with incorrect password must fail
    await assert.rejects(
      async () => {
        await authDb.authenticate(testEmail, "WrongPassword#999");
      },
      /Invalid password/i
    );
  });

  await t.test("Requirement 3: Persistent, revocable sessions", async () => {
    const email = `session_test_${Date.now()}@example.com`;
    const { user, token } = await authDb.register(
      "Session User",
      email,
      "SecurePass123!@",
      "Cloud Corp"
    );

    // Verify session retrieval
    const sessionUser = await authDb.getSessionUser(token);
    assert.ok(sessionUser, "Session user should be found");
    assert.equal(sessionUser?.id, user.id);

    // Revoke the session
    const revoked = await authDb.revokeSession(token);
    assert.equal(revoked, true, "Revocation must return true for active token");

    // Once revoked, getSessionUser must return null
    const postRevokeUser = await authDb.getSessionUser(token);
    assert.equal(postRevokeUser, null, "Revoked session must return null");
  });

  await t.test("Requirement 4: Revoke all user sessions", async () => {
    const email = `multisession_${Date.now()}@example.com`;
    const { user, token: token1 } = await authDb.register(
      "Multi User",
      email,
      "SecurePass123!@",
      "Multi Corp"
    );

    // Create a second session
    const token2 = await authDb.createSession(user.id);

    // Verify both are active
    assert.ok(await authDb.getSessionUser(token1));
    assert.ok(await authDb.getSessionUser(token2));

    // Revoke all sessions for this user
    const count = await authDb.revokeAllUserSessions(user.id);
    assert.ok(count >= 2, "Should revoke all active sessions");

    // Verify neither works now
    assert.equal(await authDb.getSessionUser(token1), null);
    assert.equal(await authDb.getSessionUser(token2), null);
  });

  await t.test("Requirement 5: API Key authentication and rotation", async () => {
    const email = `apikey_test_${Date.now()}@example.com`;
    const { user } = await authDb.register(
      "API User",
      email,
      "PassKey123!@",
      "Key Corp"
    );

    const initialApiKey = user.credentials.apiKey;
    assert.ok(initialApiKey.startsWith("ve_live_"));

    // Lookup user by API key
    const foundUser = await authDb.getUserByApiKey(initialApiKey);
    assert.ok(foundUser);
    assert.equal(foundUser?.id, user.id);

    // Rotate API key
    const newCreds = await authDb.rotateApiKey(user.id);
    assert.notEqual(newCreds.apiKey, initialApiKey);

    // Old key must be invalidated
    const oldKeyLookup = await authDb.getUserByApiKey(initialApiKey);
    assert.equal(oldKeyLookup, null, "Previous API key must be invalidated");

    // New key must work
    const newKeyLookup = await authDb.getUserByApiKey(newCreds.apiKey);
    assert.ok(newKeyLookup);
    assert.equal(newKeyLookup?.id, user.id);
  });

  await t.test("Requirement 6: Cold restart survival via durable storage", async () => {
    const email = `cold_restart_${Date.now()}@example.com`;
    const { user, token } = await authDb.register(
      "Cold Restart User",
      email,
      "ColdPass123!@",
      "Restart Corp"
    );

    // Simulate new cold serverless instance initializing from durable storage
    const newInstance = new DurableAuthDatabase();

    // Verify user can authenticate on fresh instance
    const authOnNew = await newInstance.authenticate(email, "ColdPass123!@");
    assert.equal(authOnNew.user.id, user.id);

    // Verify session token is valid on fresh instance
    const sessionOnNew = await newInstance.getSessionUser(token);
    assert.ok(sessionOnNew);
    assert.equal(sessionOnNew?.id, user.id);
  });
});
