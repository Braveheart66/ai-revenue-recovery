import { GoogleGenAI } from '@google/genai';

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.trim() === '' || apiKey.includes('YourGeminiApiKeyHere')) {
    return null;
  }
  return new GoogleGenAI({ apiKey });
}

/**
 * Uses Gemini to generate dynamic, empathetic Hinglish recovery messages
 * with intelligent context reasoning. Falls back gracefully to heuristic Hinglish if key is absent.
 */
export async function generateHinglishRecoveryMessage(
  failureReason: string,
  amountPaise: number,
  paymentLinkUrl: string
): Promise<string> {
  const amountRupees = (amountPaise / 100).toFixed(2);
  const gemini = getGeminiClient();

  if (gemini) {
    try {
      const prompt = `You are an empathetic, professional financial recovery agent in India messaging a customer on WhatsApp.
A payment has failed for:
- Reason: "${failureReason}"
- Amount: ₹${amountRupees}
- Secure Recovery Payment Link: ${paymentLinkUrl}

Generate a concise, courteous WhatsApp message in natural Hinglish (conversational Hindi in English letters).
Guidelines:
1. Start with "Namaste! 🙏".
2. Empathetically explain why the payment failed without placing harsh blame on the customer.
3. Suggest an alternative (UPI apps like GPay/PhonePe/Paytm or alternative bank card).
4. Provide the exact payment link: ${paymentLinkUrl}.
5. Keep it under 260 characters, natural, polite, and persuasive. No robotic jargon.

Output ONLY the final WhatsApp message text.`;

      const response = await gemini.models.generateContent({
        model: 'gemini-1.5-flash',
        contents: prompt,
      });

      const messageText = response.text?.trim();
      if (messageText && messageText.length > 20) {
        console.log(`[Gemini AI] Generated contextual Hinglish message:\n"${messageText}"`);
        return messageText;
      }
    } catch (err: any) {
      console.warn(`[Gemini AI] Generation error (falling back to template engine):`, err?.message || err);
    }
  }

  // Graceful heuristic fallback engine if GEMINI_API_KEY is not yet supplied
  const reasonLower = (failureReason || '').toLowerCase();

  if (reasonLower.includes('insufficient') || reasonLower.includes('balance')) {
    return `Namaste! 🙏 Lagta hai account me sufficient balance na hone ki wajah se aapka ₹${amountRupees} ka payment complete nahi ho paya. Koi baat nahi, aap kisi doosre account ya UPI se 1-click me yahan se pay kar sakte hain: ${paymentLinkUrl}`;
  }

  if (reasonLower.includes('otp') || reasonLower.includes('authentication') || reasonLower.includes('3d secure')) {
    return `Namaste! 🙏 Bank OTP verify na hone ya 3D Secure issue ki wajah se transaction reject ho gaya. Fikar mat kijiye, bina OTP ke fast UPI ya card se yahan se complete karein: ${paymentLinkUrl}`;
  }

  if (reasonLower.includes('limit') || reasonLower.includes('exceeds')) {
    return `Namaste! 🙏 Aapke card ki per-transaction limit reach ho gayi thi isliye ₹${amountRupees} ka payment ruka. Aap alternative UPI app (GPay / PhonePe) se turant yahan se clear karein: ${paymentLinkUrl}`;
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

  return `Namaste! 🙏 Lagta hai technical reasons ki wajah se aapka ₹${amountRupees} ka payment complete nahi ho saka. Koi dikkat nahi, aap yahan se direct complete kar sakte hain: ${paymentLinkUrl}`;
}
