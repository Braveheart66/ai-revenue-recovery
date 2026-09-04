import { Request, Response } from 'express';
import { verifyWebhookSignature } from '../config/razorpay';
import prisma from '../config/db';
import { evaluateFailure } from '../services/aiRouter';
import { executeWhatsAppRecovery } from '../services/whatsappAgent';
import { checkRecoveryAllowed } from '../services/dunningPolicy';

interface RazorpayWebhookPayload {
  entity: string;
  account_id?: string;
  event: string;
  contains: string[];
  payload: {
    payment?: {
      entity: {
        id: string;
        order_id?: string;
        invoice_id?: string;
        amount?: number;
        currency?: string;
        status?: string;
        error_code?: string | null;
        error_description?: string | null;
        error_source?: string | null;
        error_step?: string | null;
        error_reason?: string | null;
        contact?: string;
        email?: string;
        [key: string]: unknown;
      };
    };
    payment_link?: {
      entity: {
        id: string;
        reference_id?: string;
        order_id?: string;
        amount?: number;
        amount_paid?: number;
        status?: string;
        [key: string]: unknown;
      };
    };
    [key: string]: unknown;
  };
  created_at: number;
}

/**
 * Controller for POST /webhooks/razorpay
 * Handles both payment.failed (triggering AI dunning) and payment.captured / payment_link.paid (closing recovery loop)
 */
export const razorpayWebhookHandler = async (req: Request, res: Response): Promise<void> => {
  const signature = req.headers['x-razorpay-signature'] as string | undefined;
  const rawBody = req.body;

  // 1. Validate signature using the raw byte buffer
  const isValid = verifyWebhookSignature(rawBody, signature);
  if (!isValid) {
    res.status(400).json({
      error: 'Invalid signature',
      message: 'x-razorpay-signature header does not match expected HMAC SHA256 digest',
    });
    return;
  }

  // 2. Immediately respond with 200 OK to prevent Razorpay delivery timeouts
  res.status(200).json({ status: 'ok', received: true });

  // 3. Process event asynchronously without blocking the response
  (async () => {
    try {
      const rawString = Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : String(rawBody);
      const parsedData: RazorpayWebhookPayload = JSON.parse(rawString);
      const eventType = parsedData.event;

      // =======================================================================
      // CASE 1: PAYMENT SUCCESS / LOOP CLOSING (payment.captured, payment_link.paid)
      // =======================================================================
      if (eventType === 'payment.captured' || eventType === 'payment_link.paid') {
        const paymentEntity = parsedData.payload?.payment?.entity;
        const linkEntity = parsedData.payload?.payment_link?.entity;

        const orderId = paymentEntity?.order_id || linkEntity?.order_id;
        const paymentLinkId = linkEntity?.id;
        const amountPaise = paymentEntity?.amount || linkEntity?.amount_paid || linkEntity?.amount || 0;
        const amountRupees = (amountPaise / 100).toFixed(2);

        let recoveredInvoiceId: string | undefined;

        // Try matching by order_id first
        if (orderId) {
          const invoiceByOrder = await prisma.invoice.findUnique({
            where: { razorpay_order_id: orderId },
          });
          if (invoiceByOrder) {
            recoveredInvoiceId = invoiceByOrder.id;
          }
        }

        // If not matched by order, try matching payment link ID from DunningAction
        if (!recoveredInvoiceId && paymentLinkId) {
          const matchedAction = await prisma.dunningAction.findFirst({
            where: { new_payment_link_id: paymentLinkId },
            include: { invoice: true },
          });
          if (matchedAction) {
            recoveredInvoiceId = matchedAction.invoice_id;
          }
        }

        // Also check reference_id if provided in payment link
        if (!recoveredInvoiceId && linkEntity?.reference_id) {
          const invoiceByRef = await prisma.invoice.findUnique({
            where: { id: linkEntity.reference_id },
          });
          if (invoiceByRef) {
            recoveredInvoiceId = invoiceByRef.id;
          }
        }

        if (recoveredInvoiceId) {
          // Update Invoice status to RECOVERED
          await prisma.invoice.update({
            where: { id: recoveredInvoiceId },
            data: { status: 'RECOVERED' },
          });

          // Update any pending/scheduled/in_progress DunningActions to SUCCESS
          await prisma.dunningAction.updateMany({
            where: { invoice_id: recoveredInvoiceId },
            data: { status: 'SUCCESS' },
          });

          console.log(
            `\n🎉 REVENUE RECOVERED: ₹${amountRupees} for Invoice [${recoveredInvoiceId}] (Event: ${eventType})\n`
          );
        } else {
          console.warn(
            `[Razorpay Webhook] Received ${eventType} but could not correlate to an active invoice (Order: ${orderId}, Link: ${paymentLinkId})`
          );
        }
        return;
      }

      // =======================================================================
      // CASE 2: PAYMENT FAILURE (payment.failed)
      // =======================================================================
      if (eventType !== 'payment.failed') {
        return;
      }

      const paymentEntity = parsedData.payload?.payment?.entity;
      if (!paymentEntity) {
        console.warn('[Razorpay Webhook] payment.failed event missing payment.entity');
        return;
      }

      const rawEventId = paymentEntity.id;
      const orderId = paymentEntity.order_id;
      const errorCode = paymentEntity.error_code || 'unknown_error';
      const errorDescription = paymentEntity.error_description || 'No description provided';
      const amountPaise = paymentEntity.amount || 10000;
      const userPhone = paymentEntity.contact || '+919876543210';

      let invoiceId: string;

      // Map or create Invoice
      if (orderId) {
        const existingInvoice = await prisma.invoice.findUnique({
          where: { razorpay_order_id: orderId },
        });

        if (existingInvoice) {
          invoiceId = existingInvoice.id;
        } else {
          const user = await prisma.user.upsert({
            where: { phone: userPhone },
            update: {},
            create: {
              name: 'Recovery Customer',
              phone: userPhone,
            },
          });

          const createdInvoice = await prisma.invoice.create({
            data: {
              user_id: user.id,
              razorpay_order_id: orderId,
              amount_paise: amountPaise,
              status: 'FAILED',
            },
          });
          invoiceId = createdInvoice.id;
        }
      } else {
        const user = await prisma.user.upsert({
          where: { phone: userPhone },
          update: {},
          create: {
            name: 'Recovery Customer',
            phone: userPhone,
          },
        });

        const createdInvoice = await prisma.invoice.create({
          data: {
            user_id: user.id,
            razorpay_order_id: `ord_direct_${rawEventId}`,
            amount_paise: amountPaise,
            status: 'FAILED',
          },
        });
        invoiceId = createdInvoice.id;
      }

      // Write PaymentWebhook record
      const webhookRecord = await prisma.paymentWebhook.create({
        data: {
          invoice_id: invoiceId,
          raw_event_id: rawEventId,
          error_code: errorCode,
          error_description: errorDescription,
        },
      });

      console.log(
        `[Razorpay Webhook] 📥 Recorded payment.failed [${webhookRecord.id}] for order [${orderId || rawEventId}] (Error: ${errorCode})`
      );

      // Check Stopping Rules (Compliance Policy: Max 3 attempts)
      const policyCheck = await checkRecoveryAllowed(invoiceId);
      if (!policyCheck.allowed) {
        console.log(
          `[Dunning Policy] Automated recovery halted for Invoice [${invoiceId}]. Policy Reason: ${policyCheck.reason}`
        );
        return;
      }

      // Autonomous AI Dunning Router Evaluation
      try {
        const aiDecision = await evaluateFailure(errorCode, errorDescription, amountPaise);

        // Write NEW record to DunningAction audit log table
        const dunningAction = await prisma.dunningAction.create({
          data: {
            invoice_id: invoiceId,
            strategy_chosen: aiDecision.strategy,
            ai_reasoning: aiDecision.reasoning,
            status: 'SCHEDULED',
          },
        });

        console.log(
          `\n🤖 AI Router Decided: [${aiDecision.strategy}] because [${aiDecision.reasoning}]`
        );
        console.log(`📋 Audit Trail Action ID: [${dunningAction.id}] - Status: SCHEDULED\n`);

        // Execute WhatsApp Recovery Agent immediately when WHATSAPP_NEGOTIATION is chosen
        if (aiDecision.strategy === 'WHATSAPP_NEGOTIATION') {
          console.log(`🚀 Triggering WhatsApp Negotiation Agent for Invoice [${invoiceId}]...`);
          await executeWhatsAppRecovery(
            invoiceId,
            amountPaise,
            userPhone,
            errorDescription,
            dunningAction.id
          );
        }
      } catch (aiErr) {
        console.error('[AI Router] Failed to evaluate or log dunning action:', aiErr);
      }
    } catch (err) {
      console.error('[Razorpay Webhook] Asynchronous processing error:', err);
    }
  })();
};

export default razorpayWebhookHandler;
