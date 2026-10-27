import { NextRequest, NextResponse } from "next/server";
import { MetricsCollector } from "@/src/telemetry/metrics";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { requireAuth } from "@/lib/auth-guard";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  // 1. Sliding-window rate limit: 30 requests per minute per IP
  const clientIp = getClientIp(request);
  const rateCheck = checkRateLimit(clientIp, "metrics", 30, 60 * 1000);
  if (!rateCheck.success) {
    return NextResponse.json(
      { error: "Too many metrics requests. Please slow down." },
      {
        status: 429,
        headers: {
          "Retry-After": Math.ceil(rateCheck.resetMs / 1000).toString(),
        },
      }
    );
  }

  // 2. Production Access Protection: Require Bearer token matching METRICS_API_KEY/TWILIO_AUTH_TOKEN or active session
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_INSECURE_DEV_WEBHOOKS !== "true") {
    const authHeader = request.headers.get("authorization") || "";
    const expectedKey = process.env.METRICS_API_KEY || process.env.TWILIO_AUTH_TOKEN;
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();

    if (!token || token !== expectedKey) {
      const { errorResponse } = await requireAuth(request);
      if (errorResponse) {
        return NextResponse.json(
          { error: "Unauthorized: Valid Bearer token or session credentials required to read metrics." },
          { status: 401 }
        );
      }
    }
  }

  const { searchParams } = new URL(request.url);
  const format = searchParams.get("format");
  const acceptsPrometheus = request.headers.get("Accept")?.includes("text/plain");

  if (format === "prometheus" || acceptsPrometheus) {
    const text = MetricsCollector.getInstance().toPrometheus();
    return new Response(text, {
      headers: { "Content-Type": "text/plain; version=0.0.4; charset=utf-8" },
    });
  }

  const snapshot = MetricsCollector.getInstance().getSnapshot();
  return NextResponse.json(snapshot);
}
