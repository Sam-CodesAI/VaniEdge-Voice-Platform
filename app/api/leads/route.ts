import { NextRequest, NextResponse } from "next/server";
import { sendTelegramAdminAlert } from "@/lib/telegram-alert";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { supabase } from "@/lib/supabase-client";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const clientIp = getClientIp(req);
    const rateCheck = checkRateLimit(clientIp, "lead_capture", 10, 60 * 1000);
    if (!rateCheck.success) {
      return NextResponse.json(
        { error: "Too many submissions. Please wait a moment." },
        { status: 429 }
      );
    }

    const body = (await req.json()) as Record<string, any>;
    const {
      type = "LEAD_CUSTOMIZER",
      businessName,
      category,
      callerName,
      contact,
      language = "en",
      planName,
      details,
    } = body;

    // 1. Send Instant Telegram Push Notification to Samarth
    void sendTelegramAdminAlert({
      type: type as any,
      businessName,
      category,
      callerName,
      contact,
      language,
      planName,
      details,
    });

    // 2. Persist to Supabase if available
    if (supabase) {
      try {
        await (supabase as any)
          .from("inquiries")
          .insert({
            name: callerName || businessName || "Prospective Client",
            contact_method: contact || "VaniEdge Web Customizer",
            service_requested: `Voice AI - ${category || "General"} (${planName || "Trial"})`,
            message: `[VANIEDGE LEAD]\n• Business: ${businessName || "Not stated"}\n• Category: ${category || "clinic"}\n• Language: ${language}\n• Details: ${details || "Customized in studio"}`,
            status: "NEW",
            source: "vaniedge_voice_platform",
            user_agent: "vaniedge_web",
          });
      } catch {
        // Defensive: do not fail client response if Supabase schema differs
      }
    }

    return NextResponse.json(
      {
        success: true,
        message: "Your voice agent configuration has been saved. Test it live in the studio below!",
      },
      { status: 200 }
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to record lead";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
