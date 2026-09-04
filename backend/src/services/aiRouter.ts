import { AiStrategy } from '@prisma/client';

export interface AiEvaluationResult {
  strategy: AiStrategy;
  reasoning: string;
}

/**
 * Autonomous AI Router: Evaluates payment failure contexts (error code, description, and transaction amount)
 * to decide whether to trigger a silent queue retry, initiate WhatsApp negotiation, call, or escalate.
 */
export async function evaluateFailure(
  errorCode: string,
  errorDescription: string,
  amountPaise: number
): Promise<AiEvaluationResult> {
  const normalizedCode = (errorCode || '').toLowerCase();
  const normalizedDesc = (errorDescription || '').toLowerCase();
  const amountRupees = (amountPaise / 100).toFixed(2);

  // If GEMINI_API_KEY is present in environment, we can optionally query Google GenAI
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
- WHATSAPP_NEGOTIATION (for hard failures like insufficient_balance, card_limit_exceeded, card_expired where customer interaction can resolve with UPI/alternate payment)
- VOICE_CALL (for high value transactions > ₹10,000 with repeated or urgent failures)
- ESCALATE_TO_HUMAN (for fraud, suspicious activity, account blocked)

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

  // Autonomous contextual rule & diagnostic engine fallback
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

  if (
    normalizedCode.includes('insufficient') ||
    normalizedCode.includes('limit') ||
    normalizedCode.includes('expired') ||
    normalizedDesc.includes('insufficient balance') ||
    normalizedDesc.includes('limit') ||
    normalizedDesc.includes('expired')
  ) {
    return {
      strategy: AiStrategy.WHATSAPP_NEGOTIATION,
      reasoning: `Customer-side balance/limit constraint identified (${errorDescription || errorCode}). Initiating empathetic Hinglish WhatsApp conversational recovery offering instant UPI payment link.`,
    };
  }

  if (amountPaise > 1000000) {
    // > ₹10,000
    return {
      strategy: AiStrategy.VOICE_CALL,
      reasoning: `High-ticket transaction failure (₹${amountRupees}). Prioritizing voice call outreach for immediate settlement assurance.`,
    };
  }

  if (normalizedCode.includes('fraud') || normalizedCode.includes('blocked')) {
    return {
      strategy: AiStrategy.ESCALATE_TO_HUMAN,
      reasoning: `Security or account hold flag detected (${errorCode}). Escalating to human compliance officer.`,
    };
  }

  // Default fallback for user-level payment failures
  return {
    strategy: AiStrategy.WHATSAPP_NEGOTIATION,
    reasoning: `Card/payment authorization failed (${errorCode}). Engaging user on WhatsApp with contextual alternative payment options.`,
  };
}
