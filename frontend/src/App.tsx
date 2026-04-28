import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';

type Expense = {
  _id: string;
  amount: number;
  category: string;
  description?: string | null;
  date: string;
  created_at: string;
};

type ExpenseListResponse = {
  items: Expense[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000';
const TOKEN_STORAGE_KEY = 'expense_tracker_token';

function formatRupeesFromPaise(paise: number): string {
  return `Rs. ${(paise / 100).toFixed(2)}`;
}

async function apiRequest<T>(path: string, options: RequestInit = {}, token?: string): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(body?.message ?? 'Request failed');
  }

  return (await response.json()) as T;
}

function App() {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_STORAGE_KEY));
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState('');

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [isListLoading, setIsListLoading] = useState(false);
  const [isAuthSubmitting, setIsAuthSubmitting] = useState(false);
  const [isExpenseSubmitting, setIsExpenseSubmitting] = useState(false);
  const [requestError, setRequestError] = useState('');

  // Local component state is enough here because auth + expense data are used on a single page.
  // This keeps the frontend simple and avoids introducing global state tooling prematurely.
  useEffect(() => {
    if (!token) {
      setExpenses([]);
      return;
    }

    void loadExpenses(token, categoryFilter);
  }, [token, categoryFilter]);

  async function loadExpenses(authToken: string, selectedCategory: string): Promise<void> {
    setIsListLoading(true);
    setRequestError('');

    try {
      const query = new URLSearchParams();
      if (selectedCategory.trim()) {
        query.set('category', selectedCategory.trim());
      }

      // API integration keeps filtering/sorting on backend query paths so large datasets are handled server-side.
      // The frontend only renders the returned slice, minimizing client-side processing.
      const result = await apiRequest<ExpenseListResponse>(
        `/expenses${query.toString() ? `?${query.toString()}` : ''}`,
        { method: 'GET' },
        authToken
      );

      setExpenses(result.items);
    } catch (error) {
      setRequestError(error instanceof Error ? error.message : 'Failed to load expenses');
    } finally {
      setIsListLoading(false);
    }
  }

  async function handleAuthSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (isAuthSubmitting) {
      return;
    }
    setIsAuthSubmitting(true);
    setRequestError('');
    setStatusMessage('');

    try {
      if (authMode === 'register') {
        await apiRequest<{ userId: string }>('/auth/register', {
          method: 'POST',
          body: JSON.stringify({ email, password }),
        });
        setStatusMessage('Registration successful. Please login.');
        setAuthMode('login');
        setPassword('');
        return;
      }

      const result = await apiRequest<{ token: string }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });

      localStorage.setItem(TOKEN_STORAGE_KEY, result.token);
      setToken(result.token);
      setStatusMessage('Login successful.');
      setPassword('');
    } catch (error) {
      setRequestError(error instanceof Error ? error.message : 'Authentication failed');
    } finally {
      setIsAuthSubmitting(false);
    }
  }

  async function handleExpenseSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!token || isExpenseSubmitting) {
      return;
    }

    // Disabling submit while a request is in-flight prevents accidental double-click duplicates.
    // This improves UX reliability by giving deterministic feedback during slow network calls.
    setIsExpenseSubmitting(true);
    setRequestError('');
    setStatusMessage('');

    try {
      await apiRequest<{ expense: Expense }>(
        '/expenses',
        {
          method: 'POST',
          headers: { 'Idempotency-Key': crypto.randomUUID() },
          body: JSON.stringify({
            amount: Number(amount),
            category,
            description: description || undefined,
            date,
          }),
        },
        token
      );

      setAmount('');
      setCategory('');
      setDescription('');
      setDate('');
      setStatusMessage('Expense added.');
      await loadExpenses(token, categoryFilter);
    } catch (error) {
      setRequestError(error instanceof Error ? error.message : 'Failed to add expense');
    } finally {
      setIsExpenseSubmitting(false);
    }
  }

  const totalPaise = useMemo(() => expenses.reduce((sum, item) => sum + item.amount, 0), [expenses]);

  function handleLogout(): void {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    setToken(null);
    setStatusMessage('Logged out.');
    setRequestError('');
  }

  return (
    <main className="container">
      <h1>Expense Tracker</h1>

      {!token ? (
        <section className="card">
          <h2>{authMode === 'login' ? 'Login' : 'Register'}</h2>
          <form onSubmit={(event) => void handleAuthSubmit(event)} className="form-grid">
            <label>
              Email
              <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
            </label>
            <label>
              Password
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                minLength={8}
                required
              />
            </label>
            <button type="submit" disabled={isAuthSubmitting}>
              {isAuthSubmitting ? 'Please wait...' : authMode === 'login' ? 'Login' : 'Create account'}
            </button>
          </form>
          <button
            type="button"
            className="link-button"
            disabled={isAuthSubmitting}
            onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}
          >
            {authMode === 'login' ? 'Need an account? Register' : 'Already have an account? Login'}
          </button>
        </section>
      ) : (
        <>
          <section className="card">
            <div className="row between">
              <h2>Add Expense</h2>
              <button type="button" onClick={handleLogout}>
                Logout
              </button>
            </div>
            <form onSubmit={(event) => void handleExpenseSubmit(event)} className="form-grid">
              <label>
                Amount (paise)
                <input
                  type="number"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  min={1}
                  step={1}
                  required
                />
              </label>
              <label>
                Category
                <input value={category} onChange={(event) => setCategory(event.target.value)} required />
              </label>
              <label>
                Description
                <input value={description} onChange={(event) => setDescription(event.target.value)} />
              </label>
              <label>
                Date
                <input type="date" value={date} onChange={(event) => setDate(event.target.value)} required />
              </label>
              <button type="submit" disabled={isExpenseSubmitting}>
                {isExpenseSubmitting ? 'Saving...' : 'Add expense'}
              </button>
            </form>
          </section>

          <section className="card">
            <div className="row between">
              <h2>My Expenses</h2>
              <label>
                Filter category
                <input value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} placeholder="e.g. Food" />
              </label>
            </div>
            <p className="total">Total (current list): {formatRupeesFromPaise(totalPaise)}</p>

            {isListLoading ? <p>Loading expenses...</p> : null}
            {!isListLoading && expenses.length === 0 ? <p>No expenses found.</p> : null}
            {!isListLoading && expenses.length > 0 ? (
              <ul className="expense-list">
                {expenses.map((expense) => (
                  <li key={expense._id}>
                    <div>
                      <strong>{expense.category}</strong> - {formatRupeesFromPaise(expense.amount)}
                      <div className="muted">{expense.description || 'No description'}</div>
                    </div>
                    <span>{new Date(expense.date).toLocaleDateString()}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
        </>
      )}

      {statusMessage ? <p className="success">{statusMessage}</p> : null}
      {requestError ? <p className="error">{requestError}</p> : null}
    </main>
  );
}

export default App;
