import { supabase } from "@/lib/supabase-client";
import * as crypto from "crypto";

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

export function generateSmsConfirmation(
  category: string,
  callerName: string,
  serviceType: string,
  details: string,
  ticketId: string,
  language: string = "en"
): string {
  const lang = (language || "en").toLowerCase();

  if (lang === "hi") {
    if (category === "clinic") {
      return `[वाणीEdge AI] डॉ. शर्मा क्लिनिक: ${callerName} के लिए अपॉइंटमेंट कन्फर्म। टिकट: ${ticketId}। समय: ${details}।`;
    } else if (category === "restaurant") {
      return `[वाणीEdge AI] भोजनालय: आर्डर कन्फर्म (${serviceType})। टिकट: ${ticketId}। अनुमानित डिलीवरी: 25-35 मिनट।`;
    } else if (category === "retail") {
      return `[वाणीEdge AI] रिटेल सपोर्ट: ${callerName} के लिए अनुरोध दर्ज (${serviceType})। टिकट: ${ticketId}। विवरण: ${details}।`;
    } else if (category === "realestate") {
      return `[वाणीEdge AI] रियल एस्टेट: प्रॉपर्टी विजिट शेड्यूल हुई (${serviceType})। टिकट: ${ticketId}। समय: ${details}।`;
    } else if (category === "finance") {
      return `[वाणीEdge AI] बैंकिंग सेवा: ${callerName} का अनुरोध प्रोसेस हुआ (${serviceType})। टिकट: ${ticketId}।`;
    } else if (category === "hospitality") {
      return `[वाणीEdge AI] होटल रिजर्वेशन: कमरा बुक हुआ (${serviceType})। टिकट: ${ticketId}। विवरण: ${details}।`;
    } else if (category === "general") {
      return `[वाणीEdge AI] ग्राहक सेवा: सहायता टिकट जनरेट हुआ (${serviceType})। टिकट: ${ticketId}।`;
    } else {
      return `[वाणीEdge AI] एपेक्स रेस्क्यू: ${serviceType} के लिए वाहन रवाना। टिकट: ${ticketId}। ईटीए: 18 मिनट।`;
    }
  }

  if (lang === "kn") {
    if (category === "clinic") {
      return `[ವಾಣಿEdge AI] ಡಾ. ಶರ್ಮಾ ಕ್ಲಿನಿಕ್: ${callerName} ಅವರಿಗೆ ಅಪಾಯಿಂಟ್ಮೆಂಟ್ ದೃಢೀಕರಿಸಲಾಗಿದೆ. ಟಿಕೆಟ್: ${ticketId}. ಸಮಯ: ${details}.`;
    } else if (category === "restaurant") {
      return `[ವಾಣಿEdge AI] ಭೋಜನಾಲಯ: ಆರ್ಡರ್ ದೃಢೀಕರಿಸಲಾಗಿದೆ (${serviceType}). ಟಿಕೆಟ್: ${ticketId}. ವಿತರಣೆ ಸಮಯ: 25-35 ನಿಮಿಷಗಳು.`;
    } else if (category === "retail") {
      return `[ವಾಣಿEdge AI] ಚಿಲ್ಲರೆ ಬೆಂಬಲ: ${callerName} ಗಾಗಿ ವಿನಂತಿ ಸ್ವೀಕರಿಸಲಾಗಿದೆ (${serviceType}). ಟಿಕೆಟ್: ${ticketId}.`;
    } else if (category === "realestate") {
      return `[ವಾಣಿEdge AI] ರಿಯಲ್ ಎಸ್ಟೇಟ್: ಆಸ್ತಿ ಭೇಟಿ ನಿಗದಿಪಡಿಸಲಾಗಿದೆ (${serviceType}). ಟಿಕೆಟ್: ${ticketId}.`;
    } else if (category === "finance") {
      return `[ವಾಣಿEdge AI] ಬ್ಯಾಂಕಿಂಗ್ ಸೇವೆ: ${callerName} ಅವರ ವಿನಂತಿ ಪ್ರಕ್ರಿಯೆಯಲ್ಲಿದೆ (${serviceType}). ಟಿಕೆಟ್: ${ticketId}.`;
    } else if (category === "hospitality") {
      return `[ವಾಣಿEdge AI] ಹೋಟೆಲ್ ಮೀಸಲಾತಿ: ಕೊಠಡಿ ಕಾಯ್ದಿರಿಸಲಾಗಿದೆ (${serviceType}). ಟಿಕೆಟ್: ${ticketId}.`;
    } else if (category === "general") {
      return `[ವಾಣಿEdge AI] ಗ್ರಾಹಕ ಸೇವೆ: ಬೆಂಬಲ ಟಿಕೆಟ್ ರಚಿಸಲಾಗಿದೆ (${serviceType}). ಟಿಕೆಟ್: ${ticketId}.`;
    } else {
      return `[ವಾಣಿEdge AI] ಅಪೆಕ್ಸ್ ರೆಸ್ಕ್ಯೂ: ${serviceType} ಗಾಗಿ ರಕ್ಷಣಾ ವಾಹನ ಕಳುಹಿಸಲಾಗಿದೆ. ಟಿಕೆಟ್: ${ticketId}. ಇಟಿಎ: 18 ನಿಮಿಷಗಳು.`;
    }
  }

  if (lang === "es") {
    if (category === "clinic") {
      return `[VaniEdge AI] Cita confirmada para ${callerName} en Clínica Dr. Sharma. Ticket: ${ticketId}. Turno: ${details}.`;
    } else if (category === "restaurant") {
      return `[VaniEdge AI] Restaurante Bhojanalaya: Pedido confirmado (${serviceType}). Ticket: ${ticketId}. Entrega estimada: 25-35 mins.`;
    } else {
      return `[VaniEdge AI] Asistencia en Carretera Apex: Vehículo enviado para ${serviceType}. Ticket: ${ticketId}. ETA: 18 mins.`;
    }
  }

  // English Default
  if (category === "clinic") {
    return `[VaniEdge AI] Appointment confirmed for ${callerName} at Dr. Sharma Clinic. Ticket: ${ticketId}. Slot: ${details}.`;
  } else if (category === "restaurant") {
    return `[VaniEdge AI] Bhojanalaya Kitchen: Order confirmed (${serviceType}). Ticket: ${ticketId}. Estimated delivery: 25-35 mins.`;
  } else if (category === "retail") {
    return `[VaniEdge AI] Prime Retail: Inquiry & Order logged for ${callerName} (${serviceType}). Ticket: ${ticketId}. Details: ${details}.`;
  } else if (category === "realestate") {
    return `[VaniEdge AI] Skyline Realty: Viewing scheduled for ${callerName} (${serviceType}). Ticket: ${ticketId}. Time: ${details}.`;
  } else if (category === "finance") {
    return `[VaniEdge AI] Apex Banking: Request confirmed for ${callerName} (${serviceType}). Ticket: ${ticketId}. Ref: ${details}.`;
  } else if (category === "hospitality") {
    return `[VaniEdge AI] Grand Horizon Hotel: Reservation confirmed for ${callerName} (${serviceType}). Ticket: ${ticketId}. Stay: ${details}.`;
  } else if (category === "general") {
    return `[VaniEdge AI] Enterprise Support: Ticket created for ${callerName} (${serviceType}). Ticket: ${ticketId}. Status: In Progress.`;
  } else {
    return `[VaniEdge AI] Apex Rescue: Recovery vehicle dispatched for ${serviceType}. Ticket: ${ticketId}. ETA: 18 mins.`;
  }
}

export class TicketDispatcher {
  private tickets: Map<string, TicketRecord> = new Map();

  public createTicket(req: TicketRequest): TicketRecord {
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const prefix = req.category.slice(0, 3).toUpperCase();
    const ticketId = `VANI-${prefix}-${randomSuffix}`;
    const timestamp = new Date().toISOString();
    const language = req.language || "en";

    const checksum = generateChecksum(`${ticketId}:${req.callerPhone}:${timestamp}`);
    const smsConfirmation = generateSmsConfirmation(
      req.category,
      req.callerName,
      req.serviceType,
      req.details,
      ticketId,
      language
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
      status: req.priority === "URGENT" ? "ESCALATED" : "CONFIRMED",
      priority: req.priority || "STANDARD",
      language,
      smsConfirmation,
      checksum,
      notes: [],
      metadata: req.metadata,
    };

    this.tickets.set(ticketId, record);

    // Asynchronously try to persist to Supabase if configured and not in test
    if (process.env.NODE_ENV !== "test" && process.env.NEXT_PUBLIC_SUPABASE_URL) {
      Promise.resolve(
        supabase
          .from("dispatch_tickets")
          .insert([{
            tenant_id: record.tenant_id,
            ticket_id: record.ticketId,
            caller_name: record.callerName,
            caller_phone: record.callerPhone,
            category: record.category,
            service_type: record.serviceType,
            details: record.details,
            priority: record.priority,
            language: record.language,
            status: record.status
          }])
      ).catch(() => {});
    }

    return record;
  }

  public getTicket(ticketId: string): TicketRecord | undefined {
    return this.tickets.get(ticketId);
  }

  public updateTicketStatus(ticketId: string, status: TicketStatus, note?: string): boolean {
    const ticket = this.tickets.get(ticketId);
    if (!ticket) return false;

    ticket.status = status;
    if (note) {
      if (!ticket.notes) ticket.notes = [];
      ticket.notes.push(`[${new Date().toISOString()}] ${note}`);
    }

    if (process.env.NODE_ENV !== "test" && process.env.NEXT_PUBLIC_SUPABASE_URL) {
      Promise.resolve(
        supabase
          .from("dispatch_tickets")
          .update({ status })
          .eq("ticket_id", ticketId)
      ).catch(() => {});
    }

    return true;
  }

  public getTicketsByPhone(phone: string): TicketRecord[] {
    const targetNorm = normalizePhone(phone);
    return Array.from(this.tickets.values()).filter(
      (t) => normalizePhone(t.callerPhone) === targetNorm
    );
  }

  public findTickets(filter: { category?: string; status?: string; phone?: string; tenantId?: string }): TicketRecord[] {
    return Array.from(this.tickets.values()).filter((t) => {
      if (filter.category && t.category !== filter.category) return false;
      if (filter.status && t.status !== filter.status) return false;
      if (filter.phone && !phoneMatches(t.callerPhone, filter.phone)) return false;
      if (filter.tenantId && t.tenant_id !== filter.tenantId) return false;
      return true;
    });
  }

  public count(): number {
    return this.tickets.size;
  }

  public listTickets(): TicketRecord[] {
    return Array.from(this.tickets.values());
  }

  public exportSnapshot(): TicketRecord[] {
    return Array.from(this.tickets.values());
  }

  public importSnapshot(records: TicketRecord[]): void {
    this.tickets.clear();
    for (const r of records) {
      this.tickets.set(r.ticketId, r);
    }
  }
}
