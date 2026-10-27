import { NextResponse } from "next/server";
import { authDb } from "@/lib/auth-store";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    // 1. Rate limiting: 5 signups per 60 seconds per IP
    const clientIp = getClientIp(req);
    const rateCheck = checkRateLimit(clientIp, "auth_signup", 5, 60 * 1000);
    if (!rateCheck.success) {
      return NextResponse.json(
        { error: "Too many signup attempts. Please wait before trying again." },
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

    const body = (await req.json()) as Record<string, unknown>;
    const { name, email, password, company } = body as {
      name: string;
      email: string;
      password: string;
      company?: string;
    };

    if (!name || typeof name !== "string" || name.trim().length === 0 || name.length > 100) {
      return NextResponse.json(
        { error: "Full name is required (max 100 characters)." },
        { status: 400 }
      );
    }

    if (!email || typeof email !== "string" || !email.includes("@") || email.length > 255) {
      return NextResponse.json(
        { error: "A valid email address is required (max 255 characters)." },
        { status: 400 }
      );
    }

    if (!password || typeof password !== "string" || password.length < 8 || password.length > 128) {
      return NextResponse.json(
        { error: "Password must be between 8 and 128 characters long." },
        { status: 400 }
      );
    }

    const { user, token } = await authDb.register(
      name,
      email,
      password,
      company || "Independent Developer",
      "email"
    );

    const safeUser = authDb.safeUser(user);

    const response = NextResponse.json(
      {
        success: true,
        message: "Account created successfully.",
        user: safeUser,
        token,
      },
      { status: 201 }
    );

    // Set hardened secure cookie for sessions
    response.cookies.set("vaniedge_session", token, {
      path: "/",
      maxAge: 30 * 24 * 60 * 60,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
    });

    return response;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to create account.";
    const status = message.includes("already exists") ? 409 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
