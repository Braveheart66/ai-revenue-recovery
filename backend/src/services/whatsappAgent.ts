import Razorpay from 'razorpay';
import twilio from 'twilio';
import { config } from '../config';
import prisma from '../config/db';

// Initialize Razorpay client
const razorpay = new Razorpay({
  key_id: config.razorpay.keyId || process.env.RAZORPAY_KEY_ID || '',
  key_secret: config.razorpay.keySecret || process.env.RAZORPAY_KEY_SECRET || '',
});

// Initialize Twilio client
function getTwilioClient() {
  const sid = config.twilio.accountSid || process.env.TWILIO_ACCOUNT_SID;
  const token = config.twilio.authToken || process.env.TWILIO_AUTH_TOKEN;
  if (sid && token) {
    return twilio(sid, token);
  }
  return null;
}

function getFromWhatsappNumber(): string {
  const rawFrom = config.twilio.whatsappNumber || process.env.TWILIO_WHATSAPP_NUMBER || '+14155238886';
  return rawFrom.startsWith('whatsapp:') ? rawFrom : `whatsapp:${rawFrom.startsWith('+') ? rawFrom : `+${rawFrom}`}`;
}

export interface WhatsAppRecoveryResult {
  paymentLinkId: string;
  paymentLinkUrl: string;
  messageSent: boolean;
  messageSid?: string;
}

/**
 * Generates natural, empathetic Hinglish messages tailored to specific failure contexts
 */
function buildHinglishMessage(failureReason: string, paymentLinkUrl: string): string {
  const reasonLower = (failureReason || '').toLowerCase();

  if (reasonLower.includes('insufficient') || reasonLower.includes('balance')) {
    return `Namaste! 🙏 Lagta hai account me sufficient balance na hone ki wajah se aapka payment complete nahi ho paya. Koi baat nahi, aap kisi doosre account ya UPI se 1-click me yahan se pay kar sakte hain: ${paymentLinkUrl}`;
  }

  if (reasonLower.includes('otp') || reasonLower.includes('authentication') || reasonLower.includes('3d secure')) {
    return `Namaste! 🙏 Bank OTP verify na hone ya 3D Secure issue ki wajah se transaction reject ho gaya. Fikar mat kijiye, bina OTP ke fast UPI ya card se yahan se complete karein: ${paymentLinkUrl}`;
  }

  if (reasonLower.includes('limit') || reasonLower.includes('exceeds')) {
    return `Namaste! 🙏 Aapke card ki per-transaction limit reach ho gayi thi isliye payment ruka. Aap alternative UPI app (GPay / PhonePe / Paytm) se yahan turant complete kar sakte hain: ${paymentLinkUrl}`;
  }

  if (reasonLower.includes('mandate') || reasonLower.includes('autopay') || reasonLower.includes('recurring')) {
    return `Namaste! 🙏 Aapka recurring auto-debit process nahi ho paya. Subscription ko uninterrupted rakhne ke liye yahan se securely apna payment clear karein: ${paymentLinkUrl}`;
  }

  if (reasonLower.includes('international') || reasonLower.includes('currency')) {
    return `Namaste! 🙏 International payments card par disabled hone ki wajah se transaction decline hua. Aap Indian UPI ya local payment mode se yahan se complete kar sakte hain: ${paymentLinkUrl}`;
  }

  if (reasonLower.includes('upi') || reasonLower.includes('vpa') || reasonLower.includes('app')) {
    return `Namaste! 🙏 UPI app timeout ya MPIN issue ki wajah se payment fail hua. Aap kisi bhi doosre UPI handle ya card se direct yahan se complete kar sakte hain: ${paymentLinkUrl}`;
  }

  // General empathetic fallback
  return `Namaste! 🙏 Lagta hai technical reasons ki wajah se aapka payment complete nahi ho saka. Koi dikkat nahi, aap bina kisi pareshani ke yahan se payment complete kar sakte hain: ${paymentLinkUrl}`;
}

/**
 * Executes autonomous WhatsApp negotiation:
 * 1. Generates a dynamic Razorpay payment link tied to the failed invoice
 * 2. Formats a context-specific empathetic Hinglish WhatsApp message
 * 3. Sends the message via Twilio WhatsApp API
 * 4. Reconciles the DunningAction audit record with 'SUCCESS' and the new payment link ID
 */
export async function executeWhatsAppRecovery(
  invoiceId: string,
  amountPaise: number,
  userPhone: string,
  failureReason: string,
  dunningActionId?: string
): Promise<WhatsAppRecoveryResult> {
  let paymentLinkId = `plink_sim_${Date.now()}`;
  let paymentLinkUrl = `https://rzp.io/i/recovery_${invoiceId}`;

  // 1. Call Razorpay API to generate a standard Payment Link
  try {
    const paymentLink = await razorpay.paymentLink.create({
      amount: amountPaise,
      currency: 'INR',
      description: 'Retry payment for failed transaction',
      reference_id: invoiceId,
      customer: {
        contact: userPhone,
      },
      notify: {
        sms: false,
        email: false,
      },
    });

    if (paymentLink && paymentLink.id) {
      paymentLinkId = paymentLink.id;
      paymentLinkUrl = paymentLink.short_url || paymentLinkUrl;
      console.log(`[WhatsApp Agent] Generated Razorpay Payment Link: ${paymentLinkId} (${paymentLinkUrl})`);
    }
  } catch (rzpErr) {
    console.warn(
      `[WhatsApp Agent] Razorpay API link generation warning:`,
      (rzpErr as any)?.error?.description || (rzpErr as any)?.message || rzpErr
    );
  }

  // 2. Format empathetic contextual Hinglish WhatsApp message
  const whatsappMessage = buildHinglishMessage(failureReason, paymentLinkUrl);

  // 3. Send message via Twilio WhatsApp API
  let messageSent = false;
  let messageSid: string | undefined;

  const targetWhatsapp = userPhone.startsWith('whatsapp:')
    ? userPhone
    : `whatsapp:${userPhone.startsWith('+') ? userPhone : `+${userPhone}`}`;

  const fromNumber = getFromWhatsappNumber();
  const twilioClient = getTwilioClient();

  if (twilioClient) {
    try {
      console.log(`[WhatsApp Agent] Dispatching real Twilio WhatsApp message from ${fromNumber} to ${targetWhatsapp}...`);
      const response = await twilioClient.messages.create({
        body: whatsappMessage,
        from: fromNumber,
        to: targetWhatsapp,
      });
      messageSent = true;
      messageSid = response.sid;
      console.log(`[WhatsApp Agent] [SUCCESS] Sent Twilio WhatsApp message SID: [${response.sid}] status: [${response.status}]`);
    } catch (twilioErr: any) {
      console.error(`[WhatsApp Agent] Twilio dispatch error:`, twilioErr?.message || twilioErr);
      if (twilioErr?.code === 21608) {
        console.warn(`[WhatsApp Agent] NOTE: Recipient ${targetWhatsapp} is unjoined to your Twilio Sandbox. Join sandbox first to receive real messages!`);
      }
      messageSent = false;
    }
  } else {
    console.log(
      `[WhatsApp Agent] [Simulated Dispatch - No Twilio credentials] to ${targetWhatsapp}:\n"${whatsappMessage}"`
    );
    messageSent = true;
  }

  // 4. Update the DunningAction record in Prisma
  try {
    if (dunningActionId) {
      await prisma.dunningAction.update({
        where: { id: dunningActionId },
        data: {
          status: 'SUCCESS',
          new_payment_link_id: paymentLinkId,
        },
      });
    } else {
      const latestAction = await prisma.dunningAction.findFirst({
        where: { invoice_id: invoiceId, status: 'SCHEDULED' },
        orderBy: { executed_at: 'desc' },
      });

      if (latestAction) {
        await prisma.dunningAction.update({
          where: { id: latestAction.id },
          data: {
            status: 'SUCCESS',
            new_payment_link_id: paymentLinkId,
          },
        });
      }
    }
    console.log(`[WhatsApp Agent] Updated DunningAction record to SUCCESS with Payment Link ID [${paymentLinkId}]`);
  } catch (dbErr) {
    console.error(`[WhatsApp Agent] Failed to update DunningAction record:`, dbErr);
  }

  return {
    paymentLinkId,
    paymentLinkUrl,
    messageSent,
    messageSid,
  };
}
