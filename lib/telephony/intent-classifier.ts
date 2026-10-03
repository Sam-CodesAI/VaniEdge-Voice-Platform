/**
 * VaniEdge-Pro Telephony Platform
 * Hybrid Intent Classifier & Emergency Gate
 * 
 * Sub-millisecond negation-aware regex triage for life/property safety emergencies,
 * paired with fast Groq / Gemini AI routing for conversational inquiries.
 */

import { TenantProfile, IntentResult, IntentType } from "./types";
import { checkBusinessHours } from "./tenant-store";

// Negation pattern: prevents false positives (e.g., "I don't have a gas leak")
const NEGATION_PATTERN =
  /\b(no|not|don't have|dont have|never had|did you fix|already fixed|was the|is the)\s+[\w\s]{0,25}(gas leak|burst pipe|flooding|fire|carbon monoxide|emergency)/i;

const HUMAN_TRANSFER_PATTERNS = [
  /\b(speak to (a |an )?(human|person|agent|representative|operator|technician|dispatcher))\b/i,
  /\b(talk to (a |an )?(human|person|agent|representative|operator|technician|dispatcher))\b/i,
  /\b(connect me to (a |an )?(human|person|agent|representative|dispatcher))\b/i,
  /\b(operator|representative|human|real person)\b/i,
];

const PRICING_PATTERNS = [
  /\b(how much|cost|pricing|price|rate|fees?|estimate|quote|charge)\b/i,
];

const BOOKING_PATTERNS = [
  /\b(book(ing)?|schedule|appointment|set up a visit|come out|have someone look|tune up|annual service|maintenance check)\b/i,
];

/**
 * Fast sub-millisecond regex check for emergency keywords.
 */
export function checkEmergencyTriage(text: string, tenant: TenantProfile): {
  isEmergency: boolean;
  matchedKeyword?: string;
} {
  if (NEGATION_PATTERN.test(text)) {
    return { isEmergency: false };
  }

  const lower = text.toLowerCase();
  for (const kw of tenant.knowledgeBase.emergencyKeywords) {
    const kwRegex = new RegExp(`\\b${kw}\\b`, "i");
    if (kwRegex.test(lower)) {
      return { isEmergency: true, matchedKeyword: kw };
    }
  }

  return { isEmergency: false };
}

/**
 * Procedural intent classifier that evaluates deterministic rules before invoking LLMs.
 */
export function classifyProceduralIntent(
  text: string,
  tenant: TenantProfile
): IntentResult | null {
  const trimmed = text.trim();
  if (!trimmed) {
    return {
      intent: "unclear",
      confidence: 0,
      summary: "Empty or inaudible input",
      emergencyDetected: false,
      replyText: "I didn't quite catch that. Could you please repeat how we can help you today?",
      action: "gather",
    };
  }

  // 1. Emergency Gate (Highest priority)
  const emergencyCheck = checkEmergencyTriage(trimmed, tenant);
  if (emergencyCheck.isEmergency) {
    const kw = emergencyCheck.matchedKeyword || "urgent issue";
    return {
      intent: "emergency_transfer",
      confidence: 1.0,
      summary: `Urgent emergency detected: ${kw}`,
      emergencyDetected: true,
      emergencyKeyword: kw,
      replyText: `I understand this is an urgent emergency regarding ${kw}. I am initiating an immediate warm transfer to our on-call technician right now.`,
      action: "transfer",
    };
  }

  // 2. Explicit Human Request
  for (const pat of HUMAN_TRANSFER_PATTERNS) {
    if (pat.test(trimmed)) {
      const hours = checkBusinessHours(tenant);
      const reply = hours.isOpen
        ? "Certainly. Let me transfer you directly to our office dispatcher. Please hold."
        : `Our office is currently closed for the day. ${hours.scheduleText}. I can connect you to our on-call technician for urgent matters, or help you book an appointment right now.`;

      return {
        intent: "human_transfer",
        confidence: 0.95,
        summary: "Caller requested live representative transfer",
        emergencyDetected: false,
        replyText: reply,
        action: hours.isOpen ? "transfer" : "gather",
      };
    }
  }

  // 3. Pricing & Diagnostic Fee Inquiries
  for (const pat of PRICING_PATTERNS) {
    if (pat.test(trimmed)) {
      const pricingList = tenant.knowledgeBase.pricingRules
        .map((p) => `${p.service}: ${p.price}${p.note ? ` (${p.note})` : ""}`)
        .join(". ");

      return {
        intent: "pricing_inquiry",
        confidence: 0.9,
        summary: "Inquiry about service pricing or diagnostic fee",
        emergencyDetected: false,
        replyText: `Our standard pricing is: ${pricingList}. Would you like me to book a technician to inspect your system?`,
        action: "gather",
      };
    }
  }

  // 4. Appointment Booking Request
  for (const pat of BOOKING_PATTERNS) {
    if (pat.test(trimmed)) {
      return {
        intent: "book_appointment",
        confidence: 0.9,
        summary: "Caller wants to schedule an appointment or service visit",
        emergencyDetected: false,
        replyText: `I would be happy to help schedule that for you. We service ${tenant.knowledgeBase.serviceArea.slice(0, 3).join(", ")}, and surrounding areas. What day and time work best for you?`,
        action: "gather",
      };
    }
  }

  return null;
}

/**
 * AI Intent Classifier via Groq Cloud or Gemini Flash.
 * Dispatched when procedural rules require conversational understanding.
 */
export async function classifyWithAi(params: {
  callerSpeech: string;
  tenant: TenantProfile;
  timeoutMs?: number;
}): Promise<IntentResult> {
  const { callerSpeech, tenant, timeoutMs = 1200 } = params;

  // 1. First run instant procedural check
  const proceduralResult = classifyProceduralIntent(callerSpeech, tenant);
  if (proceduralResult) {
    return proceduralResult;
  }

  const groqKey = process.env.GROQ_API_KEY;
  if (!groqKey) {
    // Graceful procedural fallback if no API key
    return {
      intent: "routine_inquiry",
      confidence: 0.7,
      summary: callerSpeech.slice(0, 80),
      emergencyDetected: false,
      replyText: `Thanks for providing that detail. We can certainly assist you with your ${tenant.industry.replace("_", " ")} needs. Would you like to schedule a technician or hear more about our services?`,
      action: "gather",
    };
  }

  // 2. High-speed Groq Inference (qwen3.8-27b or openai/gpt-oss-20b)
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const systemPrompt = `You are ${tenant.voiceConfig.personaName}, the AI receptionist for ${tenant.name}.
Analyze the caller's spoken input and classify their intent into one of:
- routine_inquiry
- book_appointment
- emergency_transfer
- human_transfer
- pricing_inquiry
- unclear

Tenant Knowledge Base:
- Service Area: ${tenant.knowledgeBase.serviceArea.join(", ")}
- Pricing: ${tenant.knowledgeBase.pricingRules.map((p) => `${p.service}: ${p.price}`).join("; ")}
- Emergency Keywords: ${tenant.knowledgeBase.emergencyKeywords.join(", ")}

Respond with STRICT JSON format only:
{
  "intent": "routine_inquiry" | "book_appointment" | "emergency_transfer" | "human_transfer" | "pricing_inquiry" | "unclear",
  "confidence": 0.0 to 1.0,
  "summary": "1 sentence brief summary",
  "emergencyDetected": boolean,
  "replyText": "Natural, polite, 1-2 sentence spoken response to caller",
  "action": "gather" | "transfer" | "record" | "hangup"
}`;

    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${groqKey}`,
      },
      body: JSON.stringify({
        model: "openai/gpt-oss-20b",
        temperature: 0.1,
        max_tokens: 250,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: callerSpeech },
        ],
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      throw new Error(`Groq HTTP ${res.status}`);
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    const content = data.choices?.[0]?.message?.content;
    if (content) {
      const parsed = JSON.parse(content) as IntentResult;
      if (parsed.intent && parsed.replyText) {
        return parsed;
      }
    }
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.warn(`[IntentClassifier] AI classification fallback triggered: ${errorMsg}`);
  }

  // Safe fallback response
  return {
    intent: "routine_inquiry",
    confidence: 0.6,
    summary: callerSpeech.slice(0, 80),
    emergencyDetected: false,
    replyText: `I have noted your request regarding "${callerSpeech.slice(0, 50)}". Would you like me to book a technician to come out, or did you want to speak with a dispatcher?`,
    action: "gather",
  };
}
