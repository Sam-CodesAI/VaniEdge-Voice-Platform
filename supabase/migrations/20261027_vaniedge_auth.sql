-- ==============================================================================
-- VANIEDGE VOICE PLATFORM: PRODUCTION SCHEMA, MULTI-TENANCY & RLS POLICIES
-- Migration: 20261027_vaniedge_auth.sql
-- ==============================================================================

-- 1. Users Table
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
  credentials JSONB NOT NULL,
  voice_minutes_total INT NOT NULL DEFAULT 500,
  voice_minutes_used INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast case-insensitive email lookup
CREATE INDEX IF NOT EXISTS idx_vaniedge_users_email_lower ON vaniedge_users (LOWER(email));

-- Index for fast API key authentication
CREATE INDEX IF NOT EXISTS idx_vaniedge_users_api_key ON vaniedge_users ((credentials->>'apiKey'));

-- 2. Revocable Sessions Table
CREATE TABLE IF NOT EXISTS vaniedge_sessions (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES vaniedge_users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at BIGINT NOT NULL,
  revoked BOOLEAN NOT NULL DEFAULT FALSE,
  revoked_at TIMESTAMPTZ,
  last_active_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for user session lookups and bulk revocation
CREATE INDEX IF NOT EXISTS idx_vaniedge_sessions_user_id ON vaniedge_sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_vaniedge_sessions_token_revoked ON vaniedge_sessions (token, revoked);

-- 3. Tenants Table
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

-- 4. Dispatch Tickets Table
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
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dispatch_tickets_tenant_id ON dispatch_tickets (tenant_id);
CREATE INDEX IF NOT EXISTS idx_dispatch_tickets_phone ON dispatch_tickets (caller_phone);

-- 5. Call Sessions Table
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
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_call_sessions_tenant_id ON call_sessions (tenant_id);

-- 6. SutraDB Knowledge Documents Table
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

-- Enable Row Level Security (RLS) on all tables
ALTER TABLE vaniedge_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE vaniedge_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE dispatch_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sutradb_knowledge ENABLE ROW LEVEL SECURITY;

-- Service Role full access policies (Backend Server execution with SUPABASE_SERVICE_ROLE_KEY)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'vaniedge_users' AND policyname = 'service_role_manage_vaniedge_users'
  ) THEN
    CREATE POLICY service_role_manage_vaniedge_users ON vaniedge_users
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'vaniedge_sessions' AND policyname = 'service_role_manage_vaniedge_sessions'
  ) THEN
    CREATE POLICY service_role_manage_vaniedge_sessions ON vaniedge_sessions
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'tenants' AND policyname = 'service_role_manage_tenants'
  ) THEN
    CREATE POLICY service_role_manage_tenants ON tenants
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'dispatch_tickets' AND policyname = 'service_role_manage_dispatch_tickets'
  ) THEN
    CREATE POLICY service_role_manage_dispatch_tickets ON dispatch_tickets
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'call_sessions' AND policyname = 'service_role_manage_call_sessions'
  ) THEN
    CREATE POLICY service_role_manage_call_sessions ON call_sessions
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'sutradb_knowledge' AND policyname = 'service_role_manage_sutradb_knowledge'
  ) THEN
    CREATE POLICY service_role_manage_sutradb_knowledge ON sutradb_knowledge
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;
