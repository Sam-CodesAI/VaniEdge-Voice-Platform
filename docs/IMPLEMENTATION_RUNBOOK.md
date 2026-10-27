# 📘 VaniEdge & BridgeView Client Implementation Runbook
### *Standard Operating Procedure (SOP) for 60-Minute Turnkey Voice AI Deployments*

---

## 🎯 Purpose & Scope

This runbook defines the complete, end-to-end engineering protocol for deploying, verifying, and supporting client installations of:
1. **BridgeView** (The Client Lead, Ticket & Telephony Operations Portal)
2. **The AI Customer Assistant** (Multi-channel web & conversational knowledge base)
3. **The AI Receptionist** (PSTN voice answering with sub-second failover watchdog)

Target Turnaround Time: **< 60 minutes per client installation**.  
Standard Installation Rate: **$300 fixed per module** + **$20–$100/month recurring support share**.

---

## 📋 Pre-Flight Client Intake Checklist

Before touching code or provisioning numbers, obtain from the client:
- [ ] **Business Name & Core Vertical:** (e.g. Clinic, Dental, Restaurant, Roadside Rescue, Legal, Real Estate)
- [ ] **Operating Hours & Timezone:** (e.g. Mon–Sat 9:00 AM – 7:00 PM IST/EST)
- [ ] **Emergency / Human Backup Forwarding Number:** (A real staff mobile/PSTN line, e.g. `+1 (800) 555-0199`)
- [ ] **Top 10 Business FAQs / Service Catalog:** (Services offered, fee schedules, cancellation policies)
- [ ] **SMS Notification Target Number:** (Mobile number of on-duty manager or receptionist)

---

## ⚡ Step 1: Carrier Provisioning & Telephony Routing (10 Mins)

### 1.1 Twilio / Exotel Inbound Number Configuration
1. Provision a local or toll-free PSTN number in the client's local area code via Twilio Console or Exotel.
2. In Twilio Console, navigate to **Phone Numbers → Active Numbers → Voice & Fax Configuration**:
   - **A CALL COMES IN:** Select `Webhook`
   - **URL:** `https://<client-subdomain>.workers.dev/voice/incoming` (or `https://twilio-voice-agent-failover.sam-codes.workers.dev/voice/incoming`)
   - **HTTP METHOD:** `HTTP POST`
3. Configure the primary fallback path:
   - **PRIMARY HANDLER FAILS:** `Webhook`
   - **FALLBACK URL:** `https://<client-subdomain>.workers.dev/voice/fallback`
   - **HTTP METHOD:** `HTTP POST`
4. Set Status Callback URL:
   - **CALL STATUS CHANGES:** `https://<client-domain>/api/voice/status`
   - **HTTP METHOD:** `HTTP POST`

### 1.2 Cryptographic HMAC-SHA1 Signature Verification
Confirm that `TWILIO_AUTH_TOKEN` is loaded into the edge worker environment:
```bash
wrangler secret put TWILIO_AUTH_TOKEN
```
> **Fail-Closed Security Invariant:** In production (`NODE_ENV === "production"`), every incoming request without a valid `X-Twilio-Signature` is rejected with HTTP 401. If `TWILIO_AUTH_TOKEN` is unset or invalid, all webhooks fail closed.

---

## 🗄️ Step 2: Database & Durable Persistence Setup (5 Mins)

VaniEdge uses **Supabase PostgreSQL** for multi-instance persistence with an atomic local JSON disk fallback (`.data/`).

### 2.1 Apply Database Migration
Execute the consolidated production migration `supabase/migrations/20261027_vaniedge_auth.sql`:
```bash
# Using Supabase CLI:
supabase db push

# Or paste into the Supabase Dashboard SQL Editor:
# supabase/migrations/20261027_vaniedge_auth.sql
```

This migration provisions the following durable tables with Row Level Security (RLS):
- `vaniedge_users`: Password hashes (scrypt `N=16384, r=8, p=1`), salts, roles, and developer API keys.
- `vaniedge_sessions`: SHA-256 session token digests, expiration, and user linkages.
- `tenants`: Multi-tenant business profiles, operating hours, emergency keywords, and voice routing.
- `dispatch_tickets`: Customer appointments and service tickets with SHA-256 checksums.
- `call_sessions`: Telephony call lifecycles, latency telemetry, and triage logs.
- `idempotency_keys`: Distributed webhook deduplication and replay protection.
- `sutradb_knowledge`: Hybrid vector/lexical RAG document repository.

---

## 🧠 Step 3: Knowledge Ingestion into SutraDB (<10 Mins)

### 3.1 Format the Domain Knowledge Graph
Prepare the client's business facts into structured JSON chunks. For example, for a dental clinic:

```json
[
  {
    "title": "CarePlus Dental Clinic Operating Hours",
    "content": "Mon-Fri 9:00 AM - 7:00 PM, Saturday 10:00 AM - 4:00 PM. Emergency walk-ins accepted until 8:00 PM.",
    "category": "clinic"
  },
  {
    "title": "Consultation and Service Fees",
    "content": "Emergency toothache evaluation: $75. Routine cleaning: $120. Root canal consultation: $150. Insurance accepted: Delta Dental, Cigna, MetLife.",
    "category": "clinic"
  },
  {
    "title": "Staff Doctor Roster",
    "content": "Dr. Sharma (Pediatric & Family Dentistry), Dr. Chen (Endodontist & Emergency Surgery).",
    "category": "clinic"
  }
]
```

### 3.2 Ingest via Authenticated API
Ingestion (`PUT /api/query`) requires authentication using either a session cookie or a developer API key (`ve_live_...`):

```bash
curl -X PUT https://vaniedge.vercel.app/api/query \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ve_live_YOUR_API_KEY_HERE" \
  -d '{
    "title": "CarePlus Dental Hours & Pricing",
    "content": "Hours: Mon-Fri 9 AM - 7 PM. Emergency toothache fee: $75. Dr. Sharma on duty today.",
    "category": "clinic"
  }'
```
*Expected Response:*
```json
{
  "success": true,
  "message": "Document indexed successfully into SutraDB",
  "documentId": "careplus-dental-hours-pricing",
  "totalDocuments": 4
}
```

---

## 🎙️ Step 4: ElevenLabs Conversational Voice Agent Binding (10 Mins)

### 4.1 Provision Conversational Agent
1. Open ElevenLabs Console → **Conversational AI → Create Agent**.
2. Select Model: `eleven_turbo_v2` (ultra-low latency turn-taking).
3. Set Voice: Warm, professional localized persona (e.g. Rachel / Sarah for US, or Arya / Aditi for Indic).
4. Prompt Template:
   ```text
   You are the 24/7 AI Receptionist for {BUSINESS_NAME}.
   Your primary objective is to assist callers with business hours, answer service pricing, and schedule appointment slots.
   Be concise, professional, and courteous. Keep responses under 2 sentences to ensure rapid turn-taking.
   If the caller indicates a severe emergency, triage immediately and prepare a dispatch ticket.
   ```
5. Save the `AGENT_ID` into edge worker secrets:
   ```bash
   wrangler secret put ELEVENLABS_AGENT_ID
   ```

---

## 🛡️ Step 5: Telephony Failover Watchdog & Human Forwarding (5 Mins)

Configure the failover watchdog invariants in `wrangler.toml` or the edge environment:

```toml
[vars]
FAILOVER_CONNECT_TIMEOUT_MS = "1200"
FAILOVER_TTFT_TIMEOUT_MS = "1500"
FALLBACK_HUMAN_NUMBER = "+18005550199"   # Client's actual staff line
TWILIO_PHONE_NUMBER = "+18149613703"
```

### Verification Test:
1. Place a test call to the client number.
2. In `components/TelephonyMissionControl.tsx`, trigger the **"Simulate 1,500ms Timeout"** button.
3. Confirm that the Watchdog detects the silence breach at `1,200ms` and executes an atomic Twilio REST redirect (`<20ms`) to the human queue with polite holding audio.

---

## 📋 Step 6: BridgeView Portal & SMS Dispatch Webhooks (10 Mins)

### 6.1 Real-Time Lead & Ticket Setup
All ticket creations (`POST /api/dispatch`) require authentication and are verified with CSRF headers and sliding-window rate limits (15 requests/min):

```bash
curl -X POST https://vaniedge.vercel.app/api/dispatch \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ve_live_YOUR_API_KEY_HERE" \
  -d '{
    "callerName": "John Doe",
    "callerPhone": "+18005550199",
    "category": "clinic",
    "serviceType": "Emergency Toothache",
    "details": "Severe pain since yesterday, needs urgent consultation",
    "priority": "URGENT"
  }'
```

### 6.2 Ticket Lifecycle & Status Tracking
To maintain operational integrity, ticket statuses represent real external confirmations:
- **`CREATED`**: Ticket persisted durably with an 8-character SHA checksum (e.g. `7b84a92c`).
- **`ESCALATED`**: Urgent priority triage triggered; notifications queued.
- **`DISPATCHED`**: External SMS or technician webhook provider returns delivery success.
- **`CONFIRMED`**: Caller acknowledges appointment or technician accepts dispatch.

---

## ✅ Step 7: 15-Minute Pre-Handover Verification Matrix

Execute this automated checklist before delivering credentials to the client:

| Step | Verification Check | Command / Procedure | Pass Criteria | Verified |
| :---: | :--- | :--- | :--- | :---: |
| **1** | **Environment Auditor** | `pnpm check:env` | All required variables present & valid | [x] |
| **2** | **Static Typecheck** | `pnpm typecheck` | 0 TypeScript compiler errors | [x] |
| **3** | **Worker Build** | `pnpm build:ts` | Wrangler compilation clean | [x] |
| **4** | **Automated Tests** | `pnpm test` | All 60 tests pass across 8 suites | [x] |
| **5** | **Next.js Production Build** | `pnpm build` | Clean production build output | [x] |
| **6** | **Webhook Auth** | `curl -X POST /api/voice/incoming` | Returns 401 Unauthorized without HMAC signature | [x] |
| **7** | **IDOR Isolation** | `curl -X GET /api/agency/tenants/:id` | Returns 404 for unowned tenants | [x] |
| **8** | **Failover Watchdog** | Mission Control timeout simulation | Bridges call to human backup in `< 20ms` | [x] |

---

## 💰 Step 8: Handover & Recurring Support Handoff

Once all verification steps pass:
1. Deliver the client their dedicated **BridgeView Dashboard URL** (`https://vaniedge.vercel.app`).
2. Provide admin credentials or generate a dedicated developer API key (`ve_live_...`).
3. Collect the **$300 installation fee**.
4. Set up the **$20–$100/month recurring support share** covering telephony monitoring, prompt updates, and monthly minutes quota.
