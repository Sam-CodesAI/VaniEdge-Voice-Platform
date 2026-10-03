# 📘 VaniEdge & BridgeView Client Implementation Runbook
### *Standard Operating Procedure (SOP) for 60-Minute Turnkey Voice AI Deployments*

---

## 🎯 Purpose & Scope

This runbook defines the complete, end-to-end engineering protocol for deploying and supporting client installations of:
1. **BridgeView** (The Client Lead, Ticket & Telephony Operations Portal)
2. **The AI Customer Assistant** (Multi-channel web & conversational knowledge base)
3. **The AI Receptionist** (PSTN voice answering with sub-second failover)

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
1. Provision a local or toll-free PSTN number in the client's local area code via Twilio Console or Exotel (India BLR-01).
2. Navigate to **Phone Numbers → Active Numbers → Voice & Fax Configuration**:
   - **A CALL COMES IN:** Select `Webhook`
   - **URL:** `https://<client-subdomain>.workers.dev/voice/incoming` (or `https://twilio-voice-agent-failover.sam-codes.workers.dev/voice/incoming`)
   - **HTTP METHOD:** `HTTP POST`
3. Configure the primary fallback path:
   - **PRIMARY HANDLER FAILS:** `Webhook`
   - **FALLBACK URL:** `https://<client-subdomain>.workers.dev/voice/fallback`
   - **HTTP METHOD:** `HTTP POST`

### 1.2 Cryptographic HMAC-SHA1 Signature Verification
Confirm that `TWILIO_AUTH_TOKEN` is loaded into the edge worker environment:
```bash
wrangler secret put TWILIO_AUTH_TOKEN
```
Every incoming request must be authenticated via `X-Twilio-Signature` using `validateTwilioSignature()`.

---

## 🧠 Step 2: Knowledge Ingestion into SutraDB (<10 Mins)

### 2.1 Format the Domain Knowledge Graph
Prepare the client's business facts into structured Markdown or JSON chunks. For example, for a dental clinic:

```json
[
  {
    "id": "clinic-hours",
    "title": "CarePlus Dental Clinic Operating Hours",
    "content": "Mon-Fri 9:00 AM - 7:00 PM, Saturday 10:00 AM - 4:00 PM. Emergency walk-ins accepted until 8:00 PM.",
    "category": "clinic"
  },
  {
    "id": "clinic-fees",
    "title": "Consultation and Service Fees",
    "content": "Emergency toothache evaluation: $75. Routine cleaning: $120. Root canal consultation: $150. Insurance accepted: Delta Dental, Cigna, MetLife.",
    "category": "clinic"
  },
  {
    "id": "clinic-doctors",
    "title": "Staff Doctor Roster",
    "content": "Dr. Sharma (Pediatric & Family Dentistry), Dr. Chen (Endodontist & Emergency Surgery).",
    "category": "clinic"
  }
]
```

### 2.2 Ingest via Live Edge API
Execute the live ingestion request to SutraDB:
```bash
curl -X PUT https://vaniedge.vercel.app/api/query \
  -H "Content-Type: application/json" \
  -d '{
    "title": "CarePlus Dental Hours & Pricing",
    "content": "Hours: Mon-Fri 9 AM - 7 PM. Emergency toothache fee: $75. Dr. Sharma on duty today.",
    "category": "clinic"
  }'
```
*Expected Response:* `{"success": true, "latencyMs": 11.4, "totalDocuments": 4}`

---

## 🎙️ Step 3: ElevenLabs Conversational Voice Agent Binding (10 Mins)

### 3.1 Provision Conversational Agent
1. Open ElevenLabs Console → **Conversational AI → Create Agent**.
2. Select Model: `eleven_turbo_v2` (low latency, high turn responsiveness).
3. Set Voice: Warm, professional localized persona (e.g. Rachel / Sarah for US, or Arya / Aditi for Indic).
4. Prompt Template:
   ```text
   You are the 24/7 AI Receptionist for {BUSINESS_NAME}.
   Your primary objective is to assist callers with business hours, answer service pricing, and schedule appointment slots.
   Be concise, professional, and courteous. Keep responses under 2 sentences to ensure rapid turn-taking.
   If the caller indicates a severe emergency, triage immediately and prepare a dispatch ticket.
   ```
5. Grab the `AGENT_ID` and save to environment:
   ```bash
   wrangler secret put ELEVENLABS_AGENT_ID
   ```

---

## 🛡️ Step 4: Telephony Failover Watchdog & Human Forwarding (5 Mins)

Configure the zero-dropped-calls watchdog invariants in `wrangler.toml` or edge environment:

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

## 📋 Step 5: BridgeView Portal & SMS Dispatch Webhooks (10 Mins)

### 5.1 Real-Time Lead & Ticket Setup
Ensure the client's `POST /api/dispatch` handler is connected to their notification channel (Twilio SMS or WhatsApp Webhook):

- **Caller Confirmation:** Automatically formats and sends an SMS containing the ticket ID, appointment time, and address.
- **Cryptographic Checksum:** Every ticket receives an 8-character SHA hash (e.g. `7b84a92c`) to prevent ticket tampering or duplicate booking conflicts.
- **Client Staff Alert:** Dispatches an emergency SMS alert if the caller urgency is flagged as `HIGH` or `URGENT`.

---

## ✅ Step 6: 15-Minute Pre-Handover Verification Matrix

Execute this automated checklist before delivering credentials to the client:

| Step | Test Objective | Pass Criteria | Verified |
| :---: | :--- | :--- | :---: |
| **1** | Webhook Auth | `POST /voice/incoming` returns 401 without valid HMAC signature | [x] |
| **2** | Media Stream | TwiML `<Connect><Stream>` upgrades WebSocket in `< 50ms` | [x] |
| **3** | Turn Latency | Time-to-First-Audio-Byte (TTFT) clocks in at `< 450ms` | [x] |
| **4** | SutraDB RAG | Question on business hours retrieves exact hours in `< 15ms` | [x] |
| **5** | Barge-In | Speaking over the agent triggers immediate buffer flush (`< 15ms`) | [x] |
| **6** | Failover | Artificial 1,500ms silence bridges call to human backup without hanging up | [x] |
| **7** | Dispatch SMS | Test appointment generates ticket and sends SMS within 3 seconds | [x] |
| **8** | Production Build | Run `pnpm run build` & `tsc --noEmit` — 100% clean production compilation | [x] |

---

## 💰 Handover & Recurring Support Handoff

Once verified:
1. Deliver the client their dedicated **BridgeView Dashboard URL** (`https://vaniedge.vercel.app`).
2. Provide login credentials or generate a dedicated developer API key (`ve_live_...`).
3. Collect the **$300 installation fee**.
4. Set up the **$20–$100/month recurring support share** covering telephony monitoring, prompt updates, and monthly minutes quota.
