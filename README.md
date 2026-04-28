# Expense Tracker

A production-focused full-stack Expense Tracker built with the MERN stack — emphasizing **reliability, correctness, and clean architecture** over feature breadth.

> Built for real-world conditions: unreliable networks, browser refreshes, and client retries.

---
## deploy link:
https://expense-tracker-lemon-tau.vercel.app/

## Demo Video
https://drive.google.com/file/d/1GrYkx29mePZHk8m7o6oE8yRZbRw4hAzI/view?usp=sharing
---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React + TypeScript (Vite) |
| Backend | Node.js + Express + TypeScript |
| Database | MongoDB Atlas (Mongoose) |
| Auth | JWT (HS256, short-lived tokens) |
| Validation | Zod |
| Logging | Winston |
| Testing | Vitest + in-memory MongoDB |

---

## Features

All required acceptance criteria are implemented:

- **Create expense** — amount, category, description, date via form
- **List expenses** — paginated, newest-first by default
- **Filter by category** — query parameter-driven, server-side
- **Sort by date** — newest-first (`sort=date_desc`)
- **Total amount** — displayed for the currently visible filtered list
- **Category summary** — aggregated spend totals per category

Plus production-grade additions:

- **JWT Authentication** — bcrypt-hashed passwords, short-lived (1h) tokens
- **Idempotent POST /expenses** — safe to retry on network failure or double-submit
- **Rate limiting** — per-user, per-minute cap on expense creation (`429` + `Retry-After`)
- **Integer money model** — stored as paise to eliminate floating-point drift

---

## Why MongoDB

MongoDB fits this workload well: the expense payload may evolve, writes are append-heavy, reads are user-scoped and filtered, and the aggregation pipeline handles category summaries cleanly. Mongoose schemas and indexes provide the data constraints you would expect from a relational DB, without sacrificing flexibility. Atlas handles availability and backups.

For a write-heavy financial system at scale, a relational DB with stricter ACID guarantees would be worth revisiting — but for this scope, MongoDB is the right call.

---

## Key Design Decisions

### 1. Money as Integer Paise

All amounts are stored as **integer paise** (`Rs. 250.50 -> 25050`). Floating-point binary representation introduces rounding drift in financial calculations. Integer storage guarantees deterministic totals across inserts, aggregates, and retries.

### 2. Idempotent Expense Creation

`POST /expenses` accepts an `Idempotency-Key` header. The backend checks `(idempotency_key, user_id)` before inserting. A unique compound index enforces this at the database level — concurrent duplicate requests get the same response, not a duplicate row. This makes the create flow safe under the conditions the assignment describes: double-submits, page refreshes, and retried network requests.

### 3. Index Strategy

Indexes map directly to the API's access patterns:

| Index | Purpose |
|---|---|
| `{ user_id: 1 }` | Fast user-scoped list queries |
| `{ category: 1 }` | Fast category filtering |
| `{ date: -1 }` | Efficient newest-first sort |
| `{ idempotency_key: 1, user_id: 1 }` unique | Duplicate write prevention |

### 4. Server-Driven Filtering and Sorting

Filtering, sorting, and summary aggregation happen on the server — not in the client. This keeps the frontend thin and ensures results are consistent regardless of pagination state.

### 5. Layered Backend Architecture

```
backend/
├── routes/        # HTTP route definitions
├── controllers/   # Request/response orchestration
├── services/      # Business logic and DB interaction
├── models/        # Mongoose schemas and indexes
├── schemas/       # Zod validation contracts
├── middleware/    # JWT auth, rate limiting
├── db/            # Connection lifecycle
└── core/          # Config and logging (Winston)
```

This separation keeps API concerns isolated from domain logic, improves testability, and reduces regression risk as features evolve.

---

## Trade-offs (Due to Timebox)

| Decision | Rationale |
|---|---|
| In-memory rate limiting | Sufficient for single-instance deployment; Redis needed at scale |
| No refresh tokens | 1h access token expiry is the mitigation; rotation kept out of scope |
| No frontend state library | Local component state is sufficient for a single-page auth/list workflow |
| Deeper create/read reliability over full CRUD | Focused on the flows with the most correctness risk |

---

## What I Intentionally Did Not Do

- **No delete or edit expenses** — the assignment did not require it; adding partial CRUD without tests would add surface area without value
- **No distributed idempotency cache (Redis)** — in-memory check + unique DB index is sufficient and simpler for single-instance scope
- **No token refresh flow** — short-lived tokens with re-login is acceptable for this scope; refresh rotation adds complexity without assignment benefit
- **No E2E tests** — covered the two highest-value test cases (validation unit test, authenticated create API test); E2E automation would require additional infrastructure

---

## API Reference

### Health

```
GET /health
```

### Auth

```
POST /auth/register
POST /auth/login
```

### Expenses — JWT required

```
POST   /expenses                        # Idempotent; rate-limited
GET    /expenses?category=food          # Optional category filter, newest-first
GET    /expenses/summary                # Total spend per category
```

All protected routes require:

```
Authorization: Bearer <token>
```

---

## Data Model

### Expense

| Field | Type | Notes |
|---|---|---|
| `amount` | Number | Integer paise, > 0 |
| `category` | String | Required |
| `description` | String | Optional |
| `date` | Date | Required |
| `idempotency_key` | String | Required |
| `user_id` | ObjectId | Required |
| `created_at` | Date | Auto |

---

## Local Setup

### Prerequisites

- Node.js 18+
- npm
- MongoDB Atlas connection string

### 1. Backend

```bash
cd backend
npm install
```

Create `backend/.env` from `backend/.env.example`:

```env
MONGODB_URI=
DB_NAME=
JWT_SECRET=
JWT_EXPIRES_IN=1h
EXPENSE_POST_LIMIT_PER_MINUTE=
PORT=
```

### 2. Frontend

```bash
cd frontend
npm install
```

Optionally create `frontend/.env`:

```env
VITE_API_BASE_URL=http://localhost:5000
```

### 3. Run

```bash
# Terminal 1
cd backend && npm run dev

# Terminal 2
cd frontend && npm run dev
```

Frontend runs at `http://localhost:5173` by default.

---

## Testing

```bash
cd backend
npm test
```

- **Unit test** — Invalid amount fails Zod validation
- **API test** — Authenticated expense creation succeeds end-to-end (in-memory MongoDB)

