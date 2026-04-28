import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import './style.css';

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

type ExpenseSummaryRow = {
  category: string;
  total: number;
};

type ExpenseSummaryResponse = {
  summary: ExpenseSummaryRow[];
};

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000';
const TOKEN_STORAGE_KEY = 'expense_tracker_token';
const USER_NAME_STORAGE_KEY = 'expense_tracker_user_name';
const USER_EMAIL_STORAGE_KEY = 'expense_tracker_user_email';

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
  const [userName, setUserName] = useState<string | null>(() => localStorage.getItem(USER_NAME_STORAGE_KEY));
  const [userEmail, setUserEmail] = useState<string | null>(() => localStorage.getItem(USER_EMAIL_STORAGE_KEY));
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  
  // Auth form fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Expense form fields
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState('');

  // UI state
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [summaryByCategory, setSummaryByCategory] = useState<ExpenseSummaryRow[]>([]);
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
      setSummaryByCategory([]);
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
      const summaryResult = await apiRequest<ExpenseSummaryResponse>('/expenses/summary', { method: 'GET' }, authToken);

      setExpenses(result.items);
      setSummaryByCategory(summaryResult.summary);
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
        if (password !== confirmPassword) {
          setRequestError('Passwords do not match');
          setIsAuthSubmitting(false);
          return;
        }

        if (!name.trim()) {
          setRequestError('Name is required');
          setIsAuthSubmitting(false);
          return;
        }

        await apiRequest<{ userId: string }>('/auth/register', {
          method: 'POST',
          body: JSON.stringify({ name: name.trim(), email, password }),
        });
        setStatusMessage('✓ Registration successful! Please login.');
        setAuthMode('login');
        setName('');
        setEmail('');
        setPassword('');
        setConfirmPassword('');
        return;
      }

      const result = await apiRequest<{ token: string; name: string; email: string }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });

      localStorage.setItem(TOKEN_STORAGE_KEY, result.token);
      localStorage.setItem(USER_NAME_STORAGE_KEY, result.name);
      localStorage.setItem(USER_EMAIL_STORAGE_KEY, result.email);
      
      setToken(result.token);
      setUserName(result.name);
      setUserEmail(result.email);
      setStatusMessage(`✓ Welcome ${result.name}!`);
      setEmail('');
      setPassword('');
      setName('');
      setConfirmPassword('');
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
      setStatusMessage('✓ Expense added successfully!');
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
    localStorage.removeItem(USER_NAME_STORAGE_KEY);
    localStorage.removeItem(USER_EMAIL_STORAGE_KEY);
    setToken(null);
    setUserName(null);
    setUserEmail(null);
    setStatusMessage('✓ Logged out successfully.');
    setRequestError('');
  }

  return (
    <div className="app-wrapper">
      <main className="container">
        {!token ? (
          <div className="auth-container">
            <div className="auth-card">
              <div className="auth-header">
                <h1>💰 Expense Tracker</h1>
                <p className="subtitle">{authMode === 'login' ? 'Welcome back!' : 'Create your account'}</p>
              </div>

              <form onSubmit={(event) => void handleAuthSubmit(event)} className="auth-form">
                {authMode === 'register' && (
                  <div className="form-group">
                    <label htmlFor="name">Full Name</label>
                    <input 
                      id="name"
                      type="text" 
                      value={name} 
                      onChange={(event) => setName(event.target.value)} 
                      placeholder="Enter your name"
                      disabled={isAuthSubmitting}
                      required 
                    />
                  </div>
                )}

                <div className="form-group">
                  <label htmlFor="email">Email Address</label>
                  <input 
                    id="email"
                    type="email" 
                    value={email} 
                    onChange={(event) => setEmail(event.target.value)} 
                    placeholder="Enter your email"
                    disabled={isAuthSubmitting}
                    required 
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="password">Password</label>
                  <input 
                    id="password"
                    type="password" 
                    value={password} 
                    onChange={(event) => setPassword(event.target.value)} 
                    placeholder={authMode === 'register' ? 'Min 8 characters' : 'Enter your password'}
                    minLength={authMode === 'register' ? 8 : 1}
                    disabled={isAuthSubmitting}
                    required 
                  />
                </div>

                {authMode === 'register' && (
                  <div className="form-group">
                    <label htmlFor="confirmPassword">Confirm Password</label>
                    <input 
                      id="confirmPassword"
                      type="password" 
                      value={confirmPassword} 
                      onChange={(event) => setConfirmPassword(event.target.value)} 
                      placeholder="Confirm your password"
                      minLength={8}
                      disabled={isAuthSubmitting}
                      required 
                    />
                  </div>
                )}

                <button type="submit" className="btn-primary" disabled={isAuthSubmitting}>
                  {isAuthSubmitting ? '⏳ Please wait...' : authMode === 'login' ? '🔓 Login' : '✏️ Create Account'}
                </button>
              </form>

              <div className="auth-toggle">
                <p>
                  {authMode === 'login' 
                    ? "Don't have an account? " 
                    : "Already have an account? "}
                  <button
                    type="button"
                    className="toggle-link"
                    disabled={isAuthSubmitting}
                    onClick={() => {
                      setAuthMode(authMode === 'login' ? 'register' : 'login');
                      setName('');
                      setEmail('');
                      setPassword('');
                      setConfirmPassword('');
                      setRequestError('');
                      setStatusMessage('');
                    }}
                  >
                    {authMode === 'login' ? 'Register here' : 'Login here'}
                  </button>
                </p>
              </div>

              {statusMessage && <div className="alert alert-success">{statusMessage}</div>}
              {requestError && <div className="alert alert-error">{requestError}</div>}
            </div>
          </div>
        ) : (
          <div className="dashboard">
            {/* Welcome Section */}
            <div className="welcome-card">
              <div className="welcome-content">
                <h1>👋 Welcome, {userName}!</h1>
                <p className="user-email">{userEmail}</p>
              </div>
              <button 
                type="button" 
                className="btn-secondary"
                onClick={handleLogout}
              >
                🚪 Logout
              </button>
            </div>

            {/* Status Messages */}
            {statusMessage && <div className="alert alert-success">{statusMessage}</div>}
            {requestError && <div className="alert alert-error">{requestError}</div>}

            {/* Add Expense Section */}
            <section className="card expense-form-card">
              <h2>➕ Add Expense</h2>
              <form onSubmit={(event) => void handleExpenseSubmit(event)} className="expense-form">
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="amount">Amount (paise)</label>
                    <input
                      id="amount"
                      type="number"
                      value={amount}
                      onChange={(event) => setAmount(event.target.value)}
                      placeholder="e.g., 500"
                      min={1}
                      step={1}
                      disabled={isExpenseSubmitting}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="category">Category</label>
                    <input 
                      id="category"
                      value={category} 
                      onChange={(event) => setCategory(event.target.value)} 
                      placeholder="e.g., Food, Transport"
                      disabled={isExpenseSubmitting}
                      required 
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="description">Description</label>
                    <input 
                      id="description"
                      value={description} 
                      onChange={(event) => setDescription(event.target.value)} 
                      placeholder="Optional"
                      disabled={isExpenseSubmitting}
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="date">Date</label>
                    <input 
                      id="date"
                      type="date" 
                      value={date} 
                      onChange={(event) => setDate(event.target.value)} 
                      disabled={isExpenseSubmitting}
                      required 
                    />
                  </div>
                </div>

                <button type="submit" className="btn-primary" disabled={isExpenseSubmitting}>
                  {isExpenseSubmitting ? '💾 Saving...' : '📝 Add Expense'}
                </button>
              </form>
            </section>

            {/* Expenses List */}
            <section className="card expenses-card">
              <div className="card-header">
                <h2>📊 My Expenses</h2>
                <div className="filter-group">
                  <input 
                    value={categoryFilter} 
                    onChange={(event) => setCategoryFilter(event.target.value)} 
                    placeholder="Filter by category..."
                    className="filter-input"
                  />
                </div>
              </div>
              
              <div className="total-box">
                <strong>Total: {formatRupeesFromPaise(totalPaise)}</strong>
              </div>

              {isListLoading && <p className="loading">⏳ Loading expenses...</p>}
              {!isListLoading && expenses.length === 0 && <p className="no-data">📭 No expenses found.</p>}
              {!isListLoading && expenses.length > 0 && (
                <ul className="expense-list">
                  {expenses.map((expense) => (
                    <li key={expense._id} className="expense-item">
                      <div className="expense-info">
                        <div className="expense-header">
                          <strong className="expense-category">{expense.category}</strong>
                          <span className="expense-amount">{formatRupeesFromPaise(expense.amount)}</span>
                        </div>
                        <div className="expense-description">
                          {expense.description || 'No description'}
                        </div>
                        <div className="expense-date">
                          📅 {new Date(expense.date).toLocaleDateString()}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Summary */}
            <section className="card summary-card">
              <h2>📈 Summary by Category</h2>
              {!isListLoading && summaryByCategory.length === 0 && <p className="no-data">📭 No summary data yet.</p>}
              {!isListLoading && summaryByCategory.length > 0 && (
                <ul className="summary-list">
                  {summaryByCategory.map((entry) => (
                    <li key={entry.category} className="summary-item">
                      <span className="summary-category">{entry.category}</span>
                      <span className="summary-total">{formatRupeesFromPaise(entry.total)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
