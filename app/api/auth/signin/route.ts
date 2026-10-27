import { NextResponse } from "next/server";
import { authDb } from "@/lib/auth-store";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    // 1. Rate limiting: 5 signin attempts per 60 seconds per IP
    const clientIp = getClientIp(req);
    const rateCheck = checkRateLimit(clientIp, "auth_signin", 5, 60 * 1000);
    if (!rateCheck.success) {
      return NextResponse.json(
        { error: "Too many sign-in attempts. Please wait before trying again." },
        {
          status: 429,
          headers: {
            "Retry-After": Math.ceil(rateCheck.resetMs / 1000).toString(),
            "X-RateLimit-Limit": rateCheck.limit.toString(),
            "X-RateLimit-Remaining": rateCheck.remaining.toString(),
          },
        }
      );
    }

    const body = (await req.json()) as { email: string; password: string };
    const { email, password } = body;

    if (!email || typeof email !== "string" || !email.includes("@") || email.length > 255) {
      return NextResponse.json(
        { error: "A valid email address is required." },
        { status: 400 }
      );
    }

    if (!password || typeof password !== "string" || password.length === 0 || password.length > 128) {
      return NextResponse.json(
        { error: "Password is required (max 128 characters)." },
        { status: 400 }
      );
    }

    const { user, token } = await authDb.authenticate(email, password);
    const safeUser = authDb.safeUser(user);

    const response = NextResponse.json(
      {
        success: true,
        message: "Authenticated successfully.",
        user: safeUser,
        token,
      },
      { status: 200 }
    );

    response.cookies.set("vaniedge_session", token, {
      path: "/",
      maxAge: 30 * 24 * 60 * 60,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
    });

    return response;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Authentication failed.";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
