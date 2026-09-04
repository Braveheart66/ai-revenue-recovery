import express, { Request, Response } from 'express';
import cors from 'cors';
import { config } from './config';
import { razorpayWebhookHandler } from './webhooks/razorpay';
import metricsRouter from './routes/metrics.route';

const app = express();

app.use(cors());

// CRITICAL: Mount the Razorpay webhook route with express.raw() BEFORE global express.json()
// This preserves the exact untouched byte buffer for HMAC SHA256 signature verification.
app.post(
  '/webhooks/razorpay',
  express.raw({ type: 'application/json' }),
  razorpayWebhookHandler
);

// Global body parsers applied only to all other routes
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Metrics API Route
app.use('/api/metrics', metricsRouter);

// Health Check Endpoint
app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    service: 'financial-recovery-backend',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Root Endpoint
app.get('/', (_req: Request, res: Response) => {
  res.json({
    name: 'Autonomous Financial Recovery Engine API',
    status: 'running',
    endpoints: {
      health: 'GET /health',
      metrics: 'GET /api/metrics',
      razorpayWebhook: 'POST /webhooks/razorpay',
    },
  });
});

const PORT = config.port;

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`[Recovery Engine API] Server running on port ${PORT}`);
    console.log(`[Recovery Engine API] Health Check at http://localhost:${PORT}/health`);
    console.log(`[Recovery Engine API] Recovery Metrics at http://localhost:${PORT}/api/metrics`);
    console.log(`[Recovery Engine API] Razorpay Webhook listening at http://localhost:${PORT}/webhooks/razorpay (Raw Buffer)`);
  });
}

export default app;
