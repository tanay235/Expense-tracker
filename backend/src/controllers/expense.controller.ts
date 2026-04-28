import { Request, Response } from 'express';

import { createExpenseSchema } from '../schemas/expense.schema';
import { createExpenseWithIdempotency, listExpensesByUser } from '../services/expense.service';

export async function createExpenseController(req: Request, res: Response): Promise<void> {
  const authUser = req.authUser;
  if (!authUser) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }

  const idempotencyKey = req.header('idempotency-key')?.trim();
  if (!idempotencyKey) {
    res.status(400).json({ message: 'Missing Idempotency-Key header' });
    return;
  }

  const parsed = createExpenseSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: 'Invalid expense payload', errors: parsed.error.flatten() });
    return;
  }

  const result = await createExpenseWithIdempotency({
    payload: parsed.data,
    userId: authUser.userId,
    idempotencyKey,
  });

  // For the same user + idempotency key we always return the same resource response.
  res.status(201).json(result);
}

export async function listExpensesController(req: Request, res: Response): Promise<void> {
  const authUser = req.authUser;
  if (!authUser) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }

  const parsedPage = Number(req.query.page ?? 1);
  const parsedLimit = Number(req.query.limit ?? 20);
  const page = Number.isFinite(parsedPage) ? Math.max(1, Math.floor(parsedPage)) : 1;
  const limit = Number.isFinite(parsedLimit) ? Math.min(100, Math.max(1, Math.floor(parsedLimit))) : 20;
  const category = typeof req.query.category === 'string' ? req.query.category.trim() : undefined;

  const result = await listExpensesByUser({
    userId: authUser.userId,
    page,
    limit,
    category,
  });

  res.status(200).json(result);
}
