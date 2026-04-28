import { createExpenseSchema } from './expense.schema';

describe('createExpenseSchema', () => {
  it('fails validation when amount is invalid', () => {
    // Validates that API boundary rejects non-positive amounts before persistence.
    // This is important because financial data corruption is expensive to correct later.
    const result = createExpenseSchema.safeParse({
      amount: 0,
      category: 'Food',
      date: '2026-04-28',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain('greater than 0');
    }
  });
});
