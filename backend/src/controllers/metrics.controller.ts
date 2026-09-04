import { Request, Response } from 'express';
import prisma from '../config/db';

export const getRecoveryMetrics = async (_req: Request, res: Response): Promise<void> => {
  try {
    // 1. Fetch all invoices
    const invoices = await prisma.invoice.findMany({
      select: {
        id: true,
        amount_paise: true,
        status: true,
      },
    });

    const totalInvoicesProcessed = invoices.length;

    // Total At Risk = Sum of all invoices that encountered payment failure/pending
    const totalAtRiskPaise = invoices.reduce((acc, inv) => acc + inv.amount_paise, 0);

    // Total Recovered = Sum of invoices successfully recovered
    const totalRecoveredPaise = invoices
      .filter((inv) => inv.status === 'RECOVERED')
      .reduce((acc, inv) => acc + inv.amount_paise, 0);

    const recoveryRatePercentage =
      totalAtRiskPaise > 0
        ? parseFloat(((totalRecoveredPaise / totalAtRiskPaise) * 100).toFixed(2))
        : 0;

    // 2. Breakdown by AI Strategy from DunningAction
    const actions = await prisma.dunningAction.findMany({
      select: {
        strategy_chosen: true,
      },
    });

    const breakdownByStrategy: Record<string, number> = {
      SILENT_RETRY: 0,
      WHATSAPP_NEGOTIATION: 0,
      VOICE_CALL: 0,
      ESCALATE_TO_HUMAN: 0,
    };

    for (const action of actions) {
      if (breakdownByStrategy[action.strategy_chosen] !== undefined) {
        breakdownByStrategy[action.strategy_chosen]++;
      }
    }

    // 3. Recent Audit Trail (Last 10 DunningActions)
    const recentAuditTrail = await prisma.dunningAction.findMany({
      take: 10,
      orderBy: { executed_at: 'desc' },
      include: {
        invoice: {
          select: {
            id: true,
            razorpay_order_id: true,
            amount_paise: true,
            status: true,
            user: {
              select: {
                name: true,
                phone: true,
              },
            },
          },
        },
      },
    });

    res.status(200).json({
      total_at_risk_paise: totalAtRiskPaise,
      total_recovered_paise: totalRecoveredPaise,
      recovery_rate_percentage: recoveryRatePercentage,
      total_invoices_processed: totalInvoicesProcessed,
      breakdown_by_strategy: breakdownByStrategy,
      recent_audit_trail: recentAuditTrail,
    });
  } catch (error) {
    console.error('[Metrics Controller] Error calculating metrics:', error);
    res.status(500).json({
      error: 'Internal server error calculating recovery metrics',
    });
  }
};
