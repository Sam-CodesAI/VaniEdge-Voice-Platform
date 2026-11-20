import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const clientIp = getClientIp(req);
    const rateCheck = checkRateLimit(clientIp, "voice_outbound_call", 5, 60 * 1000);
    if (!rateCheck.success) {
      return NextResponse.json(
        { error: "Too many call requests. Please wait a minute before requesting another callback." },
        { status: 429 }
      );
    }

    const body = (await req.json()) as { to?: string };
    const to = body.to?.trim() || "+916361209256";

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const from = process.env.TWILIO_PHONE_NUMBER || "+18149613703";
    const origin = req.nextUrl.origin || "https://vaniedge.vercel.app";

    if (!accountSid || !authToken) {
      return NextResponse.json(
        { error: "Twilio credentials are not configured on the server." },
        { status: 500 }
      );
    }

    const authHeader = Buffer.from(`${accountSid}:${authToken}`).toString("base64");
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Calls.json`;

    const params = new URLSearchParams();
    params.set("To", to);
    params.set("From", from);
    params.set("Url", `${origin}/api/voice/incoming`);

    const twilioRes = await fetch(twilioUrl, {
      method: "POST",
      headers: {
        Authorization: `Basic ${authHeader}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    const twilioData = (await twilioRes.json()) as {
      sid?: string;
      status?: string;
      to?: string;
      from?: string;
      message?: string;
      code?: number;
    };

    if (!twilioRes.ok) {
      return NextResponse.json(
        {
          error: twilioData.message || "Failed to trigger outbound call via Twilio.",
          code: twilioData.code,
        },
        { status: twilioRes.status }
      );
    }

    return NextResponse.json({
      success: true,
      callSid: twilioData.sid,
      status: twilioData.status,
      to: twilioData.to,
      from: twilioData.from,
      message: `Outbound call dispatched successfully to ${twilioData.to}. Answer your phone to talk to VaniEdge Voice AI!`,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
