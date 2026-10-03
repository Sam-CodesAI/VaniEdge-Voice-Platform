import { NextRequest, NextResponse } from "next/server";
import { tenantStore } from "@/lib/tenant-store";

export async function GET(req: NextRequest) {
  const tenants = await tenantStore.getAll();
  return NextResponse.json({ tenants });
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { name?: string; category?: string; twilioSid?: string; twilioToken?: string };
    const { name, category, twilioSid, twilioToken } = body;
    
    // Simulate 1-click provisioning
    const newId = `tnt_${Math.random().toString(36).substring(2, 9)}`;
    const phone = `+1 (${Math.floor(200 + Math.random() * 800)}) ${Math.floor(200 + Math.random() * 800)}-${Math.floor(1000 + Math.random() * 9000)}`;
    
    const tenant = await tenantStore.create({
      id: newId,
      name: name || "New Client",
      category: category || "general",
      twilioSid: twilioSid || process.env.TWILIO_ACCOUNT_SID || "",
      twilioPhone: phone,
      webhookUrl: `https://vaniedge.vercel.app/api/webhooks/${newId}`,
      monthlyCalls: 0,
      status: "active",
    });

    return NextResponse.json({ tenant }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: "Failed to provision tenant" }, { status: 500 });
  }
}
