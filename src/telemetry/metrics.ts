/**
 * Telemetry & Latency Breakdown Metrics Engine
 *
 * Tracks stage-by-stage telephony benchmarks as required by enterprise SLA:
 * - Stage 1: Edge Webhook Processing Latency
 * - Stage 2: Media Stream Handshake Latency
 * - Stage 3: Upstream Agent Handshake Latency
 * - Stage 4: First Audio Byte / TTFT (Time to First Audio Chunk)
 * - Stage 5: Failover Watchdog Dispatches
 */

export interface LatencyRecord {
  count: number;
  totalMs: number;
  minMs: number;
  maxMs: number;
  avgMs: number;
}

export interface FailoverEvent {
  timestamp: string;
  callSid: string;
  reason: string;
  elapsedMs: number;
  redirectStatus: 'dispatched' | 'failed';
}

export class MetricsCollector {
  private static instance: MetricsCollector;

  public callsTotal = 0;
  public callsCompleted = 0;
  public callDurationTotalSeconds = 0;
  public streamsActive = 0;
  public streamsCompleted = 0;
  public failoversTotal = 0;

  public failoverReasons: Record<string, number> = {
    connect_timeout: 0,
    ttft_timeout: 0,
    upstream_disconnect: 0,
    socket_error: 0,
    client_disconnect: 0,
  };

  private latencies: Record<string, LatencyRecord> = {
    edge_webhook: { count: 0, totalMs: 0, minMs: Infinity, maxMs: 0, avgMs: 0 },
    stream_handshake: { count: 0, totalMs: 0, minMs: Infinity, maxMs: 0, avgMs: 0 },
    upstream_handshake: { count: 0, totalMs: 0, minMs: Infinity, maxMs: 0, avgMs: 0 },
    ttft: { count: 0, totalMs: 0, minMs: Infinity, maxMs: 0, avgMs: 0 },
    failover_dispatch: { count: 0, totalMs: 0, minMs: Infinity, maxMs: 0, avgMs: 0 },
  };

  public recentFailovers: FailoverEvent[] = [];

  public static getInstance(): MetricsCollector {
    if (!MetricsCollector.instance) {
      MetricsCollector.instance = new MetricsCollector();
    }
    return MetricsCollector.instance;
  }

  public reset(): void {
    this.callsTotal = 0;
    this.callsCompleted = 0;
    this.callDurationTotalSeconds = 0;
    this.streamsActive = 0;
    this.streamsCompleted = 0;
    this.failoversTotal = 0;
    this.failoverReasons = {
      connect_timeout: 0,
      ttft_timeout: 0,
      upstream_disconnect: 0,
      socket_error: 0,
      client_disconnect: 0,
    };
    this.latencies = {
      edge_webhook: { count: 0, totalMs: 0, minMs: Infinity, maxMs: 0, avgMs: 0 },
      stream_handshake: { count: 0, totalMs: 0, minMs: Infinity, maxMs: 0, avgMs: 0 },
      upstream_handshake: { count: 0, totalMs: 0, minMs: Infinity, maxMs: 0, avgMs: 0 },
      ttft: { count: 0, totalMs: 0, minMs: Infinity, maxMs: 0, avgMs: 0 },
      failover_dispatch: { count: 0, totalMs: 0, minMs: Infinity, maxMs: 0, avgMs: 0 },
    };
    this.recentFailovers = [];
  }

  public recordLatency(stage: 'edge_webhook' | 'stream_handshake' | 'upstream_handshake' | 'ttft' | 'failover_dispatch', durationMs: number): void {
    const record = this.latencies[stage];
    if (!record) return;

    record.count++;
    record.totalMs += durationMs;
    record.minMs = Math.min(record.minMs, durationMs);
    record.maxMs = Math.max(record.maxMs, durationMs);
    record.avgMs = Math.round((record.totalMs / record.count) * 10) / 10;
  }

  public recordFailover(event: FailoverEvent): void {
    this.failoversTotal++;
    const count = this.failoverReasons[event.reason] || 0;
    this.failoverReasons[event.reason] = count + 1;

    this.recentFailovers.unshift(event);
    if (this.recentFailovers.length > 20) {
      this.recentFailovers.pop();
    }
  }

  public recordCallCompleted(durationSeconds: number): void {
    this.callsCompleted++;
    if (durationSeconds > 0) {
      this.callDurationTotalSeconds += durationSeconds;
    }
  }

  public getSnapshot(): Record<string, unknown> {
    const avgDuration = this.callsCompleted > 0
      ? Math.round((this.callDurationTotalSeconds / this.callsCompleted) * 10) / 10
      : 0;

    return {
      status: 'operational',
      uptime_seconds: Math.floor(performance.now() / 1000),
      summary: {
        calls_total: this.callsTotal,
        calls_completed: this.callsCompleted,
        average_call_duration_seconds: avgDuration,
        streams_active: this.streamsActive,
        streams_completed: this.streamsCompleted,
        failovers_total: this.failoversTotal,
      },
      failover_by_cause: this.failoverReasons,
      benchmarks_by_stage: {
        stage_1_edge_webhook: {
          name: 'Cloudflare Edge Webhook Signature & TwiML Dispatch',
          stats: this.latencies.edge_webhook,
          typical_sla: '< 30ms',
        },
        stage_2_stream_handshake: {
          name: 'Twilio Media Stream WebSocket Upgrade & Protocol Handshake',
          stats: this.latencies.stream_handshake,
          typical_sla: '< 70ms',
        },
        stage_3_upstream_handshake: {
          name: 'ElevenLabs Conversational AI WebSocket Handshake',
          stats: this.latencies.upstream_handshake,
          typical_sla: '< 150ms',
        },
        stage_4_ttft_first_audio_byte: {
          name: 'Turn Detection to First Synthesized Audio Frame (TTFT)',
          stats: this.latencies.ttft,
          typical_sla: '< 450ms',
        },
        stage_5_failover_dispatch: {
          name: 'Watchdog Dead-Air Detection & Twilio API Redirect',
          stats: this.latencies.failover_dispatch,
          typical_sla: '< 20ms (dispatched immediately at 1200ms threshold)',
        },
      },
      recent_failover_events: this.recentFailovers.map((e) => ({
        ...e,
        callSid: e.callSid && e.callSid.length > 8 ? `${e.callSid.slice(0, 4)}...${e.callSid.slice(-4)}` : 'masked',
      })),
    };
  }

  /**
   * Formats metrics in Prometheus exposition text format for monitoring systems
   */
  public toPrometheus(): string {
    const lines: string[] = [];

    lines.push('# HELP twilio_calls_total Total inbound voice calls received');
    lines.push('# TYPE twilio_calls_total counter');
    lines.push(`twilio_calls_total ${this.callsTotal}`);

    lines.push('# HELP twilio_calls_completed Total calls completed');
    lines.push('# TYPE twilio_calls_completed counter');
    lines.push(`twilio_calls_completed ${this.callsCompleted}`);

    lines.push('# HELP twilio_streams_active Currently active media streams');
    lines.push('# TYPE twilio_streams_active gauge');
    lines.push(`twilio_streams_active ${this.streamsActive}`);

    lines.push('# HELP twilio_failovers_total Total watchdog failover dispatches');
    lines.push('# TYPE twilio_failovers_total counter');
    lines.push(`twilio_failovers_total ${this.failoversTotal}`);

    for (const [reason, count] of Object.entries(this.failoverReasons)) {
      lines.push(`twilio_failovers_by_reason{reason="${reason}"} ${count}`);
    }

    for (const [stage, stat] of Object.entries(this.latencies)) {
      const avg = stat.avgMs || 0;
      lines.push(`twilio_latency_avg_ms{stage="${stage}"} ${avg}`);
      lines.push(`twilio_latency_count{stage="${stage}"} ${stat.count}`);
    }

    return lines.join('\n') + '\n';
  }
}
