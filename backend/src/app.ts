import cors from 'cors';
import express from 'express';

import { logger } from './core/logger';
import { apiRouter } from './routes';

const app = express();

app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.use((req, _res, next) => {
  logger.info(`${req.method} ${req.originalUrl}`);
  next();
});

app.use(apiRouter);

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error(err);
  res.status(500).json({ message: 'Internal server error' });
});

export { app };
