import crypto from "node:crypto";

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
  credentials: UserCredentials;
  voiceMinutesTotal: number;
  voiceMinutesUsed: number;
  createdAt: string;
  lastLoginAt: string;
}

export interface SessionRecord {
  token: string;
  userId: string;
  expiresAt: number;
}

// Helper to serialize bytes to hex string compatible across Node.js and Cloudflare Workers
function toHex(buf: unknown): string {
  const u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf as ArrayBuffer);
  let hex = "";
  for (let i = 0; i < u8.length; i++) {
    hex += u8[i].toString(16).padStart(2, "0");
  }
  return hex;
}

// In-memory persistent database for server lifecycle
class AuthDatabase {
  private users: Map<string, UserRecord> = new Map();
  private usersByEmail: Map<string, string> = new Map();
  private usersByApiKey: Map<string, string> = new Map();
  private sessions: Map<string, SessionRecord> = new Map();

  constructor() {
    this.seedDefaultUsers();
  }

  private generateCredentials(userId: string, email: string): UserCredentials {
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

  private hashPassword(password: string, salt: string): string {
    return toHex(crypto.pbkdf2Sync(password, salt, 10000, 64, "sha512"));
  }

  private seedDefaultUsers() {
    // 1. Seed demo developer account
    const devSalt = toHex(crypto.randomBytes(16));
    const devId = "usr_dev_001";
    const devCredentials = this.generateCredentials(devId, "developer@vaniedge.ai");
    const devUser: UserRecord = {
      id: devId,
      email: "developer@vaniedge.ai",
      passwordHash: this.hashPassword("password123", devSalt),
      salt: devSalt,
      name: "Arjun Mehta",
      company: "CarePlus Health Systems",
      provider: "email",
      avatarUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=faces",
      tier: "Starter",
      credentials: devCredentials,
      voiceMinutesTotal: 500,
      voiceMinutesUsed: 38,
      createdAt: new Date(Date.now() - 7 * 86400000).toISOString(),
      lastLoginAt: new Date().toISOString(),
    };
    this.users.set(devUser.id, devUser);
    this.usersByEmail.set(devUser.email.toLowerCase(), devUser.id);
    this.usersByApiKey.set(devCredentials.apiKey, devUser.id);

    // 2. Seed enterprise client account
    const entSalt = toHex(crypto.randomBytes(16));
    const entId = "usr_ent_002";
    const entCredentials = this.generateCredentials(entId, "demo@vaniedge.ai");
    const entUser: UserRecord = {
      id: entId,
      email: "demo@vaniedge.ai",
      passwordHash: this.hashPassword("password123", entSalt),
      salt: entSalt,
      name: "Priya Sharma",
      company: "Apex Roadside Rescue",
      provider: "email",
      tier: "Growth",
      credentials: entCredentials,
      voiceMinutesTotal: 2500,
      voiceMinutesUsed: 412,
      createdAt: new Date(Date.now() - 14 * 86400000).toISOString(),
      lastLoginAt: new Date().toISOString(),
    };
    this.users.set(entUser.id, entUser);
    this.usersByEmail.set(entUser.email.toLowerCase(), entUser.id);
    this.usersByApiKey.set(entCredentials.apiKey, entUser.id);
  }

  public register(
    name: string,
    email: string,
    password?: string,
    company: string = "Independent Developer",
    provider: "email" = "email",
    avatarUrl?: string
  ): { user: UserRecord; token: string } {
    const normalizedEmail = email.trim().toLowerCase();
    if (this.usersByEmail.has(normalizedEmail)) {
      throw new Error("An account with this email address already exists.");
    }

    const salt = toHex(crypto.randomBytes(16));
    const passwordHash = password ? this.hashPassword(password, salt) : "";
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
      credentials,
      voiceMinutesTotal: 500,
      voiceMinutesUsed: 0,
      createdAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
    };

    this.users.set(id, user);
    this.usersByEmail.set(normalizedEmail, id);
    this.usersByApiKey.set(credentials.apiKey, id);

    const token = this.createSession(id);
    return { user, token };
  }

  public authenticate(email: string, password: string): { user: UserRecord; token: string } {
    const normalizedEmail = email.trim().toLowerCase();
    const userId = this.usersByEmail.get(normalizedEmail);
    if (!userId) {
      throw new Error("No account found with this email address.");
    }

    const user = this.users.get(userId);
    if (!user) {
      throw new Error("User record not found.");
    }

    const computedHash = this.hashPassword(password, user.salt);
    if (computedHash !== user.passwordHash) {
      throw new Error("Invalid password. Please verify your credentials.");
    }

    user.lastLoginAt = new Date().toISOString();
    const token = this.createSession(user.id);
    return { user, token };
  }



  public createSession(userId: string): string {
    const token = `vsk_${toHex(crypto.randomBytes(32))}`;
    const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000; // 30 days
    this.sessions.set(token, { token, userId, expiresAt });
    return token;
  }

  public getSessionUser(token: string): UserRecord | null {
    const session = this.sessions.get(token);
    if (!session) return null;
    if (Date.now() > session.expiresAt) {
      this.sessions.delete(token);
      return null;
    }
    return this.users.get(session.userId) || null;
  }

  public getUserByApiKey(apiKey: string): UserRecord | null {
    const userId = this.usersByApiKey.get(apiKey);
    if (!userId) return null;
    return this.users.get(userId) || null;
  }

  public rotateApiKey(userId: string): UserCredentials {
    const user = this.users.get(userId);
    if (!user) throw new Error("User not found.");

    // Remove old key index
    this.usersByApiKey.delete(user.credentials.apiKey);

    // Generate fresh credentials
    const newCredentials = this.generateCredentials(user.id, user.email);
    user.credentials = newCredentials;
    this.usersByApiKey.set(newCredentials.apiKey, user.id);

    return newCredentials;
  }

  public safeUser(user: UserRecord) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { passwordHash, salt, ...safe } = user;
    return safe;
  }
}

// Global singleton instance
const globalAuthDb = globalThis as unknown as { __vaniedge_auth_db?: AuthDatabase };
if (!globalAuthDb.__vaniedge_auth_db) {
  globalAuthDb.__vaniedge_auth_db = new AuthDatabase();
}

export const authDb = globalAuthDb.__vaniedge_auth_db;
