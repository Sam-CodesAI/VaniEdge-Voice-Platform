-- ==============================================================================
-- VANIEDGE VOICE PLATFORM: APPOINTMENTS SCHEMA, INDEXES & RLS
-- Migration: 20261121_vaniedge_appointments.sql
-- ==============================================================================

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

-- Query performance indexes
CREATE INDEX IF NOT EXISTS idx_appointments_tenant_id ON appointments (tenant_id);
CREATE INDEX IF NOT EXISTS idx_appointments_caller_phone ON appointments (caller_phone);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments (status);
CREATE INDEX IF NOT EXISTS idx_appointments_scheduled_time ON appointments (scheduled_time);

-- Enable Row Level Security (RLS)
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

-- Service Role full management policy
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'appointments' AND policyname = 'service_role_manage_appointments'
  ) THEN
    CREATE POLICY service_role_manage_appointments ON appointments
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;
