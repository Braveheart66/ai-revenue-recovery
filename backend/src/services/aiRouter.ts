import { AiStrategy } from '@prisma/client';

export interface AiEvaluationResult {
  strategy: AiStrategy;
  reasoning: string;
}

/**
 * Autonomous AI Router: Evaluates payment failure contexts (error code, description, and transaction amount)
 * to decide whether to trigger a silent queue retry, initiate WhatsApp negotiation, voice call, or escalate to human.
 */
export async function evaluateFailure(
  errorCode: string,
  errorDescription: string,
  amountPaise: number
): Promise<AiEvaluationResult> {
  const normalizedCode = (errorCode || '').toLowerCase();
  const normalizedDesc = (errorDescription || '').toLowerCase();
  const amountRupees = (amountPaise / 100).toFixed(2);

  // If GEMINI_API_KEY is present in environment, query Google GenAI
  const geminiApiKey = process.env.GEMINI_API_KEY;

  if (geminiApiKey) {
    try {
      const prompt = `You are an autonomous financial recovery collections agent. 
Analyze this failed transaction and decide the optimal recovery strategy.
- Error Code: ${errorCode}
- Error Description: ${errorDescription}
- Amount: ₹${amountRupees}

Allowed strategies:
- SILENT_RETRY (for soft gateway timeouts, network blips, bank downtime)
- WHATSAPP_NEGOTIATION (for hard failures like insufficient_balance, card_limit_exceeded where customer interaction can resolve with UPI/alternate payment)
- VOICE_CALL (for high value transactions > ₹10,000 with repeated or urgent failures)
- ESCALATE_TO_HUMAN (for non-retriable card expiration, expired instrument, fraud, suspicious activity, account blocked)

Return JSON with format: {"strategy": "<AiStrategy>", "reasoning": "<concise explanation>"}`;

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: 'application/json' },
          }),
        }
      );

      if (response.ok) {
        const data: any = await response.json();
        const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (rawText) {
          const parsed = JSON.parse(rawText);
          if (parsed.strategy && Object.values(AiStrategy).includes(parsed.strategy)) {
            return {
              strategy: parsed.strategy as AiStrategy,
              reasoning: parsed.reasoning || 'AI diagnosed failure and assigned optimal recovery strategy.',
            };
          }
        }
      }
    } catch (err) {
      console.warn('[AI Router] Gemini API call fallback to contextual diagnostic engine:', err);
    }
  }

  // Explicit Card Expiration Rule -> Immediate ESCALATE_TO_HUMAN
  if (
    normalizedCode.includes('expired') ||
    normalizedCode.includes('card_expired') ||
    normalizedDesc.includes('expired') ||
    normalizedDesc.includes('validity')
  ) {
    return {
      strategy: AiStrategy.ESCALATE_TO_HUMAN,
      reasoning: `Card validity expired (${errorDescription || errorCode}). Instrument cannot be recovered autonomously. Halting retries and escalating directly to Human Account Manager for mandate renewal.`,
    };
  }

  // Soft network/gateway glitch rule -> SILENT_RETRY
  if (
    normalizedCode.includes('timeout') ||
    normalizedCode.includes('gateway') ||
    normalizedCode.includes('server_error') ||
    normalizedDesc.includes('timeout') ||
    normalizedDesc.includes('downtime') ||
    normalizedDesc.includes('network')
  ) {
    return {
      strategy: AiStrategy.SILENT_RETRY,
      reasoning: `Soft network/gateway glitch detected (${errorCode}). Scheduling silent automated retry with exponential backoff without disturbing customer.`,
    };
  }

  // Balance or Limit issues -> WHATSAPP_NEGOTIATION
  if (
    normalizedCode.includes('insufficient') ||
    normalizedCode.includes('limit') ||
    normalizedDesc.includes('insufficient balance') ||
    normalizedDesc.includes('limit')
  ) {
    return {
      strategy: AiStrategy.WHATSAPP_NEGOTIATION,
      reasoning: `Customer-side balance/limit constraint identified (${errorDescription || errorCode}). Initiating empathetic Hinglish WhatsApp conversational recovery offering instant UPI payment link.`,
    };
  }

  // High-ticket rule (> ₹10,000) -> VOICE_CALL
  if (amountPaise > 1000000) {
    return {
      strategy: AiStrategy.VOICE_CALL,
      reasoning: `High-ticket transaction failure (₹${amountRupees}). Prioritizing voice call outreach for immediate settlement assurance.`,
    };
  }

  // Fraud or blocked accounts -> ESCALATE_TO_HUMAN
  if (normalizedCode.includes('fraud') || normalizedCode.includes('blocked')) {
    return {
      strategy: AiStrategy.ESCALATE_TO_HUMAN,
      reasoning: `Security or account hold flag detected (${errorCode}). Escalating to human compliance officer.`,
    };
  }

  // Default fallback -> WHATSAPP_NEGOTIATION
  return {
    strategy: AiStrategy.WHATSAPP_NEGOTIATION,
    reasoning: `Card/payment authorization failed (${errorCode}). Engaging user on WhatsApp with contextual alternative payment options.`,
  };
}
