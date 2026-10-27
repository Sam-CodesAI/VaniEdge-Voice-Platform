import { supabase, isSupabaseConfigured } from "@/lib/supabase-client";
import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";

export type TicketPriority = "STANDARD" | "URGENT" | "CRITICAL";
export type TicketStatus = "PENDING" | "CONFIRMED" | "DISPATCHED" | "ESCALATED" | "RESOLVED" | "COMPLETED" | "CANCELLED";
export type SupportedLanguage = "en" | "kn" | "es" | "hi";

export interface TicketRequest {
  callerName: string;
  callerPhone: string;
  category: string;
  serviceType: string;
  details: string;
  priority?: TicketPriority;
  language?: string;
  metadata?: Record<string, string | number | boolean>;
  tenantId?: string;
  isSimulated?: boolean;
}

export interface TicketRecord {
  id?: string;
  tenant_id?: string | null;
  ticketId: string;
  timestamp: string;
  callerName: string;
  callerPhone: string;
  category: string;
  serviceType: string;
  details: string;
  status: TicketStatus;
  priority: TicketPriority;
  language: string;
  smsConfirmation: string;
  checksum: string;
  isSimulated?: boolean;
  notes?: string[];
  metadata?: Record<string, string | number | boolean>;
}

export function generateChecksum(payload: string): string {
  return crypto.createHash("sha256").update(payload).digest("hex").substring(0, 8).toUpperCase();
}

export function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

export function phoneMatches(phone1: string, phone2: string): boolean {
  return normalizePhone(phone1) === normalizePhone(phone2);
}

/**
 * Generates verified, honest SMS confirmations reflecting actual transaction states.
 * Prohibits fabricating fixed arrival times (e.g. "18 mins") or confirmed bookings
 * when the request is actually pending or escalated to a human.
 */
export function generateSmsConfirmation(
  category: string,
  callerName: string,
  serviceType: string,
  details: string,
  ticketId: string,
  language: string = "en",
  status: TicketStatus = "PENDING",
  isSimulated: boolean = false
): string {
  const lang = (language || "en").toLowerCase();
  const simPrefix = isSimulated ? "[DEMO SIMULATION] " : "";

  if (lang === "hi") {
    if (status === "ESCALATED") {
      return `${simPrefix}[वाणीEdge AI] आपातकालीन अनुरोध दर्ज: ${callerName} (${serviceType})। टिकट: ${ticketId}। समन्वयक को कॉल कनेक्ट किया जा रहा है।`;
    }
    if (status === "DISPATCHED") {
      return `${simPrefix}[वाणीEdge AI] सेवा प्रदाता पुष्टि व प्रस्थान: ${callerName} (${serviceType})। टिकट: ${ticketId}।`;
    }
    if (status === "CONFIRMED") {
      return `${simPrefix}[वाणीEdge AI] टिकट ${ticketId}: ${callerName} के लिए ${serviceType} पुष्टि। संदर्भ: ${details || "मानक"}। प्रदाता प्रेषण की प्रतीक्षा में।`;
    }
    return `${simPrefix}[वाणीEdge AI] अनुरोध प्राप्त: ${callerName} (${serviceType})। टिकट: ${ticketId}। समन्वयक पुष्टि प्रक्रियाधीन।`;
  }

  if (lang === "kn") {
    if (status === "ESCALATED") {
      return `${simPrefix}[ವಾಣಿEdge AI] ತುರ್ತು ವಿನಂತಿ ದಾಖಲಾಗಿದೆ: ${callerName} (${serviceType}). ಟಿಕೆಟ್: ${ticketId}. ಮಾನವ ಅಧಿಕಾರಿಗೆ ವರ್ಗಾಯಿಸಲಾಗಿದೆ.`;
    }
    if (status === "DISPATCHED") {
      return `${simPrefix}[ವಾಣಿEdge AI] ಸೇವಾ ಪೂರೈಕೆದಾರರು ದೃಢೀಕರಿಸಿ ಹೊರಟಿದ್ದಾರೆ: ${callerName} (${serviceType}). ಟಿಕೆಟ್: ${ticketId}.`;
    }
    if (status === "CONFIRMED") {
      return `${simPrefix}[ವಾಣಿEdge AI] ವಿನಂತಿ ದೃಢೀಕರಿಸಲಾಗಿದೆ: ${callerName} (${serviceType}). ಟಿಕೆಟ್: ${ticketId}. ನಿಯೋಜನೆ ಬಾಕಿ ಇದೆ.`;
    }
    return `${simPrefix}[ವಾಣಿEdge AI] ವಿನಂತಿ ದಾಖಲಾಗಿದೆ: ${callerName} (${serviceType}). ಟಿಕೆಟ್: ${ticketId}. ದೃಢೀಕರಣ ನಿರೀಕ್ಷೆಯಲ್ಲಿದೆ.`;
  }

  if (lang === "es") {
    if (status === "ESCALATED") {
      return `${simPrefix}[VaniEdge AI] Solicitud prioritaria registrada para ${callerName} (${serviceType}). Ticket: ${ticketId}. Derivando a coordinador de guardia.`;
    }
    if (status === "DISPATCHED") {
      return `${simPrefix}[VaniEdge AI] Proveedor confirmado y despachado para ${callerName} (${serviceType}). Ticket: ${ticketId}.`;
    }
    if (status === "CONFIRMED") {
      return `${simPrefix}[VaniEdge AI] Confirmado: ${callerName} (${serviceType}). Ticket: ${ticketId}. Pendiente de asignación externa.`;
    }
    return `${simPrefix}[VaniEdge AI] Solicitud recibida para ${callerName} (${serviceType}). Ticket: ${ticketId}. Pendiente de confirmación.`;
  }

  // English Default
  if (status === "ESCALATED") {
    return `${simPrefix}[VaniEdge AI] Priority emergency request logged for ${callerName} (${serviceType}). Ticket: ${ticketId}. Transferring directly to human coordinator.`;
  }
  if (status === "DISPATCHED") {
    return `${simPrefix}[VaniEdge AI] External provider confirmed & dispatched for ${callerName} (${serviceType}). Ticket: ${ticketId}.`;
  }
  if (status === "CONFIRMED") {
    return `${simPrefix}[VaniEdge AI] Request confirmed for ${callerName} (${serviceType}). Ticket: ${ticketId}. Details: ${details || "Processed"}. Awaiting provider dispatch.`;
  }
  return `${simPrefix}[VaniEdge AI] Request received for ${callerName} (${serviceType}). Ticket: ${ticketId}. Status: Pending coordinator confirmation.`;
}

export class TicketDispatcher {
  private tickets: Map<string, TicketRecord> = new Map();
  private diskFilePath: string | null = null;
  private isLoaded = false;

  constructor() {
    // Only configure local disk persistence in Node.js environments (fs available)
    if (typeof process !== "undefined" && process.cwd && typeof fs.existsSync === "function") {
      this.diskFilePath = path.join(process.cwd(), ".data", "dispatch_tickets.json");
      this.loadFromDisk();
    }
  }

  private loadFromDisk(): void {
    if (!this.diskFilePath || this.isLoaded) return;
    try {
      if (fs.existsSync(this.diskFilePath)) {
        const raw = fs.readFileSync(this.diskFilePath, "utf-8");
        const list = JSON.parse(raw) as TicketRecord[];
        if (Array.isArray(list)) {
          for (const item of list) {
            this.tickets.set(item.ticketId, item);
          }
        }
      }
    } catch {
      // Ignore
    }
    this.isLoaded = true;
  }

  private saveToDisk(): void {
    if (!this.diskFilePath) return;
    try {
      const dir = path.dirname(this.diskFilePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(
        this.diskFilePath,
        JSON.stringify(Array.from(this.tickets.values()), null, 2),
        "utf-8"
      );
    } catch {
      // Ignore
    }
  }

  public async createTicket(req: TicketRequest): Promise<TicketRecord> {
    this.loadFromDisk();
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const prefix = req.category.slice(0, 3).toUpperCase();
    const ticketId = `VANI-${prefix}-${randomSuffix}`;
    const timestamp = new Date().toISOString();
    const language = req.language || "en";

    // Accurate status mapping: URGENT / CRITICAL -> ESCALATED, otherwise PENDING
    const status: TicketStatus =
      req.priority === "URGENT" || req.priority === "CRITICAL" ? "ESCALATED" : "PENDING";

    const checksum = generateChecksum(`${ticketId}:${req.callerPhone}:${timestamp}`);
    const smsConfirmation = generateSmsConfirmation(
      req.category,
      req.callerName,
      req.serviceType,
      req.details,
      ticketId,
      language,
      status,
      Boolean(req.isSimulated)
    );

    const record: TicketRecord = {
      tenant_id: req.tenantId || null,
      ticketId,
      timestamp,
      callerName: req.callerName,
      callerPhone: req.callerPhone,
      category: req.category,
      serviceType: req.serviceType,
      details: req.details,
      status,
      priority: req.priority || "STANDARD",
      language,
      smsConfirmation,
      checksum,
      isSimulated: Boolean(req.isSimulated),
      notes: [],
      metadata: req.metadata,
    };

    this.tickets.set(ticketId, record);
    this.saveToDisk();

    // Persist to Supabase if configured and await write
    if (isSupabaseConfigured) {
      try {
        const { error } = await supabase.from("dispatch_tickets").insert([
          {
            tenant_id: record.tenant_id,
            ticket_id: record.ticketId,
            caller_name: record.callerName,
            caller_phone: record.callerPhone,
            category: record.category,
            service_type: record.serviceType,
            details: record.details,
            priority: record.priority,
            language: record.language,
            status: record.status,
            sms_confirmation: record.smsConfirmation,
            checksum: record.checksum,
            is_simulated: record.isSimulated,
            metadata: record.metadata,
          },
        ]);

        if (error) {
          console.error(`[TicketDispatcher] Database insert failed for ticket ${ticketId}:`, error.message);
          if (process.env.NODE_ENV === "production" && process.env.ALLOW_LOCAL_DISK_FALLBACK !== "true") {
            this.tickets.delete(ticketId);
            this.saveToDisk();
            throw new Error(`Failed to persist dispatch ticket to durable database: ${error.message}`);
          }
        }
      } catch (dbErr) {
        console.error(`[TicketDispatcher] Supabase exception on ticket insert:`, dbErr);
        if (process.env.NODE_ENV === "production" && process.env.ALLOW_LOCAL_DISK_FALLBACK !== "true") {
          this.tickets.delete(ticketId);
          this.saveToDisk();
          throw dbErr;
        }
      }
    } else if (process.env.NODE_ENV === "production" && process.env.ALLOW_LOCAL_DISK_FALLBACK !== "true") {
      this.tickets.delete(ticketId);
      this.saveToDisk();
      throw new Error("Durable database persistence is unconfigured in production");
    }

    return record;
  }

  public getTicket(ticketId: string): TicketRecord | undefined {
    this.loadFromDisk();
    return this.tickets.get(ticketId);
  }

  public async updateTicketStatus(ticketId: string, status: TicketStatus, note?: string): Promise<boolean> {
    this.loadFromDisk();
    const ticket = this.tickets.get(ticketId);
    if (!ticket) return false;

    ticket.status = status;
    if (note) {
      if (!ticket.notes) ticket.notes = [];
      ticket.notes.push(`[${new Date().toISOString()}] ${note}`);
    }

    this.saveToDisk();

    if (isSupabaseConfigured) {
      try {
        const { error } = await supabase
          .from("dispatch_tickets")
          .update({ status, notes: ticket.notes, updated_at: new Date().toISOString() })
          .eq("ticket_id", ticketId);

        if (error) {
          console.error(`[TicketDispatcher] Database status update failed for ticket ${ticketId}:`, error.message);
        }
      } catch (dbErr) {
        console.error(`[TicketDispatcher] Supabase exception on status update:`, dbErr);
      }
    }

    return true;
  }

  public getTicketsByPhone(phone: string): TicketRecord[] {
    this.loadFromDisk();
    const targetNorm = normalizePhone(phone);
    return Array.from(this.tickets.values()).filter(
      (t) => normalizePhone(t.callerPhone) === targetNorm
    );
  }

  public findTickets(filter: { category?: string; status?: string; phone?: string; tenantId?: string }): TicketRecord[] {
    this.loadFromDisk();
    return Array.from(this.tickets.values()).filter((t) => {
      if (filter.category && t.category !== filter.category) return false;
      if (filter.status && t.status !== filter.status) return false;
      if (filter.phone && !phoneMatches(t.callerPhone, filter.phone)) return false;
      if (filter.tenantId && t.tenant_id !== filter.tenantId) return false;
      return true;
    });
  }

  public count(): number {
    this.loadFromDisk();
    return this.tickets.size;
  }

  public listTickets(): TicketRecord[] {
    this.loadFromDisk();
    return Array.from(this.tickets.values());
  }

  public exportSnapshot(): TicketRecord[] {
    this.loadFromDisk();
    return Array.from(this.tickets.values());
  }

  public importSnapshot(records: TicketRecord[]): void {
    this.tickets.clear();
    for (const r of records) {
      this.tickets.set(r.ticketId, r);
    }
    this.saveToDisk();
  }
}
