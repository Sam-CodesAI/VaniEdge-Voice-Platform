import { NextRequest, NextResponse } from "next/server";
import { TicketDispatcher } from "@/src/dispatch/tickets";
import { requireAuth } from "@/lib/auth-guard";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { isTenantOwnedByUser } from "@/lib/tenant-store";
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

  // 2. Tenant isolation: verify caller has access to the requested tenant
  const userRole = auth!.user.role || "user";
  const hasAccess = await isTenantOwnedByUser(requestedTenantId, auth!.user.id, userRole);
  if (!hasAccess) {
    return NextResponse.json(
      { error: "Forbidden: Cannot access tickets for another tenant" },
      { status: 403 }
    );
  }

  const effectiveTenantId = requestedTenantId || (userRole === "admin" ? undefined : auth!.user.id);

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

    // 2. Enforce strict authentication & CSRF check
    const { auth, errorResponse } = await requireAuth(req, { checkCsrf: true });
    if (errorResponse) {
      return errorResponse;
    }

    // 3. Validate input schema
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

    // 4. Enforce tenant ownership: non-admin callers cannot create tickets under another tenant ID
    const userRole = auth!.user.role || "user";
    const hasAccess = await isTenantOwnedByUser(bodyTenantId, auth!.user.id, userRole);
    if (!hasAccess) {
      return NextResponse.json(
        { error: "Forbidden: Cannot dispatch tickets for another tenant" },
        { status: 403 }
      );
    }

    const effectiveTenantId = bodyTenantId || auth!.user.id;

    // 5. Await durable ticket creation in persistent storage
    const record = await dispatcher.createTicket({
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

    // 6. Honest state response: distinguish created vs dispatched states
    return NextResponse.json(
      {
        success: true,
        state: record.status.toLowerCase(),
        dispatched: false,
        externalProviderConfirmed: false,
        ticket: record,
        message:
          record.status === "ESCALATED"
            ? "Emergency request logged and escalated to human operator."
            : "Ticket created in durable storage. Awaiting external provider dispatch confirmation.",
      },
      { status: 201 }
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Dispatch failed";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
