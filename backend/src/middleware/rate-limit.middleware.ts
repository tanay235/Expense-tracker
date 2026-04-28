import { NextFunction, Request, Response } from 'express';

import { config } from '../core/config';

const ONE_MINUTE_MS = 60 * 1000;

type UserWindow = {
  windowStartMs: number;
  count: number;
};

const postExpenseWindows = new Map<string, UserWindow>();

export function postExpenseRateLimiter(req: Request, res: Response, next: NextFunction): void {
  const userId = req.authUser?.userId;
  if (!userId) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }

  // Rate limiting protects write endpoints from abuse and accidental client retry loops.
  // Per-user limiting keeps one noisy client from overwhelming shared API/database capacity.
  const nowMs = Date.now();
  const current = postExpenseWindows.get(userId);

  if (!current || nowMs - current.windowStartMs >= ONE_MINUTE_MS) {
    postExpenseWindows.set(userId, { windowStartMs: nowMs, count: 1 });
    next();
    return;
  }

  if (current.count >= config.expensePostLimitPerMinute) {
    const retryAfterSeconds = Math.ceil((ONE_MINUTE_MS - (nowMs - current.windowStartMs)) / 1000);
    res.setHeader('Retry-After', retryAfterSeconds.toString());
    res.status(429).json({ message: 'Rate limit exceeded for expense creation. Try again later.' });
    return;
  }

  current.count += 1;
  postExpenseWindows.set(userId, current);
  next();
}
