import test from "node:test";
import assert from "node:assert/strict";
import { TenantStore } from "../lib/tenant-store";
import path from "node:path";
import fs from "node:fs";

test("Multi-Tenant Isolation & IDOR Protection Test Suite", async (t) => {
  const testDbPath = path.join(process.cwd(), ".data", `test_tenants_${Date.now()}.json`);
  const store = new TenantStore(testDbPath);

  t.after(() => {
    try {
      if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
    } catch {}
  });

  const userA = "usr_tenant_user_a";
  const userB = "usr_tenant_user_b";

  let tenantAId = "";
  let tenantBId = "";

  await t.test("Requirement 1: Tenant provisioning associates ownership with authenticated user", async () => {
    tenantAId = `tnt_a_${Date.now()}`;
    const tenantA = await store.create({
      id: tenantAId,
      ownerId: userA,
      name: "Client Alpha",
      category: "clinic",
      twilioPhone: "+18005550101",
      twilioSid: "ACsecret_sid_alpha",
      webhookUrl: "https://vaniedge.ai/api/voice/incoming",
      monthlyCalls: 0,
      status: "active",
    });

    assert.equal(tenantA.id, tenantAId);
    assert.equal(tenantA.ownerId, userA);

    tenantBId = `tnt_b_${Date.now()}`;
    const tenantB = await store.create({
      id: tenantBId,
      ownerId: userB,
      name: "Client Beta",
      category: "restaurant",
      twilioPhone: "+18005550102",
      twilioSid: "ACsecret_sid_beta",
      webhookUrl: "https://vaniedge.ai/api/voice/incoming",
      monthlyCalls: 0,
      status: "active",
    });

    assert.equal(tenantB.id, tenantBId);
    assert.equal(tenantB.ownerId, userB);
  });

  await t.test("Requirement 2: Tenant listing isolates records by ownerId", async () => {
    const listForA = await store.getAll(userA);
    assert.equal(listForA.length, 1);
    assert.equal(listForA[0].id, tenantAId);

    const listForB = await store.getAll(userB);
    assert.equal(listForB.length, 1);
    assert.equal(listForB[0].id, tenantBId);
  });

  await t.test("Requirement 3: IDOR Prevention - User A cannot access User B's tenant", async () => {
    // User A trying to get Tenant B must return null
    const unauthorizedAccess = await store.get(tenantBId, userA);
    assert.equal(unauthorizedAccess, null, "Cross-tenant access must return null without leaking existence");

    // Legitimate owner access works
    const authorizedAccess = await store.get(tenantBId, userB);
    assert.ok(authorizedAccess);
    assert.equal(authorizedAccess?.id, tenantBId);
  });

  await t.test("Requirement 4: IDOR Prevention - User A cannot update or mutate User B's tenant", async () => {
    const updateResult = await store.update(
      tenantBId,
      { name: "Hacked by User A" },
      userA
    );
    assert.equal(updateResult, null, "Unauthorized update must fail");

    // Verify tenant B's name is unchanged
    const verified = await store.get(tenantBId, userB);
    assert.equal(verified?.name, "Client Beta");
  });

  await t.test("Requirement 5: Immutability - Client cannot reassign ownership via request body", async () => {
    const attemptedHijack = await store.update(
      tenantAId,
      {
        ownerId: "usr_attacker",
        id: "tnt_overwritten",
        name: "Legit Update",
      } as Record<string, unknown>,
      userA
    );

    assert.ok(attemptedHijack);
    assert.equal(attemptedHijack?.ownerId, userA, "ownerId must be immutable through updates");
    assert.equal(attemptedHijack?.id, tenantAId, "id must be immutable through updates");
  });

  await t.test("Requirement 6: IDOR Prevention - User A cannot delete User B's tenant", async () => {
    const deleteResult = await store.delete(tenantBId, userA);
    assert.equal(deleteResult, false, "Unauthorized delete must fail");

    // Tenant B still exists
    const stillExists = await store.get(tenantBId, userB);
    assert.ok(stillExists);
  });

  await t.test("Requirement 7: safeTenant sanitization strips twilioSid and sensitive credentials", async () => {
    const tenant = await store.get(tenantAId, userA);
    assert.ok(tenant);

    const safe = store.safeTenant(tenant!);
    // @ts-expect-error verifying twilioSid removal
    assert.equal(safe.twilioSid, undefined, "twilioSid must not be exposed in safeTenant DTO");
    assert.equal(safe.twilioConfigured, true);
  });

  await t.test("Requirement 8: Cold restart survival via durable storage", async () => {
    const freshStore = new TenantStore(testDbPath);
    const restoredA = await freshStore.get(tenantAId, userA);
    assert.ok(restoredA, "Persisted tenant must be found on cold instance");
    assert.equal(restoredA?.name, "Legit Update");
  });
});
