import { NextRequest, NextResponse } from "next/server";
import { SutraEdgeIndex, DEFAULT_KNOWLEDGE_PRESETS, DocumentEntry } from "@/lib/sutradb-engine";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export type PersonaCategory =
  | "clinic"
  | "restaurant"
  | "auto"
  | "retail"
  | "realestate"
  | "finance"
  | "hospitality"
  | "general";

export type RequestState = "inquiry" | "pending" | "confirmed" | "failed" | "requires_human";

interface ChatRequestBody {
  message: string;
  persona?: PersonaCategory;
  language?: string; // en, hi, kn, ta, te, mr, es
  customDocuments?: DocumentEntry[];
  businessName?: string;
  isDemo?: boolean;
}

export async function POST(req: NextRequest) {
  const routeStartTime = performance.now();

  try {
    // 1. Rate Limiting: 30 chat queries per 60 seconds per IP
    const clientIp = getClientIp(req);
    const rateCheck = checkRateLimit(clientIp, "chat", 30, 60 * 1000);
    if (!rateCheck.success) {
      return NextResponse.json(
        { error: "Too many chat requests. Please slow down." },
        {
          status: 429,
          headers: {
            "Retry-After": Math.ceil(rateCheck.resetMs / 1000).toString(),
            "X-RateLimit-Limit": rateCheck.limit.toString(),
            "X-RateLimit-Remaining": rateCheck.remaining.toString(),
          },
        }
      );
    }

    const body = (await req.json()) as ChatRequestBody;
    const {
      message,
      persona = "clinic",
      language = "en",
      customDocuments = [],
      businessName = "Dr. Sharma's Clinic",
      isDemo = false,
    } = body;

    // 2. Strict Input Validation & Bounds
    if (!message || typeof message !== "string" || message.trim().length === 0) {
      return NextResponse.json(
        { error: "Valid message string is required." },
        { status: 400 }
      );
    }

    if (message.length > 2000) {
      return NextResponse.json(
        { error: "Message exceeds maximum allowed length of 2000 characters." },
        { status: 400 }
      );
    }

    // Bound custom documents count and length to prevent DoS
    const boundedDocs = customDocuments.slice(0, 20).map((d) => ({
      ...d,
      content: typeof d.content === "string" ? d.content.slice(0, 5000) : "",
    }));

    // Initialize SutraDB Edge Index with presets and custom user documents
    const allDocs = [...boundedDocs, ...DEFAULT_KNOWLEDGE_PRESETS];
    const index = new SutraEdgeIndex(allDocs);

    const searchStartTime = performance.now();
    const searchResults = index.search(message, 3);
    const retrievalLatencyMs = parseFloat((performance.now() - searchStartTime).toFixed(2));

    const topMatch = searchResults[0];
    const bestDocContent = topMatch && topMatch.fusedScore > 0.15 ? topMatch.document.content : null;

    // Advanced Dynamic Entity & Intent Extraction
    const lower = message.toLowerCase();
    let detectedIntent:
      | "BOOK_APPOINTMENT"
      | "ORDER_FOOD"
      | "EMERGENCY_DISPATCH"
      | "RETAIL_SUPPORT"
      | "PROPERTY_INQUIRY"
      | "BANKING_SERVICE"
      | "HOTEL_RESERVATION"
      | "PRICE_INQUIRY"
      | "GENERAL_INQUIRY" = "GENERAL_INQUIRY";
    const extractedEntities: Record<string, string> = {};

    // 1. Name Extraction
    const nameMatch =
      message.match(
        /(?:my name is|i am|this is|caller is)\s+([A-Za-z]+(?:\s+(?!and\b|phone\b|with\b|for\b|at\b)[A-Za-z]+)?)/i
      ) || message.match(/(?:नाम\s*(?:है)?|ಹೆಸರು)\s*[:=]?\s*([^\s,]+)/i);
    if (nameMatch) {
      extractedEntities["callerName"] = nameMatch[1].trim();
    }

    // 2. Time & Date Extraction
    const timeMatch = message.match(
      /(?:\b(?:at|on|for|around)\s+)?(\d{1,2}(?::\d{2})?\s*(?:am|pm)?|\b(?:today|tomorrow|morning|evening|afternoon|monday|tuesday|wednesday|thursday|friday|saturday)\b(?:\s+(?:at\s+)?\d{1,2}(?::\d{2})?\s*(?:am|pm)?)?)/i
    );
    if (timeMatch && timeMatch[1]) {
      extractedEntities["scheduledTime"] = timeMatch[1].trim();
    }

    // 3. Phone Number Extraction
    const phoneMatch = message.match(/(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);
    if (phoneMatch) {
      extractedEntities["phone"] = phoneMatch[0];
    }

    // 4. Intent Classification
    if (
      lower.includes("appointment") ||
      lower.includes("doctor") ||
      lower.includes("timing") ||
      lower.includes("slot") ||
      lower.includes("अपॉइंटमेंट") ||
      lower.includes("ಬುಕ್")
    ) {
      detectedIntent = "BOOK_APPOINTMENT";
    } else if (
      lower.includes("thali") ||
      lower.includes("biryani") ||
      lower.includes("food") ||
      lower.includes("delivery") ||
      lower.includes("menu") ||
      lower.includes("खाना") ||
      lower.includes("ಊಟ")
    ) {
      detectedIntent = "ORDER_FOOD";
      const foodItems: string[] = [];
      if (lower.includes("thali")) foodItems.push("Special Thali");
      if (lower.includes("biryani")) foodItems.push("Veg Biryani");
      if (lower.includes("dosa")) foodItems.push("Masala Dosa");
      if (lower.includes("roti")) foodItems.push("Butter Roti");
      if (foodItems.length > 0) extractedEntities["items"] = foodItems.join(", ");
    } else if (
      lower.includes("emergency") ||
      lower.includes("tow") ||
      lower.includes("puncture") ||
      lower.includes("breakdown") ||
      lower.includes("accident") ||
      lower.includes("मदद") ||
      lower.includes("ತುರ್ತು")
    ) {
      detectedIntent = "EMERGENCY_DISPATCH";
      extractedEntities["severity"] = "HIGH_PRIORITY";
    } else if (
      lower.includes("track") ||
      lower.includes("return") ||
      lower.includes("shipping") ||
      lower.includes("refund") ||
      lower.includes("package") ||
      lower.includes("warranty") ||
      lower.includes("स्टॉक") ||
      lower.includes("ರಿಟರ್ನ್")
    ) {
      detectedIntent = "RETAIL_SUPPORT";
    } else if (
      lower.includes("apartment") ||
      lower.includes("property") ||
      lower.includes("flat") ||
      lower.includes("bhk") ||
      lower.includes("rent") ||
      lower.includes("lease") ||
      lower.includes("viewing") ||
      lower.includes("मकान") ||
      lower.includes("ಆಸ್ತಿ")
    ) {
      detectedIntent = "PROPERTY_INQUIRY";
    } else if (
      lower.includes("balance") ||
      lower.includes("card") ||
      lower.includes("freeze") ||
      lower.includes("bank") ||
      lower.includes("loan") ||
      lower.includes("mortgage") ||
      lower.includes("खाता") ||
      lower.includes("ಬ್ಯಾಂಕ್")
    ) {
      detectedIntent = "BANKING_SERVICE";
    } else if (
      lower.includes("hotel") ||
      lower.includes("suite") ||
      lower.includes("check-in") ||
      lower.includes("checkout") ||
      lower.includes("shuttle") ||
      lower.includes("होटल") ||
      lower.includes("ಹೋಟೆಲ್")
    ) {
      detectedIntent = "HOTEL_RESERVATION";
    } else if (
      lower.includes("cost") ||
      lower.includes("fee") ||
      lower.includes("price") ||
      lower.includes("charge") ||
      lower.includes("rate") ||
      lower.includes("कीमत") ||
      lower.includes("ಬೆಲೆ")
    ) {
      detectedIntent = "PRICE_INQUIRY";
    } else if (lower.includes("book") || lower.includes("order")) {
      if (persona === "clinic") detectedIntent = "BOOK_APPOINTMENT";
      else if (persona === "restaurant") detectedIntent = "ORDER_FOOD";
      else if (persona === "hospitality") detectedIntent = "HOTEL_RESERVATION";
      else if (persona === "realestate") detectedIntent = "PROPERTY_INQUIRY";
      else if (persona === "retail") detectedIntent = "RETAIL_SUPPORT";
      else detectedIntent = "BOOK_APPOINTMENT";
    }

    // Determine Honest Transaction State
    let requestState: RequestState = "inquiry";
    if (detectedIntent === "EMERGENCY_DISPATCH") {
      requestState = "requires_human";
    } else if (
      detectedIntent === "BOOK_APPOINTMENT" ||
      detectedIntent === "ORDER_FOOD" ||
      detectedIntent === "HOTEL_RESERVATION"
    ) {
      requestState = "pending";
    }

    // Dynamic Multi-Lingual Generation based on Verified State
    let voiceResponse = "";
    const name = extractedEntities["callerName"] || "Customer";
    const time = extractedEntities["scheduledTime"] || "the earliest available slot";
    const items = extractedEntities["items"] || "your requested item";

    if (language.startsWith("hi")) {
      // Hindi (हिंदी)
      if (detectedIntent === "BOOK_APPOINTMENT") {
        voiceResponse = `नमस्ते ${name}! ${businessName} में आपका अपॉइंटमेंट अनुरोध ${time} के लिए दर्ज कर लिया गया है। उपलब्धता की पुष्टि के लिए हमारा क्लिनिक प्रतिनिधि आपसे जल्द संपर्क करेगा। ${
          bestDocContent ? `संदर्भ: ${bestDocContent.slice(0, 100)}` : ""
        }`;
      } else if (detectedIntent === "ORDER_FOOD") {
        voiceResponse = `नमस्ते ${name}! आपका ${items} का आर्डर अनुरोध प्राप्त हुआ है। हमारी टीम इसे सत्यापित कर रही है।`;
      } else if (detectedIntent === "EMERGENCY_DISPATCH") {
        voiceResponse = `आपातकालीन सहायता अनुरोध दर्ज हुआ है। हम आपका कॉल तुरंत वरिष्ठ आपातकालीन समन्वयक को स्थानांतरित कर रहे हैं। कृपया लाइन पर बने रहें।`;
      } else if (detectedIntent === "RETAIL_SUPPORT") {
        voiceResponse = `नमस्ते ${name}! आपका सहायता अनुरोध दर्ज कर लिया गया है। ${
          bestDocContent ? `विवरण: ${bestDocContent.slice(0, 120)}` : ""
        }`;
      } else if (detectedIntent === "PROPERTY_INQUIRY") {
        voiceResponse = `नमस्ते ${name}! प्रॉपर्टी विजिट और फ्लैट की जानकारी के लिए आपका अनुरोध दर्ज हो गया है। ${
          bestDocContent ? `विवरण: ${bestDocContent.slice(0, 120)}` : ""
        }`;
      } else if (detectedIntent === "BANKING_SERVICE") {
        voiceResponse = `नमस्ते ${name}! आपकी बैंकिंग सेवा का अनुरोध दर्ज किया गया है।`;
      } else if (detectedIntent === "HOTEL_RESERVATION") {
        voiceResponse = `नमस्ते ${name}! ${businessName} में कमरा आरक्षण का अनुरोध ${time} के लिए प्राप्त हुआ है।`;
      } else if (bestDocContent) {
        voiceResponse = `नमस्ते! हमारे रिकॉर्ड के अनुसार: ${bestDocContent.slice(
          0,
          220
        )}। क्या मैं आपकी कुछ और मदद कर सकता हूँ?`;
      } else {
        voiceResponse = `नमस्ते! ${businessName} के वॉयस असिस्टेंट में आपका स्वागत है। मैं आपकी क्या मदद कर सकता हूँ?`;
      }
    } else if (language.startsWith("kn")) {
      // Kannada (ಕನ್ನಡ)
      if (detectedIntent === "BOOK_APPOINTMENT") {
        voiceResponse = `ನಮಸ್ಕಾರ ${name}! ${businessName} ನಲ್ಲಿ ಅಪಾಯಿಂಟ್‌ಮೆಂಟ್ ವಿನಂತಿ ಸ್ವೀಕರಿಸಲಾಗಿದೆ (${time}). ನಮ್ಮ ಪ್ರತಿನಿಧಿ ಶೀಘ್ರದಲ್ಲೇ ದೃಢೀಕರಿಸುತ್ತಾರೆ.`;
      } else if (detectedIntent === "ORDER_FOOD") {
        voiceResponse = `ನಮಸ್ಕಾರ ${name}! ನಿಮ್ಮ ${items} ಆರ್ಡರ್ ವಿನಂತಿ ಸ್ವೀಕರಿಸಲಾಗಿದೆ.`;
      } else if (detectedIntent === "EMERGENCY_DISPATCH") {
        voiceResponse = `ತುರ್ತು ನೆರವು ವಿನಂತಿ ದಾಖಲಾಗಿದೆ. ತಕ್ಷಣ ತುರ್ತು ಪ್ರತಿನಿಧಿಯೊಂದಿಗೆ ಸಂಪರ್ಕ ಕಲ್ಪಿಸಲಾಗುತ್ತಿದೆ.`;
      } else if (bestDocContent) {
        voiceResponse = `ನಮಸ್ಕಾರ! ನಮ್ಮ ದಾಖಲೆಗಳ ಪ್ರಕಾರ: ${bestDocContent.slice(0, 200)}.`;
      } else {
        voiceResponse = `ನಮಸ್ಕಾರ! ${businessName} ಗೆ ಸುಸ್ವಾಗತ. ನಾನು ನಿಮಗೆ ಹೇಗೆ ಸಹಾಯ ಮಾಡಲಿ?`;
      }
    } else if (language.startsWith("mr")) {
      // Marathi (मराठी)
      if (detectedIntent === "BOOK_APPOINTMENT") {
        voiceResponse = `नमस्कार ${name}! ${businessName} मध्ये आपली अपॉइंटमेंट विनंती ${time} साठी नोंदवण्यात आली आहे. आमचे प्रतिनिधी लवकरच पुष्टी करतील.`;
      } else if (detectedIntent === "ORDER_FOOD") {
        voiceResponse = `नमस्कार ${name}! आपली ऑर्डर विनंती नोंदवली गेली आहे.`;
      } else if (detectedIntent === "EMERGENCY_DISPATCH") {
        voiceResponse = `तातडीची मदत विनंती नोंदवली गेली आहे. कृपया फोनवर थांबा, आपत्कालीन टीमशी जोडत आहोत.`;
      } else if (bestDocContent) {
        voiceResponse = `नमस्कार! माहितीनुसार: ${bestDocContent.slice(0, 200)}.`;
      } else {
        voiceResponse = `नमस्कार! ${businessName} मध्ये आपले स्वागत आहे. मी आपल्याला कशी मदत करू?`;
      }
    } else if (language.startsWith("es")) {
      // Spanish (Español)
      if (detectedIntent === "BOOK_APPOINTMENT") {
        voiceResponse = `¡Hola ${name}! Su solicitud de cita en ${businessName} ha sido registrada para ${time}. Un coordinador confirmará la disponibilidad en breve.`;
      } else if (detectedIntent === "ORDER_FOOD") {
        voiceResponse = `¡Hola ${name}! Su pedido de comida ha sido enviado al restaurante para su verificación.`;
      } else if (detectedIntent === "EMERGENCY_DISPATCH") {
        voiceResponse = `Alerta de emergencia recibida. Conectándole de inmediato con un coordinador humano de emergencias.`;
      } else if (bestDocContent) {
        voiceResponse = `Hola, según nuestros registros: ${bestDocContent.slice(0, 200)}.`;
      } else {
        voiceResponse = `¡Hola! Bienvenido a ${businessName}. ¿En qué puedo ayudarle hoy?`;
      }
    } else {
      // English (Default)
      if (detectedIntent === "BOOK_APPOINTMENT") {
        voiceResponse = `Hello ${name}. I have registered your appointment request for ${businessName} for ${time}. A clinic coordinator will confirm your exact slot shortly. ${
          bestDocContent ? `Note: ${bestDocContent.slice(0, 110)}.` : ""
        }`;
      } else if (detectedIntent === "ORDER_FOOD") {
        voiceResponse = `Order request received for ${name}: ${items}. The request has been submitted to the kitchen for preparation confirmation.`;
      } else if (detectedIntent === "EMERGENCY_DISPATCH") {
        voiceResponse = `Emergency assistance requested. Transferring your request to our senior emergency dispatcher immediately. Please remain on the line.`;
      } else if (detectedIntent === "RETAIL_SUPPORT") {
        voiceResponse = `Hello ${name}! I have logged your retail support inquiry. ${
          bestDocContent ? `Policy details: ${bestDocContent.slice(0, 140)}.` : ""
        } An agent will follow up with your ticket reference.`;
      } else if (detectedIntent === "PROPERTY_INQUIRY") {
        voiceResponse = `Hello ${name}! Thank you for your inquiry regarding ${businessName}. ${
          bestDocContent ? `Listing summary: ${bestDocContent.slice(0, 140)}.` : ""
        } A viewing tour request has been noted.`;
      } else if (detectedIntent === "BANKING_SERVICE") {
        voiceResponse = `Hello ${name}! Your banking inquiry has been logged. ${
          bestDocContent ? `Policy details: ${bestDocContent.slice(0, 140)}.` : ""
        }`;
      } else if (detectedIntent === "HOTEL_RESERVATION") {
        voiceResponse = `Hello ${name}! Your reservation request at ${businessName} is received for ${time}. ${
          bestDocContent ? `Amenities: ${bestDocContent.slice(0, 140)}.` : ""
        } A reservations associate will confirm room availability.`;
      } else if (detectedIntent === "PRICE_INQUIRY" && bestDocContent) {
        voiceResponse = `According to verified records: ${bestDocContent.slice(0, 230)}.`;
      } else if (bestDocContent) {
        voiceResponse = `Based on our verified records: ${bestDocContent.slice(
          0,
          240
        )}. Would you like me to submit an inquiry or booking request for you?`;
      } else {
        voiceResponse = `Hello! Welcome to ${businessName} Voice Telephony. How may I assist you today?`;
      }
    }

    if (isDemo) {
      voiceResponse = `[Demo Simulation] ${voiceResponse}`;
    }

    const totalRoundtripMs = parseFloat((performance.now() - routeStartTime).toFixed(1));

    return NextResponse.json({
      success: true,
      voiceResponse,
      intent: detectedIntent,
      requestState,
      isSimulated: isDemo,
      entities: extractedEntities,
      retrieval: {
        latencyMs: retrievalLatencyMs,
        matchedDocument:
          topMatch && topMatch.fusedScore > 0.1
            ? {
                id: topMatch.document.id,
                title: topMatch.document.title,
                fusedScore: parseFloat(topMatch.fusedScore.toFixed(3)),
                matchedTerms: topMatch.matchedTerms,
              }
            : null,
      },
      telemetry: {
        sutraDbLatencyMs: retrievalLatencyMs,
        totalRoundtripMs,
        requestState,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("VaniEdge Chat Route Error:", msg);
    return NextResponse.json(
      { error: "Internal chat engine error", details: msg },
      { status: 500 }
    );
  }
}
