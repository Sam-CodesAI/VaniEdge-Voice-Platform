import { NextRequest, NextResponse } from "next/server";
import { TicketDispatcher } from "@/src/dispatch/tickets";
import { requireAuth } from "@/lib/auth-guard";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { z } from "zod";

export const dynamic = "force-dynamic";

const dispatcher = new TicketDispatcher();

const CreateTicketSchema = z.object({
  callerName: z.string().min(1).max(100),
  callerPhone: z.string().min(3).max(50),
  category: z.string().min(1).max(50).default("general"),
  serviceType: z.string().min(1).max(100).default("Inbound Query"),
  details: z.string().max(1000).default(""),
  priority: z.enum(["STANDARD", "URGENT", "CRITICAL"]).default("STANDARD"),
  language: z.string().max(10).default("en"),
  tenantId: z.string().max(50).optional(),
  isSimulated: z.boolean().optional(),
});

export async function GET(req: NextRequest) {
  // 1. Enforce authentication for ticket reads
  const { auth, errorResponse } = await requireAuth(req);
  if (errorResponse) {
    return errorResponse;
  }

  const { searchParams } = new URL(req.url);
  const filter = searchParams.get("filter") || "all";
  const requestedTenantId = searchParams.get("tenantId") || undefined;

  // 2. Tenant isolation: regular users can only read tickets for their own tenant
  const isSuperAdmin = auth!.user.role === "admin";
  const effectiveTenantId = isSuperAdmin ? requestedTenantId : auth!.user.id;

  let records = [];
  if (filter === "all") {
    records = dispatcher.findTickets({ tenantId: effectiveTenantId });
  } else {
    records = dispatcher.findTickets({ category: filter, tenantId: effectiveTenantId });
  }

  return NextResponse.json({ tickets: records });
}

export async function POST(req: NextRequest) {
  try {
    // 1. Rate limiting: 15 dispatches per 60 seconds per IP
    const clientIp = getClientIp(req);
    const rateCheck = checkRateLimit(clientIp, "dispatch", 15, 60 * 1000);
    if (!rateCheck.success) {
      return NextResponse.json(
        { error: "Too many dispatch requests. Please slow down." },
        {
          status: 429,
          headers: {
            "Retry-After": Math.ceil(rateCheck.resetMs / 1000).toString(),
          },
        }
      );
    }

    // 2. Validate input schema
    const rawBody = (await req.json()) as unknown;
    const parsed = CreateTicketSchema.safeParse(rawBody);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const {
      callerName,
      callerPhone,
      category,
      serviceType,
      details,
      priority,
      language,
      tenantId: bodyTenantId,
      isSimulated,
    } = parsed.data;

    // Optional auth context attachment
    const { auth } = await requireAuth(req).catch(() => ({ auth: undefined }));
    const effectiveTenantId = auth?.user?.id || bodyTenantId || null;

    const record = dispatcher.createTicket({
      callerName,
      callerPhone,
      category,
      serviceType,
      details,
      priority,
      language,
      tenantId: effectiveTenantId || undefined,
      isSimulated,
    });

    return NextResponse.json({ success: true, ticket: record }, { status: 201 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Dispatch failed";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
