import { Router } from 'express';

import { createExpenseController, expenseSummaryController, listExpensesController } from '../controllers/expense.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { postExpenseRateLimiter } from '../middleware/rate-limit.middleware';

const expenseRouter = Router();

// Expense routes are protected so every read/write action is scoped to authenticated user identity.
expenseRouter.post('/expenses', requireAuth, postExpenseRateLimiter, createExpenseController);
expenseRouter.get('/expenses', requireAuth, listExpensesController);
expenseRouter.get('/expenses/summary', requireAuth, expenseSummaryController);

export { expenseRouter };
