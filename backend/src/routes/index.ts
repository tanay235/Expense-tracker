import { Router } from 'express';

import { authRouter } from './auth/auth.routes';
import { healthRouter } from './health.routes';

const apiRouter = Router();

apiRouter.use(healthRouter);
apiRouter.use(authRouter);

export { apiRouter };
