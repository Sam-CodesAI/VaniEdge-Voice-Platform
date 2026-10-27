<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# 🎙️⚡ VaniEdge Voice Platform — Engineering & Agent Operational Directives

These guidelines define non-negotiable engineering, security, and architectural standards across all tasks executed in this repository. All AI agents, contributors, and automated pipelines must strictly comply.

---

## 1. Architectural Model & Dual-Runtime Invariants

VaniEdge operates on an intentional **dual-runtime architecture**. Code must never conflate the two runtimes or their operational boundaries:

### A. Next.js 16 (Node.js App Router Runtime)
- **Directory:** `app/`, `lib/`, `components/`
- **Responsibilities:**
  - Inbound REST telephony webhooks (`/api/voice/*`).
  - Agency multi-tenant management (`/api/agency/*`).
  - Scrypt-authenticated session management (`/api/auth/*`).
  - Knowledge base RAG query and ingestion (`/api/query`).
  - Dispatch ticket creation and SMS queue (`/api/dispatch`).
  - React 19 interactive operator UI & Telephony Mission Control.
- **Persistence:** Supabase PostgreSQL with atomic disk fallback (`.data/`).

### B. Cloudflare Worker (V8 Edge Runtime)
- **Directory:** `src/` (entrypoint `src/worker.ts`), configuration `wrangler.toml`
- **Responsibilities:**
  - Real-time Twilio Media Stream WebSocket handling (`/voice/stream`).
  - 8kHz μ-law bidirectional audio bridge to ElevenLabs / Groq.
  - Sub-second watchdog timer triggering atomic HTTP 307 redirects to human queues on latency breach.
  - Edge health checks (`/health`) and telephony metrics (`/metrics`).
- **Constraints:** No Node.js standard library modules (`fs`, `path`, etc.) unless Cloudflare Worker compatible. Secrets are accessed via environment bindings (`env.TWILIO_AUTH_TOKEN`, `env.ELEVENLABS_API_KEY`).

---

## 2. Security & Hardening Non-Negotiables

### A. Authentication & Session Management
- **Zero In-Memory Production State:** Never store production accounts, API keys, or active sessions in transient JavaScript `Map` objects. Use durable Supabase tables (`vaniedge_users`, `vaniedge_sessions`) or the atomic disk fallback (`.data/`).
- **Production Database Guard:** In production (`NODE_ENV === "production"`), missing Supabase credentials or failed durable database writes throw hard errors and roll back state rather than silently falling back to ephemeral storage (unless `ALLOW_LOCAL_DISK_FALLBACK=true` is explicitly configured for offline testing).
- **No Hardcoded Credentials:** Never seed default accounts (`developer@vaniedge.ai`, `demo@vaniedge.ai`) or hardcoded passwords (`password123`) in production.
- **Scrypt Password Hashing:** Use standard scrypt hashing (`N=16384, r=8, p=1`) with cryptographically secure random salts and NFKC unicode normalization. Password length boundaries must be 8–128 characters.
- **User Enumeration Defense:** Always perform a constant-time dummy scrypt verification if an email address does not exist during sign-in.
- **HttpOnly Cookie Encapsulation:** Session tokens must be stored exclusively in secure HTTP-only cookies (`httpOnly: true`, `secure: true` in production, `sameSite: "lax"`). Never return raw session tokens in JSON response bodies.
- **CSRF Defense:** State-changing requests (`POST`, `PUT`, `DELETE`, `PATCH`) must validate `Origin` and `Referer` headers against allowed domains.

### B. Multi-Tenant Isolation & IDOR Protection
- **Tenant Ownership:** Every tenant record is scoped by `ownerId`.
- **Enforce Scoping:** Every agency query and mutation must authenticate via `requireAuth()` and verify that the calling user matches `tenant.ownerId` (unless caller has role `admin`).
- **Enumeration Prevention:** Attempting to view, edit, or delete an unowned tenant MUST return `404 Not Found` rather than `403 Forbidden` to prevent resource enumeration.
- **Sensitive Credential Scrubbing:** Tenant DTOs returned to the client must always strip sensitive fields (`twilioAccountSid`, `twilioAuthToken`, `apiKeys`).

### C. Fail-Closed Webhook Verification
- **Twilio HMAC-SHA1:** Every externally reachable Twilio webhook (`/api/voice/*` and worker `/voice/*`) must verify `X-Twilio-Signature` using `validateTwilioSignature()`.
- **Fail-Closed Rule:** In production (`NODE_ENV === "production"`), missing `TWILIO_AUTH_TOKEN` or missing/invalid signatures MUST immediately reject with HTTP 401. Never skip verification when secrets are missing.
- **Timing-Safe Equality:** Compare signature hashes using `crypto.timingSafeEqual` to avoid side-channel timing attacks.
- **Replay Protection:** Deduplicate status callbacks using distributed idempotency keys (`checkEventDuplicateAsync`) coordinated via the `idempotency_keys` table.

### D. Rate Limiting & Input Validation
- Protect all sensitive endpoints with sliding-window rate limiters:
  - Auth (`/api/auth/signin`, `/api/auth/signup`): 5 requests / min per IP.
  - Chat (`/api/chat`): 30 requests / min per IP.
  - RAG (`/api/query` query & ingestion): 60 requests / min per IP.
  - Dispatch (`/api/dispatch`): 15 requests / min per IP.
  - Agency Tenants (`/api/agency/tenants`): 60 requests / min per IP.
  - Speech Synthesis (`/api/tts`): 20 requests / min per IP.
  - Telemetry Metrics (`/api/metrics`): 30 requests / min per IP.
- Resolve client IPs safely via trusted proxy headers (`cf-connecting-ip`, `x-real-ip`, leftmost `x-forwarded-for`).
- Validate all incoming payloads with strict Zod schemas with explicit string length bounds.

---

## 3. Telephony Reliability & Omni-Shield Failover Protocol

- **Omni-Shield 4-Tier Invariants:**
  1. **Tier 1:** Sub-second streaming conversational voice (Groq Llama 3.3 70B / ElevenLabs + Amazon Polly).
  2. **Tier 2:** Voicemail circuit breaker (`<Record maxLength="60">`) tripping within 10ms on LLM stall (>1,400ms) or service exception.
  3. **Tier 3:** Warm transfer with private technician briefing whisper (`<Dial><Number url="/api/voice/whisper">`).
  4. **Tier 4:** Omnichannel SMS rescue dispatch on dropped calls (<15s) with a 1-hour cooldown deduplication per caller.
- **Operational Honesty Invariant:**
  - Physical carrier disconnects (cellular dead zones, caller hangup) are outside software control. Never claim "100% Zero Dropped Calls" without qualifying the operational boundary.
  - Tenant provisioning creates a profile in `provisioning` status until real carrier E.164 numbers are assigned.
  - Ticket creation records a state of `CREATED` or `ESCALATED`. Only claim `DISPATCHED` or `CONFIRMED` after the downstream carrier/SMS provider confirms delivery.
  - Web demo simulations must display `[DEMO SIMULATION]` to prevent caller confusion during browser-based evaluation.

---

## 4. Test-Driven Verification & Quality Gates

Every code change must satisfy all 5 automated quality gates before pull requests or commits:

```bash
# 1. Verify environment configuration
pnpm check:env

# 2. TypeScript static typechecking (zero errors)
pnpm typecheck

# 3. Cloudflare Worker TypeScript build verification
pnpm build:ts

# 4. Automated test suite (all 60 tests across 8 suites must pass)
pnpm test

# 5. Production Next.js compilation
pnpm build
```

### Test Suite Structure (`test/`):
- `test/auth-security.test.ts`: Password hashing, constant-time dummy verification, session lifecycle, CSRF protection.
- `test/tenant-isolation.test.ts`: Cross-tenant IDOR protection, 404 on unowned tenants, DTO credential stripping.
- `test/twilio-webhook-verification.test.ts`: HMAC-SHA1 validation, fail-closed production semantics, deduplication.
- `test/durable-persistence.test.ts`: Supabase integration, table integrity, fallback store resilience.
- `test/rate-limit.test.ts`: Sliding-window burst mitigation, proxy header IP extraction.
- `test/e2e-failure-benchmark.test.ts`: Measured latency deadlines (151ms failover callback, <5ms Tier 2 trip, <2ms Tier 3 triage, burst volume distribution).
- `test/telephony-failover.test.ts`: Four-tier state machine transitions, TwiML generation.
- `test/production-readiness.test.ts`: Startup environment assertions, rollback on database failure, cross-tenant dispatch/query access, TTS limits, distributed idempotency.

---

## 5. Coding Standards & Git Discipline

- **Strict TypeScript:** No `any` types. Enforce proper typing across all interfaces, DTOs, and route parameters.
- **Atomic Diffs:** Make surgical, targeted edits. Preserve existing comments and docstrings unless updating stale specifications.
- **Secret Hygiene:** Never commit secrets, tokens, API keys, or private phone numbers. All tests must use synthetic or mock credentials.
- **No Direct Default Branch Commits:** Work on dedicated feature or fix branches (`fix/production-security-hardening`). Verify CI passes green before merging.
- **Outbound Direct Message Invariant:** Never instruct users to send cold outbound DMs on Reddit or X. Embed proposals and sample code in public comment threads, inviting inbound contact or Telegram reachout (`@Samarth1306`).
