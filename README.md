# AI Revenue Recovery Engine

Built for Razorpay AI Buildathon Track 03.

## Architecture
- **/backend**: Node.js, Express, TypeScript, Prisma, PostgreSQL (Neon), Gemini AI Router, Twilio WhatsApp Agent, Razorpay Webhooks.
- **/frontend**: Next.js, React, Tailwind CSS, Lucide icons, live telemetry dashboard.

## Features
1. **Raw Webhook Ingestion**: Preserves exact byte buffer for HMAC SHA256 signature verification.
2. **Autonomous AI Router**: Contextual failure diagnosis (`WHATSAPP_NEGOTIATION`, `SILENT_RETRY`, `VOICE_CALL`, `ESCALATE_TO_HUMAN`).
3. **Hinglish WhatsApp Agent**: Dynamic Razorpay payment link generation and empathetic WhatsApp negotiation.
4. **Compliance Stopping Rules**: Strict 3-attempt recovery policy; automatic transition to `HALTED` and escalation.
5. **Loop Closing Reconciliation**: Matches `payment.captured` and `payment_link.paid` back to original invoices.
6. **Real-time Telemetry API**: `GET /api/metrics` powering live revenue recovery metrics.

## Running Locally

### 1. Backend
```bash
cd backend
npm install
npm run dev
```

### 2. Frontend
```bash
cd frontend
npm install
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) for the live dashboard.
