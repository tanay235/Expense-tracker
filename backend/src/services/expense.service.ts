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

export async function listExpensesByUser(params: {
  userId: string;
  page: number;
  limit: number;
}) {
  const { userId, page, limit } = params;
  const normalizedUserId = new Types.ObjectId(userId);

  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    ExpenseModel.find({ user_id: normalizedUserId }).sort({ date: -1, created_at: -1 }).skip(skip).limit(limit).lean(),
    ExpenseModel.countDocuments({ user_id: normalizedUserId }),
  ]);

  return {
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}
