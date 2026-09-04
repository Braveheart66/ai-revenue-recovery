import { Request, Response, Router } from 'express';

export const webhookRouter = Router();

// Endpoint for receiving Razorpay webhooks
webhookRouter.post('/', (req: Request, res: Response) => {
  const signature = req.headers['x-razorpay-signature'] as string | undefined;
  const isRawBuffer = Buffer.isBuffer(req.body);

  // In later stages, signature validation and AI triage dispatch will be executed here
  res.status(200).json({
    received: true,
    hasSignature: Boolean(signature),
    rawBodyPreserved: isRawBuffer,
    byteLength: isRawBuffer ? (req.body as Buffer).length : 0,
  });
});
