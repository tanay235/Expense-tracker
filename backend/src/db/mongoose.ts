import mongoose from 'mongoose';

import { config } from '../core/config';
import { logger } from '../core/logger';
import { ExpenseModel } from '../models/expense.model';

export async function connectDatabase(): Promise<void> {
  await mongoose.connect(config.mongoUri, { dbName: config.dbName });
  await ExpenseModel.syncIndexes();
  logger.info('MongoDB connected and indexes synchronized');
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
  logger.info('MongoDB disconnected');
}
