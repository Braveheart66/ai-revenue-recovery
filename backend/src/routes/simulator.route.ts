import { Router } from 'express';
import { simulateFailure, simulatePayment } from '../controllers/simulator.controller';

const simulatorRouter = Router();

// POST /api/simulate/failure
simulatorRouter.post('/failure', simulateFailure);

// POST /api/simulate/payment
simulatorRouter.post('/payment', simulatePayment);

export default simulatorRouter;
