import { Router } from 'express';
import { getRecoveryMetrics } from '../controllers/metrics.controller';

const metricsRouter = Router();

// GET /api/metrics
metricsRouter.get('/', getRecoveryMetrics);

export default metricsRouter;
