import { useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent, KeyboardEvent, ReactNode } from 'react';
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
  const [categorySearchInput, setCategorySearchInput] = useState('');
  const [showCategorySuggestions, setShowCategorySuggestions] = useState(false);
  const [highlightedSuggestionIndex, setHighlightedSuggestionIndex] = useState(-1);
  const [expenseSortOrder, setExpenseSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [showAddCategorySuggestions, setShowAddCategorySuggestions] = useState(false);
  const [highlightedAddCategoryIndex, setHighlightedAddCategoryIndex] = useState(-1);
  const [isSummaryModalOpen, setIsSummaryModalOpen] = useState(false);
  const [summarySelectedCategory, setSummarySelectedCategory] = useState<string | null>(null);
  const [summaryCategoryExpenses, setSummaryCategoryExpenses] = useState<Expense[]>([]);
  const [isSummaryCategoryLoading, setIsSummaryCategoryLoading] = useState(false);
  const [summaryCategoryError, setSummaryCategoryError] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [isListLoading, setIsListLoading] = useState(false);
  const [isAuthSubmitting, setIsAuthSubmitting] = useState(false);
  const [isExpenseSubmitting, setIsExpenseSubmitting] = useState(false);
  const [requestError, setRequestError] = useState('');

  const categoryFilterContainerRef = useRef<HTMLDivElement | null>(null);
  const addExpenseCategoryContainerRef = useRef<HTMLDivElement | null>(null);

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

  useEffect(() => {
    if (!showCategorySuggestions) {
      return;
    }

    const handlePointerDown = (event: MouseEvent | TouchEvent): void => {
      const container = categoryFilterContainerRef.current;
      if (!container) {
        return;
      }

      const targetNode = event.target as Node | null;
      if (!targetNode) {
        return;
      }

      if (!container.contains(targetNode)) {
        setShowCategorySuggestions(false);
        setHighlightedSuggestionIndex(-1);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
    };
  }, [showCategorySuggestions]);

  useEffect(() => {
    if (!showAddCategorySuggestions) {
      return;
    }

    const handlePointerDown = (event: MouseEvent | TouchEvent): void => {
      const container = addExpenseCategoryContainerRef.current;
      if (!container) {
        return;
      }

      const targetNode = event.target as Node | null;
      if (!targetNode) {
        return;
      }

      if (!container.contains(targetNode)) {
        setShowAddCategorySuggestions(false);
        setHighlightedAddCategoryIndex(-1);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
    };
  }, [showAddCategorySuggestions]);

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

  async function loadAllExpensesForCategory(authToken: string, selectedCategory: string): Promise<Expense[]> {
    const allItems: Expense[] = [];
    let page = 1;
    let totalPages = 1;

    while (page <= totalPages) {
      const query = new URLSearchParams({
        category: selectedCategory,
        page: String(page),
        limit: '100',
      });

      const result = await apiRequest<ExpenseListResponse>(`/expenses?${query.toString()}`, { method: 'GET' }, authToken);
      allItems.push(...result.items);
      totalPages = result.pagination.totalPages;
      page += 1;
    }

    return allItems;
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
            amount: Math.round(Number(amount) * 100), // Convert Rupees to Paise
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

  const availableCategories = useMemo(() => {
    const categories = new Set<string>();

    summaryByCategory.forEach((entry) => {
      if (entry.category && entry.category.trim()) {
        categories.add(entry.category.trim());
      }
    });

    expenses.forEach((expense) => {
      if (expense.category && expense.category.trim()) {
        categories.add(expense.category.trim());
      }
    });

    return Array.from(categories).sort((left, right) =>
      left.localeCompare(right, undefined, { sensitivity: 'base' })
    );
  }, [expenses, summaryByCategory]);

  type CategorySuggestion = {
    category: string;
    matchIndex: number;
    matchLength: number;
  };

  const filteredCategorySuggestions = useMemo<CategorySuggestion[]>(() => {
    const trimmedSearch = categorySearchInput.trim();
    if (!trimmedSearch) {
      return availableCategories.map((category) => ({ category, matchIndex: -1, matchLength: 0 }));
    }

    const searchTerm = trimmedSearch.toLowerCase();
    const matches: Array<CategorySuggestion & { score: number; matchOffset: number }> = [];

    for (const category of availableCategories) {
      const normalizedCategory = category.toLowerCase();
      const matchIndex = normalizedCategory.indexOf(searchTerm);
      if (matchIndex === -1) {
        continue;
      }

      // Relevance heuristic:
      // - exact/prefix matches first
      // - then word-boundary matches (e.g. "fast food" matches "food")
      // - then any other substring matches
      let score = 3;
      if (matchIndex === 0) {
        score = normalizedCategory.length === searchTerm.length ? 0 : 1;
      } else {
        const prevChar = normalizedCategory[matchIndex - 1];
        if (prevChar === ' ' || prevChar === '-' || prevChar === '_' || prevChar === '/') {
          score = 2;
        }
      }

      matches.push({
        category,
        matchIndex,
        matchLength: searchTerm.length,
        score,
        matchOffset: matchIndex,
      });
    }

    matches.sort((left, right) => {
      if (left.score !== right.score) {
        return left.score - right.score;
      }
      if (left.matchOffset !== right.matchOffset) {
        return left.matchOffset - right.matchOffset;
      }
      return left.category.localeCompare(right.category, undefined, { sensitivity: 'base' });
    });

    return matches.map(({ category, matchIndex, matchLength }) => ({ category, matchIndex, matchLength }));
  }, [availableCategories, categorySearchInput]);

  const addExpenseCategorySuggestions = useMemo<CategorySuggestion[]>(() => {
    const trimmedSearch = category.trim();
    if (!trimmedSearch) {
      return availableCategories.map((categoryName) => ({ category: categoryName, matchIndex: -1, matchLength: 0 }));
    }

    const searchTerm = trimmedSearch.toLowerCase();
    const matches: Array<CategorySuggestion & { score: number; matchOffset: number }> = [];

    for (const categoryName of availableCategories) {
      const normalizedCategory = categoryName.toLowerCase();
      const matchIndex = normalizedCategory.indexOf(searchTerm);
      if (matchIndex === -1) {
        continue;
      }

      let score = 3;
      if (matchIndex === 0) {
        score = normalizedCategory.length === searchTerm.length ? 0 : 1;
      } else {
        const prevChar = normalizedCategory[matchIndex - 1];
        if (prevChar === ' ' || prevChar === '-' || prevChar === '_' || prevChar === '/') {
          score = 2;
        }
      }

      matches.push({
        category: categoryName,
        matchIndex,
        matchLength: searchTerm.length,
        score,
        matchOffset: matchIndex,
      });
    }

    matches.sort((left, right) => {
      if (left.score !== right.score) {
        return left.score - right.score;
      }
      if (left.matchOffset !== right.matchOffset) {
        return left.matchOffset - right.matchOffset;
      }
      return left.category.localeCompare(right.category, undefined, { sensitivity: 'base' });
    });

    return matches.map(({ category: categoryName, matchIndex, matchLength }) => ({
      category: categoryName,
      matchIndex,
      matchLength,
    }));
  }, [availableCategories, category]);

  useEffect(() => {
    if (!showCategorySuggestions) {
      return;
    }

    setHighlightedSuggestionIndex((currentIndex) => {
      if (filteredCategorySuggestions.length === 0) {
        return -1;
      }
      if (currentIndex < 0) {
        return 0;
      }
      return Math.min(currentIndex, filteredCategorySuggestions.length - 1);
    });
  }, [filteredCategorySuggestions, showCategorySuggestions]);

  useEffect(() => {
    if (!showAddCategorySuggestions) {
      return;
    }

    setHighlightedAddCategoryIndex((currentIndex) => {
      if (addExpenseCategorySuggestions.length === 0) {
        return -1;
      }
      if (currentIndex < 0) {
        return 0;
      }
      return Math.min(currentIndex, addExpenseCategorySuggestions.length - 1);
    });
  }, [addExpenseCategorySuggestions, showAddCategorySuggestions]);

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

  function handleSelectCategory(selectedCategory: string): void {
    setCategoryFilter(selectedCategory);
    setCategorySearchInput(selectedCategory);
    setShowCategorySuggestions(false);
    setHighlightedSuggestionIndex(-1);
  }

  function handleClearFilter(): void {
    setCategoryFilter('');
    setCategorySearchInput('');
    setShowCategorySuggestions(false);
    setHighlightedSuggestionIndex(-1);
  }

  async function handleOpenSummaryCategory(categoryName: string): Promise<void> {
    if (!token) {
      return;
    }

    setIsSummaryModalOpen(true);
    setSummarySelectedCategory(categoryName);
    setSummaryCategoryExpenses([]);
    setSummaryCategoryError('');
    setIsSummaryCategoryLoading(true);

    try {
      const items = await loadAllExpensesForCategory(token, categoryName);
      items.sort((left, right) => {
        const leftTime = Number.isFinite(Date.parse(left.date)) ? Date.parse(left.date) : 0;
        const rightTime = Number.isFinite(Date.parse(right.date)) ? Date.parse(right.date) : 0;
        return rightTime - leftTime;
      });
      setSummaryCategoryExpenses(items);
    } catch (error) {
      setSummaryCategoryError(error instanceof Error ? error.message : 'Failed to load category transactions');
    } finally {
      setIsSummaryCategoryLoading(false);
    }
  }

  function handleCloseSummaryModal(): void {
    setIsSummaryModalOpen(false);
    setSummarySelectedCategory(null);
    setSummaryCategoryExpenses([]);
    setSummaryCategoryError('');
    setIsSummaryCategoryLoading(false);
  }

  function handleApplySummaryCategoryFilter(): void {
    if (!summarySelectedCategory) {
      return;
    }
    handleSelectCategory(summarySelectedCategory);
    handleCloseSummaryModal();
  }

  function renderCategorySuggestionLabel(suggestion: CategorySuggestion): ReactNode {
    if (suggestion.matchIndex < 0 || suggestion.matchLength <= 0) {
      return suggestion.category;
    }

    const beforeMatch = suggestion.category.slice(0, suggestion.matchIndex);
    const matchText = suggestion.category.slice(suggestion.matchIndex, suggestion.matchIndex + suggestion.matchLength);
    const afterMatch = suggestion.category.slice(suggestion.matchIndex + suggestion.matchLength);

    return (
      <>
        {beforeMatch}
        <mark className="match-mark">{matchText}</mark>
        {afterMatch}
      </>
    );
  }

  function handleCategorySearchKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key === 'Escape') {
      setShowCategorySuggestions(false);
      setHighlightedSuggestionIndex(-1);
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setShowCategorySuggestions(true);
      setHighlightedSuggestionIndex((currentIndex) => {
        const nextIndex = currentIndex < 0 ? 0 : currentIndex + 1;
        return Math.min(nextIndex, filteredCategorySuggestions.length - 1);
      });
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setShowCategorySuggestions(true);
      setHighlightedSuggestionIndex((currentIndex) => Math.max(currentIndex - 1, 0));
      return;
    }

    if (event.key === 'Enter') {
      if (!showCategorySuggestions) {
        return;
      }

      const suggestion = filteredCategorySuggestions[highlightedSuggestionIndex];
      if (suggestion) {
        event.preventDefault();
        handleSelectCategory(suggestion.category);
      }
    }
  }

  function handleAddExpenseCategorySelect(selectedCategory: string): void {
    setCategory(selectedCategory);
    setShowAddCategorySuggestions(false);
    setHighlightedAddCategoryIndex(-1);
  }

  function handleAddExpenseCategoryKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key === 'Escape') {
      setShowAddCategorySuggestions(false);
      setHighlightedAddCategoryIndex(-1);
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setShowAddCategorySuggestions(true);
      setHighlightedAddCategoryIndex((currentIndex) => {
        const nextIndex = currentIndex < 0 ? 0 : currentIndex + 1;
        return Math.min(nextIndex, addExpenseCategorySuggestions.length - 1);
      });
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setShowAddCategorySuggestions(true);
      setHighlightedAddCategoryIndex((currentIndex) => Math.max(currentIndex - 1, 0));
      return;
    }

    if (event.key === 'Enter') {
      if (!showAddCategorySuggestions) {
        return;
      }

      const suggestion = addExpenseCategorySuggestions[highlightedAddCategoryIndex];
      if (suggestion) {
        event.preventDefault();
        handleAddExpenseCategorySelect(suggestion.category);
      }
    }
  }

  const sortedExpenses = useMemo(() => {
    const sorted = [...expenses];
    sorted.sort((left, right) => {
      const leftTime = Number.isFinite(Date.parse(left.date)) ? Date.parse(left.date) : 0;
      const rightTime = Number.isFinite(Date.parse(right.date)) ? Date.parse(right.date) : 0;
      return expenseSortOrder === 'newest' ? rightTime - leftTime : leftTime - rightTime;
    });
    return sorted;
  }, [expenses, expenseSortOrder]);

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
                    <label htmlFor="amount">Amount (Rupees)</label>
                    <input
                      id="amount"
                      type="number"
                      value={amount}
                      onChange={(event) => setAmount(event.target.value)}
                      placeholder="e.g., 10.50"
                      min={0}
                      step={0.01}
                      disabled={isExpenseSubmitting}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="category">Category</label>
                    <div className="search-container" ref={addExpenseCategoryContainerRef}>
                      <input 
                        id="category"
                        value={category} 
                        onChange={(event) => {
                          setCategory(event.target.value);
                          setShowAddCategorySuggestions(true);
                          setHighlightedAddCategoryIndex(0);
                        }} 
                        onFocus={() => setShowAddCategorySuggestions(true)}
                        onKeyDown={handleAddExpenseCategoryKeyDown}
                        placeholder="e.g., Food, Transport"
                        disabled={isExpenseSubmitting}
                        required 
                      />

                      {showAddCategorySuggestions && addExpenseCategorySuggestions.length > 0 && (
                        <div className="suggestions-dropdown suggestions-dropdown--form" role="listbox" aria-label="Category suggestions">
                          <div className="suggestions-header">
                            <span className="suggestions-title">Categories ({availableCategories.length})</span>
                          </div>
                          <ul className="suggestions-list">
                            {addExpenseCategorySuggestions.map((suggestion, index) => (
                              <li key={suggestion.category}>
                                <button
                                  type="button"
                                  role="option"
                                  className={`suggestion-item ${index === highlightedAddCategoryIndex ? 'highlighted' : ''}`}
                                  onClick={() => handleAddExpenseCategorySelect(suggestion.category)}
                                  onMouseEnter={() => setHighlightedAddCategoryIndex(index)}
                                >
                                  <span className="category-name">{renderCategorySuggestionLabel(suggestion)}</span>
                                </button>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {showAddCategorySuggestions && category && addExpenseCategorySuggestions.length === 0 && (
                        <div className="suggestions-dropdown suggestions-dropdown--form" role="listbox" aria-label="Category suggestions">
                          <div className="no-suggestions">No categories match "{category}"</div>
                        </div>
                      )}
                    </div>
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
                  <div className="expense-controls">
                    <div className="search-container" ref={categoryFilterContainerRef}>
                      <input 
                        value={categorySearchInput} 
                        onChange={(event) => {
                          setCategorySearchInput(event.target.value);
                          setShowCategorySuggestions(true);
                          setHighlightedSuggestionIndex(0);
                        }}
                        onFocus={() => setShowCategorySuggestions(true)}
                        onKeyDown={handleCategorySearchKeyDown}
                        placeholder="🔍 Search categories..."
                        className="filter-input"
                        aria-label="Search and filter expense categories"
                      />
                      {categorySearchInput && (
                        <button
                          type="button"
                          className="clear-btn"
                          onClick={handleClearFilter}
                          title="Clear filter"
                        >
                          ✕
                        </button>
                      )}
                      
                      {showCategorySuggestions && filteredCategorySuggestions.length > 0 && (
                        <div className="suggestions-dropdown" role="listbox" aria-label="Category suggestions">
                          <div className="suggestions-header">
                            <span className="suggestions-title">Available Categories ({availableCategories.length})</span>
                            {categoryFilter && (
                              <span className="active-filter">✓ Filtered by: <strong>{categoryFilter}</strong></span>
                            )}
                          </div>
                          <ul className="suggestions-list">
                            {filteredCategorySuggestions.map((suggestion, index) => (
                              <li key={suggestion.category}>
                                <button
                                  type="button"
                                  role="option"
                                  aria-selected={categoryFilter === suggestion.category}
                                  className={`suggestion-item ${categoryFilter === suggestion.category ? 'active' : ''} ${
                                    index === highlightedSuggestionIndex ? 'highlighted' : ''
                                  }`}
                                  onClick={() => handleSelectCategory(suggestion.category)}
                                  onMouseEnter={() => setHighlightedSuggestionIndex(index)}
                                >
                                  <span className="category-name">{renderCategorySuggestionLabel(suggestion)}</span>
                                  {categoryFilter === suggestion.category && <span className="check-icon">✓</span>}
                                </button>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      
                      {showCategorySuggestions && categorySearchInput && filteredCategorySuggestions.length === 0 && (
                        <div className="suggestions-dropdown" role="listbox" aria-label="Category suggestions">
                          <div className="no-suggestions">
                            No categories match "{categorySearchInput}"
                          </div>
                        </div>
                      )}

                      {showCategorySuggestions && !categorySearchInput && availableCategories.length === 0 && (
                        <div className="suggestions-dropdown" role="listbox" aria-label="Category suggestions">
                          <div className="no-suggestions">No categories yet. Add an expense to create one.</div>
                        </div>
                      )}
                    </div>

                    <div className="sort-container">
                      <label htmlFor="expense-sort" className="sort-label">Sort by date</label>
                      <select
                        id="expense-sort"
                        className="sort-select"
                        value={expenseSortOrder}
                        onChange={(event) => setExpenseSortOrder(event.target.value as 'newest' | 'oldest')}
                        aria-label="Sort expenses by date"
                      >
                        <option value="newest">Newest → Oldest</option>
                        <option value="oldest">Oldest → Newest</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="total-box">
                <strong>Total: {formatRupeesFromPaise(totalPaise)}</strong>
              </div>

              {isListLoading && <p className="loading">⏳ Loading expenses...</p>}
              {!isListLoading && expenses.length === 0 && (
                <p className="no-data">
                  {categoryFilter ? `📭 No expenses found for "${categoryFilter}".` : '📭 No expenses found.'}
                </p>
              )}
              {!isListLoading && expenses.length > 0 && (
                <ul className="expense-list">
                  {sortedExpenses.map((expense) => (
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
                      <button
                        type="button"
                        className="summary-item-button"
                        onClick={() => void handleOpenSummaryCategory(entry.category)}
                        aria-label={`View transactions for ${entry.category}`}
                      >
                        <span className="summary-category">{entry.category}</span>
                        <span className="summary-total">{formatRupeesFromPaise(entry.total)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {isSummaryModalOpen && (
              <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="Category transactions">
                <div className="modal-content">
                  <div className="modal-header">
                    <div>
                      <h3 className="modal-title">Transactions: {summarySelectedCategory ?? ''}</h3>
                      <p className="modal-subtitle">Sorted newest → oldest</p>
                    </div>
                    <button type="button" className="modal-close" onClick={handleCloseSummaryModal} aria-label="Close">
                      ✕
                    </button>
                  </div>

                  {summaryCategoryError && <div className="alert alert-error">{summaryCategoryError}</div>}
                  {isSummaryCategoryLoading && <p className="loading">⏳ Loading transactions...</p>}

                  {!isSummaryCategoryLoading && !summaryCategoryError && summaryCategoryExpenses.length === 0 && (
                    <p className="no-data">📭 No transactions found.</p>
                  )}

                  {!isSummaryCategoryLoading && !summaryCategoryError && summaryCategoryExpenses.length > 0 && (
                    <ul className="modal-expense-list">
                      {summaryCategoryExpenses.map((expense) => (
                        <li key={expense._id} className="modal-expense-item">
                          <div className="modal-expense-main">
                            <strong className="modal-expense-amount">{formatRupeesFromPaise(expense.amount)}</strong>
                            <span className="modal-expense-date">📅 {new Date(expense.date).toLocaleDateString()}</span>
                          </div>
                          <div className="modal-expense-desc">{expense.description || 'No description'}</div>
                        </li>
                      ))}
                    </ul>
                  )}

                  <div className="modal-footer">
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={handleApplySummaryCategoryFilter}
                      disabled={!summarySelectedCategory}
                    >
                      Filter main list
                    </button>
                    <button type="button" className="btn-primary" onClick={handleCloseSummaryModal}>
                      Close
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
