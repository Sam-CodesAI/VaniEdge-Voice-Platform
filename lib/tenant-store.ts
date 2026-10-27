import fs from "node:fs";
import path from "node:path";
import { supabase, isSupabaseConfigured } from "./supabase-client";

export interface Tenant {
  id: string;
  ownerId?: string;
  name: string;
  category: string;
  twilioPhone: string;
  twilioSid: string;
  webhookUrl: string;
  monthlyCalls: number;
  status: "active" | "provisioning" | "suspended";
  createdAt: string;
  logoUrl?: string;
  brandColor?: string;
}

export type SafeTenant = Omit<Tenant, "twilioSid"> & {
  twilioConfigured: boolean;
};

export class TenantStore {
  private diskFilePath: string;
  private tenants: Map<string, Tenant> = new Map();
  private isLoaded = false;

  constructor(customPath?: string) {
    this.diskFilePath =
      customPath ||
      path.join(process.cwd(), ".data", "tenants.json");
    this.loadFromDisk();
  }

  private loadFromDisk(): void {
    if (this.isLoaded) return;
    try {
      if (fs.existsSync(this.diskFilePath)) {
        const raw = fs.readFileSync(this.diskFilePath, "utf-8");
        const list = JSON.parse(raw) as Tenant[];
        if (Array.isArray(list)) {
          for (const item of list) {
            this.tenants.set(item.id, item);
          }
        }
      }
    } catch (err) {
      console.warn("[TenantStore] Failed to read disk cache:", err);
    }
    this.isLoaded = true;
  }

  private saveToDisk(): void {
    try {
      const dir = path.dirname(this.diskFilePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(
        this.diskFilePath,
        JSON.stringify(Array.from(this.tenants.values()), null, 2),
        "utf-8"
      );
    } catch (err) {
      console.warn("[TenantStore] Disk write warning:", err);
    }
  }

  public safeTenant(tenant: Tenant): SafeTenant {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { twilioSid, ...safe } = tenant;
    return {
      ...safe,
      twilioConfigured: Boolean(twilioSid && twilioSid.length > 0),
    };
  }

  async create(tenantData: Omit<Tenant, "createdAt">): Promise<Tenant> {
    const tenant: Tenant = {
      ...tenantData,
      createdAt: new Date().toISOString(),
    };

    this.tenants.set(tenant.id, tenant);
    this.saveToDisk();

    if (isSupabaseConfigured) {
      try {
        await supabase.from("tenants").upsert({
          id: tenant.id,
          owner_id: tenant.ownerId || null,
          name: tenant.name,
          category: tenant.category,
          twilio_phone: tenant.twilioPhone,
          twilio_sid: tenant.twilioSid,
          webhook_url: tenant.webhookUrl,
          monthly_calls: tenant.monthlyCalls,
          status: tenant.status,
          logo_url: tenant.logoUrl,
          brand_color: tenant.brandColor,
          created_at: tenant.createdAt,
        }, { onConflict: "id" });
      } catch (err) {
        console.warn("[TenantStore] Supabase persist warning:", err);
      }
    }

    return tenant;
  }

  async getAll(ownerId?: string): Promise<Tenant[]> {
    this.loadFromDisk();

    if (isSupabaseConfigured) {
      try {
        let query = supabase.from("tenants").select("*").order("created_at", { ascending: false });
        if (ownerId) {
          query = query.eq("owner_id", ownerId);
        }
        const { data, error } = await query;
        if (!error && Array.isArray(data)) {
          for (const row of data) {
            const t: Tenant = {
              id: row.id,
              ownerId: row.owner_id || undefined,
              name: row.name,
              category: row.category,
              twilioPhone: row.twilio_phone,
              twilioSid: row.twilio_sid || "",
              webhookUrl: row.webhook_url,
              monthlyCalls: row.monthly_calls || 0,
              status: row.status,
              createdAt: row.created_at,
              logoUrl: row.logo_url || undefined,
              brandColor: row.brand_color || undefined,
            };
            this.tenants.set(t.id, t);
          }
        }
      } catch {
        // Fallback to local map
      }
    }

    const all = Array.from(this.tenants.values());
    if (ownerId) {
      return all.filter((t) => t.ownerId === ownerId);
    }
    return all;
  }

  async get(id: string, ownerId?: string): Promise<Tenant | null> {
    this.loadFromDisk();
    let tenant = this.tenants.get(id);

    if (!tenant && isSupabaseConfigured) {
      try {
        const { data } = await supabase.from("tenants").select("*").eq("id", id).maybeSingle();
        if (data) {
          tenant = {
            id: data.id,
            ownerId: data.owner_id || undefined,
            name: data.name,
            category: data.category,
            twilioPhone: data.twilio_phone,
            twilioSid: data.twilio_sid || "",
            webhookUrl: data.webhook_url,
            monthlyCalls: data.monthly_calls || 0,
            status: data.status,
            createdAt: data.created_at,
            logoUrl: data.logo_url || undefined,
            brandColor: data.brand_color || undefined,
          };
          this.tenants.set(tenant.id, tenant);
        }
      } catch {
        // Ignore
      }
    }

    if (!tenant) return null;

    // Strict tenant isolation: If ownerId specified, verify ownership
    if (ownerId && tenant.ownerId && tenant.ownerId !== ownerId) {
      return null;
    }

    return tenant;
  }

  async update(id: string, updates: Partial<Tenant>, ownerId?: string): Promise<Tenant | null> {
    const existing = await this.get(id, ownerId);
    if (!existing) return null;

    // Disallow mutating core identity fields
    delete updates.id;
    delete updates.ownerId;
    delete updates.createdAt;

    const updated: Tenant = {
      ...existing,
      ...updates,
    };

    this.tenants.set(id, updated);
    this.saveToDisk();

    if (isSupabaseConfigured) {
      try {
        const dbUpdates: Record<string, unknown> = {};
        if (updates.name !== undefined) dbUpdates.name = updates.name;
        if (updates.category !== undefined) dbUpdates.category = updates.category;
        if (updates.logoUrl !== undefined) dbUpdates.logo_url = updates.logoUrl;
        if (updates.brandColor !== undefined) dbUpdates.brand_color = updates.brandColor;
        if (updates.status !== undefined) dbUpdates.status = updates.status;

        await supabase.from("tenants").update(dbUpdates).eq("id", id);
      } catch (err) {
        console.warn("[TenantStore] Supabase update warning:", err);
      }
    }

    return updated;
  }

  async delete(id: string, ownerId?: string): Promise<boolean> {
    const existing = await this.get(id, ownerId);
    if (!existing) return false;

    this.tenants.delete(id);
    this.saveToDisk();

    if (isSupabaseConfigured) {
      try {
        await supabase.from("tenants").delete().eq("id", id);
      } catch (err) {
        console.warn("[TenantStore] Supabase delete warning:", err);
      }
    }

    return true;
  }
}

export const tenantStore = new TenantStore();
