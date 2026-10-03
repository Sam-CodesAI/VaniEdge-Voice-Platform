/**
 * VaniEdge-Pro Telephony Platform
 * Carrier-Agnostic TwiML & TeXML Response Generator
 * 
 * Generates lightweight, compliant XML for Twilio Voice and Telnyx TeXML.
 * Built without heavy external SDK dependencies to optimize serverless cold starts.
 */

export interface SayOptions {
  voice?: string;
  language?: string;
}

export interface GatherOptions {
  action: string;
  method?: "POST" | "GET";
  input?: "speech" | "dtmf" | "speech dtmf";
  speechTimeout?: "auto" | number;
  timeout?: number;
  numDigits?: number;
  finishOnKey?: string;
  hints?: string;
  sayText?: string;
  sayOptions?: SayOptions;
}

export interface DialOptions {
  action?: string;
  method?: "POST" | "GET";
  timeout?: number; // seconds to wait before giving up
  callerId?: string;
  whisperUrl?: string; // audio whisper played only to dialed technician
}

export interface RecordOptions {
  action: string;
  method?: "POST" | "GET";
  maxLength?: number;
  playBeep?: boolean;
  timeout?: number;
  finishOnKey?: string;
  transcribe?: boolean;
  transcribeCallback?: string;
}

/**
 * Escapes XML special characters to prevent malformed TwiML.
 */
export function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export class TwiMLBuilder {
  private elements: string[] = [];
  private defaultVoice: string;
  private defaultLanguage: string;

  constructor(defaultVoice = "Polly.Joanna-Neural", defaultLanguage = "en-US") {
    this.defaultVoice = defaultVoice;
    this.defaultLanguage = defaultLanguage;
  }

  /**
   * Add a <Say> node with neural voice configuration.
   */
  say(text: string, options?: SayOptions): this {
    const voice = options?.voice || this.defaultVoice;
    const language = options?.language || this.defaultLanguage;
    this.elements.push(
      `<Say voice="${escapeXml(voice)}" language="${escapeXml(language)}">${escapeXml(text)}</Say>`
    );
    return this;
  }

  /**
   * Add a <Pause> node.
   */
  pause(lengthSeconds = 1): this {
    this.elements.push(`<Pause length="${Math.max(1, Math.round(lengthSeconds))}"/>`);
    return this;
  }

  /**
   * Add a <Play> audio file node.
   */
  play(audioUrl: string): this {
    this.elements.push(`<Play>${escapeXml(audioUrl)}</Play>`);
    return this;
  }

  /**
   * Add a <Gather> node for speech recognition or DTMF keypress input.
   */
  gather(options: GatherOptions): this {
    const action = escapeXml(options.action);
    const method = options.method || "POST";
    const input = options.input || "speech dtmf";
    const speechTimeout = options.speechTimeout !== undefined ? options.speechTimeout : "auto";
    const timeout = options.timeout ?? 4;
    const hints = options.hints ? ` hints="${escapeXml(options.hints)}"` : "";
    const numDigits = options.numDigits ? ` numDigits="${options.numDigits}"` : "";
    const finishOnKey = options.finishOnKey ? ` finishOnKey="${escapeXml(options.finishOnKey)}"` : "";

    let innerContent = "";
    if (options.sayText) {
      const voice = options.sayOptions?.voice || this.defaultVoice;
      const language = options.sayOptions?.language || this.defaultLanguage;
      innerContent = `<Say voice="${escapeXml(voice)}" language="${escapeXml(language)}">${escapeXml(
        options.sayText
      )}</Say>`;
    }

    this.elements.push(
      `<Gather action="${action}" method="${method}" input="${input}" speechTimeout="${speechTimeout}" timeout="${timeout}"${hints}${numDigits}${finishOnKey}>${innerContent}</Gather>`
    );
    return this;
  }

  /**
   * Add a <Dial> node for live warm transfer with optional whisper announcement.
   */
  dial(phoneNumber: string, options?: DialOptions): this {
    const timeout = options?.timeout ?? 20;
    const action = options?.action ? ` action="${escapeXml(options.action)}"` : "";
    const method = options?.method ? ` method="${options.method}"` : ` method="POST"`;
    const callerId = options?.callerId ? ` callerId="${escapeXml(options.callerId)}"` : "";

    let numberTag = escapeXml(phoneNumber);
    if (options?.whisperUrl) {
      numberTag = `<Number url="${escapeXml(options.whisperUrl)}">${escapeXml(phoneNumber)}</Number>`;
    }

    this.elements.push(
      `<Dial timeout="${timeout}"${action}${method}${callerId}>${numberTag}</Dial>`
    );
    return this;
  }

  /**
   * Add a <Record> node for circuit-breaker voicemail fallback.
   */
  record(options: RecordOptions): this {
    const action = escapeXml(options.action);
    const method = options.method || "POST";
    const maxLength = options.maxLength ?? 60;
    const playBeep = options.playBeep !== false ? "true" : "false";
    const timeout = options.timeout ?? 5;
    const finishOnKey = options.finishOnKey ? ` finishOnKey="${escapeXml(options.finishOnKey)}"` : ' finishOnKey="#"';
    const transcribe = options.transcribe !== false ? ' transcribe="true"' : "";
    const transcribeCallback = options.transcribeCallback
      ? ` transcribeCallback="${escapeXml(options.transcribeCallback)}"`
      : "";

    this.elements.push(
      `<Record action="${action}" method="${method}" maxLength="${maxLength}" playBeep="${playBeep}" timeout="${timeout}"${finishOnKey}${transcribe}${transcribeCallback}/>`
    );
    return this;
  }

  /**
   * Add a <Redirect> node.
   */
  redirect(url: string, method: "POST" | "GET" = "POST"): this {
    this.elements.push(`<Redirect method="${method}">${escapeXml(url)}</Redirect>`);
    return this;
  }

  /**
   * Add a <Hangup> node.
   */
  hangup(): this {
    this.elements.push("<Hangup/>");
    return this;
  }

  /**
   * Render the complete XML document.
   */
  toString(): string {
    return `<?xml version="1.0" encoding="UTF-8"?><Response>${this.elements.join("")}</Response>`;
  }

  /**
   * Helper to return standard Next.js Response with XML headers.
   */
  toResponse(status = 200): Response {
    return new Response(this.toString(), {
      status,
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        "Cache-Control": "no-store, no-cache, must-revalidate",
        "X-Telephony-Engine": "VaniEdge-Pro",
      },
    });
  }
}

// ==============================================================================
// FACTORY HELPERS FOR STANDARD TELEPHONY FLOWS
// ==============================================================================

/**
 * Creates the initial incoming call greeting TwiML with TCPA disclosure.
 */
export function createInboundGreetingTwiML(params: {
  businessName: string;
  greetingText: string;
  tcpaNotice: string;
  processActionUrl: string;
  voice?: string;
}): Response {
  const builder = new TwiMLBuilder(params.voice);

  // 1. TCPA legal recording disclosure
  builder.say(params.tcpaNotice);
  builder.pause(0.5);

  // 2. Initial greeting with speech gather
  builder.gather({
    action: params.processActionUrl,
    input: "speech dtmf",
    speechTimeout: "auto",
    timeout: 5,
    sayText: params.greetingText,
    hints: "appointment, quote, repair, emergency, technician, leak, hours, pricing, schedule",
  });

  // 3. Fallback if silence
  builder.say("I didn't hear anything. If you need assistance, please speak now or leave a message.");
  builder.gather({
    action: params.processActionUrl,
    input: "speech dtmf",
    timeout: 4,
  });
  builder.say("Thank you for calling. Goodbye.");
  builder.hangup();

  return builder.toResponse();
}

/**
 * Creates an emergency warm transfer TwiML with private whisper audio.
 */
export function createEmergencyTransferTwiML(params: {
  emergencyExplanation: string;
  transferNumber: string;
  whisperUrl: string;
  fallbackActionUrl: string;
  voice?: string;
}): Response {
  const builder = new TwiMLBuilder(params.voice);

  builder.say(params.emergencyExplanation);
  builder.say("Connecting you with our on-call technician immediately. Please hold.");
  builder.dial(params.transferNumber, {
    timeout: 20,
    whisperUrl: params.whisperUrl,
    action: params.fallbackActionUrl,
  });

  return builder.toResponse();
}

/**
 * Creates a Tier 2 circuit-breaker recording TwiML.
 */
export function createVoicemailRecordingTwiML(params: {
  promptText: string;
  recordingActionUrl: string;
  voice?: string;
}): Response {
  const builder = new TwiMLBuilder(params.voice);

  builder.say(params.promptText);
  builder.record({
    action: params.recordingActionUrl,
    maxLength: 120,
    playBeep: true,
    transcribe: true,
  });
  builder.say("Thank you. Your message has been dispatched to our team. Goodbye.");
  builder.hangup();

  return builder.toResponse();
}
