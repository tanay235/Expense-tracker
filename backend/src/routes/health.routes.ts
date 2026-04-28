import { Router } from 'express';

import { healthCheckController } from '../controllers/health.controller';

const healthRouter = Router();

healthRouter.get('/health', healthCheckController);

export { healthRouter };
