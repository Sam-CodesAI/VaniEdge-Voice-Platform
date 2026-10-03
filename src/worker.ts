/**
 * Cloudflare Worker Voice Agent with Sub-Second Failover Watchdog
 *
 * Connects Twilio Inbound Media Streams to ElevenLabs Conversational AI
 * with zero dropped calls and sub-second human failover handoff.
 */

import type { Env } from './types/env';
import type { TwilioVoiceWebhookPayload } from './types/twilio';
import { validateTwilioSignature } from './twilio/signature';
import { generateStreamTwiML, generateFallbackTwiML } from './twilio/twiml';
import { StreamBridge } from './stream/bridge';
import { MetricsCollector } from './telemetry/metrics';
import { renderDashboardHtml } from './dashboard/html';
import { SutraHybridEngine } from './engine/sutradb.js';
import { TicketDispatcher, TicketRequest } from './dispatch/tickets.js';

const sutraEngine = new SutraHybridEngine([
  {
    id: "clinic-1",
    title: "Dr. Sharma Pediatric & Family Clinic",
    content: "Timings: Mon-Sat 9:00 AM - 7:00 PM. Consultation: ₹500. Address: Indiranagar, Bengaluru. Phone: +91-98765-43210.",
    category: "clinic",
  },
  {
    id: "restaurant-1",
    title: "Bhojanalaya Kitchen Indiranagar",
    content: "Special North & South Indian Thali, Paneer Butter Masala, Butter Naan. Delivery: 25-35 mins. Min order ₹250.",
    category: "restaurant",
  },
  {
    id: "auto-1",
    title: "Apex Highway Emergency Towing & Recovery",
    content: "24/7 Roadside breakdown assistance, flat tyre fix, engine jumpstart. Emergency ETA: 15-20 mins. Helpline: 1800-APEX-NOW.",
    category: "auto",
  },
]);

const ticketDispatcher = new TicketDispatcher();


/**
 * Parses request parameters from form-data or JSON
 */
async function parseParams(request: Request): Promise<Record<string, string>> {
  const contentType = request.headers.get('Content-Type') || '';
  const params: Record<string, string> = {};

  if (contentType.includes('application/x-www-form-urlencoded') || contentType.includes('multipart/form-data')) {
    const formData = await request.formData();
    for (const [key, value] of formData.entries()) {
      if (typeof value === 'string') {
        params[key] = value;
      }
    }
  } else if (contentType.includes('application/json')) {
    try {
      const json = (await request.json()) as Record<string, unknown>;
      for (const [key, value] of Object.entries(json)) {
        if (value !== undefined && value !== null) {
          params[key] = String(value);
        }
      }
    } catch {
      // JSON parse error
    }
  }

  return params;
}

export default {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const pathname = url.pathname;
    const method = request.method;

    // Route: Root & Mission Control Dashboard
    if ((pathname === '/' || pathname === '/dashboard') && method === 'GET') {
      const acceptsHtml = request.headers.get('Accept')?.includes('text/html');
      const forceJson = url.searchParams.get('format') === 'json';

      if (pathname === '/dashboard' || (acceptsHtml && !forceJson)) {
        const html = renderDashboardHtml(env, url.host);
        return new Response(html, {
          headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'no-cache',
          },
        });
      }

      return new Response(
        JSON.stringify(
          {
            service: 'Twilio Voice Agent Failover Engine',
            version: '1.1.0',
            runtime: 'Cloudflare Workers (Edge)',
            endpoints: {
              dashboard: 'GET /dashboard',
              incoming_webhook: 'POST /voice/incoming',
              media_stream: 'GET /voice/stream (WebSocket Upgrade)',
              status_callback: 'POST /voice/status',
              failover_fallback: 'POST /voice/fallback',
              health: 'GET /health',
              metrics: 'GET /metrics',
            },
            failover_sla: {
              connect_deadline_ms: env.FAILOVER_CONNECT_TIMEOUT_MS || '1200',
              ttft_deadline_ms: env.FAILOVER_TTFT_TIMEOUT_MS || '1500',
              zero_dropped_calls: true,
            },
          },
          null,
          2
        ),
        {
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Route: Health Check
    if (pathname === '/health' && method === 'GET') {
      const hasTwilio = Boolean(env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN);
      const hasElevenLabs = Boolean(env.ELEVENLABS_API_KEY || env.ELEVENLABS_AGENT_ID);

      return new Response(
        JSON.stringify(
          {
            status: hasTwilio ? 'healthy' : 'degraded',
            timestamp: new Date().toISOString(),
            providers: {
              twilio: {
                configured: hasTwilio,
                account_sid: env.TWILIO_ACCOUNT_SID
                  ? `${env.TWILIO_ACCOUNT_SID.substring(0, 6)}...`
                  : null,
                phone_number: env.TWILIO_PHONE_NUMBER || null,
              },
              elevenlabs: {
                configured: hasElevenLabs,
                agent_id: env.ELEVENLABS_AGENT_ID || null,
              },
            },
            watchdog: {
              connect_timeout_ms: parseInt(env.FAILOVER_CONNECT_TIMEOUT_MS || '1200', 10),
              ttft_timeout_ms: parseInt(env.FAILOVER_TTFT_TIMEOUT_MS || '1500', 10),
              fallback_target: env.FALLBACK_HUMAN_NUMBER || '+18005550199',
            },
            sutradb: {
              status: 'ready',
              documents_indexed: sutraEngine.size(),
            },
            dispatcher: {
              total_tickets: await ticketDispatcher.count(),
            },
          },
          null,
          2
        ),
        {
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Route: Latency & Telemetry Metrics (Supports JSON & Prometheus formats)
    if (pathname === '/metrics' && method === 'GET') {
      const format = url.searchParams.get('format');
      const acceptsPrometheus = request.headers.get('Accept')?.includes('text/plain');

      if (format === 'prometheus' || acceptsPrometheus) {
        const prometheusText = MetricsCollector.getInstance().toPrometheus();
        return new Response(prometheusText, {
          headers: { 'Content-Type': 'text/plain; version=0.0.4; charset=utf-8' },
        });
      }

      const snapshot = MetricsCollector.getInstance().getSnapshot();
      return new Response(JSON.stringify(snapshot, null, 2), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Route: Twilio Inbound Voice Webhook
    if (pathname === '/voice/incoming' && method === 'POST') {
      const webhookStart = performance.now();
      MetricsCollector.getInstance().callsTotal++;

      // Parse Form Data from Twilio
      const params = await parseParams(request);
      const payload = params as unknown as TwilioVoiceWebhookPayload;

      // Validate Twilio HMAC-SHA1 Signature strictly in production
      const signatureHeader = request.headers.get('X-Twilio-Signature');
      if (env.TWILIO_AUTH_TOKEN) {
        if (!signatureHeader) {
          return new Response('Unauthorized: Missing Twilio Signature', { status: 401 });
        }
        const isValid = await validateTwilioSignature(
          signatureHeader,
          request.url,
          params,
          env.TWILIO_AUTH_TOKEN
        );

        if (!isValid) {
          return new Response('Unauthorized: Invalid Twilio Signature', { status: 401 });
        }
      }

      // Generate WebSocket URL for media stream
      const wsProtocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
      const streamWsUrl = `${wsProtocol}//${url.host}/voice/stream`;

      const twiml = generateStreamTwiML(streamWsUrl, {
        callSid: payload.CallSid,
        caller: payload.From,
        greeting: 'Thank you for calling. Connecting you to our voice assistant.',
      });

      const elapsed = Math.round(performance.now() - webhookStart);
      MetricsCollector.getInstance().recordLatency('edge_webhook', elapsed);

      return new Response(twiml, {
        status: 200,
        headers: {
          'Content-Type': 'text/xml',
          'X-Processing-Time-Ms': elapsed.toString(),
        },
      });
    }

    // Route: Twilio Call Status Callback
    if (pathname === '/voice/status' && method === 'POST') {
      const params = await parseParams(request);
      const signatureHeader = request.headers.get('X-Twilio-Signature');
      if (env.TWILIO_AUTH_TOKEN) {
        if (!signatureHeader) {
          return new Response('Unauthorized: Missing Twilio Signature', { status: 401 });
        }
        const isValid = await validateTwilioSignature(
          signatureHeader,
          request.url,
          params,
          env.TWILIO_AUTH_TOKEN
        );

        if (!isValid) {
          return new Response('Unauthorized: Invalid Twilio Signature', { status: 401 });
        }
      }

      const callStatus = params.CallStatus;
      const durationSeconds = parseInt(params.CallDuration || '0', 10);

      if (callStatus === 'completed') {
        MetricsCollector.getInstance().recordCallCompleted(durationSeconds);
      }

      return new Response('<?xml version="1.0" encoding="UTF-8"?><Response/>', {
        status: 200,
        headers: { 'Content-Type': 'text/xml' },
      });
    }

    // Route: Twilio Media Stream WebSocket Upgrade
    if (pathname === '/voice/stream') {
      const upgradeHeader = request.headers.get('Upgrade');
      if (!upgradeHeader || upgradeHeader.toLowerCase() !== 'websocket') {
        return new Response('Expected WebSocket Upgrade', { status: 426 });
      }

      const streamUpgradeStart = performance.now();

      // Cloudflare Workers WebSocketPair
      const webSocketPair = new WebSocketPair();
      const clientWs = webSocketPair[0];
      const serverWs = webSocketPair[1];

      if (!clientWs || !serverWs) {
        return new Response('WebSocket Pair Initialization Failed', { status: 500 });
      }

      const caller = url.searchParams.get('caller') || undefined;

      const bridge = new StreamBridge({
        clientWebSocket: serverWs,
        env,
        requestUrl: url,
        caller,
      });

      bridge.start();

      const elapsed = Math.round(performance.now() - streamUpgradeStart);
      MetricsCollector.getInstance().recordLatency('stream_handshake', elapsed);

      return new Response(null, {
        status: 101,
        webSocket: clientWs,
      });
    }

    // Route: Emergency Failover Fallback Webhook
    if (pathname === '/voice/fallback' && method === 'POST') {
      const params = await parseParams(request);
      const signatureHeader = request.headers.get('X-Twilio-Signature');
      if (env.TWILIO_AUTH_TOKEN) {
        if (!signatureHeader) {
          return new Response('Unauthorized: Missing Twilio Signature', { status: 401 });
        }
        const isValid = await validateTwilioSignature(
          signatureHeader,
          request.url,
          params,
          env.TWILIO_AUTH_TOKEN
        );

        if (!isValid) {
          return new Response('Unauthorized: Invalid Twilio Signature', { status: 401 });
        }
      }

      const humanNumber = env.FALLBACK_HUMAN_NUMBER || '+18005550199';
      const twilioNumber = env.TWILIO_PHONE_NUMBER;

      const fallbackTwiml = generateFallbackTwiML(humanNumber, {
        noticeMessage:
          'Please hold for just a moment. Connecting you directly with our senior specialist.',
        callerId: twilioNumber,
        timeoutSeconds: 25,
      });

      return new Response(fallbackTwiml, {
        status: 200,
        headers: {
          'Content-Type': 'text/xml',
        },
      });
    }

    // Route: SutraDB Semantic RAG Search
    if (pathname === '/api/query' && method === 'POST') {
      try {
        const body = (await request.json()) as {
          query: string;
          category?: string;
          filter?: Record<string, string | number | boolean>;
          topK?: number;
          minScore?: number;
        };

        if (!body.query || typeof body.query !== 'string') {
          return new Response(JSON.stringify({ error: "Missing required 'query' field" }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        const results = sutraEngine.query(body.query, {
          category: body.category,
          filter: body.filter,
          topK: body.topK ?? 3,
          minScore: body.minScore ?? 0,
        });

        return new Response(JSON.stringify({ query: body.query, count: results.length, results }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        return new Response(JSON.stringify({ error: message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    // Route: Autonomous Ticket Creation & SMS Dispatch
    if (pathname === '/api/dispatch' && method === 'POST') {
      try {
        const body = (await request.json()) as TicketRequest;
        if (!body.callerName || !body.callerPhone || !body.category || !body.serviceType) {
          return new Response(
            JSON.stringify({
              error: 'Missing required fields (callerName, callerPhone, category, serviceType)',
            }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
          );
        }

        const ticket = ticketDispatcher.createTicket(body);
        return new Response(JSON.stringify({ success: true, ticket }), {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        return new Response(JSON.stringify({ error: message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    // Route: Ticket Search & Filtering
    if (pathname === '/api/tickets' && method === 'GET') {
      const phone = url.searchParams.get('phone') || undefined;
      const category = url.searchParams.get('category') || undefined;
      const status = url.searchParams.get('status') || undefined;

      const tickets = await ticketDispatcher.findTickets({ phone, category, status });
      return new Response(JSON.stringify({ count: tickets.length, tickets }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response('Not Found', { status: 404 });
  },
};
