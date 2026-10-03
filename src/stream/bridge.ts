/**
 * Bidirectional Telephony Audio Bridge (Twilio Media Stream <-> ElevenLabs Conversational AI)
 *
 * Handles:
 * - 8kHz μ-law Base64 audio streaming between Twilio and ElevenLabs
 * - Barge-in / Interruption handling with instant Twilio buffer clearing
 * - Integrated Sub-Second Watchdog for failover on latency or disconnects
 * - Live Twilio call redirection via Twilio REST API upon failover
 */

import type { Env } from '../types/env';
import type {
  TwilioInboundMessage,
  TwilioOutboundClearMessage,
  TwilioOutboundMediaMessage,
} from '../types/twilio';
import type { ElevenLabsInboundMessage } from '../types/elevenlabs';
import { WatchdogEngine } from './watchdog';
import { TwilioClient } from '../twilio/client';
import { MetricsCollector } from '../telemetry/metrics';

export interface StreamBridgeOptions {
  clientWebSocket: WebSocket;
  env: Env;
  requestUrl: URL;
  twilioClient?: TwilioClient;
  caller?: string;
}

export class StreamBridge {
  private clientWs: WebSocket;
  private upstreamWs: WebSocket | null = null;
  private env: Env;
  private requestUrl: URL;

  private callSid: string | null = null;
  private streamSid: string | null = null;
  private caller: string | null = null;
  private watchdog: WatchdogEngine | null = null;
  private twilioClient: TwilioClient;
  private isClosed = false;
  private keepaliveTimer: ReturnType<typeof setInterval> | null = null;

  constructor(options: StreamBridgeOptions) {
    this.clientWs = options.clientWebSocket;
    this.env = options.env;
    this.requestUrl = options.requestUrl;
    this.caller = options.caller || null;

    this.twilioClient =
      options.twilioClient ||
      new TwilioClient({
        accountSid: options.env.TWILIO_ACCOUNT_SID,
        authToken: options.env.TWILIO_AUTH_TOKEN,
        apiKeySid: options.env.TWILIO_API_KEY_SID,
        apiSecret: options.env.TWILIO_API_SECRET,
      });
  }

  /**
   * Initializes the bridge and binds WebSocket event listeners
   */
  public start(): void {
    MetricsCollector.getInstance().streamsActive++;

    // Accept client WebSocket (Twilio)
    this.clientWs.accept();

    this.clientWs.addEventListener('message', (event) => {
      this.handleClientMessage(event.data);
    });

    this.clientWs.addEventListener('close', () => {
      this.handleClientClose();
    });

    this.clientWs.addEventListener('error', (err) => {
      this.handleClientError(err);
    });
  }

  /**
   * Handles incoming protocol messages from Twilio Media Stream
   */
  private handleClientMessage(data: string | ArrayBuffer): void {
    if (this.isClosed || typeof data !== 'string') return;

    try {
      const msg = JSON.parse(data) as TwilioInboundMessage;

      switch (msg.event) {
        case 'connected':
          // Twilio connected to stream
          break;

        case 'start':
          this.handleTwilioStart(msg);
          break;

        case 'media':
          this.handleTwilioMedia(msg.media.payload);
          break;

        case 'stop':
          this.handleTwilioStop();
          break;

        case 'mark':
          // Twilio finished playing specific marked audio buffer
          break;
      }
    } catch {
      // Inbound frame parse error
    }
  }

  /**
   * Called when Twilio sends the 'start' event containing CallSid & StreamSid
   */
  private handleTwilioStart(startMsg: Extract<TwilioInboundMessage, { event: 'start' }>): void {
    this.callSid = startMsg.start.callSid;
    this.streamSid = startMsg.start.streamSid;

    const connectTimeoutMs = this.env.FAILOVER_CONNECT_TIMEOUT_MS
      ? parseInt(this.env.FAILOVER_CONNECT_TIMEOUT_MS, 10)
      : 1200;

    const ttftTimeoutMs = this.env.FAILOVER_TTFT_TIMEOUT_MS
      ? parseInt(this.env.FAILOVER_TTFT_TIMEOUT_MS, 10)
      : 1500;

    // Initialize the Sub-Second Watchdog Engine
    this.watchdog = new WatchdogEngine({
      callSid: this.callSid,
      streamSid: this.streamSid,
      connectTimeoutMs,
      ttftTimeoutMs,
      onFailover: async (reason, elapsedMs) => {
        await this.executeFailover(reason, elapsedMs);
      },
      onClearAudioBuffer: () => {
        this.clearTwilioAudioBuffer();
      },
    });

    // Arm the connect watchdog deadline
    this.watchdog.armConnectWatchdog();

    // Connect to ElevenLabs Conversational AI
    this.connectUpstream();

    // Forward customer variables if available
    this.sendContextualUpdate(startMsg.start.customParameters);
  }

  /**
   * Forwards custom customer variables to ElevenLabs dynamic variables
   */
  private sendContextualUpdate(customParams?: Record<string, string>): void {
    if (!this.upstreamWs || this.upstreamWs.readyState !== WebSocket.OPEN) return;
    if (!customParams || Object.keys(customParams).length === 0) return;

    try {
      this.upstreamWs.send(
        JSON.stringify({
          contextual_update: {
            dynamic_variables: customParams,
          },
        })
      );
    } catch {
      // Safe write
    }
  }

  /**
   * Handles audio from caller and forwards to ElevenLabs
   */
  private handleTwilioMedia(base64Payload: string): void {
    if (this.isClosed || !this.upstreamWs || this.upstreamWs.readyState !== WebSocket.OPEN) {
      return;
    }

    // ElevenLabs expects audio packet in { user_audio_chunk: base64 }
    const elevenLabsAudioMsg = JSON.stringify({
      user_audio_chunk: base64Payload,
    });

    try {
      this.upstreamWs.send(elevenLabsAudioMsg);
    } catch (err: unknown) {
      this.watchdog?.onStreamError(err instanceof Error ? err : String(err));
    }
  }

  /**
   * Connects to ElevenLabs Conversational AI WebSocket endpoint
   */
  private connectUpstream(): void {
    const handshakeStart = performance.now();

    const agentId = this.env.ELEVENLABS_AGENT_ID || 'default_agent';
    const elevenLabsUrl = new URL(`wss://api.elevenlabs.io/v1/convai/conversation`);
    elevenLabsUrl.searchParams.set('agent_id', agentId);

    // Explicitly configure 8kHz μ-law telephony audio to match Twilio native format
    const inputFormat = this.env.ELEVENLABS_INPUT_FORMAT || 'ulaw_8000';
    const outputFormat = this.env.ELEVENLABS_OUTPUT_FORMAT || 'ulaw_8000';
    elevenLabsUrl.searchParams.set('user_input_audio_format', inputFormat);
    elevenLabsUrl.searchParams.set('agent_output_audio_format', outputFormat);

    // Support optional custom model or voice
    if (this.env.ELEVENLABS_MODEL_ID) {
      elevenLabsUrl.searchParams.set('model_id', this.env.ELEVENLABS_MODEL_ID);
    }
    if (this.env.ELEVENLABS_VOICE_ID) {
      elevenLabsUrl.searchParams.set('voice_id', this.env.ELEVENLABS_VOICE_ID);
    }

    try {
      const headers: Record<string, string> = {};
      if (this.env.ELEVENLABS_API_KEY) {
        headers['xi-api-key'] = this.env.ELEVENLABS_API_KEY;
      }

      this.upstreamWs = new WebSocket(elevenLabsUrl.toString());
      this.setupUpstreamListeners(handshakeStart);
    } catch (err: unknown) {
      this.watchdog?.onStreamError(err instanceof Error ? err : String(err));
    }
  }

  /**
   * Sets up event listeners on the upstream ElevenLabs WebSocket
   */
  private setupUpstreamListeners(handshakeStart: number): void {
    if (!this.upstreamWs) return;

    this.upstreamWs.addEventListener('open', () => {
      const elapsed = Math.round(performance.now() - handshakeStart);
      this.watchdog?.onUpstreamConnected(elapsed);
      this.sendContextualUpdate();
    });

    this.upstreamWs.addEventListener('message', (event) => {
      this.handleUpstreamMessage(event.data);
    });

    this.upstreamWs.addEventListener('close', (event) => {
      this.watchdog?.onUpstreamDisconnection(event.code, event.reason);
    });

    this.upstreamWs.addEventListener('error', (err) => {
      this.watchdog?.onStreamError(err instanceof Error ? err.message : 'Upstream WebSocket error');
    });
  }

  /**
   * Handles incoming protocol messages from ElevenLabs Conversational AI
   */
  private handleUpstreamMessage(data: string | ArrayBuffer): void {
    if (this.isClosed || typeof data !== 'string') return;

    try {
      const msg = JSON.parse(data) as ElevenLabsInboundMessage;

      switch (msg.type) {
        case 'conversation_initiation_metadata':
          // Upstream ready
          break;

        case 'audio': {
          // Received synthesized voice chunk from ElevenLabs
          this.watchdog?.onAgentAudioReceived();
          const base64Audio = msg.audio_event.audio_base_64;
          this.sendAudioToTwilio(base64Audio);
          break;
        }

        case 'interruption':
          // Caller spoke while agent was talking: instantly clear Twilio buffer
          this.watchdog?.onUserInterruption();
          break;

        case 'user_transcript':
          // Caller speech transcription completed: arm TTFT deadline
          this.watchdog?.onUserTurnCompleted();
          break;

        case 'agent_response':
          // Agent finished responding to turn
          this.watchdog?.onAgentTurnFinished();
          break;

        case 'ping':
          // Reply to ElevenLabs ping
          if (this.upstreamWs && this.upstreamWs.readyState === WebSocket.OPEN && msg.ping_event) {
            this.upstreamWs.send(JSON.stringify({ pong: { event_id: msg.ping_event.event_id ?? 0 } }));
          }
          break;
      }
    } catch {
      // Inbound frame parse error
    }
  }

  /**
   * Sends audio packet to Twilio Media Stream
   */
  private sendAudioToTwilio(base64Payload: string): void {
    if (!this.streamSid || this.clientWs.readyState !== WebSocket.OPEN) return;

    const twilioMedia: TwilioOutboundMediaMessage = {
      event: 'media',
      streamSid: this.streamSid,
      media: {
        payload: base64Payload,
      },
    };

    try {
      this.clientWs.send(JSON.stringify(twilioMedia));
    } catch {
      // Socket write failure
    }
  }

  /**
   * Flushes Twilio's audio playback buffer for barge-in or failover
   */
  public clearTwilioAudioBuffer(): void {
    if (!this.streamSid || this.clientWs.readyState !== WebSocket.OPEN) return;

    const clearMsg: TwilioOutboundClearMessage = {
      event: 'clear',
      streamSid: this.streamSid,
    };

    try {
      this.clientWs.send(JSON.stringify(clearMsg));
    } catch {
      // Socket write failure
    }
  }

  /**
   * Executes mid-call failover via Twilio REST API redirection.
   * This bridges the call to a human backup operator with ZERO dropped calls.
   */
  private async executeFailover(reason: string, elapsedMs: number): Promise<void> {
    if (!this.callSid) return;

    // Build the emergency fallback URL pointing to /voice/fallback on this worker
    const fallbackUrl = new URL('/voice/fallback', this.requestUrl.origin);
    fallbackUrl.searchParams.set('reason', reason);
    fallbackUrl.searchParams.set('elapsed', elapsedMs.toString());

    // Redirect the live Twilio call dynamically
    const result = await this.twilioClient.redirectCall(this.callSid, fallbackUrl.toString());

    // Safely tear down upstream connection
    if (this.upstreamWs) {
      try {
        this.upstreamWs.close(1000, 'Failover rerouted');
      } catch {
        // Safe close
      }
    }

    if (!result.success) {
      throw new Error(result.error || 'Twilio call redirection failed');
    }
  }

  private handleTwilioStop(): void {
    this.close();
  }

  private handleClientClose(): void {
    this.close();
  }

  private handleClientError(_err: unknown): void {
    this.close();
  }

  public close(): void {
    if (this.isClosed) return;
    this.isClosed = true;

    if (this.keepaliveTimer) {
      clearInterval(this.keepaliveTimer);
      this.keepaliveTimer = null;
    }

    MetricsCollector.getInstance().streamsActive = Math.max(0, MetricsCollector.getInstance().streamsActive - 1);
    MetricsCollector.getInstance().streamsCompleted++;

    this.watchdog?.close();

    if (this.upstreamWs && this.upstreamWs.readyState === WebSocket.OPEN) {
      try {
        this.upstreamWs.close(1000, 'Stream ended');
      } catch {
        // Safe close
      }
    }

    if (this.clientWs.readyState === WebSocket.OPEN) {
      try {
        this.clientWs.close(1000, 'Stream ended');
      } catch {
        // Safe close
      }
    }
  }
}
