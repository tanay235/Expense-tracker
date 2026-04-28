import { z } from 'zod';

export const createExpenseSchema = z.object({
  amount: z.number().int().positive(),
  category: z.string().trim().min(1),
  description: z.string().trim().max(500).optional(),
  date: z.coerce.date()
});

export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;
