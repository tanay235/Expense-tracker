import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';

let mongoServer: MongoMemoryServer;
let appModule: typeof import('../app');
let dbModule: typeof import('../db/mongoose');
let expenseModelModule: typeof import('../models/expense.model');

describe('POST /expenses', () => {
  jest.setTimeout(30000);

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongoServer.getUri();
    process.env.DB_NAME = 'expense_tracker_test';
    process.env.JWT_SECRET = 'test-secret';
    process.env.JWT_EXPIRES_IN = '1h';

    dbModule = await import('../db/mongoose');
    appModule = await import('../app');
    expenseModelModule = await import('../models/expense.model');
    await dbModule.connectDatabase();
  });

  afterAll(async () => {
    await dbModule.disconnectDatabase();
    await mongoServer.stop();
  });

  it('creates an expense for an authenticated user', async () => {
    await expenseModelModule.ExpenseModel.deleteMany({});

    const userId = new mongoose.Types.ObjectId().toString();
    const token = jwt.sign({ sub: userId, email: 'test@example.com' }, process.env.JWT_SECRET as string, {
      algorithm: 'HS256',
      expiresIn: '1h',
    });

    // Validates the end-to-end protected creation flow: JWT auth + payload validation + DB write.
    // This catches regressions where auth wiring breaks or create route stops persisting correctly.
    const response = await request(appModule.app)
      .post('/expenses')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', 'phase10-api-test-key')
      .send({
        amount: 25050,
        category: 'Food',
        description: 'Lunch',
        date: '2026-04-28',
      });

    expect(response.status).toBe(201);
    expect(response.body.expense.amount).toBe(25050);
    expect(response.body.expense.category).toBe('Food');
    expect(response.body.expense.user_id).toBeDefined();
    expect(response.body.expense.idempotency_key).toBe('phase10-api-test-key');
  });
});
