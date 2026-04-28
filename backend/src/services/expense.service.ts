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
  // Idempotency handles real-world retry scenarios: if client/network times out after create,
  // the client can resend the same request key and safely receive the original result.
  const lookup = {
    idempotency_key: idempotencyKey,
    user_id: normalizedUserId,
  };

  const existing = await ExpenseModel.findOne(lookup).lean();
  if (existing) {
    return { expense: existing };
  }

  try {
    const created = await ExpenseModel.create({
      ...payload,
      idempotency_key: idempotencyKey,
      user_id: normalizedUserId,
    });

    return { expense: created.toObject() };
  } catch (error) {
    // Duplicate prevention is critical for finance data: retry storms must not double-charge totals.
    // Unique (idempotency_key, user_id) ensures only one row wins; losers read and return that row.
    if ((error as { code?: number }).code === 11000) {
      const winner = await ExpenseModel.findOne(lookup).lean();
      if (winner) {
        return { expense: winner };
      }
    }
    throw error;
  }
}

export async function listExpensesByUser(params: {
  userId: string;
  page: number;
  limit: number;
  category?: string;
}) {
  const { userId, page, limit, category } = params;
  const normalizedUserId = new Types.ObjectId(userId);
  // Filtering stays user-scoped first, then optional category narrows only that user's dataset.
  const query: { user_id: Types.ObjectId; category?: string } = { user_id: normalizedUserId };
  if (category) {
    query.category = category;
  }

  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    // Newest-first ordering is deterministic using date desc with created_at as tie-breaker.
    ExpenseModel.find(query)
      // lean() avoids Mongoose document hydration overhead, keeping list responses efficient.
      .sort({ date: -1, created_at: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    ExpenseModel.countDocuments(query),
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
