import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase-client";

export const dynamic = "force-dynamic";

export async function GET() {
  const hasTwilio = Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN);
  const hasElevenLabs = Boolean(process.env.ELEVENLABS_API_KEY || process.env.ELEVENLABS_AGENT_ID);
  const isHealthy = hasTwilio && hasElevenLabs;

  return NextResponse.json({
    service: "VaniEdge Voice Platform",
    version: "1.2.0",
    status: isHealthy ? "healthy" : "degraded",
    timestamp: new Date().toISOString(),
    providers: {
      twilio: {
        configured: hasTwilio,
      },
      elevenlabs: {
        configured: hasElevenLabs,
      },
      sutradb: {
        configured: true,
        mode: isSupabaseConfigured ? "postgres_hybrid" : "local_edge_index",
      },
    },
    failoverSla: {
      targetConnectionTimeoutMs: 1200,
      targetTtftTimeoutMs: 1500,
      architecture: "Sub-second edge watchdog with multi-tier carrier fallback",
    },
  });
}
