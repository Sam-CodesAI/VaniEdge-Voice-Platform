import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

// Strict E.164 Phone Format: + followed by 8 to 15 digits
const E164_REGEX = /^\+[1-9]\d{7,14}$/;

// Fraud & Toll-Abuse Blocklist (Premium rate numbers, satellite, high-risk tele-fraud prefixes)
const BLOCKED_FRAUD_PREFIXES = [
  "+1900", // US Premium Rate
  "+1976", // US 976 Premium Rate
  "+881",  // Global Mobile Satellite System
  "+882",  // International Networks
  "+883",  // International Networks
];

function isBlockedPrefix(phone: string): boolean {
  return BLOCKED_FRAUD_PREFIXES.some((prefix) => phone.startsWith(prefix));
}

export async function POST(req: NextRequest) {
  try {
    const clientIp = getClientIp(req);
    const rateCheck = checkRateLimit(clientIp, "voice_outbound_call", 5, 60 * 1000);
    if (!rateCheck.success) {
      return NextResponse.json(
        {
          type: "https://vaniedge.ai/errors/rate-limit-exceeded",
          title: "Too Many Requests",
          status: 429,
          detail: "Too many call requests. Please wait a minute before requesting another callback.",
          instance: req.nextUrl.pathname,
        },
        { status: 429 }
      );
    }

    const body = (await req.json()) as { to?: string };
    const rawTo = body.to ? body.to.trim().replace(/[\s\-\(\)]/g, "") : "+916361209256";
    const to = rawTo;

    // 1. Validate strict E.164 formatting
    if (!E164_REGEX.test(to)) {
      return NextResponse.json(
        {
          type: "https://vaniedge.ai/errors/invalid-phone-format",
          title: "Invalid Phone Number Format",
          status: 400,
          detail: "Destination phone number must be in valid international E.164 format (e.g. +916361209256 or +15551234567).",
          instance: req.nextUrl.pathname,
        },
        { status: 400 }
      );
    }

    // 2. Guard against toll fraud & premium rate exploitation
    if (isBlockedPrefix(to)) {
      return NextResponse.json(
        {
          type: "https://vaniedge.ai/errors/restricted-destination",
          title: "Restricted Destination Number",
          status: 403,
          detail: "Calls to premium-rate, satellite, or high-cost destinations are restricted.",
          instance: req.nextUrl.pathname,
        },
        { status: 403 }
      );
    }

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const from = process.env.TWILIO_PHONE_NUMBER || "+18149613703";
    const origin = req.nextUrl.origin || "https://vaniedge.vercel.app";

    if (!accountSid || !authToken) {
      return NextResponse.json(
        {
          type: "https://vaniedge.ai/errors/unconfigured-telephony",
          title: "Telephony Gateway Unconfigured",
          status: 500,
          detail: "Twilio credentials are not configured on the server.",
          instance: req.nextUrl.pathname,
        },
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
          type: "https://vaniedge.ai/errors/telephony-provider-error",
          title: "Twilio Telephony Dispatch Failed",
          status: twilioRes.status,
          detail: twilioData.message || "Failed to trigger outbound call via Twilio.",
          code: twilioData.code,
          instance: req.nextUrl.pathname,
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
    return NextResponse.json(
      {
        type: "https://vaniedge.ai/errors/internal-error",
        title: "Internal Telephony Server Error",
        status: 500,
        detail: errorMsg,
        instance: req.nextUrl.pathname,
      },
      { status: 500 }
    );
  }
}
