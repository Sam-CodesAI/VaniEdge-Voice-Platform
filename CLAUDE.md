# 🎙️⚡ VaniEdge Voice Platform — Developer Reference & Architecture Guide

@AGENTS.md

This document provides a concise, high-impact reference for building, testing, and maintaining the **VaniEdge Voice Platform (वाणी Edge)**.

---

## ⚡ Quick Reference Commands

All commands use `pnpm` (Node.js 22 LTS).

| Command | Description |
| :--- | :--- |
| `pnpm install` | Install all dependencies with frozen lockfile |
| `pnpm check:env` | Run the pre-flight environment auditor |
| `pnpm dev` | Start Next.js App Router development server (`http://localhost:3000`) |
| `pnpm dev:worker` | Start local Cloudflare Worker development runtime via Wrangler |
| `pnpm typecheck` | Static TypeScript analysis (`tsc --noEmit`) |
| `pnpm build:ts` | Compile and verify Cloudflare Worker TypeScript (`wrangler deploy --dry-run`) |
| `pnpm test` | Run automated test suite (60 tests across 8 suites) |
| `pnpm build` | Compile production Next.js 16 application with Turbopack |

---

## 🏗️ Architecture & Directory Map

VaniEdge operates on an intentional **dual-runtime** architecture:

```
VaniEdge-Voice-Platform/
├── app/                              # Next.js 16 App Router (Node.js Runtime)
│   ├── api/
│   │   ├── agency/tenants/           # Multi-tenant CRUD with IDOR isolation
│   │   ├── auth/                     # Scrypt auth (signin, signup, signout, rotate)
│   │   ├── chat/                     # Customer assistant web chat
│   │   ├── dispatch/                 # Dispatch ticketing with SHA checksums
│   │   ├── health/                   # Provider readiness & masked telemetry
│   │   ├── metrics/                  # Latency percentiles & call telemetry
│   │   ├── query/                    # SutraDB RAG semantic search & ingestion
│   │   └── voice/                    # Twilio REST webhooks (incoming, process, status, whisper)
│   ├── demos/voice-agent/            # Interactive voice mission control demo
│   ├── layout.tsx                    # Root layout with 2026 dark-mode design tokens
│   └── page.tsx                      # Bento Grid landing page & live console
├── components/                       # React 19 UI components
│   ├── BentoGrid.tsx                 # Core capability showcase
│   ├── CallSimulator.tsx             # Interactive PSTN simulator with audio waveforms
│   └── TelephonyMissionControl.tsx   # Real-time latency watchdog trigger console
├── lib/                              # Shared backend utilities & services
│   ├── auth-guard.ts                 # Session verification & CSRF middleware
│   ├── auth-store.ts                 # Durable scrypt password hashing & session store
│   ├── rate-limit.ts                 # Sliding-window rate limiter with proxy IP detection
│   ├── supabase-client.ts            # Durable PostgreSQL client & health checks
│   ├── sutradb-engine.ts             # Hybrid lexical/vector RAG engine
│   └── telephony.ts                  # Twilio REST client & HMAC-SHA1 signature validator
├── src/                              # Cloudflare Worker (V8 Edge Runtime)
│   ├── worker.ts                     # Media Stream WebSocket router & fail-closed webhooks
│   ├── engine/                       # Voice stream bridging & watchdog timers
│   └── dispatch/                     # Ticket dispatcher & emergency routing
├── supabase/migrations/              # Durable database schema definitions
│   └── 20261027_vaniedge_auth.sql    # Users, sessions, tenants, tickets, call sessions, idempotency
└── test/                             # Automated test suite (60 tests across 8 suites)
    ├── auth-security.test.ts         # Scrypt hashing, constant-time verification, sessions
    ├── durable-persistence.test.ts   # Database resilience & fallback persistence
    ├── e2e-failure-benchmark.test.ts # Measured timeout deadlines & burst distribution
    ├── production-readiness.test.ts  # Startup assertions, outage rollback, cross-tenant, TTS/Metrics
    ├── rate-limit.test.ts            # Sliding-window rate limiting & IP extraction
    ├── telephony-failover.test.ts    # 4-tier state machine transitions & TwiML
    ├── tenant-isolation.test.ts      # Multi-tenant IDOR protection & credential scrubbing
    └── twilio-webhook-verification.test.ts # Fail-closed HMAC-SHA1 signatures
```

---

## 🛡️ Core Engineering Invariants

### 1. Authentication & Session Security
- **No in-memory state:** Production user accounts, sessions, and API keys are stored durably in Supabase (`vaniedge_users`, `vaniedge_sessions`) with atomic local JSON disk fallback (`.data/`).
- **Scrypt hashing:** Passwords hashed with `scrypt` (`N=16384, r=8, p=1`) with cryptographically random salt and NFKC unicode normalization.
- **Constant-time dummy check:** Unrecognized emails trigger a dummy scrypt verification to eliminate user enumeration side-channels.
- **HttpOnly Cookies:** Session tokens are delivered strictly via `Set-Cookie` (`httpOnly: true`, `secure: true` in production, `sameSite: "lax"`). Never expose tokens in JSON response bodies.
- **CSRF Protection:** Mutating requests (`POST`, `PUT`, `DELETE`, `PATCH`) validate `Origin` and `Referer` against configured application hosts.

### 2. Multi-Tenant Scoping (IDOR Prevention)
- All tenant profiles in `/api/agency/tenants/*` are scoped to `ownerId`.
- Non-admin users can only view, edit, or delete tenants they own.
- Unowned tenant requests return `404 Not Found` (never `403 Forbidden`) to prevent resource enumeration.
- Tenant DTOs strip sensitive keys (`twilioAccountSid`, `twilioAuthToken`) before returning payloads to clients.

### 3. Fail-Closed Twilio Webhook Verification
- All webhook entrypoints verify `X-Twilio-Signature` using `validateTwilioSignature()`.
- **Fail-closed:** In production, missing `TWILIO_AUTH_TOKEN` or missing/invalid signatures reject immediately with HTTP 401.
- In-memory event deduplication cache (`checkEventDuplicate`) prevents replay attacks on status callbacks.

### 4. Omni-Shield 4-Tier Failover Protocol
- **Tier 1 (Streaming AI):** ElevenLabs / Groq Llama 3.3 70B + Amazon Polly Neural streaming (< 1500ms TTFT target).
- **Tier 2 (Voicemail Circuit Breaker):** Latency spike (>1,400ms) or upstream exception trips `<Record maxLength="60">` in **< 10ms**.
- **Tier 3 (Warm Transfer + Whisper):** Urgent keywords or caller transfer requests trigger `<Dial><Number url="/api/voice/whisper">` in **< 5ms**.
- **Tier 4 (Omnichannel SMS Rescue):** Short calls (<15s) trigger Twilio SMS self-booking link with a 1-hour cooldown deduplication per caller.

### 5. Operational Honesty
- **Telephony Limits:** Physical carrier dropouts and cellular dead zones are outside software boundaries. Total latency includes 150–350ms PSTN transit.
- **Tenant Provisioning:** Profiles are initialized with `provisioning` status until real carrier E.164 numbers are assigned.
- **Ticketing:** Appointments and triage entries are created in `CREATED` or `ESCALATED` status. Only report `DISPATCHED` or `CONFIRMED` after external delivery confirmation.
- **Demo Mode:** Web demo interfaces are explicitly labeled `[DEMO SIMULATION]`.

---

## 🧪 Quality Gates & CI

All pull requests and commits run through `.github/workflows/ci.yml`:
1. `pnpm check:env` — Verifies all required environment variables are set.
2. `pnpm typecheck` — Strict TypeScript checking.
3. `pnpm build:ts` — Cloudflare Worker TypeScript build verification.
4. `pnpm test` — Runs all 51 tests across 7 test suites.
5. `pnpm build` — Next.js 16 production build.
