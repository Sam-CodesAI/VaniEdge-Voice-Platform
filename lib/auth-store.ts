/**
 * VaniEdge Voice Platform
 * Durable Authentication, Scrypt Password Hashing, and Revocable Sessions
 * 
 * - Zero hardcoded demo accounts in production
 * - Memory-hard scrypt password hashing with constant-time verification
 * - Persistent database backing (Supabase PostgreSQL + resilient local disk fallback)
 * - Cryptographically secure, revocable session lifecycle management
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { supabase, isSupabaseConfigured } from "./supabase-client";

export interface UserCredentials {
  apiKey: string;
  webhookSecret: string;
  sipEndpoint: string;
  sipUsername: string;
  sipPassword: string;
  assignedPhoneNumber: string;
}

export interface UserRecord {
  id: string;
  email: string;
  passwordHash: string;
  salt: string;
  name: string;
  company: string;
  provider: "email";
  avatarUrl?: string;
  tier: "Free Trial" | "Starter" | "Growth" | "Enterprise";
  role?: "user" | "agency_admin" | "admin";
  credentials: UserCredentials;
  voiceMinutesTotal: number;
  voiceMinutesUsed: number;
  createdAt: string;
  lastLoginAt: string;
}

export interface SessionRecord {
  token: string;
  userId: string;
  createdAt: string;
  expiresAt: number;
  revoked: boolean;
  revokedAt?: string;
  lastActiveAt?: string;
}

// Convert bytes to hex string
function toHex(buf: unknown): string {
  const u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf as ArrayBuffer);
  let hex = "";
  for (let i = 0; i < u8.length; i++) {
    hex += u8[i].toString(16).padStart(2, "0");
  }
  return hex;
}

// Secure scrypt password hashing (OWASP standard, memory-hard)
export function hashPassword(password: string, salt: string): string {
  const normalized = password.normalize("NFKC");
  return crypto
    .scryptSync(normalized, salt, 64, {
      N: 16384,
      r: 8,
      p: 1,
      maxmem: 32 * 1024 * 1024,
    })
    .toString("hex");
}

// Constant-time timing-safe password comparison
export function verifyPassword(password: string, salt: string, storedHash: string): boolean {
  try {
    const computedHash = hashPassword(password, salt);
    const bufA = Buffer.from(computedHash, "hex");
    const bufB = Buffer.from(storedHash, "hex");

    if (bufA.length !== bufB.length) {
      return false;
    }

    return crypto.timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

interface SerializedAuthStore {
  users: UserRecord[];
  sessions: SessionRecord[];
}

export class DurableAuthDatabase {
  private users: Map<string, UserRecord> = new Map();
  private usersByEmail: Map<string, string> = new Map();
  private usersByApiKey: Map<string, string> = new Map();
  private sessions: Map<string, SessionRecord> = new Map();

  private diskFilePath: string;
  private isLoaded = false;

  constructor() {
    // Determine durable local storage path for dev / serverless instance restarts
    const baseDir = process.env.VANIEDGE_DATA_DIR || path.join(process.cwd(), ".data");
    this.diskFilePath = path.join(baseDir, "vaniedge_auth_store.json");
    this.loadFromDisk();
  }

  private loadFromDisk(): void {
    if (this.isLoaded) return;
    try {
      if (fs.existsSync(this.diskFilePath)) {
        const raw = fs.readFileSync(this.diskFilePath, "utf-8");
        const parsed = JSON.parse(raw) as SerializedAuthStore;

        if (Array.isArray(parsed.users)) {
          for (const user of parsed.users) {
            this.users.set(user.id, user);
            this.usersByEmail.set(user.email.toLowerCase(), user.id);
            if (user.credentials?.apiKey) {
              this.usersByApiKey.set(user.credentials.apiKey, user.id);
            }
          }
        }

        if (Array.isArray(parsed.sessions)) {
          for (const session of parsed.sessions) {
            this.sessions.set(session.token, session);
          }
        }
      }
    } catch (err) {
      console.warn("[AuthDatabase] Failed to read disk auth cache:", err);
    }
    this.isLoaded = true;
  }

  private saveToDisk(): void {
    try {
      const dir = path.dirname(this.diskFilePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      const payload: SerializedAuthStore = {
        users: Array.from(this.users.values()),
        sessions: Array.from(this.sessions.values()),
      };

      fs.writeFileSync(this.diskFilePath, JSON.stringify(payload, null, 2), "utf-8");
    } catch (err) {
      // In read-only serverless filesystems without write permission, log warning
      console.warn("[AuthDatabase] Could not write to local disk auth store:", err);
    }
  }

  public generateCredentials(userId: string, email: string): UserCredentials {
    const keySuffix = toHex(crypto.randomBytes(16));
    const secretSuffix = toHex(crypto.randomBytes(24));
    const sipPass = toHex(crypto.randomBytes(12));
    const shortId = userId.slice(0, 8);

    return {
      apiKey: `ve_live_${keySuffix}`,
      webhookSecret: `whsec_${secretSuffix}`,
      sipEndpoint: "sip:blr-edge.vaniedge.ai:5060",
      sipUsername: `ve_${shortId}`,
      sipPassword: `sip_${sipPass}`,
      assignedPhoneNumber: "+91 80 4736 1284",
    };
  }

  // ============================================================================
  // DATABASE PERSISTENCE HELPERS (SUPABASE)
  // ============================================================================

  private async persistUserToSupabase(user: UserRecord): Promise<void> {
    if (!isSupabaseConfigured) return;

    try {
      // 1. Try dedicated vaniedge_users table
      const { error } = await supabase.from("vaniedge_users").upsert(
        {
          id: user.id,
          email: user.email.toLowerCase(),
          password_hash: user.passwordHash,
          salt: user.salt,
          name: user.name,
          company: user.company,
          provider: user.provider,
          avatar_url: user.avatarUrl || null,
          tier: user.tier,
          credentials: user.credentials,
          voice_minutes_total: user.voiceMinutesTotal,
          voice_minutes_used: user.voiceMinutesUsed,
          created_at: user.createdAt,
          last_login_at: user.lastLoginAt,
        },
        { onConflict: "id" }
      );

      if (error) {
        // Fallback to site_settings KV row if table does not exist
        await supabase.from("site_settings").upsert(
          {
            key: `auth_user_${user.id}`,
            value: user,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "key" }
        );
      }
    } catch (err) {
      console.warn("[AuthDatabase] Supabase user persist warning:", err);
    }
  }

  private async persistSessionToSupabase(session: SessionRecord): Promise<void> {
    if (!isSupabaseConfigured) return;

    try {
      // 1. Try dedicated vaniedge_sessions table
      const { error } = await supabase.from("vaniedge_sessions").upsert(
        {
          token: session.token,
          user_id: session.userId,
          created_at: session.createdAt,
          expires_at: session.expiresAt,
          revoked: session.revoked,
          revoked_at: session.revokedAt || null,
          last_active_at: session.lastActiveAt || new Date().toISOString(),
        },
        { onConflict: "token" }
      );

      if (error) {
        // Fallback to site_settings KV row
        await supabase.from("site_settings").upsert(
          {
            key: `auth_session_${session.token}`,
            value: session,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "key" }
        );
      }
    } catch (err) {
      console.warn("[AuthDatabase] Supabase session persist warning:", err);
    }
  }

  private async fetchUserFromDatabase(userId: string): Promise<UserRecord | null> {
    if (!isSupabaseConfigured) return null;

    try {
      const { data, error } = await supabase
        .from("vaniedge_users")
        .select("*")
        .eq("id", userId)
        .maybeSingle();

      if (!error && data) {
        return {
          id: data.id,
          email: data.email,
          passwordHash: data.password_hash,
          salt: data.salt,
          name: data.name,
          company: data.company,
          provider: data.provider,
          avatarUrl: data.avatar_url || undefined,
          tier: data.tier,
          credentials: data.credentials,
          voiceMinutesTotal: data.voice_minutes_total,
          voiceMinutesUsed: data.voice_minutes_used,
          createdAt: data.created_at,
          lastLoginAt: data.last_login_at,
        };
      }

      // Check site_settings fallback
      const { data: kvData } = await supabase
        .from("site_settings")
        .select("value")
        .eq("key", `auth_user_${userId}`)
        .maybeSingle();

      if (kvData?.value) {
        return kvData.value as UserRecord;
      }
    } catch {
      // Graceful fallback to local cache
    }
    return null;
  }

  private async fetchUserByEmailFromDatabase(email: string): Promise<UserRecord | null> {
    if (!isSupabaseConfigured) return null;

    try {
      const { data, error } = await supabase
        .from("vaniedge_users")
        .select("*")
        .eq("email", email.toLowerCase())
        .maybeSingle();

      if (!error && data) {
        return {
          id: data.id,
          email: data.email,
          passwordHash: data.password_hash,
          salt: data.salt,
          name: data.name,
          company: data.company,
          provider: data.provider,
          avatarUrl: data.avatar_url || undefined,
          tier: data.tier,
          credentials: data.credentials,
          voiceMinutesTotal: data.voice_minutes_total,
          voiceMinutesUsed: data.voice_minutes_used,
          createdAt: data.created_at,
          lastLoginAt: data.last_login_at,
        };
      }
    } catch {
      // Ignore
    }
    return null;
  }

  private async fetchSessionFromDatabase(token: string): Promise<SessionRecord | null> {
    if (!isSupabaseConfigured) return null;

    try {
      const { data, error } = await supabase
        .from("vaniedge_sessions")
        .select("*")
        .eq("token", token)
        .maybeSingle();

      if (!error && data) {
        return {
          token: data.token,
          userId: data.user_id,
          createdAt: data.created_at,
          expiresAt: Number(data.expires_at),
          revoked: Boolean(data.revoked),
          revokedAt: data.revoked_at || undefined,
          lastActiveAt: data.last_active_at || undefined,
        };
      }

      // Fallback check in site_settings
      const { data: kvData } = await supabase
        .from("site_settings")
        .select("value")
        .eq("key", `auth_session_${token}`)
        .maybeSingle();

      if (kvData?.value) {
        return kvData.value as SessionRecord;
      }
    } catch {
      // Ignore
    }
    return null;
  }

  // ============================================================================
  // CORE AUTHENTICATION OPERATIONS
  // ============================================================================

  public async register(
    name: string,
    email: string,
    password?: string,
    company: string = "Independent Developer",
    provider: "email" = "email",
    avatarUrl?: string
  ): Promise<{ user: UserRecord; token: string }> {
    const normalizedEmail = email.trim().toLowerCase();

    if (password && (password.length < 8 || password.length > 128)) {
      throw new Error("Password must be between 8 and 128 characters long.");
    }

    // Check memory or cloud database for existing email
    if (this.usersByEmail.has(normalizedEmail)) {
      throw new Error("An account with this email address already exists.");
    }
    const dbUser = await this.fetchUserByEmailFromDatabase(normalizedEmail);
    if (dbUser) {
      throw new Error("An account with this email address already exists.");
    }

    // 32-byte high-entropy salt
    const salt = toHex(crypto.randomBytes(32));
    const passwordHash = password ? hashPassword(password, salt) : "";
    const id = `usr_${toHex(crypto.randomBytes(8))}`;
    const credentials = this.generateCredentials(id, normalizedEmail);

    const user: UserRecord = {
      id,
      email: normalizedEmail,
      passwordHash,
      salt,
      name: name.trim(),
      company: company.trim() || "Independent Developer",
      provider,
      avatarUrl,
      tier: "Starter",
      role: "user",
      credentials,
      voiceMinutesTotal: 500,
      voiceMinutesUsed: 0,
      createdAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
    };

    // Cache locally
    this.users.set(id, user);
    this.usersByEmail.set(normalizedEmail, id);
    this.usersByApiKey.set(credentials.apiKey, id);
    this.saveToDisk();

    // Persist to cloud database
    await this.persistUserToSupabase(user);

    const token = await this.createSession(id);
    return { user, token };
  }

  public async authenticate(email: string, password: string): Promise<{ user: UserRecord; token: string }> {
    const normalizedEmail = email.trim().toLowerCase();
    let userId = this.usersByEmail.get(normalizedEmail);
    let user = userId ? this.users.get(userId) : null;

    if (!user) {
      // Check cloud database
      user = await this.fetchUserByEmailFromDatabase(normalizedEmail);
      if (user) {
        userId = user.id;
        this.users.set(user.id, user);
        this.usersByEmail.set(normalizedEmail, user.id);
        this.usersByApiKey.set(user.credentials.apiKey, user.id);
      }
    }

    if (!user) {
      // Constant-time dummy computation to mitigate timing enumeration
      try {
        verifyPassword(password, "00".repeat(32), "00".repeat(64));
      } catch {}
      throw new Error("No account found with this email address or invalid password. Please verify your credentials.");
    }

    const isValid = verifyPassword(password, user.salt, user.passwordHash);
    if (!isValid) {
      throw new Error("Invalid password or no account found. Please verify your credentials.");
    }

    user.lastLoginAt = new Date().toISOString();
    this.saveToDisk();
    await this.persistUserToSupabase(user);

    const token = await this.createSession(user.id);
    return { user, token };
  }

  // ============================================================================
  // REVOCABLE SESSION MANAGEMENT
  // ============================================================================

  public async createSession(userId: string): Promise<string> {
    const token = `vsk_${toHex(crypto.randomBytes(32))}`;
    const now = new Date();
    const expiresAt = now.getTime() + 30 * 24 * 60 * 60 * 1000; // 30 days

    const session: SessionRecord = {
      token,
      userId,
      createdAt: now.toISOString(),
      expiresAt,
      revoked: false,
      lastActiveAt: now.toISOString(),
    };

    this.sessions.set(token, session);
    this.saveToDisk();
    await this.persistSessionToSupabase(session);

    return token;
  }

  public async getSessionUser(token: string): Promise<UserRecord | null> {
    if (!token || typeof token !== "string" || !token.startsWith("vsk_")) {
      return null;
    }

    let session = this.sessions.get(token);
    if (!session) {
      session = (await this.fetchSessionFromDatabase(token)) || undefined;
      if (session) {
        this.sessions.set(token, session);
      }
    }

    if (!session) return null;

    // Check revocation and expiration
    if (session.revoked || Date.now() > session.expiresAt) {
      return null;
    }

    // Touch lastActiveAt
    session.lastActiveAt = new Date().toISOString();

    let user = this.users.get(session.userId);
    if (!user) {
      user = (await this.fetchUserFromDatabase(session.userId)) || undefined;
      if (user) {
        this.users.set(user.id, user);
        this.usersByEmail.set(user.email.toLowerCase(), user.id);
        this.usersByApiKey.set(user.credentials.apiKey, user.id);
      }
    }

    return user || null;
  }

  public async revokeSession(token: string): Promise<boolean> {
    let session = this.sessions.get(token);
    if (!session) {
      session = (await this.fetchSessionFromDatabase(token)) || undefined;
    }

    if (!session) return false;

    session.revoked = true;
    session.revokedAt = new Date().toISOString();
    this.sessions.set(token, session);
    this.saveToDisk();
    await this.persistSessionToSupabase(session);

    return true;
  }

  public async revokeAllUserSessions(userId: string): Promise<number> {
    let count = 0;
    const nowIso = new Date().toISOString();

    for (const [token, session] of this.sessions.entries()) {
      if (session.userId === userId && !session.revoked) {
        session.revoked = true;
        session.revokedAt = nowIso;
        count++;
        await this.persistSessionToSupabase(session);
      }
    }

    if (isSupabaseConfigured) {
      try {
        await supabase
          .from("vaniedge_sessions")
          .update({ revoked: true, revoked_at: nowIso })
          .eq("user_id", userId);
      } catch (err) {
        console.warn("[AuthDatabase] Supabase bulk revoke warning:", err);
      }
    }

    this.saveToDisk();
    return count;
  }

  public async getUserByApiKey(apiKey: string): Promise<UserRecord | null> {
    let userId = this.usersByApiKey.get(apiKey);
    let user = userId ? this.users.get(userId) : null;

    if (!user && isSupabaseConfigured) {
      try {
        const { data } = await supabase
          .from("vaniedge_users")
          .select("*")
          .contains("credentials", { apiKey })
          .maybeSingle();

        if (data) {
          user = {
            id: data.id,
            email: data.email,
            passwordHash: data.password_hash,
            salt: data.salt,
            name: data.name,
            company: data.company,
            provider: data.provider,
            avatarUrl: data.avatar_url || undefined,
            tier: data.tier,
            credentials: data.credentials,
            voiceMinutesTotal: data.voice_minutes_total,
            voiceMinutesUsed: data.voice_minutes_used,
            createdAt: data.created_at,
            lastLoginAt: data.last_login_at,
          };
          this.users.set(user.id, user);
          this.usersByEmail.set(user.email.toLowerCase(), user.id);
          this.usersByApiKey.set(user.credentials.apiKey, user.id);
        }
      } catch {
        // Fallback
      }
    }

    return user || null;
  }

  public async rotateApiKey(userId: string): Promise<UserCredentials> {
    let user = this.users.get(userId);
    if (!user) {
      user = (await this.fetchUserFromDatabase(userId)) || undefined;
    }
    if (!user) throw new Error("User not found.");

    // Remove old key index
    if (user.credentials?.apiKey) {
      this.usersByApiKey.delete(user.credentials.apiKey);
    }

    // Generate fresh credentials
    const newCredentials = this.generateCredentials(user.id, user.email);
    user.credentials = newCredentials;

    this.users.set(user.id, user);
    this.usersByApiKey.set(newCredentials.apiKey, user.id);
    this.saveToDisk();
    await this.persistUserToSupabase(user);

    return newCredentials;
  }

  public safeUser(user: UserRecord): Omit<UserRecord, "passwordHash" | "salt"> {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { passwordHash, salt, ...safe } = user;
    return safe;
  }

  public toPublicDto(user: UserRecord) {
    const { passwordHash, salt, credentials, ...safe } = user;
    return {
      ...safe,
      credentials: {
        apiKeyPreview: credentials?.apiKey ? `${credentials.apiKey.slice(0, 11)}...` : "",
        assignedPhoneNumber: credentials?.assignedPhoneNumber || "",
        sipEndpoint: credentials?.sipEndpoint || "",
        sipUsername: credentials?.sipUsername || "",
      },
    };
  }
}

// Global singleton instance for warm Next.js environments
const globalAuthDb = globalThis as unknown as { __vaniedge_auth_db?: DurableAuthDatabase };
if (!globalAuthDb.__vaniedge_auth_db) {
  globalAuthDb.__vaniedge_auth_db = new DurableAuthDatabase();
}

export const authDb = globalAuthDb.__vaniedge_auth_db;
