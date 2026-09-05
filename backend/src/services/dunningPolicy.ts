import prisma from '../config/db';
import { AiStrategy } from '@prisma/client';

export interface PolicyCheckResult {
  allowed: boolean;
  attemptsCount: number;
  reason?: string;
}

const MAX_RECOVERY_ATTEMPTS = 3;

/**
 * Enforces compliance stopping rules:
 * - Maximum of 3 recovery attempts per invoice.
 * - If 3 attempts have been exhausted without success, halts automated outreach,
 *   sets Invoice.status = 'HALTED', and creates an ESCALATE_TO_HUMAN audit log.
 */
export async function checkRecoveryAllowed(invoiceId: string): Promise<PolicyCheckResult> {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      dunning_actions: true,
    },
  });

  if (!invoice) {
    return { allowed: false, attemptsCount: 0, reason: 'INVOICE_NOT_FOUND' };
  }

  // If already recovered or halted, do not attempt further automated outreach
  if (invoice.status === 'RECOVERED') {
    return { allowed: false, attemptsCount: invoice.dunning_actions.length, reason: 'ALREADY_RECOVERED' };
  }

  if (invoice.status === 'HALTED') {
    return { allowed: false, attemptsCount: invoice.dunning_actions.length, reason: 'ALREADY_HALTED' };
  }

  const attemptsCount = invoice.dunning_actions.length;

  if (attemptsCount >= MAX_RECOVERY_ATTEMPTS) {
    // 1. Halt further automated recovery
    await prisma.invoice.update({
      where: { id: invoiceId },
      data: { status: 'HALTED' },
    });

    // 2. Create ESCALATE_TO_HUMAN audit log action
    const escalationAction = await prisma.dunningAction.create({
      data: {
        invoice_id: invoiceId,
        strategy_chosen: AiStrategy.ESCALATE_TO_HUMAN,
        ai_reasoning: `Hard stopping rule triggered: ${attemptsCount} failed recovery attempts exhausted. Automated dunning halted and bounded. Escalated to Human Support.`,
        status: 'SCHEDULED',
      },
    });

    console.warn(
      `\n⚠️ [Compliance Stopping Rule] Invoice [${invoiceId}] reached ${attemptsCount} attempts. Status changed to HALTED.`
    );
    console.warn(
      `🛑 Created Escalation Action [${escalationAction.id}]: Max retries reached. Manual human intervention required.\n`
    );

    return {
      allowed: false,
      attemptsCount,
      reason: 'MAX_RETRIES_REACHED_HALTED',
    };
  }

  return {
    allowed: true,
    attemptsCount,
  };
}
