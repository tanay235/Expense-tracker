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

// user_id index speeds up the primary access pattern: listing expenses for the logged-in user.
expenseSchema.index({ user_id: 1 });
// category index improves selective filtering when users query by expense category.
expenseSchema.index({ category: 1 });
// date descending index supports newest-first scans without in-memory sorting on large datasets.
expenseSchema.index({ date: -1 });
// Unique compound index prevents duplicate writes on retries by enforcing one key per user.
expenseSchema.index({ idempotency_key: 1, user_id: 1 }, { unique: true });

export type ExpenseDocument = InferSchemaType<typeof expenseSchema>;

export const ExpenseModel = model<ExpenseDocument>('Expense', expenseSchema);
