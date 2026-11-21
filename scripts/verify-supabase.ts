import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

// Load .env or .env.local if present
try {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (fs.existsSync(envPath) && typeof (process as any).loadEnvFile === "function") {
    (process as any).loadEnvFile(envPath);
  } else if (fs.existsSync(path.resolve(process.cwd(), ".env")) && typeof (process as any).loadEnvFile === "function") {
    (process as any).loadEnvFile(path.resolve(process.cwd(), ".env"));
  }
} catch {
  // Ignore fallback
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

console.log("================================================================================");
console.log("🔍 VANIEDGE SUPABASE CONNECTIVITY & SCHEMA VERIFICATION");
console.log("================================================================================");
console.log(`URL:         ${SUPABASE_URL || "NOT SET"}`);
console.log(`Anon Key:    ${SUPABASE_ANON_KEY ? `SET (${SUPABASE_ANON_KEY.slice(0, 10)}...)` : "NOT SET"}`);
console.log(`Service Key: ${SUPABASE_SERVICE_KEY ? `SET (${SUPABASE_SERVICE_KEY.slice(0, 10)}...)` : "NOT SET"}`);
console.log("--------------------------------------------------------------------------------\n");

if (!SUPABASE_URL || (!SUPABASE_SERVICE_KEY && !SUPABASE_ANON_KEY)) {
  console.error("❌ Supabase environment variables are missing.");
  console.log("\nTo configure Supabase, set the following environment variables:");
  console.log("  NEXT_PUBLIC_SUPABASE_URL=https://<your-project-id>.supabase.co");
  console.log("  NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>");
  console.log("  SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>");
  process.exit(1);
}

const client = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY || SUPABASE_ANON_KEY!, {
  auth: { persistSession: false },
});

const REQUIRED_TABLES = [
  "vaniedge_users",
  "vaniedge_sessions",
  "tenants",
  "appointments",
  "dispatch_tickets",
  "call_sessions",
  "idempotency_keys",
  "sutradb_knowledge",
];

async function verify() {
  let passedTables = 0;
  let missingTables: string[] = [];

  for (const table of REQUIRED_TABLES) {
    try {
      const { data, error } = await client.from(table).select("*").limit(1);
      if (error) {
        console.error(`❌ Table '${table}': Failed query (${error.message})`);
        missingTables.push(table);
      } else {
        console.log(`✅ Table '${table}': Accessible (Found ${data?.length ?? 0} sample rows)`);
        passedTables++;
      }
    } catch (err: any) {
      console.error(`❌ Table '${table}': Exception (${err.message})`);
      missingTables.push(table);
    }
  }

  console.log("\n--------------------------------------------------------------------------------");
  if (missingTables.length === 0) {
    console.log(`🎉 ALL ${passedTables} REQUIRED TABLES VERIFIED IN SUPABASE! Schema is 100% ready.`);
  } else {
    console.log(`⚠️ ${passedTables}/${REQUIRED_TABLES.length} tables verified. Missing tables: ${missingTables.join(", ")}`);
    console.log("Please run the schema migration in Supabase SQL Editor: 'supabase/schema.sql'");
  }
  console.log("================================================================================\n");
}

verify();
