import { InferSchemaType, Schema, model } from 'mongoose';

const expenseSchema = new Schema(
  {
    // Store money in paise to avoid floating-point rounding bugs in finance logic.
    amount: { type: Number, required: true, min: 1 },
    category: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: null },
    date: { type: Date, required: true },
    // Used with user_id to make POST retries safe and prevent duplicate inserts.
    idempotency_key: { type: String, required: true, trim: true },
    user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true }
  },
  {
    collection: 'expenses',
    timestamps: { createdAt: 'created_at', updatedAt: false },
    versionKey: false
  }
);

// category/date indexes support frequent filtering and time-ordered listing.
expenseSchema.index({ category: 1 });
expenseSchema.index({ date: -1 });
// Unique compound index enforces idempotent create per user.
expenseSchema.index({ idempotency_key: 1, user_id: 1 }, { unique: true });

export type ExpenseDocument = InferSchemaType<typeof expenseSchema>;

export const ExpenseModel = model<ExpenseDocument>('Expense', expenseSchema);
