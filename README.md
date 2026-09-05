# Autonomous Financial Recovery Engine

**Razorpay AI Buildathon — Track 03: Autonomous Financial Recovery Loop**  
An enterprise-grade, closed-loop financial recovery platform that intercepts transaction failures in real time, uses contextual AI to diagnose payment taxonomy, engages customers via empathetic multi-channel recovery flows (dynamic UPI links on WhatsApp), schedules jittered silent retries, and coordinates human merchant escalation for high-risk accounts.

---

## Executive Summary

Payment failures in online commerce and subscription billing typically result in involuntary churn, lost revenue, and poor customer experience. Traditional dunning tools rely on brute-force retry queues or generic SMS alerts that often trigger bank fraud limits or alienate users.

The **Autonomous Financial Recovery Engine** solves this problem by introducing an intelligent, self-healing recovery loop:
1. **Zero-Loss Webhook Processing**: Ingests Razorpay webhook payloads as untouched byte buffers to guarantee cryptographic HMAC SHA-256 verification.
2. **Context-Aware Triage**: Distinguishes between transient network glitches, balance limitations, and permanent instrument expirations.
3. **Empathetic Hinglish Engagement**: Generates dynamic, context-specific WhatsApp recovery links powered by Google Gemini and Twilio.
4. **Compliance-First Guardrails**: Strictly limits automated outreach to 3 attempts, halting bots to prevent regulatory non-compliance.
5. **Human-in-the-Loop Operations**: Escalates unrecoverable accounts (e.g. card expirations, fraud flags) directly to designated merchant officers.
6. **Full-Loop Reconciliation**: Listens for downstream payment link settlements and automatically balances the double-entry recovery ledger.

---

## System Architecture

```
                                  +-----------------------------+
                                  |   Razorpay Payment Gateway  |
                                  +-----------------------------+
                                                 |
                       [payment.failed]          |          [payment_link.paid]
                     HMAC SHA-256 Webhook        |         HMAC SHA-256 Webhook
                                                 v
+---------------------------------------------------------------------------------------------------+
|                                  BACKEND RECOVERY ENGINE                                          |
|                                                                                                   |
|  1. Ingestion Layer      -> Raw byte buffer verification via crypto.timingSafeEqual              |
|  2. Transaction Ledger   -> PostgreSQL (Neon Serverless) via Prisma ORM                           |
|  3. AI Triage Pipeline   -> Evaluates failure taxonomy, attempt count, and recovery strategy:     |
|                                                                                                   |
|     +---------------------------------------------------------------------------------------+     |
|     |  * WHATSAPP_NEGOTIATION  -> Real-time Hinglish messaging + instant dynamic UPI link   |     |
|     |  * SILENT_RETRY          -> Background queue with exponential backoff & jitter        |     |
|     |  * VOICE_CALL            -> Prioritized phone outreach for high-value transactions    |     |
|     |  * ESCALATE_TO_HUMAN     -> Strict 3-attempt safety bounds & Merchant Ops handoff     |     |
|     +---------------------------------------------------------------------------------------+     |
|                                                                                                   |
|  4. Reconciliation Core  -> Re-matches payment links and captured webhooks to root invoices       |
|  5. Escalations Manager  -> Tracks assignments, resolution notes, and SLA deadlines               |
+---------------------------------------------------------------------------------------------------+
                                                 ^
                                                 | Polling Telemetry (2s) / REST Actions
                                                 v
+---------------------------------------------------------------------------------------------------+
|                                  FRONTEND DASHBOARD (Next.js)                                     |
|                                                                                                   |
|  * Real-Time Telemetry    -> Live Revenue at Risk, Total Recovered, and Closed-Loop Rate          |
|  * AI Decision Audit Log  -> Chronological record of model reasoning, strategy, and status        |
|  * Live Control Center    -> 10 realistic payment failure scenarios for on-demand evaluation      |
|  * Human Escalation Desk  -> Dedicated operational modal with assigned officers and resolution log|
+---------------------------------------------------------------------------------------------------+
```

---

## Core Engineering Features

### 1. Cryptographic Ingestion & Timing-Safe Verification
Payment webhooks carry financial liability. To prevent replay attacks and payload tampering:
- The Express server registers the webhook route using `express.raw({ type: 'application/json' })` **before** any JSON parsing middleware.
- Signature verification compares the calculated HMAC digest with `x-razorpay-signature` using `crypto.timingSafeEqual`, preventing timing attacks.

### 2. Multi-Tier AI Decision Matrix
Instead of applying blanket retry policies, transaction failures are categorized into distinct operational pathways:

| Failure Mode | Root Cause Category | Recovery Action | Primary Channel |
| :--- | :--- | :--- | :--- |
| **Insufficient Balance** | Customer constraint | Generate 1-click dynamic UPI payment link | Empathetic WhatsApp |
| **Authentication Failed (OTP)** | Friction / timeout | Provide frictionless biometric or alternative app link | Empathetic WhatsApp |
| **Card Limit Exceeded** | Bank threshold | Recommend split or alternative UPI apps (GPay / PhonePe) | Empathetic WhatsApp |
| **Auto-Debit Mandate Failed** | Subscription glitch | Request instant one-touch manual replenishment | Empathetic WhatsApp |
| **Gateway Timeout** | Network transient | Silent background retry with randomized jitter | Background Queue |
| **Bank Servers Down** | Issuer outage | Delayed retry queue scheduled around bank recovery metrics | Background Queue |
| **Card Expired** | Expired instrument | Automatic outreach halted; account assigned to Merchant Desk | Human Ops Desk |
| **Risk / Fraud Flagged** | Security violation | Immediate freeze; handoff to Risk & Compliance Officer | Compliance Desk |

### 3. Contextual Hinglish Customer Outreach
Indian retail consumers respond significantly better to polite, conversational Hinglish than rigid English alerts. The platform uses Gemini 1.5 Flash (with built-in contextual fallback) to craft courteous, non-accusatory messages:
- Acknowledges the specific friction point politely (e.g. bank limits, OTP timeout).
- Delivers a secure Razorpay short URL (`https://rzp.io/rzp/...`) supporting UPI, NetBanking, and alternate cards.
- Sent directly via the Twilio WhatsApp API with automatic E.164 phone normalization (`+91`).

### 4. Compliance Stopping Rules & Guardrails
To adhere to the RBI Fair Practices Code for recovery and prevent spamming customers:
- Every invoice enforces a **hard maximum limit of 3 recovery attempts**.
- If 3 attempts elapse without settlement, the engine changes the invoice status to `HALTED`.
- The engine ceases automated communications and registers an `ESCALATE_TO_HUMAN` action in the audit trail.

### 5. Human Escalation Desk
Certain failure modes cannot—and should not—be handled by automated bots. The platform includes an interactive Escalation Desk that pairs accounts with specialized human officers:
- **Pooja Sharma** *(Key Account Manager)*: Handles card expirations and mandate renewals for corporate and high-value accounts.
- **Vikramaditya Rao** *(Senior Risk & Compliance Officer)*: Reviews suspicious transactions flagged by gateway risk engines.
- **Ananya Verma** *(Senior Collections Specialist)*: Investigates accounts that reached the 3-attempt cap to arrange customized payment plans.
- Operators can log resolution notes and mark tickets resolved, updating the ledger and setting the invoice to `RECOVERED`.

---

## Technical Stack

- **Backend Runtime**: Node.js & Express with TypeScript
- **Database & Persistence**: PostgreSQL (Neon Serverless) with Prisma ORM
- **AI Engine**: Google Gemini 1.5 Flash via `@google/genai`
- **Payment Infrastructure**: Razorpay Node.js SDK (Orders, Payments, Payment Links)
- **Messaging**: Twilio WhatsApp API
- **Frontend Application**: Next.js 16 (App Router, Turbopack), React 19, Tailwind CSS, Lucide Icons
- **Security**: Node.js `crypto` (HMAC SHA-256, `timingSafeEqual`), CORS Whitelist

---

## Quick Start & Local Development

### Prerequisites
- Node.js (v18.x or newer)
- Neon PostgreSQL connection string (or local PostgreSQL)
- Razorpay Test Key & Secret
- Twilio Account SID & Auth Token (WhatsApp Sandbox enabled)
- Google Gemini API Key *(Optional, heuristic fallback provided)*

### 1. Backend Setup
```bash
# Navigate to backend directory
cd backend

# Install dependencies
npm install

# Create environment configuration file
cp .env.example .env
```

Ensure your `backend/.env` file contains:
```env
PORT=8080
DATABASE_URL="postgresql://user:password@host/neondb?sslmode=require"
RAZORPAY_KEY_ID="rzp_test_YourKeyId"
RAZORPAY_KEY_SECRET="YourKeySecret"
RAZORPAY_WEBHOOK_SECRET="YourWebhookSecret"
TWILIO_ACCOUNT_SID="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
TWILIO_AUTH_TOKEN="your_twilio_auth_token"
TWILIO_WHATSAPP_NUMBER="whatsapp:+14155238886"
GEMINI_API_KEY="your_gemini_api_key"
```

Initialize database schemas:
```bash
npx prisma generate
npx prisma db push

# Start backend server
npm run dev
# Running at http://localhost:8080
```

### 2. Frontend Setup
```bash
# Open a new terminal and navigate to frontend directory
cd frontend

# Install dependencies
npm install

# Start Next.js development server
npm run dev
# Dashboard running at http://localhost:3000
```

---

## Evaluation Guide for Judges

1. Open **[http://localhost:3000](http://localhost:3000)** in your browser.
2. **Scenario 1: Autonomous WhatsApp Recovery**
   - In the **Live Control Center**, select **Insufficient Balance (Card maxed out)**.
   - Enter your phone number (or leave the default test number).
   - Click **⚡ Inject & Send WhatsApp Message**.
   - *Result*: A mock Razorpay webhook is signed and processed. Gemini crafts an empathetic Hinglish message, dispatches it via Twilio, and records the event in the audit trail.
3. **Scenario 2: Closing the Recovery Loop**
   - After injecting a failure, the **Active Simulation Target** displays the active `order_id`.
   - Click **💸 Simulate Customer Paying Link**.
   - *Result*: A `payment_link.paid` webhook settles the invoice. The recovery rate and **Revenue Recovered** metrics update in real time.
4. **Scenario 3: Non-Retriable Failure & Human Escalation**
   - In the scenario selector, choose **Card Expired (Expired payment instrument)**.
   - Click **🚨 Inject & Trigger Human Escalation**.
   - *Result*: The engine determines this instrument cannot be recovered automatically. The **Human Escalations** card increments.
   - Click **Open Desk →** on the Human Escalations card to view the operational drawer, inspect **Pooja Sharma**'s assigned profile, review the protocol, and click **Mark Resolved** to complete the workflow.

---

## API Summary

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/webhooks/razorpay` | Cryptographically verifies and routes incoming Razorpay gateway webhooks |
| `GET` | `/health` | Service uptime and database connectivity health probe |
| `GET` | `/api/metrics` | Aggregated recovery KPIs, strategy counts, and recent audit trail |
| `GET` | `/api/escalations` | Queue of escalated accounts with assigned human officer profiles |
| `POST` | `/api/escalations/:id/resolve` | Logs human officer notes and marks an escalated invoice recovered |
| `POST` | `/api/simulate/failure` | Dispatches an authentic mock `payment.failed` webhook internally |
| `POST` | `/api/simulate/payment` | Dispatches an authentic mock `payment_link.paid` webhook to close the loop |

---

## License
Built for the **Razorpay AI Buildathon (Track 03)**. Distributed under the MIT License.
