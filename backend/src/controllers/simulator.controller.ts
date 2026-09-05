import { Request, Response } from 'express';
import crypto from 'crypto';
import { config } from '../config';

/**
 * Utility to sign and dispatch a mock Razorpay webhook internally
 */
async function dispatchSignedWebhook(payload: object): Promise<{ status: number; text: string }> {
  const secret = config.razorpay.webhookSecret;
  if (!secret) {
    throw new Error('RAZORPAY_WEBHOOK_SECRET is not configured.');
  }

  const payloadString = JSON.stringify(payload);
  const signature = crypto
    .createHmac('sha256', secret)
    .update(payloadString)
    .digest('hex');

  const webhookUrl = `http://127.0.0.1:${config.port}/webhooks/razorpay`;

  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-razorpay-signature': signature,
    },
    body: payloadString,
  });

  const text = await res.text();
  return { status: res.status, text };
}

/**
 * POST /api/simulate/failure
 * Simulates a payment.failed Razorpay webhook event
 */
export async function simulateFailure(req: Request, res: Response) {
  try {
    const {
      error_code = 'BAD_REQUEST_ERROR',
      error_description = 'Payment failed due to insufficient funds',
      amount_paise = 499900,
      user_phone = '+919999999999',
    } = req.body;

    const timestamp = Math.floor(Date.now() / 1000);
    const orderId = `order_sim_${Date.now()}`;
    const paymentId = `pay_sim_${Date.now()}`;

    // Format phone number to clean string
    const customerContact = user_phone && String(user_phone).trim().length > 0 
      ? String(user_phone).trim() 
      : '+919999999999';

    const mockPayload = {
      entity: 'event',
      account_id: 'acc_simulation',
      event: 'payment.failed',
      contains: ['payment'],
      payload: {
        payment: {
          entity: {
            id: paymentId,
            entity: 'payment',
            amount: Number(amount_paise),
            currency: 'INR',
            status: 'failed',
            order_id: orderId,
            invoice_id: null,
            international: false,
            method: 'card',
            amount_refunded: 0,
            refund_status: null,
            captured: false,
            description: 'Simulated failure transaction',
            card_id: null,
            bank: null,
            wallet: null,
            vpa: null,
            email: 'customer@recoverytest.com',
            contact: customerContact,
            notes: {
              simulation: 'true',
            },
            fee: null,
            tax: null,
            error_code: String(error_code),
            error_description: String(error_description),
            error_source: 'customer',
            error_step: 'payment_authorization',
            error_reason: String(error_code).toLowerCase(),
            created_at: timestamp,
          },
        },
      },
      created_at: timestamp,
    };

    const webhookResult = await dispatchSignedWebhook(mockPayload);

    return res.status(200).json({
      success: true,
      message: 'Simulated payment.failed webhook triggered successfully',
      order_id: orderId,
      payment_id: paymentId,
      contact: customerContact,
      webhook_status: webhookResult.status,
      webhook_response: webhookResult.text,
    });
  } catch (error: any) {
    console.error('[Simulator] Failed to trigger failure simulation:', error);
    return res.status(500).json({
      success: false,
      error: error?.message || 'Failed to simulate payment failure',
    });
  }
}

/**
 * POST /api/simulate/payment
 * Simulates a payment_link.paid Razorpay webhook event
 */
export async function simulatePayment(req: Request, res: Response) {
  try {
    const { order_id, link_id, amount_paise = 499900 } = req.body;

    if (!order_id) {
      return res.status(400).json({
        success: false,
        error: 'Missing order_id in request body',
      });
    }

    const timestamp = Math.floor(Date.now() / 1000);
    const paymentLinkId = link_id || `plink_sim_${Date.now()}`;
    const paymentId = `pay_sim_success_${Date.now()}`;

    const mockPayload = {
      entity: 'event',
      account_id: 'acc_simulation',
      event: 'payment_link.paid',
      contains: ['payment_link', 'payment', 'order'],
      payload: {
        payment_link: {
          entity: {
            id: paymentLinkId,
            status: 'paid',
            amount: Number(amount_paise),
            amount_paid: Number(amount_paise),
            order_id,
            description: 'Recovery Payment Link (Simulated)',
            customer: {
              name: 'Recovery Customer',
              email: 'customer@recoverytest.com',
              contact: '+919999999999',
            },
            created_at: timestamp,
            updated_at: timestamp,
          },
        },
        payment: {
          entity: {
            id: paymentId,
            order_id,
            amount: Number(amount_paise),
            currency: 'INR',
            status: 'captured',
            method: 'upi',
            created_at: timestamp,
          },
        },
        order: {
          entity: {
            id: order_id,
            amount: Number(amount_paise),
            amount_paid: Number(amount_paise),
            status: 'paid',
            attempts: 1,
            created_at: timestamp,
          },
        },
      },
      created_at: timestamp,
    };

    const webhookResult = await dispatchSignedWebhook(mockPayload);

    return res.status(200).json({
      success: true,
      message: 'Simulated payment_link.paid webhook triggered successfully',
      order_id,
      link_id: paymentLinkId,
      payment_id: paymentId,
      webhook_status: webhookResult.status,
      webhook_response: webhookResult.text,
    });
  } catch (error: any) {
    console.error('[Simulator] Failed to trigger payment simulation:', error);
    return res.status(500).json({
      success: false,
      error: error?.message || 'Failed to simulate payment link settlement',
    });
  }
}
