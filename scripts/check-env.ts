import { validateEnvironment } from "../lib/env-check";

const report = validateEnvironment();

console.log("================================================================================");
console.log("🔍 VaniEdge Environment & Pre-Flight Configuration Status");
console.log("================================================================================");
console.log(`Environment:           ${report.isProduction ? "PRODUCTION" : "DEVELOPMENT"}`);
console.log(`Overall Health:        ${report.isValid ? "✅ VALID" : "❌ INVALID CONFIGURATION"}`);
console.log("--------------------------------------------------------------------------------");
console.log("Configured Providers:");
console.log(`  Twilio Telephony:     ${report.configuredProviders.twilio ? "✅ Configured" : "⚠️  Missing credentials"}`);
console.log(`  ElevenLabs Voice AI:  ${report.configuredProviders.elevenlabs ? "✅ Configured" : "⚠️  Missing API Key (Local fallback)"}`);
console.log(`  Supabase PostgreSQL:  ${report.configuredProviders.supabase ? "✅ Configured" : "ℹ️  Offline (Resilient local disk cache active)"}`);
console.log(`  AWS Polly:            ${report.configuredProviders.awsPolly ? "✅ Configured" : "ℹ️  Optional"}`);
console.log("--------------------------------------------------------------------------------");

if (report.warnings.length > 0) {
  console.log("Warnings:");
  for (const w of report.warnings) {
    console.log(`  ⚠️  ${w}`);
  }
}

if (report.errors.length > 0) {
  console.log("Errors:");
  for (const e of report.errors) {
    console.log(`  ❌ ${e}`);
  }
  process.exit(1);
}

console.log("================================================================================");
