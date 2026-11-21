-- ==============================================================================
-- VANIEDGE VOICE PLATFORM: COMPLETE CONSOLIDATED PRODUCTION DATABASE SCHEMA
-- Target Engine: Supabase / PostgreSQL 15+
-- ==============================================================================

-- 1. USERS TABLE
CREATE TABLE IF NOT EXISTS vaniedge_users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  name TEXT NOT NULL,
  company TEXT DEFAULT 'Independent Developer',
  provider TEXT DEFAULT 'email',
  avatar_url TEXT,
  tier TEXT DEFAULT 'Starter',
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'agency_admin', 'admin')),
  credentials JSONB NOT NULL DEFAULT '{}'::jsonb,
  voice_minutes_total INT NOT NULL DEFAULT 500,
  voice_minutes_used INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vaniedge_users_email_lower ON vaniedge_users (LOWER(email));
CREATE INDEX IF NOT EXISTS idx_vaniedge_users_api_key ON vaniedge_users ((credentials->>'apiKey'));

-- 2. SESSIONS TABLE (Revocable Auth Sessions)
CREATE TABLE IF NOT EXISTS vaniedge_sessions (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES vaniedge_users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at BIGINT NOT NULL,
  revoked BOOLEAN NOT NULL DEFAULT FALSE,
  revoked_at TIMESTAMPTZ,
  last_active_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vaniedge_sessions_user_id ON vaniedge_sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_vaniedge_sessions_token_revoked ON vaniedge_sessions (token, revoked);

-- 3. TENANTS TABLE (Multi-Tenant Agency / Business Accounts)
CREATE TABLE IF NOT EXISTS tenants (
  id TEXT PRIMARY KEY,
  owner_id TEXT REFERENCES vaniedge_users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  twilio_phone TEXT NOT NULL,
  twilio_sid TEXT,
  webhook_url TEXT NOT NULL,
  monthly_calls INT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'provisioning', 'suspended')),
  logo_url TEXT,
  brand_color TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tenants_owner_id ON tenants (owner_id);

-- 4. APPOINTMENTS TABLE (Receptionist Booking Calendar)
CREATE TABLE IF NOT EXISTS appointments (
  id TEXT PRIMARY KEY,
  tenant_id TEXT REFERENCES tenants(id) ON DELETE CASCADE,
  caller_name TEXT NOT NULL,
  caller_phone TEXT NOT NULL,
  service_type TEXT NOT NULL,
  scheduled_time TIMESTAMPTZ NOT NULL,
  duration_minutes INT DEFAULT 30,
  notes TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'RESCHEDULED')),
  source TEXT NOT NULL DEFAULT 'voice_call' CHECK (source IN ('voice_call', 'web', 'manual')),
  call_sid TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_appointments_tenant_id ON appointments (tenant_id);
CREATE INDEX IF NOT EXISTS idx_appointments_caller_phone ON appointments (caller_phone);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments (status);
CREATE INDEX IF NOT EXISTS idx_appointments_scheduled_time ON appointments (scheduled_time);

-- 5. DISPATCH TICKETS TABLE (Emergency / Service Dispatches)
CREATE TABLE IF NOT EXISTS dispatch_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id TEXT UNIQUE NOT NULL,
  tenant_id TEXT REFERENCES tenants(id) ON DELETE SET NULL,
  caller_name TEXT NOT NULL,
  caller_phone TEXT NOT NULL,
  category TEXT NOT NULL,
  service_type TEXT NOT NULL,
  details TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'CONFIRMED', 'DISPATCHED', 'ESCALATED', 'RESOLVED', 'COMPLETED', 'CANCELLED')),
  priority TEXT NOT NULL DEFAULT 'STANDARD' CHECK (priority IN ('STANDARD', 'URGENT', 'CRITICAL')),
  language TEXT NOT NULL DEFAULT 'en',
  sms_confirmation TEXT,
  checksum TEXT,
  is_simulated BOOLEAN NOT NULL DEFAULT FALSE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dispatch_tickets_tenant_id ON dispatch_tickets (tenant_id);
CREATE INDEX IF NOT EXISTS idx_dispatch_tickets_phone ON dispatch_tickets (caller_phone);
CREATE INDEX IF NOT EXISTS idx_dispatch_tickets_checksum ON dispatch_tickets (checksum);

-- 6. CALL SESSIONS TABLE (Telephony Metadata & Observability)
CREATE TABLE IF NOT EXISTS call_sessions (
  call_sid TEXT PRIMARY KEY,
  tenant_id TEXT,
  from_number TEXT NOT NULL,
  to_number TEXT NOT NULL,
  direction TEXT NOT NULL DEFAULT 'inbound',
  phase TEXT NOT NULL DEFAULT 'initiated',
  transcript JSONB NOT NULL DEFAULT '[]'::jsonb,
  latency_ms JSONB NOT NULL DEFAULT '{}'::jsonb,
  recording_url TEXT,
  failover_triggered BOOLEAN NOT NULL DEFAULT FALSE,
  failover_reason TEXT,
  sms_rescue_sent BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_call_sessions_tenant_id ON call_sessions (tenant_id);

-- 7. IDEMPOTENCY KEYS TABLE (Distributed Deduplication & Replay Defense)
CREATE TABLE IF NOT EXISTS idempotency_keys (
  key TEXT PRIMARY KEY,
  scope TEXT NOT NULL,
  response JSONB,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_idempotency_keys_expires ON idempotency_keys (expires_at);

-- 8. SUTRADB KNOWLEDGE DOCUMENTS TABLE (Hybrid Search Embeddings & RAG)
CREATE TABLE IF NOT EXISTS sutradb_knowledge (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sutradb_knowledge_tenant ON sutradb_knowledge (tenant_id);

-- 9. ENABLE ROW LEVEL SECURITY (RLS) ACROSS ALL TABLES
ALTER TABLE vaniedge_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE vaniedge_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE dispatch_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE idempotency_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE sutradb_knowledge ENABLE ROW LEVEL SECURITY;

-- 10. SERVICE ROLE FULL ACCESS POLICIES
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'vaniedge_users' AND policyname = 'service_role_manage_vaniedge_users') THEN
    CREATE POLICY service_role_manage_vaniedge_users ON vaniedge_users FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'vaniedge_sessions' AND policyname = 'service_role_manage_vaniedge_sessions') THEN
    CREATE POLICY service_role_manage_vaniedge_sessions ON vaniedge_sessions FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'tenants' AND policyname = 'service_role_manage_tenants') THEN
    CREATE POLICY service_role_manage_tenants ON tenants FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'appointments' AND policyname = 'service_role_manage_appointments') THEN
    CREATE POLICY service_role_manage_appointments ON appointments FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'dispatch_tickets' AND policyname = 'service_role_manage_dispatch_tickets') THEN
    CREATE POLICY service_role_manage_dispatch_tickets ON dispatch_tickets FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'call_sessions' AND policyname = 'service_role_manage_call_sessions') THEN
    CREATE POLICY service_role_manage_call_sessions ON call_sessions FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'idempotency_keys' AND policyname = 'service_role_manage_idempotency_keys') THEN
    CREATE POLICY service_role_manage_idempotency_keys ON idempotency_keys FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'sutradb_knowledge' AND policyname = 'service_role_manage_sutradb_knowledge') THEN
    CREATE POLICY service_role_manage_sutradb_knowledge ON sutradb_knowledge FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;
