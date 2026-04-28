import { Router } from 'express';

import { authRouter } from './auth/auth.routes';
import { expenseRouter } from './expense.routes';
import { healthRouter } from './health.routes';

const apiRouter = Router();

apiRouter.use(healthRouter);
apiRouter.use(authRouter);
apiRouter.use(expenseRouter);

export { apiRouter };
