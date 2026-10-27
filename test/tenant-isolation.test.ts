import test from "node:test";
import assert from "node:assert/strict";
import { TenantStore } from "../lib/tenant-store";
import { authDb } from "../lib/auth-store";
import { NextRequest } from "next/server";
import { POST as handlePostQuery, GET as handleGetQuery } from "../app/api/query/route";
import { POST as handlePostDispatch, GET as handleGetDispatch } from "../app/api/dispatch/route";
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

  await t.test("Requirement 9: Cross-tenant access to /api/query enforces authorization & rejects unowned tenant access", async () => {
    // 1. Create two users and sessions
    const { user: realUserA, token: tokenA } = await authDb.register(
      "Query User A",
      `query_user_a_${Date.now()}@example.com`,
      "PasswordA#123"
    );

    const { user: realUserB } = await authDb.register(
      "Query User B",
      `query_user_b_${Date.now()}@example.com`,
      "PasswordB#123"
    );

    // 2. Unauthenticated query must fail with 401
    const unauthReq = new NextRequest("http://localhost:3000/api/query", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: "clinic hours" }),
    });
    const unauthRes = await handlePostQuery(unauthReq);
    assert.equal(unauthRes.status, 401, "Unauthenticated query must be rejected with 401");

    // 3. User A querying their own tenant succeeds
    const legitReq = new NextRequest("http://localhost:3000/api/query", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: `vaniedge_session=${tokenA}`,
      },
      body: JSON.stringify({ query: "clinic hours", tenantId: realUserA.id }),
    });
    const legitRes = await handlePostQuery(legitReq);
    assert.equal(legitRes.status, 200, "Authorized query must succeed");

    // 4. Cross-tenant access: User A querying User B's tenantId must be rejected with 403 Forbidden
    const crossTenantReq = new NextRequest("http://localhost:3000/api/query", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: `vaniedge_session=${tokenA}`,
      },
      body: JSON.stringify({ query: "clinic hours", tenantId: realUserB.id }),
    });
    const crossTenantRes = await handlePostQuery(crossTenantReq);
    assert.equal(crossTenantRes.status, 403, "Cross-tenant query must be rejected with 403 Forbidden");

    // 5. Cross-tenant GET /api/query?tenantId=... must be rejected with 403
    const crossGetReq = new NextRequest(`http://localhost:3000/api/query?tenantId=${realUserB.id}`, {
      method: "GET",
      headers: {
        cookie: `vaniedge_session=${tokenA}`,
      },
    });
    const crossGetRes = await handleGetQuery(crossGetReq);
    assert.equal(crossGetRes.status, 403, "Cross-tenant query list must be rejected with 403 Forbidden");
  });

  await t.test("Requirement 10: Cross-tenant access to /api/dispatch enforces authorization & rejects unowned tenant access", async () => {
    const { user: userA, token: tokenA } = await authDb.register(
      "Dispatch User A",
      `dispatch_user_a_${Date.now()}@example.com`,
      "PasswordA#123"
    );

    const { user: userB } = await authDb.register(
      "Dispatch User B",
      `dispatch_user_b_${Date.now()}@example.com`,
      "PasswordB#123"
    );

    // 1. Unauthenticated dispatch must be rejected with 401
    const unauthReq = new NextRequest("http://localhost:3000/api/dispatch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        callerName: "Eve Attacker",
        callerPhone: "+18005559999",
        category: "auto",
        serviceType: "Towing",
      }),
    });
    const unauthRes = await handlePostDispatch(unauthReq);
    assert.equal(unauthRes.status, 401, "Unauthenticated dispatch must be rejected with 401");

    // 2. User A dispatching under their own tenant succeeds
    const legitReq = new NextRequest("http://localhost:3000/api/dispatch", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        origin: "http://localhost:3000",
        cookie: `vaniedge_session=${tokenA}`,
      },
      body: JSON.stringify({
        callerName: "Legit Caller",
        callerPhone: "+18005551234",
        category: "clinic",
        serviceType: "Consultation",
        tenantId: userA.id,
      }),
    });
    const legitRes = await handlePostDispatch(legitReq);
    assert.equal(legitRes.status, 201, "Legitimate dispatch must succeed with 201");
    const legitJson = (await legitRes.json()) as Record<string, unknown>;
    assert.equal(legitJson.dispatched, false, "Must honestly report external action has not yet dispatched");

    // 3. Cross-tenant dispatch: User A attempting to create ticket under User B's tenant must fail with 403
    const crossReq = new NextRequest("http://localhost:3000/api/dispatch", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        origin: "http://localhost:3000",
        cookie: `vaniedge_session=${tokenA}`,
      },
      body: JSON.stringify({
        callerName: "Spoofed Caller",
        callerPhone: "+18005550000",
        category: "clinic",
        serviceType: "Consultation",
        tenantId: userB.id,
      }),
    });
    const crossRes = await handlePostDispatch(crossReq);
    assert.equal(crossRes.status, 403, "Cross-tenant dispatch attempt must fail with 403 Forbidden");

    // 4. Cross-tenant ticket reads: User A attempting to read User B's tickets must fail with 403
    const crossReadReq = new NextRequest(`http://localhost:3000/api/dispatch?tenantId=${userB.id}`, {
      method: "GET",
      headers: {
        cookie: `vaniedge_session=${tokenA}`,
      },
    });
    const crossReadRes = await handleGetDispatch(crossReadReq);
    assert.equal(crossReadRes.status, 403, "Cross-tenant ticket read attempt must fail with 403 Forbidden");
  });
});
