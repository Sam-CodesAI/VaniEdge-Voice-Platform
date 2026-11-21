import { NextRequest, NextResponse } from "next/server";
import { appointmentsStore, Appointment } from "@/lib/appointments-store";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { getOptionalAuth } from "@/lib/auth-guard";
import { isTenantOwnedByUser } from "@/lib/tenant-store";
import { z } from "zod";

export const dynamic = "force-dynamic";

const CreateAppointmentSchema = z.object({
  callerName: z.string().trim().min(1, "Name is required").max(100, "Name too long"),
  callerPhone: z.string().trim().min(7, "Invalid phone number").max(20, "Phone too long"),
  serviceType: z.string().trim().min(1, "Service type is required").max(100, "Service type too long"),
  tenantId: z.string().trim().max(50).default("clinic"),
  scheduledTime: z.string().datetime().optional(),
  durationMinutes: z.number().int().min(5).max(480).default(30),
  notes: z.string().max(500).default(""),
  source: z.enum(["voice_call", "web", "manual"]).default("manual"),
  callSid: z.string().max(100).optional(),
});

const UpdateAppointmentSchema = z.object({
  id: z.string().min(1, "Appointment ID required").max(100),
  status: z.enum(["PENDING", "CONFIRMED", "COMPLETED", "CANCELLED", "RESCHEDULED"]),
});

function maskPhoneNumber(phone: string): string {
  if (!phone || phone.length < 6) return "***";
  const visiblePrefix = phone.slice(0, 5);
  const visibleSuffix = phone.slice(-3);
  return `${visiblePrefix}****${visibleSuffix}`;
}

export async function GET(req: NextRequest) {
  try {
    const clientIp = getClientIp(req);
    const rateCheck = checkRateLimit(clientIp, "appointments_read", 40, 60 * 1000);
    if (!rateCheck.success) {
      return NextResponse.json(
        {
          type: "https://vaniedge.ai/errors/rate-limit-exceeded",
          title: "Too Many Requests",
          status: 429,
          detail: "Too many appointment read requests. Please slow down.",
          instance: req.nextUrl.pathname,
        },
        { status: 429 }
      );
    }

    const authCtx = await getOptionalAuth(req);
    const { searchParams } = new URL(req.url);
    const requestedTenantId = searchParams.get("tenantId") || "clinic";
    const status = searchParams.get("status") || undefined;

    // Verify tenant ownership if authenticated
    let isOwner = false;
    if (authCtx?.user) {
      isOwner = await isTenantOwnedByUser(
        requestedTenantId,
        authCtx.user.id,
        authCtx.user.role || "user"
      );
    }

    const rawList = appointmentsStore.list(requestedTenantId, status);

    // Mask PII for public demo / unauthenticated viewers
    const sanitizedAppointments = rawList.map((appt) => ({
      ...appt,
      callerPhone: isOwner ? appt.callerPhone : maskPhoneNumber(appt.callerPhone),
      notes: isOwner ? appt.notes : (appt.notes ? "[Protected Medical Note]" : ""),
    }));

    return NextResponse.json({
      success: true,
      total: sanitizedAppointments.length,
      appointments: sanitizedAppointments,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      {
        type: "https://vaniedge.ai/errors/internal-error",
        title: "Internal Server Error",
        status: 500,
        detail: errorMsg,
        instance: req.nextUrl.pathname,
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const clientIp = getClientIp(req);
    const rateCheck = checkRateLimit(clientIp, "appointments_write", 15, 60 * 1000);
    if (!rateCheck.success) {
      return NextResponse.json(
        {
          type: "https://vaniedge.ai/errors/rate-limit-exceeded",
          title: "Too Many Requests",
          status: 429,
          detail: "Too many appointment booking requests. Please wait a moment.",
          instance: req.nextUrl.pathname,
        },
        { status: 429 }
      );
    }

    const rawBody = (await req.json()) as unknown;
    const parsed = CreateAppointmentSchema.safeParse(rawBody);

    if (!parsed.success) {
      return NextResponse.json(
        {
          type: "https://vaniedge.ai/errors/validation-failed",
          title: "Invalid Appointment Payload",
          status: 400,
          detail: "The appointment payload failed validation.",
          invalidParams: parsed.error.format(),
          instance: req.nextUrl.pathname,
        },
        { status: 400 }
      );
    }

    const {
      callerName,
      callerPhone,
      serviceType,
      tenantId,
      scheduledTime,
      durationMinutes,
      notes,
      source,
      callSid,
    } = parsed.data;

    const appt = await appointmentsStore.create({
      tenantId,
      callerName,
      callerPhone,
      serviceType,
      scheduledTime: scheduledTime || new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
      durationMinutes,
      notes,
      status: "CONFIRMED",
      source,
      callSid,
    });

    return NextResponse.json(
      {
        success: true,
        appointment: appt,
      },
      { status: 201 }
    );
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      {
        type: "https://vaniedge.ai/errors/internal-error",
        title: "Internal Server Error",
        status: 500,
        detail: errorMsg,
        instance: req.nextUrl.pathname,
      },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const clientIp = getClientIp(req);
    const rateCheck = checkRateLimit(clientIp, "appointments_patch", 20, 60 * 1000);
    if (!rateCheck.success) {
      return NextResponse.json(
        {
          type: "https://vaniedge.ai/errors/rate-limit-exceeded",
          title: "Too Many Requests",
          status: 429,
          detail: "Rate limit exceeded.",
          instance: req.nextUrl.pathname,
        },
        { status: 429 }
      );
    }

    const rawBody = (await req.json()) as unknown;
    const parsed = UpdateAppointmentSchema.safeParse(rawBody);

    if (!parsed.success) {
      return NextResponse.json(
        {
          type: "https://vaniedge.ai/errors/validation-failed",
          title: "Invalid Status Update",
          status: 400,
          detail: "Valid appointment ID and status are required.",
          instance: req.nextUrl.pathname,
        },
        { status: 400 }
      );
    }

    const { id, status } = parsed.data;

    const updated = await appointmentsStore.updateStatus(id, status);
    if (!updated) {
      return NextResponse.json(
        {
          type: "https://vaniedge.ai/errors/appointment-not-found",
          title: "Appointment Not Found",
          status: 404,
          detail: `No appointment found with ID: ${id}`,
          instance: req.nextUrl.pathname,
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      appointment: updated,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      {
        type: "https://vaniedge.ai/errors/internal-error",
        title: "Internal Server Error",
        status: 500,
        detail: errorMsg,
        instance: req.nextUrl.pathname,
      },
      { status: 500 }
    );
  }
}
