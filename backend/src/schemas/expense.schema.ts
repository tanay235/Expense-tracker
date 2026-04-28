import { z } from 'zod';

export const createExpenseSchema = z.object({
  // Strict input validation at API boundary blocks malformed data before it reaches business logic.
  amount: z.number({ error: 'amount must be a number in paise' }).int('amount must be an integer').gt(0, 'amount must be greater than 0'),
  category: z.string({ error: 'category is required' }).trim().min(1, 'category is required'),
  description: z.string().trim().max(500).optional(),
  // Rejecting invalid or missing dates prevents unusable records in production reporting and sorting.
  date: z.coerce.date({ error: 'date is required' })
});

export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;
