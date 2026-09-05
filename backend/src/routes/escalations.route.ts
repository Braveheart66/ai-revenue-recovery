import { Router, Request, Response } from 'express';
import prisma from '../config/db';

const router = Router();

// GET /api/escalations - Fetch all escalated cases with invoice and user details
router.get('/', async (_req: Request, res: Response) => {
  try {
    const escalations = await prisma.dunningAction.findMany({
      where: {
        strategy_chosen: 'ESCALATE_TO_HUMAN',
      },
      orderBy: { executed_at: 'desc' },
      include: {
        invoice: {
          include: {
            user: true,
            webhooks: {
              orderBy: { received_at: 'desc' },
              take: 1,
            },
          },
        },
      },
    });

    // Map each escalation to a specialized human officer based on error type
    const enriched = escalations.map((action) => {
      const lastWebhook = action.invoice?.webhooks?.[0];
      const errorCode = (lastWebhook?.error_code || 'MANUAL_INTERVENTION').toLowerCase();
      const reasoning = action.ai_reasoning || '';
      const isMaxRetriesExhausted = reasoning.includes('Hard stopping rule') || reasoning.includes('Max retries') || action.invoice?.status === 'HALTED';

      let assignedOfficer = {
        name: 'Pooja Sharma',
        role: 'Key Account Manager (Enterprise Billing)',
        department: 'Merchant Customer Success',
        email: 'pooja.sharma@merchant-ops.com',
        avatar: 'PS',
        slaHours: '4h SLA',
        recommendedAction: 'Contact customer finance team for mandate renewal / alternative card.',
      };

      if (isMaxRetriesExhausted) {
        assignedOfficer = {
          name: 'Pooja Sharma',
          role: 'Key Account Manager (Enterprise Billing)',
          department: 'Customer Success & Tier-2 Support',
          email: 'pooja.sharma@merchant-ops.com',
          avatar: 'PS',
          slaHours: '2h SLA',
          recommendedAction: 'Hard cap exceeded (3 retries failed). Reach out directly to customer for manual reconciliation and mandate reset.',
        };
      } else if (errorCode.includes('fraud') || errorCode.includes('risk')) {
        assignedOfficer = {
          name: 'Vikramaditya Rao',
          role: 'Senior Risk & Compliance Officer',
          department: 'Financial Crimes & Fraud Ops',
          email: 'vikram.rao@razorpay-risk.com',
          avatar: 'VR',
          slaHours: '1h Critical SLA',
          recommendedAction: 'Review transaction IP velocity and verify customer identity document.',
        };
      } else if (errorCode.includes('limit') || errorCode.includes('balance')) {
        assignedOfficer = {
          name: 'Ananya Verma',
          role: 'Senior Collections Specialist',
          department: 'Retail Recovery Desk',
          email: 'ananya.verma@recovery-desk.in',
          avatar: 'AV',
          slaHours: '8h Standard SLA',
          recommendedAction: 'Offer split-payment EMI arrangement or NetBanking wire transfer.',
        };
      }

      return {
        id: action.id,
        invoiceId: action.invoice_id,
        orderId: action.invoice?.razorpay_order_id,
        amountPaise: action.invoice?.amount_paise,
        customerName: action.invoice?.user?.name || 'Valued Customer',
        customerPhone: action.invoice?.user?.phone || '+919999999999',
        reasoning: action.ai_reasoning,
        status: action.status, // SCHEDULED, IN_PROGRESS, SUCCESS
        executedAt: action.executed_at,
        assignedOfficer,
      };
    });

    res.status(200).json({ success: true, escalations: enriched });
  } catch (error: any) {
    console.error('[Escalations API] Error fetching escalations:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/escalations/:id/resolve - Mark an escalated ticket as resolved by human
router.post('/:id/resolve', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { resolutionNotes, resolutionStatus = 'SUCCESS' } = req.body;

    const action = await prisma.dunningAction.findUnique({
      where: { id },
      include: { invoice: true },
    });

    if (!action) {
      return res.status(404).json({ success: false, error: 'Escalation ticket not found' });
    }

    // Update DunningAction to SUCCESS
    await prisma.dunningAction.update({
      where: { id },
      data: {
        status: resolutionStatus === 'SUCCESS' ? 'SUCCESS' : 'IN_PROGRESS',
        ai_reasoning: action.ai_reasoning + (resolutionNotes ? ` [Human Officer Note: ${resolutionNotes}]` : ' [Resolved by Human Officer]'),
      },
    });

    // If marked SUCCESS, mark invoice as RECOVERED
    if (resolutionStatus === 'SUCCESS') {
      await prisma.invoice.update({
        where: { id: action.invoice_id },
        data: { status: 'RECOVERED' },
      });
    }

    res.status(200).json({
      success: true,
      message: 'Escalated ticket resolved successfully by Human Officer',
      ticketId: id,
    });
  } catch (error: any) {
    console.error('[Escalations API] Error resolving ticket:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
