import { NextResponse } from "next/server";
import { authDb } from "@/lib/auth-store";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    let token: string | undefined;

    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.slice(7).trim();
    }

    if (!token) {
      const cookieHeader = req.headers.get("cookie") || "";
      const match = cookieHeader.match(/vaniedge_session=([^;]+)/);
      if (match) {
        token = match[1];
      }
    }

    if (token) {
      // Invalidate session in durable database
      await authDb.revokeSession(token);
    }

    const response = NextResponse.json(
      {
        success: true,
        message: "Signed out successfully and session token revoked.",
      },
      { status: 200 }
    );

    // Invalidate cookie on client with exact same path, httpOnly, secure flags
    response.cookies.set("vaniedge_session", "", {
      path: "/",
      maxAge: 0,
      expires: new Date(0),
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
    });

    return response;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to sign out.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
