import { Request, Response } from 'express';

export function healthCheckController(_req: Request, res: Response): void {
  res.status(200).json({ status: 'ok' });
}
