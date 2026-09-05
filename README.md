# ⚡ Autonomous Financial Recovery Loop (Track 03)

> **Built for Razorpay AI Buildathon Track 03: Autonomous Financial Recovery Loop**  
> An intelligent, autonomous recovery engine that intercepts failed transactions in real time, uses Gemini AI to diagnose payment failure taxonomy, engages customers via empathetic Hinglish WhatsApp messaging with smart payment links, schedules jittered silent retries, and closes the revenue recovery loop with 100% cryptographic ledger auditability.

---

## 🌟 Architectural Overview

```
                      +------------------------------------------+
                      |         Razorpay Payment Gateway         |
                      +------------------------------------------+
                                       |
                   [payment.failed]    |    [payment_link.paid]
                  HMAC SHA-256 Webhook |    HMAC SHA-256 Webhook
                                       v
+-----------------------------------------------------------------------------------+
|                        BACKEND ENGINE (Node.js / Express)                         |
|                                                                                   |
|  1. Raw Buffer Webhook Listener -> crypto.timingSafeEqual HMAC Verification      |
|  2. Transaction Ledger Storage   -> Prisma ORM + Neon PostgreSQL Serverless       |
|  3. Gemini 1.5 Pro AI Diagnosis  -> Classifies failure taxonomy & intent          |
|     +-------------------------------------------------------------------------+   |
|     |  * WHATSAPP_NEGOTIATION  -> Generates Razorpay UPI Link + Twilio Message|   |
|     |  * SILENT_RETRY          -> Exponential backoff + jitter retry queue    |   |
|     |  * VOICE_CALL            -> Scheduled phone follow-up                   |   |
|     |  * ESCALATE_TO_HUMAN     -> Strict 3-attempt safety bounds & handoff    |   |
|     +-------------------------------------------------------------------------+   |
|  4. Reconciliation Engine        -> Re-matches payment links to original invoice  |
|  5. Simulation Controller API    -> /api/simulate/{failure, payment}              |
+-----------------------------------------------------------------------------------+
                                       ^
                                       | Real-time Telemetry Polling (2s)
                                       v
+-----------------------------------------------------------------------------------+
|                        FRONTEND (Next.js 16 + Tailwind CSS)                       |
|                                                                                   |
|  - Revenue At Risk vs. Recovered Metrics                                          |
|  - Real-Time AI Decision Audit Log & Reasoning Trail                              |
|  - Interactive Live Control Center (Inject Failures & Simulate Customer Payment)  |
+-----------------------------------------------------------------------------------+
```

---

## 🚀 Key Innovations & Features

### 1. Cryptographically Secure Webhook Ingestion
- Ingests raw unparsed byte buffers (`express.raw({ type: 'application/json' })`) before any JSON middleware to guarantee bit-exact HMAC SHA-256 verification against Razorpay's webhook secret.
- Constant-time signature comparison using `crypto.timingSafeEqual` prevents timing attack vulnerabilities.

### 2. Autonomous Gemini AI Routing & Taxonomy Diagnosis
When a payment fails, Gemini evaluates customer telemetry, error codes, and attempt history:
- **`BAD_REQUEST_ERROR` / Insufficient Balance**: Deploys an empathetic Hinglish WhatsApp negotiation message containing an instant Razorpay dynamic UPI link.
- **`GATEWAY_ERROR` / Network Timeout**: Identifies transient technical glitches and schedules a non-intrusive background silent retry with randomized jitter.
- **`CARD_EXPIRED_ERROR` / Unauthorized**: Bypasses retries to avoid customer friction and flags the account for merchant escalation.

### 3. Strict Compliance & Boundary Rules (Guardrails)
- **Hard Maximum Cap**: Strictly enforces a maximum of **3 recovery attempts** per invoice.
- **Auto-Halt Escalation**: Exceeding bounds transitions the transaction status to `HALTED` and assigns it to human merchant support to prevent customer spamming.

### 4. Closed-Loop Revenue Reconciliation
- Intercepts both `payment.captured` and `payment_link.paid` webhooks.
- Dynamically resolves simulated or live payment links back to the root `Invoice` entity, updating the status to `RECOVERED` and incrementing total recovered metrics in the ledger.

### 5. Interactive Live Control Center
- Built-in simulation sandbox directly accessible from the frontend dashboard.
- Allows judges and operators to test the autonomous pipeline end-to-end:
  1. **Inject Failure Webhook**: Choose error taxonomy and amount to trigger an authentic signed webhook.
  2. **Simulate Customer Paying Link**: Simulates customer completing the generated payment link to visually demonstrate the loop closing live.

---

## 💻 Tech Stack

| Layer | Technologies |
| :--- | :--- |
| **Backend** | Node.js, Express, TypeScript, Prisma ORM, Neon PostgreSQL |
| **AI Diagnosis** | Google Gemini 1.5 Pro / Flash API via `@google/genai` |
| **Integrations** | Razorpay SDK (Orders, Payments, Payment Links), Twilio WhatsApp API |
| **Frontend** | Next.js 16 (Turbopack), React 19, Tailwind CSS, Lucide Icons |
| **Security** | Node `crypto` HMAC SHA-256, CORS Origin Whitelist |

---

## 🛠️ Local Setup & Quickstart

### Prerequisites
- Node.js (v18+)
- PostgreSQL or [Neon.tech](https://neon.tech) Serverless connection string
- Razorpay Test Account credentials
- Gemini API Key

### 1. Clone and Configure Backend
```bash
git clone https://github.com/Braveheart66/ai-revenue-recovery.git
cd ai-revenue-recovery/backend
npm install
```

Create `backend/.env` with:
```env
PORT=8080
DATABASE_URL="postgresql://user:pass@ep-cool-db.us-east-2.aws.neon.tech/neondb?sslmode=require"
RAZORPAY_KEY_ID="rzp_test_YourKeyHere"
RAZORPAY_KEY_SECRET="YourKeySecretHere"
RAZORPAY_WEBHOOK_SECRET="YourWebhookSecretHere"
GEMINI_API_KEY="YourGeminiApiKeyHere"
TWILIO_ACCOUNT_SID="AC_dummy"
TWILIO_AUTH_TOKEN="dummy_token"
TWILIO_WHATSAPP_FROM="whatsapp:+14155238886"
```

Initialize Prisma database:
```bash
npx prisma generate
npx prisma db push
```

Start the backend:
```bash
npm run dev
# Server running at http://localhost:8080
```

---

### 2. Configure and Run Frontend
In a new terminal window:
```bash
cd ai-revenue-recovery/frontend
npm install
npm run dev
# Dashboard running at http://localhost:3000
```

---

## 🧪 Testing the Autonomous Recovery Loop

1. Navigate to **`http://localhost:3000`** in your browser.
2. Locate the **Live Control Center** on the left sidebar:
   - **Step 1**: Select **Error Injection Type** (e.g. *Insufficient Balance*).
   - **Step 2**: Enter transaction amount in paise (e.g. `50000` paise = ₹500).
   - **Step 3**: Click **⚡ Inject Failure Webhook**.
     - *Observation*: An authentic signed `payment.failed` event is dispatched internally. Gemini analyzes the failure, creates a recovery record, and records its reasoning in the **AI Decision Audit Log**.
   - **Step 4**: Click **💸 Simulate Customer Paying Link**.
     - *Observation*: A signed `payment_link.paid` event settles the invoice. The recovery rate and **Revenue Recovered** cards instantly update!

---

## 📡 API Reference

### Webhooks
- `POST /webhooks/razorpay` — Raw HMAC SHA-256 signature verified webhook handler for `payment.failed`, `payment.captured`, and `payment_link.paid`.

### Telemetry & Metrics
- `GET /health` — Service uptime and database connection status.
- `GET /api/metrics` — Aggregated revenue at risk, recovered revenue, strategy breakdown, and recent audit trail.

### Simulation Control
- `POST /api/simulate/failure` — Injects a mock signed `payment.failed` webhook payload.
  ```json
  {
    "error_code": "BAD_REQUEST_ERROR",
    "error_description": "Insufficient balance in account",
    "amount_paise": 50000
  }
  ```
- `POST /api/simulate/payment` — Injects a mock signed `payment_link.paid` webhook payload to close the recovery loop.
  ```json
  {
    "order_id": "order_sim_123456",
    "amount_paise": 50000
  }
  ```

---

## 🛡️ License
Built for the **Razorpay AI Buildathon Track 03**. Distributed under the MIT License.
