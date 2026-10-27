import { NextRequest, NextResponse } from "next/server";
import { tenantStore } from "@/lib/tenant-store";
import { requireAuth } from "@/lib/auth-guard";
import { z } from "zod";

export const dynamic = "force-dynamic";

const UpdateTenantSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  category: z.string().min(1).max(50).optional(),
  brandColor: z.string().regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/).optional(),
  logoUrl: z.string().url().max(500).optional(),
  status: z.enum(["active", "provisioning", "suspended"]).optional(),
});

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { auth, errorResponse } = await requireAuth(req);
  if (errorResponse) {
    return errorResponse;
  }

  const resolvedParams = await params;
  const isSuperAdmin = auth!.user.role === "admin";
  const ownerFilter = isSuperAdmin ? undefined : auth!.user.id;

  const tenant = await tenantStore.get(resolvedParams.id, ownerFilter);
  // Avoid leaking tenant existence: return 404 if record does not belong to user
  if (!tenant) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }

  return NextResponse.json({ tenant: tenantStore.safeTenant(tenant) }, { status: 200 });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { auth, errorResponse } = await requireAuth(req, { checkCsrf: true });
  if (errorResponse) {
    return errorResponse;
  }

  try {
    const resolvedParams = await params;
    const isSuperAdmin = auth!.user.role === "admin";
    const ownerFilter = isSuperAdmin ? undefined : auth!.user.id;

    const rawBody = (await req.json()) as unknown;
    const parseResult = UpdateTenantSchema.safeParse(rawBody);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parseResult.error.format() },
        { status: 400 }
      );
    }

    const tenant = await tenantStore.update(resolvedParams.id, parseResult.data, ownerFilter);
    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found or unauthorized" }, { status: 404 });
    }

    return NextResponse.json({ tenant: tenantStore.safeTenant(tenant) }, { status: 200 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to update tenant";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { auth, errorResponse } = await requireAuth(req, { checkCsrf: true });
  if (errorResponse) {
    return errorResponse;
  }

  const resolvedParams = await params;
  const isSuperAdmin = auth!.user.role === "admin";
  const ownerFilter = isSuperAdmin ? undefined : auth!.user.id;

  const deleted = await tenantStore.delete(resolvedParams.id, ownerFilter);
  if (!deleted) {
    return NextResponse.json({ error: "Tenant not found or unauthorized" }, { status: 404 });
  }

  return NextResponse.json({ success: true, message: "Tenant deleted." }, { status: 200 });
}
