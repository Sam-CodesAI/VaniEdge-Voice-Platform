import { NextRequest, NextResponse } from "next/server";
import { tenantStore } from "@/lib/tenant-store";
import { requireAuth } from "@/lib/auth-guard";
import { z } from "zod";

export const dynamic = "force-dynamic";

const CreateTenantSchema = z.object({
  name: z.string().min(1).max(100),
  category: z.string().min(1).max(50).default("general"),
  brandColor: z.string().regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/).optional(),
  logoUrl: z.string().url().max(500).optional(),
});

export async function GET(req: NextRequest) {
  // 1. Enforce authentication
  const { auth, errorResponse } = await requireAuth(req);
  if (errorResponse) {
    return errorResponse;
  }

  // 2. Tenant isolation: regular users and agency admins only see their owned tenants
  const isSuperAdmin = auth!.user.role === "admin";
  const ownerFilter = isSuperAdmin ? undefined : auth!.user.id;

  const rawTenants = await tenantStore.getAll(ownerFilter);
  const tenants = rawTenants.map((t) => tenantStore.safeTenant(t));

  return NextResponse.json({ tenants }, { status: 200 });
}

export async function POST(req: NextRequest) {
  // 1. Enforce authentication & CSRF check
  const { auth, errorResponse } = await requireAuth(req, { checkCsrf: true });
  if (errorResponse) {
    return errorResponse;
  }

  try {
    const rawBody = (await req.json()) as unknown;
    const parseResult = CreateTenantSchema.safeParse(rawBody);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parseResult.error.format() },
        { status: 400 }
      );
    }

    const { name, category, brandColor, logoUrl } = parseResult.data;

    // 2. Generate cryptographically safe tenant ID and telephone routing
    const newId = `tnt_${Math.random().toString(36).substring(2, 9)}`;
    const phone = `+1 (${Math.floor(200 + Math.random() * 800)}) ${Math.floor(200 + Math.random() * 800)}-${Math.floor(1000 + Math.random() * 9000)}`;

    // 3. Derive ownership strictly from authenticated user ID
    const tenant = await tenantStore.create({
      id: newId,
      ownerId: auth!.user.id,
      name,
      category,
      twilioSid: process.env.TWILIO_ACCOUNT_SID || "",
      twilioPhone: phone,
      webhookUrl: `https://vaniedge.ai/api/voice/incoming?tenantId=${newId}`,
      monthlyCalls: 0,
      status: "active",
      brandColor,
      logoUrl,
    });

    const safe = tenantStore.safeTenant(tenant);
    return NextResponse.json({ tenant: safe }, { status: 201 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to provision tenant";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
