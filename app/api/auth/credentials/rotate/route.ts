import { NextResponse, NextRequest } from "next/server";
import { authDb } from "@/lib/auth-store";
import { requireAuth } from "@/lib/auth-guard";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { auth, errorResponse } = await requireAuth(req, {
      allowApiKey: true,
      checkCsrf: true,
    });

    if (errorResponse) {
      return errorResponse;
    }

    const clientIp = getClientIp(req);
    const rateCheck = checkRateLimit(`${clientIp}:${auth!.user.id}`, "rotate_creds", 5, 60 * 1000);
    if (!rateCheck.success) {
      return NextResponse.json(
        { error: "Too many rotation requests. Please wait before rotating keys again." },
        {
          status: 429,
          headers: {
            "Retry-After": Math.ceil(rateCheck.resetMs / 1000).toString(),
          },
        }
      );
    }

    // Always derive user ID from verified authentication context, NEVER client request body
    const newCredentials = await authDb.rotateApiKey(auth!.user.id);

    return NextResponse.json(
      {
        success: true,
        message: "API credentials rotated successfully. Previous keys are now invalidated.",
        credentials: newCredentials,
      },
      { status: 200 }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to rotate credentials.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
