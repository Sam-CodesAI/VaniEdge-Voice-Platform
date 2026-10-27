import test from "node:test";
import assert from "node:assert/strict";
import { TicketDispatcher, generateSmsConfirmation } from "../src/dispatch/tickets";

test("Business Actions & Customer-Facing Claims Integrity Test Suite", async (t) => {
  const dispatcher = new TicketDispatcher();

  await t.test("Requirement 1: Standard service tickets default to PENDING status", async () => {
    const ticket = await dispatcher.createTicket({
      callerName: "Rahul Sharma",
      callerPhone: "+919876543210",
      category: "clinic",
      serviceType: "Doctor Consultation",
      details: "Tomorrow 10:00 AM",
      priority: "STANDARD",
    });

    assert.equal(ticket.status, "PENDING", "Standard ticket must not claim confirmed status without provider verification");
    assert.match(ticket.smsConfirmation, /pending/i);
    assert.doesNotMatch(ticket.smsConfirmation, /confirmed/i);
  });

  await t.test("Requirement 2: Emergency requests escalate to human without inventing arrival times", async () => {
    const emergencyTicket = await dispatcher.createTicket({
      callerName: "Vikram Mehta",
      callerPhone: "+919876543211",
      category: "auto",
      serviceType: "Highway Breakdown",
      details: "Flat tire on expressway",
      priority: "URGENT",
    });

    assert.equal(emergencyTicket.status, "ESCALATED");
    assert.match(emergencyTicket.smsConfirmation, /emergency|escalat|human coordinator/i);
    // Must never claim fixed arrival time like "18 mins"
    assert.doesNotMatch(emergencyTicket.smsConfirmation, /18 mins|18 minutes|vehicle dispatched/i);
  });

  await t.test("Requirement 3: Explicit demo mode simulation is transparently labeled", () => {
    const demoSms = generateSmsConfirmation(
      "clinic",
      "Demo User",
      "Consultation",
      "10:00 AM",
      "VANI-CLI-1001",
      "en",
      "PENDING",
      true // isSimulated
    );

    assert.match(demoSms, /\[DEMO SIMULATION\]/i, "Demo mode must be explicitly flagged to prevent customer deception");
  });

  await t.test("Requirement 4: Multi-lingual SMS confirmations maintain honest states", () => {
    // Hindi
    const hiPending = generateSmsConfirmation(
      "clinic",
      "अमित वर्मा",
      "डॉक्टर अपॉइंटमेंट",
      "कल 11 बजे",
      "VANI-CLI-1002",
      "hi",
      "PENDING"
    );
    assert.match(hiPending, /अनुरोध प्राप्त|पुष्टि प्रक्रियाधीन/i);
    assert.doesNotMatch(hiPending, /कन्फर्म/i);

    // Kannada
    const knPending = generateSmsConfirmation(
      "clinic",
      "ಸುರೇಶ್",
      "ಅಪಾಯಿಂಟ್‌ಮೆಂಟ್",
      "ಸಂಜೆ 5",
      "VANI-CLI-1003",
      "kn",
      "PENDING"
    );
    assert.match(knPending, /ವಿನಂತಿ ದಾಖಲಾಗಿದೆ|ನಿರೀಕ್ಷೆಯಲ್ಲಿದೆ/i);
    assert.doesNotMatch(knPending, /ದೃಢೀಕರಿಸಲಾಗಿದೆ/i);
  });
});
