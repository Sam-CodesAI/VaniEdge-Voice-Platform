/**
 * VaniEdge AI: Edge & Node HTTP/Fetch Server Request Handler
 * Implements telephony webhooks, SutraDB RAG queries, and ticket dispatch endpoints.
 */

import { SutraHybridEngine, KnowledgeDocument, QueryOptions } from "./engine/sutradb.js";
import { TicketDispatcher, TicketRequest, SupportedLanguage } from "./dispatch/tickets.js";
import { generateStreamTwiML, generateFallbackTwiML } from "./telephony/watchdog.js";

export interface VaniEdgeServerConfig {
  engine?: SutraHybridEngine;
  dispatcher?: TicketDispatcher;
  fallbackNumber?: string;
  twilioPhoneNumber?: string;
  streamWsUrl?: string;
  corsOrigin?: string;
}

export function createVaniEdgeHandler(config: VaniEdgeServerConfig = {}) {
  const engine = config.engine || new SutraHybridEngine();
  const dispatcher = config.dispatcher || new TicketDispatcher();
  const fallbackNumber = config.fallbackNumber || "+18005550199";
  const twilioPhoneNumber = config.twilioPhoneNumber || "+18149613703";
  const corsOrigin = config.corsOrigin || "*";

  const corsHeaders: Record<string, string> = {
    "Access-Control-Allow-Origin": corsOrigin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Twilio-Signature",
  };

  return async function handleRequest(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const pathname = url.pathname;
    const method = request.method;

    if (method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    // Route: Health & Info
    if ((pathname === "/" || pathname === "/health") && method === "GET") {
      return new Response(
        JSON.stringify(
          {
            service: "VaniEdge AI",
            version: "1.1.0",
            status: "healthy",
            timestamp: new Date().toISOString(),
            sutradb: {
              documentsIndexed: engine.size(),
            },
            dispatcher: {
              totalTickets: await dispatcher.count(),
            },
            telephony: {
              fallbackNumber,
              twilioPhoneNumber,
            },
          },
          null,
          2
        ),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        }
      );
    }

    // Route: Twilio Inbound Voice Webhook
    if (pathname === "/voice/incoming" && method === "POST") {
      let callSid = "";
      let caller = "";

      const contentType = request.headers.get("content-type") || "";
      if (
        contentType.includes("application/x-www-form-urlencoded") ||
        contentType.includes("multipart/form-data")
      ) {
        const formData = await request.formData();
        callSid = (formData.get("CallSid") as string) || "";
        caller = (formData.get("From") as string) || "";
      } else if (contentType.includes("application/json")) {
        const json = (await request.json().catch(() => ({}))) as Record<string, string>;
        callSid = json.CallSid || "";
        caller = json.From || "";
      }

      const wsProtocol = url.protocol === "https:" ? "wss:" : "ws:";
      const targetWsUrl =
        config.streamWsUrl || `${wsProtocol}//${url.host}/voice/stream`;

      const twiml = generateStreamTwiML(targetWsUrl, {
        callSid,
        caller,
        greeting: "Namaste, welcome to VaniEdge voice assistant. How can I help you today?",
      });

      return new Response(twiml, {
        status: 200,
        headers: {
          "Content-Type": "text/xml",
          ...corsHeaders,
        },
      });
    }

    // Route: Twilio Emergency Fallback Webhook
    if (pathname === "/voice/fallback" && method === "POST") {
      const twiml = generateFallbackTwiML(fallbackNumber, {
        noticeMessage:
          "Please hold for just a moment. Connecting you directly to our human specialist.",
        callerId: twilioPhoneNumber,
        timeoutSeconds: 25,
      });

      return new Response(twiml, {
        status: 200,
        headers: {
          "Content-Type": "text/xml",
          ...corsHeaders,
        },
      });
    }

    // Route: SutraDB Semantic RAG Search
    if (pathname === "/api/query" && method === "POST") {
      try {
        const body = (await request.json()) as {
          query: string;
          category?: string;
          filter?: Record<string, string | number | boolean>;
          topK?: number;
          minScore?: number;
        };

        if (!body.query || typeof body.query !== "string") {
          return new Response(
            JSON.stringify({ error: "Missing required 'query' field" }),
            { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
          );
        }

        const results = engine.query(body.query, {
          category: body.category,
          filter: body.filter,
          topK: body.topK ?? 3,
          minScore: body.minScore ?? 0,
        });

        return new Response(JSON.stringify({ query: body.query, count: results.length, results }), {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        return new Response(JSON.stringify({ error: message }), {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }
    }

    // Route: Ticket Creation & Autonomous Dispatch
    if (pathname === "/api/dispatch" && method === "POST") {
      try {
        const body = (await request.json()) as TicketRequest;

        if (!body.callerName || !body.callerPhone || !body.category || !body.serviceType) {
          return new Response(
            JSON.stringify({
              error: "Missing required fields (callerName, callerPhone, category, serviceType)",
            }),
            { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
          );
        }

        const ticket = await dispatcher.createTicket(body);
        return new Response(JSON.stringify({ success: true, ticket }), {
          status: 201,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        return new Response(JSON.stringify({ error: message }), {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }
    }

    // Route: List / Filter Tickets
    if (pathname === "/api/tickets" && method === "GET") {
      const phone = url.searchParams.get("phone") || undefined;
      const category = url.searchParams.get("category") || undefined;
      const status = url.searchParams.get("status") || undefined;

      const tickets = dispatcher.findTickets({ phone, category, status });
      return new Response(JSON.stringify({ count: (await tickets).length, tickets }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    return new Response(JSON.stringify({ error: "Not Found" }), {
      status: 404,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  };
}
