import { Router } from 'express';

import { healthRouter } from './health.routes';

const apiRouter = Router();

apiRouter.use(healthRouter);

export { apiRouter };
