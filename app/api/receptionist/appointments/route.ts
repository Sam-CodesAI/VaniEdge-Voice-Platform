import { NextRequest, NextResponse } from "next/server";
import { appointmentsStore, Appointment } from "@/lib/appointments-store";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const tenantId = searchParams.get("tenantId") || undefined;
    const status = searchParams.get("status") || undefined;

    const appointments = appointmentsStore.list(tenantId, status);
    return NextResponse.json({
      success: true,
      total: appointments.length,
      appointments,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      tenantId?: string;
      callerName?: string;
      callerPhone?: string;
      serviceType?: string;
      scheduledTime?: string;
      durationMinutes?: number;
      notes?: string;
      source?: "voice_call" | "web" | "manual";
      callSid?: string;
    };

    if (!body.callerName || !body.callerPhone || !body.serviceType) {
      return NextResponse.json(
        { error: "callerName, callerPhone, and serviceType are required fields." },
        { status: 400 }
      );
    }

    const appt = await appointmentsStore.create({
      tenantId: body.tenantId || "clinic",
      callerName: body.callerName.trim(),
      callerPhone: body.callerPhone.trim(),
      serviceType: body.serviceType.trim(),
      scheduledTime: body.scheduledTime || new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
      durationMinutes: body.durationMinutes || 30,
      notes: body.notes || "",
      status: "CONFIRMED",
      source: body.source || "manual",
      callSid: body.callSid,
    });

    return NextResponse.json({
      success: true,
      appointment: appt,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      id?: string;
      status?: Appointment["status"];
    };

    if (!body.id || !body.status) {
      return NextResponse.json(
        { error: "id and status are required fields." },
        { status: 400 }
      );
    }

    const updated = await appointmentsStore.updateStatus(body.id, body.status);
    if (!updated) {
      return NextResponse.json({ error: "Appointment not found." }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      appointment: updated,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
