import { Request, Response } from 'express';
import crypto from 'crypto';
import { config } from '../config';

const getWebhookUrl = () => `http://127.0.0.1:${config.port}/webhooks/razorpay`;

/**
 * Helper to dispatch signed webhook internally to the Razorpay webhook listener
 */
async function dispatchSignedWebhook(payload: any): Promise<{ status: number; body: any }> {
  const bodyString = JSON.stringify(payload);
  const secret = config.razorpay.webhookSecret;
  const signature = crypto.createHmac('sha256', secret).update(bodyString).digest('hex');

  const webhookUrl = getWebhookUrl();
  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-razorpay-signature': signature,
    },
    body: bodyString,
  });

  const responseText = await response.text();
  let parsedBody: any;
  try {
    parsedBody = JSON.parse(responseText);
  } catch {
    parsedBody = responseText;
  }

  return {
    status: response.status,
    body: parsedBody,
  };
}

/**
 * POST /api/simulate/failure
 * Body: { error_code?, error_description?, amount_paise? }
 */
export const simulateFailure = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      error_code = 'insufficient_balance',
      error_description = 'Payment failed due to insufficient funds in account.',
      amount_paise = 250000,
    } = req.body || {};

    const orderId = `order_sim_${Date.now()}`;
    const paymentId = `pay_sim_${Date.now()}`;

    const payload = {
      entity: 'event',
      account_id: 'acc_SimulatedDemo',
      event: 'payment.failed',
      contains: ['payment'],
      payload: {
        payment: {
          entity: {
            id: paymentId,
            amount: Number(amount_paise),
            currency: 'INR',
            status: 'failed',
            order_id: orderId,
            error_code,
            error_description,
            error_source: 'issuer',
            error_step: 'payment_authorization',
            error_reason: error_code,
            contact: '+919876543210',
            email: 'customer@example.com',
          },
        },
      },
      created_at: Math.floor(Date.now() / 1000),
    };

    const webhookResult = await dispatchSignedWebhook(payload);

    res.status(200).json({
      success: true,
      simulated_event: 'payment.failed',
      order_id: orderId,
      payment_id: paymentId,
      error_code,
      error_description,
      amount_paise: Number(amount_paise),
      webhook_status: webhookResult.status,
    });
  } catch (error: any) {
    console.error('[Simulator] Error simulating failure:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to simulate payment failure',
      details: error?.message || error,
    });
  }
};

/**
 * POST /api/simulate/payment
 * Body: { order_id?, link_id?, amount_paise? }
 */
export const simulatePayment = async (req: Request, res: Response): Promise<void> => {
  try {
    const { order_id, link_id, amount_paise = 250000 } = req.body || {};

    const paymentId = `pay_recov_${Date.now()}`;
    const effectiveLinkId = link_id || `plink_sim_${Date.now()}`;

    const payload = {
      entity: 'event',
      account_id: 'acc_SimulatedDemo',
      event: 'payment_link.paid',
      contains: ['payment_link', 'payment'],
      payload: {
        payment_link: {
          entity: {
            id: effectiveLinkId,
            reference_id: order_id,
            amount: Number(amount_paise),
            amount_paid: Number(amount_paise),
            status: 'paid',
          },
        },
        payment: {
          entity: {
            id: paymentId,
            order_id: order_id,
            amount: Number(amount_paise),
            currency: 'INR',
            status: 'captured',
            contact: '+919876543210',
            email: 'customer@example.com',
          },
        },
      },
      created_at: Math.floor(Date.now() / 1000),
    };

    const webhookResult = await dispatchSignedWebhook(payload);

    res.status(200).json({
      success: true,
      simulated_event: 'payment_link.paid',
      order_id: order_id || null,
      link_id: effectiveLinkId,
      payment_id: paymentId,
      amount_paise: Number(amount_paise),
      webhook_status: webhookResult.status,
    });
  } catch (error: any) {
    console.error('[Simulator] Error simulating payment success:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to simulate payment success',
      details: error?.message || error,
    });
  }
};
