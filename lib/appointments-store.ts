import fs from "node:fs";
import path from "node:path";
import { supabase, isSupabaseConfigured } from "./supabase-client";

export interface Appointment {
  id: string;
  tenantId: string;
  callerName: string;
  callerPhone: string;
  serviceType: string;
  scheduledTime: string; // ISO string e.g. "2026-11-21T10:00:00Z"
  durationMinutes?: number;
  notes?: string;
  status: "PENDING" | "CONFIRMED" | "COMPLETED" | "CANCELLED" | "RESCHEDULED";
  source: "voice_call" | "web" | "manual";
  callSid?: string;
  createdAt: string;
  updatedAt: string;
}

const PRE_SEEDED_APPOINTMENTS: Appointment[] = [
  {
    id: "appt_careplus_01",
    tenantId: "clinic",
    callerName: "Vikram Patil",
    callerPhone: "+91 98765 43210",
    serviceType: "General Physician Consultation",
    scheduledTime: new Date(Date.now() + 2 * 3600 * 1000).toISOString(),
    durationMinutes: 30,
    notes: "Follow-up consultation for seasonal viral checkup.",
    status: "CONFIRMED",
    source: "voice_call",
    callSid: "CA_sample_01",
    createdAt: new Date(Date.now() - 3600 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 3600 * 1000).toISOString(),
  },
  {
    id: "appt_careplus_02",
    tenantId: "clinic",
    callerName: "Ananya Sharma",
    callerPhone: "+91 99887 76655",
    serviceType: "Pediatric Wellness Checkup",
    scheduledTime: new Date(Date.now() + 5 * 3600 * 1000).toISOString(),
    durationMinutes: 45,
    notes: "Child vaccination and growth chart review.",
    status: "PENDING",
    source: "voice_call",
    callSid: "CA_sample_02",
    createdAt: new Date(Date.now() - 1800 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 1800 * 1000).toISOString(),
  },
  {
    id: "appt_apex_01",
    tenantId: "apex-hvac",
    callerName: "David Miller",
    callerPhone: "+1 (303) 555-0199",
    serviceType: "Furnace Safety Inspection & Tune-Up",
    scheduledTime: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
    durationMinutes: 60,
    notes: "Annual seasonal 21-point heat exchanger inspection.",
    status: "CONFIRMED",
    source: "voice_call",
    callSid: "CA_sample_03",
    createdAt: new Date(Date.now() - 7200 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 7200 * 1000).toISOString(),
  },
];

export class AppointmentsStore {
  private diskFilePath: string;
  private appointments: Map<string, Appointment> = new Map();
  private isLoaded = false;

  constructor(customPath?: string) {
    this.diskFilePath = customPath || path.join(process.cwd(), ".data", "appointments.json");
    this.loadFromDisk();
  }

  private loadFromDisk(): void {
    if (this.isLoaded) return;
    try {
      if (fs.existsSync(this.diskFilePath)) {
        const raw = fs.readFileSync(this.diskFilePath, "utf-8");
        const list = JSON.parse(raw) as Appointment[];
        if (Array.isArray(list)) {
          for (const item of list) {
            this.appointments.set(item.id, item);
          }
        }
      } else {
        // Pre-seed demo appointments
        for (const item of PRE_SEEDED_APPOINTMENTS) {
          this.appointments.set(item.id, item);
        }
        this.saveToDisk();
      }
    } catch (err) {
      console.warn("[AppointmentsStore] Failed to read disk file:", err);
    }
    this.isLoaded = true;
  }

  private saveToDisk(): void {
    try {
      const dir = path.dirname(this.diskFilePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const list = Array.from(this.appointments.values());
      fs.writeFileSync(this.diskFilePath, JSON.stringify(list, null, 2), "utf-8");
    } catch (err) {
      console.warn("[AppointmentsStore] Failed to write disk file:", err);
    }
  }

  public list(tenantId?: string, status?: string): Appointment[] {
    this.loadFromDisk();
    let items = Array.from(this.appointments.values());
    if (tenantId && tenantId !== "all") {
      items = items.filter((a) => a.tenantId === tenantId);
    }
    if (status && status !== "all") {
      items = items.filter((a) => a.status.toLowerCase() === status.toLowerCase());
    }
    return items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  public getById(id: string): Appointment | undefined {
    this.loadFromDisk();
    return this.appointments.get(id);
  }

  public async create(data: Omit<Appointment, "id" | "createdAt" | "updatedAt">): Promise<Appointment> {
    this.loadFromDisk();
    const id = `appt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();
    const record: Appointment = {
      ...data,
      id,
      createdAt: now,
      updatedAt: now,
    };

    this.appointments.set(id, record);
    this.saveToDisk();

    if (isSupabaseConfigured) {
      try {
        await supabase.from("appointments").insert([
          {
            id: record.id,
            tenant_id: record.tenantId,
            caller_name: record.callerName,
            caller_phone: record.callerPhone,
            service_type: record.serviceType,
            scheduled_time: record.scheduledTime,
            duration_minutes: record.durationMinutes || 30,
            notes: record.notes || "",
            status: record.status,
            source: record.source,
            call_sid: record.callSid || null,
            created_at: record.createdAt,
            updated_at: record.updatedAt,
          },
        ]);
      } catch (err) {
        console.warn("[AppointmentsStore] Supabase insert fallback:", err);
      }
    }

    return record;
  }

  public async updateStatus(id: string, status: Appointment["status"]): Promise<Appointment | null> {
    this.loadFromDisk();
    const existing = this.appointments.get(id);
    if (!existing) return null;

    const updated: Appointment = {
      ...existing,
      status,
      updatedAt: new Date().toISOString(),
    };

    this.appointments.set(id, updated);
    this.saveToDisk();

    if (isSupabaseConfigured) {
      try {
        await supabase.from("appointments").update({ status, updated_at: updated.updatedAt }).eq("id", id);
      } catch (err) {
        console.warn("[AppointmentsStore] Supabase update fallback:", err);
      }
    }

    return updated;
  }
}

export const appointmentsStore = new AppointmentsStore();
