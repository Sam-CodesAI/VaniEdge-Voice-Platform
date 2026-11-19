import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-guard";
import { listCallSessions } from "@/lib/telephony/failover-engine";
import { isTenantOwnedByUser } from "@/lib/tenant-store";
import { CallPhase } from "@/lib/telephony/types";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  // 1. Enforce authentication
  const { auth, errorResponse } = await requireAuth(req);
  if (errorResponse) {
    return errorResponse;
  }

  const { searchParams } = new URL(req.url);
  const requestedTenantId = searchParams.get("tenantId") || undefined;
  const phaseFilter = (searchParams.get("phase") as CallPhase) || undefined;

  // 2. Tenant isolation verification
  const userRole = auth!.user.role || "user";
  const hasAccess = await isTenantOwnedByUser(requestedTenantId, auth!.user.id, userRole);
  if (!hasAccess) {
    return NextResponse.json(
      { error: "Forbidden: Cannot access calls for another tenant" },
      { status: 403 }
    );
  }

  const effectiveTenantId = requestedTenantId || (userRole === "admin" ? undefined : auth!.user.id);

  // 3. Retrieve sessions
  const calls = listCallSessions({
    tenantId: effectiveTenantId,
    phase: phaseFilter,
  });

  return NextResponse.json({
    success: true,
    calls,
    total: calls.length,
  });
}
