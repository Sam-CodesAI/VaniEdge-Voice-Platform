import { NextResponse, NextRequest } from "next/server";
import { authDb } from "@/lib/auth-store";
import { requireAuth } from "@/lib/auth-guard";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { auth, errorResponse } = await requireAuth(req);
    if (errorResponse) {
      return errorResponse;
    }

    const safeUser = authDb.safeUser(auth!.user);
    return NextResponse.json({ user: safeUser }, { status: 200 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
