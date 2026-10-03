/**
 * VaniEdge-Pro Telephony Platform
 * Hybrid Intent Classifier & Emergency Gate
 * 
 * Sub-millisecond negation-aware regex triage for life/property safety emergencies,
 * paired with fast Groq / Gemini AI routing for conversational inquiries.
 */

import { TenantProfile, IntentResult, IntentType } from "./types";
import { checkBusinessHours } from "./tenant-store";

// Words/phrases indicating negation or past resolved state when preceding or following emergency keywords
const PRECEDING_NEGATION_REGEX =
  /\b(no|not|don't|dont|never|neither|without|didn't|didnt|did you fix|already fixed|no sign of|no smell of|zero)\b[\w\s]{0,25}$/i;

const FOLLOWING_RESOLVED_REGEX =
  /^[\w\s]{0,20}\b(fixed|resolved|repaired|cleared|was the|is the|not happening|stopped)\b/i;

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
 * Fast sub-millisecond regex check for emergency keywords with per-keyword negation awareness.
 */
export function checkEmergencyTriage(text: string, tenant: TenantProfile): {
  isEmergency: boolean;
  matchedKeyword?: string;
} {
  const lower = text.toLowerCase();

  for (const kw of tenant.knowledgeBase.emergencyKeywords) {
    const kwRegex = new RegExp(`\\b${kw}\\b`, "gi");
    let match: RegExpExecArray | null;

    while ((match = kwRegex.exec(lower)) !== null) {
      const matchIndex = match.index;
      const preceding = lower.slice(Math.max(0, matchIndex - 45), matchIndex);
      const following = lower.slice(matchIndex + kw.length, matchIndex + kw.length + 30);

      const isNegated = PRECEDING_NEGATION_REGEX.test(preceding) || FOLLOWING_RESOLVED_REGEX.test(following);

      if (!isNegated) {
        return { isEmergency: true, matchedKeyword: kw };
      }
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
 * Safely parse JSON from LLM output, extracting from markdown code fences or raw objects.
 */
function extractJsonFromText(rawText: string): IntentResult | null {
  try {
    const cleanText = rawText
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();
    const parsed = JSON.parse(cleanText) as IntentResult;
    if (parsed && typeof parsed === "object" && parsed.intent && parsed.replyText) {
      return parsed;
    }
  } catch {
    // If strict parse fails, attempt regex extraction for embedded JSON block
    const jsonMatch = rawText.match(/\{[\s\S]*"intent"[\s\S]*"replyText"[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]) as IntentResult;
        if (parsed && typeof parsed === "object" && parsed.intent && parsed.replyText) {
          return parsed;
        }
      } catch {
        // Fall through
      }
    }
  }
  return null;
}

/**
 * Query Groq chat completions API with JSON object response format.
 */
async function queryGroqChat(params: {
  apiKey: string;
  model: string;
  systemPrompt: string;
  userSpeech: string;
  signal: AbortSignal;
}): Promise<IntentResult | null> {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${params.apiKey}`,
    },
    body: JSON.stringify({
      model: params.model,
      temperature: 0.1,
      max_tokens: 250,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: params.systemPrompt },
        { role: "user", content: params.userSpeech },
      ],
    }),
    signal: params.signal,
  });

  if (!res.ok) {
    throw new Error(`Groq ${params.model} HTTP ${res.status}`);
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  const content = data.choices?.[0]?.message?.content;
  if (content) {
    return extractJsonFromText(content);
  }
  return null;
}

/**
 * Query Google Gemini Flash generateContent REST API.
 */
async function queryGeminiGenerate(params: {
  apiKey: string;
  model: string;
  systemPrompt: string;
  userSpeech: string;
  signal: AbortSignal;
}): Promise<IntentResult | null> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${params.model}:generateContent?key=${params.apiKey}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      system_instruction: {
        parts: [{ text: params.systemPrompt }],
      },
      contents: [
        {
          role: "user",
          parts: [{ text: params.userSpeech }],
        },
      ],
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.1,
        maxOutputTokens: 300,
      },
    }),
    signal: params.signal,
  });

  if (!res.ok) {
    throw new Error(`Gemini ${params.model} HTTP ${res.status}`);
  }

  const data = (await res.json()) as {
    candidates?: Array<{
      content?: {
        parts?: Array<{ text?: string }>;
      };
    }>;
  };

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (text) {
    return extractJsonFromText(text);
  }
  return null;
}

/**
 * AI Intent Classifier via Groq Cloud with seamless multi-LLM failover:
 * Tier 1: Groq llama-3.3-70b-versatile (Ultra-fast, nuanced reasoning)
 * Tier 2: Groq llama-3.1-8b-instant (Sub-150ms high-speed backup)
 * Tier 3: Google Gemini 2.0 Flash / 1.5 Flash (Multi-cloud provider resilience)
 * Tier 4: Procedural Triage Fallback (Guaranteed zero-failure deterministic response)
 */
export async function classifyWithAi(params: {
  callerSpeech: string;
  tenant: TenantProfile;
  timeoutMs?: number;
}): Promise<IntentResult> {
  const { callerSpeech, tenant, timeoutMs = 1200 } = params;

  // 1. First run instant procedural check (<1ms)
  const proceduralResult = classifyProceduralIntent(callerSpeech, tenant);
  if (proceduralResult) {
    return proceduralResult;
  }

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

  // 2. High-speed Groq Inference (llama-3.3-70b-versatile -> llama-3.1-8b-instant)
  const groqKey = process.env.GROQ_API_KEY;
  if (groqKey) {
    const groqModels = ["llama-3.3-70b-versatile", "llama-3.1-8b-instant"];
    for (const model of groqModels) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const result = await queryGroqChat({
          apiKey: groqKey,
          model,
          systemPrompt,
          userSpeech: callerSpeech,
          signal: controller.signal,
        });

        if (result) return result;
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        console.warn(`[IntentClassifier] Groq ${model} failed, falling back: ${errorMsg}`);
      } finally {
        clearTimeout(timeoutId);
      }
    }
  }

  // 3. Multi-Provider Failover: Google Generative AI (gemini-2.0-flash -> gemini-1.5-flash)
  const geminiKey = process.env.GEMINI_API_KEY;
  if (geminiKey) {
    const geminiModels = ["gemini-2.0-flash", "gemini-1.5-flash"];
    for (const model of geminiModels) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const result = await queryGeminiGenerate({
          apiKey: geminiKey,
          model,
          systemPrompt,
          userSpeech: callerSpeech,
          signal: controller.signal,
        });

        if (result) return result;
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        console.warn(`[IntentClassifier] Gemini ${model} failed, falling back: ${errorMsg}`);
      } finally {
        clearTimeout(timeoutId);
      }
    }
  }

  // 4. Safe Procedural Fallback Triage (Guaranteeing Zero Failure)
  return {
    intent: "routine_inquiry",
    confidence: 0.6,
    summary: callerSpeech.slice(0, 80),
    emergencyDetected: false,
    replyText: `I have noted your request regarding "${callerSpeech.slice(0, 50)}". Would you like me to book a technician to come out, or did you want to speak with a dispatcher?`,
    action: "gather",
  };
}
