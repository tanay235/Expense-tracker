import { app } from './app';
import { config } from './core/config';
import { logger } from './core/logger';
import { connectDatabase, disconnectDatabase } from './db/mongoose';

async function bootstrap(): Promise<void> {
  await connectDatabase();

  app.listen(config.port, () => {
    logger.info(`Server started on port ${config.port}`);
  });
}

bootstrap().catch((error) => {
  logger.error(error);
  process.exit(1);
});

process.on('SIGINT', async () => {
  await disconnectDatabase();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await disconnectDatabase();
  process.exit(0);
});
