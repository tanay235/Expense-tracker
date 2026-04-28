import { Types } from 'mongoose';

import { ExpenseModel } from '../models/expense.model';
import { CreateExpenseInput } from '../schemas/expense.schema';

export async function createExpenseWithIdempotency(params: {
  payload: CreateExpenseInput;
  userId: string;
  idempotencyKey: string;
}) {
  const { payload, userId, idempotencyKey } = params;
  const normalizedUserId = new Types.ObjectId(userId);

  const existing = await ExpenseModel.findOne({
    idempotency_key: idempotencyKey,
    user_id: normalizedUserId
  }).lean();

  if (existing) {
    return { expense: existing, deduplicated: true };
  }

  const created = await ExpenseModel.create({
    ...payload,
    idempotency_key: idempotencyKey,
    user_id: normalizedUserId
  });

  return { expense: created.toObject(), deduplicated: false };
}
