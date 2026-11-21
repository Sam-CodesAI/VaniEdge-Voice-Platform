import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { POST as outboundRoute } from "../app/api/voice/outbound/route";
import {
  GET as appointmentsGet,
  POST as appointmentsPost,
  PATCH as appointmentsPatch,
} from "../app/api/receptionist/appointments/route";

describe("Outbound Telephony Security & Toll Fraud Defense", () => {
  it("Requirement 1: Rejects malformed or non-E.164 phone numbers with RFC 7807 problem details", async () => {
    const invalidNumbers = ["12345", "not-a-number", "555-123-4567", "+1", "+0123456789"];

    for (const invalidNum of invalidNumbers) {
      const req = new NextRequest("https://vaniedge.vercel.app/api/voice/outbound", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-forwarded-for": "198.51.100.1" },
        body: JSON.stringify({ to: invalidNum }),
      });

      const res = await outboundRoute(req);
      assert.equal(res.status, 400, `Expected 400 for invalid number: ${invalidNum}`);

      const data = (await res.json()) as { type?: string; status?: number; title?: string };
      assert.equal(data.status, 400);
      assert.equal(data.title, "Invalid Phone Number Format");
      assert.ok(data.type?.includes("invalid-phone-format"));
    }
  });

  it("Requirement 2: Rejects toll fraud & premium-rate destinations with 403 Forbidden", async () => {
    const fraudDestinations = ["+19005550199", "+19765550199", "+881636120925", "+882163612092"];

    for (const fraudNum of fraudDestinations) {
      const req = new NextRequest("https://vaniedge.vercel.app/api/voice/outbound", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-forwarded-for": "198.51.100.2" },
        body: JSON.stringify({ to: fraudNum }),
      });

      const res = await outboundRoute(req);
      assert.equal(res.status, 403, `Expected 403 for blocked prefix: ${fraudNum}`);

      const data = (await res.json()) as { type?: string; status?: number; title?: string };
      assert.equal(data.status, 403);
      assert.equal(data.title, "Restricted Destination Number");
      assert.ok(data.type?.includes("restricted-destination"));
    }
  });
});

describe("Receptionist Appointments PII Protection & Input Validation", () => {
  it("Requirement 3: Masks phone numbers and medical notes for unauthenticated viewers", async () => {
    const req = new NextRequest("https://vaniedge.vercel.app/api/receptionist/appointments?tenantId=clinic", {
      method: "GET",
      headers: { "x-forwarded-for": "198.51.100.3" },
    });

    const res = await appointmentsGet(req);
    assert.equal(res.status, 200);

    const data = (await res.json()) as { success?: boolean; appointments?: Array<{ callerPhone: string; notes?: string }> };
    assert.ok(data.success);
    assert.ok(Array.isArray(data.appointments));
    assert.ok(data.appointments.length > 0);

    for (const appt of data.appointments) {
      // Must contain asterisks masking middle digits
      assert.ok(appt.callerPhone.includes("****"), `Expected masked phone, got: ${appt.callerPhone}`);
      // Unauthenticated viewers must not see raw private medical notes
      if (appt.notes) {
        assert.equal(appt.notes, "[Protected Medical Note]");
      }
    }
  });

  it("Requirement 4: Validates required fields and rejects invalid appointment booking payloads", async () => {
    const invalidPayloads = [
      {}, // Missing all
      { callerName: "", callerPhone: "+919876543210", serviceType: "Checkup" }, // Empty name
      { callerName: "John", callerPhone: "123", serviceType: "Checkup" }, // Too short phone
      { callerName: "John", callerPhone: "+919876543210", serviceType: "" }, // Empty serviceType
    ];

    for (const payload of invalidPayloads) {
      const req = new NextRequest("https://vaniedge.vercel.app/api/receptionist/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-forwarded-for": "198.51.100.4" },
        body: JSON.stringify(payload),
      });

      const res = await appointmentsPost(req);
      assert.equal(res.status, 400);

      const data = (await res.json()) as { status?: number; title?: string };
      assert.equal(data.status, 400);
      assert.equal(data.title, "Invalid Appointment Payload");
    }
  });

  it("Requirement 5: Rejects invalid status transitions with 400 Validation Error", async () => {
    const req = new NextRequest("https://vaniedge.vercel.app/api/receptionist/appointments", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "x-forwarded-for": "198.51.100.5" },
      body: JSON.stringify({ id: "appt_careplus_01", status: "INVALID_STATUS" }),
    });

    const res = await appointmentsPatch(req);
    assert.equal(res.status, 400);

    const data = (await res.json()) as { status?: number; title?: string };
    assert.equal(data.status, 400);
    assert.equal(data.title, "Invalid Status Update");
  });
});
