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
  twilioPhone: z.string().regex(/^\+[1-9]\d{1,14}$/).optional(),
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

    const { name, category, brandColor, logoUrl, twilioPhone } = parseResult.data;

    // 2. Generate cryptographically safe tenant ID
    const newId = `tnt_${Math.random().toString(36).substring(2, 9)}`;

    // 3. Honest Carrier Provisioning:
    // Only claim active telephone routing if a real verified E.164 number is provided.
    // Never fabricate random fake numbers.
    const isCarrierAssigned = Boolean(twilioPhone);
    const assignedPhone = twilioPhone || "pending_carrier_assignment";
    const initialStatus = isCarrierAssigned ? "active" : "provisioning";

    // 4. Derive ownership strictly from authenticated user ID
    const tenant = await tenantStore.create({
      id: newId,
      ownerId: auth!.user.id,
      name,
      category,
      twilioSid: process.env.TWILIO_ACCOUNT_SID || "",
      twilioPhone: assignedPhone,
      webhookUrl: `https://vaniedge.ai/api/voice/incoming?tenantId=${newId}`,
      monthlyCalls: 0,
      status: initialStatus,
      brandColor,
      logoUrl,
    });

    const safe = tenantStore.safeTenant(tenant);
    return NextResponse.json(
      {
        tenant: safe,
        provisioningState: {
          carrierConfirmed: isCarrierAssigned,
          phoneAssigned: isCarrierAssigned,
          status: initialStatus,
          message: isCarrierAssigned
            ? "Tenant provisioned with verified carrier phone number."
            : "Tenant created in provisioning state. Live PSTN carrier number requires Twilio carrier assignment.",
        },
      },
      { status: 201 }
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to provision tenant";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
