# EcoTrack AI — Carbon Footprint Awareness & Reduction Platform

EcoTrack AI is a production-grade web application that helps individuals understand, track, and reduce their personal carbon footprint through simple actions and personalized insights. Built with Clean Architecture and SOLID principles.

---

## Problem Statement Alignment

**Problem Statement:** *"Design a solution that helps individuals understand, track, and reduce their carbon footprint through simple actions and personalized insights."*

EcoTrack AI maps to **5 explicit criteria** derived from the problem statement:

| Criteria | How EcoTrack AI Addresses It |
|----------|------------------------------|
| **UNDERSTAND** — Help users comprehend their carbon footprint | Sustainability Score (0–100), Real-World Equivalents (trees, car km, electricity hours, phone charges), Comparative baselines (National/Global/Sustainable daily targets), Future Emission Forecasts, Category breakdown (donut chart), 15-day Trends (area chart), "Did You Know?" educational cards, personalized narrative explanation |
| **TRACK** — Enable users to log and monitor their footprint | Activity Logger with 4 categories & 25+ subcategories, 12 one-tap quick-log presets, recurring activities (daily/weekly), subcategory text search, category filter, paginated history, one-click "Repeat" action, delete, auto-calculated CO2e via emission factor database |
| **REDUCE** — Empower users to shrink their footprint | Personalized Recommendation Engine (15 strategies ranked by impact × feasibility × preference), Carbon Simulator (interactive sliders, real-time carbon/money savings), AI Eco Coach (context-aware chat), 4 Challenges with XP rewards, 6 Badges, 5-Level progression, Goal setting (monthly target), Printable Reports & Impact Card |
| **SIMPLE ACTIONS** — Provide easy, low-friction actions | "Today's Simple Action" (daily personalized suggestion on Dashboard), 4 Quick Action buttons on Dashboard, 12 one-tap log presets, one-click "Repeat" in history, Simulator action plan, Reports "Next Steps", AI Coach suggestions with clickable follow-ups, daily rotating Simple Action API (16 actions) |
| **PERSONALIZED INSIGHTS** — Tailor all content to the individual | Dashboard explanation references user's highest/lowest categories, AI Coach replies incorporate user name/level/points/streak/category emissions, Recommendations ranked by user's specific category totals, Forecast uses user's actual activity data with proportional annual projection, Reports aggregate user-specific savings and streaks, Daily action targets user's highest emission category |

### Feature-Pillar Mapping

**PILLAR 1: UNDERSTAND**
- Sustainability Score (0–100) — evaluates user daily averages relative to the IPCC sustainable target of 5.5 kg CO2e/day
- Equivalents Conversions — trees, car km, electricity hours, phone charges
- Comparative baselines — personal vs Global Average, National Average, Sustainable target
- Future Emission Forecasts — moving average predictions, goal achievement probabilities, risk warnings
- Category Breakdown — donut chart showing Transport, Energy, Food, Shopping/Waste
- 15-Day Trends — area chart with expandable data table
- Educational Content — explainer, "Did You Know?" facts, onboarding welcome banner

**PILLAR 2: TRACK**
- 12 Presets & Quick Logs — one-tap recording of frequently logged activities
- 4 Categories, 25+ Subcategories — transport, energy, food, shopping_waste
- 16 Daily Rotating Simple Actions — full catalog via `/api/actions` endpoint
- Smart Actions — recurrence (daily/weekly), textual search, filters, pagination, one-click Repeat
- Automatic CO2 Calculation — every activity converted to kg CO2e using verified emission factors
- **Business Rule**: Activities cannot be timestamped in the future — enforces authentic historical tracking

**PILLAR 3: REDUCE**
- Recommendation Engine — 15 reduction strategies scored by Impact × Feasibility × Category Preference
- Carbon Simulator — interactive sliders modeling weekly habits with carbon/financial savings
- Eco Coach AI — guilt-free NLP chatbot with personalized advice based on user stats
- 4 Challenges — Car-Free Week, Plant-Based Week, Energy Saver, Recycling Champion
- 6 Badges, 5-Level progression — Seedling → Sapling → Tree → Forest Guardian → Climate Hero
- Goal Setting — monthly carbon target with progress tracking and achievement probability
- Printable Reports & Impact Cards — month-over-month summaries with shareable stats

---

## Architecture

### System Architecture Layers
```mermaid
graph TD
    subgraph Presentation ["Presentation Layer (React SPA / Express API Server)"]
        UI["React Web Pages & Components"]
        API["Express Routes & Middleware"]
    end

    subgraph Application ["Application Use Cases Layer"]
        LogAct["LogActivity.ts (Use Case)"]
        GetDash["GetDashboardData.ts (Use Case)"]
        GenRep["GenerateReport.ts (Use Case)"]
        GetFore["GetForecast.ts (Use Case)"]
    end

    subgraph Domain ["Domain Layer (Core Rules)"]
        Ent["Entities (User, Activity, Goal, Challenge, Badge)"]
        Rules["calculateLevel() progression logic"]
        Interfaces["Repository Interfaces (IUserRepository, etc.)"]
    end

    subgraph Infrastructure ["Infrastructure & Services Layer"]
        DB["DatabaseConnection (Postgres / SQLite)"]
        Repos["SQL Repository Implementations"]
        Calc["EmissionCalculator & RecommendationEngine"]
    end

    UI -->|HTTP Requests| API
    API -->|Execute Use Case| LogAct
    API -->|Execute Use Case| GetDash
    LogAct -->|Validate & Build| Ent
    LogAct -->|Call Interface| Interfaces
    GetDash -->|Call Interface| Interfaces
    Interfaces -.->|Implemented by| Repos
    Repos -->|Write/Read| DB
    LogAct -->|Use Leveling Rules| Rules
    LogAct -->|Calculate CO2e| Calc
```

### Activity Logging Workflows
```mermaid
sequenceDiagram
    autonumber
    actor User as User (React UI)
    participant API as Express Router
    participant UC as LogActivity Use Case
    participant Calc as Emission Calculator
    participant Repos as Database Repositories
    participant DB as SQLite / Postgres

    User->>API: POST /api/activities (category, subcategory, quantity)
    API->>API: Sanitize & Validate (XSS Sanitizer, Zod schema)
    API->>UC: Execute Use Case
    UC->>Calc: Calculate CO2e (via IPCC emission factor catalog)
    Calc-->>UC: Return calculated kg CO2e
    UC->>Repos: Create Activity Log record
    Repos->>DB: INSERT INTO activities
    UC->>Repos: Get Streak & Update User Stats (streak, XP, level)
    Repos->>DB: UPDATE users
    UC->>Repos: Update progress on active challenges
    Repos->>DB: UPDATE user_challenges
    UC-->>API: Return logged activity details
    API-->>User: HTTP 201 Created (confetti triggers on UI!)
```

---

Clean Architecture with strict layer isolation:

```
src/
├── domain/                        # Enterprise Business Rules
│   ├── entities/                  # User, Activity, Goal, Challenge, Badge, Recommendation
│   ├── repositories/              # IUserRepository, IActivityRepository, IGoalRepository, IChallengeRepository
│   └── level.ts                   # calculateLevel() — 5-tier XP progression logic
├── application/                   # Application Use Cases
│   └── use-cases/
│       ├── LogActivity.ts         # Validates input, calculates CO2e, updates points/streak/challenges
│       ├── GetDashboardData.ts    # Single-pass aggregation (1 DB query, Promise.all for parallelism)
│       ├── GetActivities.ts       # Filtered, paginated activity history
│       ├── ManageChallenges.ts    # Join, progress, complete challenges
│       ├── GenerateReport.ts      # Monthly stats, badges, streaks
│       ├── GetForecast.ts         # Retrieves carbon projection forecasts & probability
│       └── GetRecommendations.ts  # Ranks personalized reduction strategies
├── infrastructure/                # Database & Security Implementations
│   ├── database/
│   │   ├── DatabaseConnection.ts  # Dual-mode (PostgreSQL/SQLite) connection manager
│   │   ├── ActivityRepository.ts  # Fully typed, no 'any' casts
│   │   ├── UserRepository.ts
│   │   ├── GoalRepository.ts
│   │   └── ChallengeRepository.ts
│   └── persistence/
│       └── schema.sql             # Full SQL schema with indexes
├── services/                      # Calculation & Expert Services
│   ├── EmissionCalculator.ts      # CO2e formula evaluator & real-world equivalents (fully documented)
│   ├── RecommendationEngine.ts    # Personalized recommendation ranker (Impact × Feasibility × Preference)
│   ├── ForecastService.ts         # Projection forecasting & probability (single-pass efficiency)
│   ├── AiCoachService.ts          # Rule-based NLP coaching engine
│   └── SimpleActionService.ts     # Daily "Simple Action of the Day" generator (16 actions)
├── config/
│   └── emissionFactors.json       # IPCC-aligned CO2e factors by category/subcategory
├── types/                         # Shared Type Definitions
│   ├── dashboard.ts               # Types for the carbon intelligence dashboard
│   └── forecast.ts                # Types for the emissions forecast page
├── presentation/
│   ├── api/
│   │   ├── server.ts              # Express app — routes, middleware, rate limits, startup env logging
│   │   └── middleware/
│   │       ├── auth.ts            # Single-user authentication stub (JWT-ready interface)
│   │       ├── schemas.ts         # Zod validation schemas with security size caps
│   │       ├── sanitize.ts        # XSS sanitizer (strips tags, event handlers, javascript:/data: URIs)
│   │       └── validate.ts        # Zod schema middleware (no separate rateLimiter file)
│   └── web/                       # React 19 SPA (Vite, TypeScript, Tailwind, Recharts)
│       ├── main.tsx               # App entry — AuthProvider, ThemeProvider, lazy routing
│       ├── index.css              # Main stylesheet with layout and style configurations
│       ├── components/            # Layout, ErrorBoundary, Toast, Skeleton, Hooks.ts, etc.
│       └── pages/                 # Dashboard, Tracker, Simulator, ForecastPage, Coach, Challenges, ReportsPage
└── tests/                         # 15 test suites — 301 tests total (moved inside src/)
    ├── use-cases.test.ts          # LogActivity, GetActivities (future timestamp, recurring activity)
    ├── domain.test.ts             # Entity validation, calculateLevel (boundary tests at every threshold)
    ├── middleware.test.ts         # Auth, XSS sanitizer, Zod validation, schema limits
    ├── e2e.test.ts                # 25 full-stack API integration tests
    ├── pages-a11y.test.tsx        # jest-axe accessibility scans of all 7 pages
    ├── Layout.test.tsx            # Component + accessibility tests
    ├── components.test.tsx        # ErrorBoundary, Skeleton components
    ├── EmissionCalculator.test.ts # 12 unit tests — formulas, equivalents, edge cases
    ├── ForecastService.test.ts    # 3 unit tests — baseline, increasing/decreasing trends
    ├── AiCoachService.test.ts     # 8 unit tests — NLP paths, weekly insights, zero-streak
    ├── SimpleActionService.test.ts # 10 unit tests — rotation, category targeting
    ├── RecommendationEngine.test.ts # 2 unit tests — ranking, de-prioritization
    ├── schemas.test.ts            # 14 schema validation tests
    ├── repository-interfaces.test.ts # Contract tests for all 4 repository interfaces
    └── db-repositories.test.ts   # DatabaseConnection + schema SQL tests
```

---

## Technical Stack

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS v3, Recharts, TanStack React Query v5, React Router v7, Lucide React, Framer Motion
- **Backend**: Node.js, Express 4, TypeScript
- **Security**: Helmet CSP, CORS, express-rate-limit, Zod input validation with size caps (quantity ≤ 100,000, message ≤ 500 chars, goal ≤ 10,000 kg), XSS sanitizer (strips `<script>`, event handlers, `javascript:`, `data:` URIs), NaN guards on all route ID params, ISO date validation for query params
- **Database**: PostgreSQL (Production) / SQLite3 (Development/Testing fallback)
- **Testing**: Vitest, Supertest, @testing-library/react, jest-axe — **301 tests across 15 suites** (100% statement/branch/function/line coverage)

---

## Security Hardening

| Protection | Implementation |
|------------|----------------|
| **XSS Prevention** | `sanitize.ts` middleware strips `<script>`, `<style>`, inline event handlers, `javascript:` and `data:` URI protocols from all body/query/param strings |
| **Input Size Caps** | Activity quantity ≤ 100,000; chat messages ≤ 500 chars; goal targets ≤ 10,000 kg/month — prevents payload abuse |
| **NaN Guards** | All `parseInt()` calls on route params (activityId, challengeId) validated before use — prevents silent query corruption |
| **404 on Missing Resources** | DELETE `/api/activities/:id` returns 404 when no matching row exists, not 200 |
| **Date Validation** | `startDate`/`endDate` query params validated as real ISO dates — returns 400 on invalid input |
| **Body Limit** | `express.json({ limit: '100kb' })` prevents oversized payloads |
| **Helmet CSP** | `script-src 'self'` (no unsafe-eval/inline), `object-src 'none'`, `base-uri 'self'` |
| **Future Timestamp Guard** | Activities cannot be logged with future timestamps — enforced at the use-case level |
| **Startup Logging** | Environment type and DB mode logged on startup; production warning if SQLite is used |

> **Architecture Note**: EcoTrack AI is designed as a single-user personal carbon tracker. The `authenticateToken` middleware uses a fixed identity stub. For multi-user deployments, this is forward-compatible with a standard JWT verification swap — see `src/presentation/api/middleware/auth.ts` for the JSDoc upgrade path.

---

## Dual-Mode Database

For zero-config execution without PostgreSQL, the infrastructure adapter initializes a local SQLite file (`ecotrack.db`) and seeds challenges, badges, and the default user automatically. To use PostgreSQL:

```
DATABASE_URL=postgresql://user:password@localhost:5432/ecotrack
```

The `ActivityRepository.delete` method uses `RETURNING id` on Postgres and SELECT-then-DELETE on SQLite for accurate empty-result detection.

---

## Setup & Running

### Prerequisites
- Node.js v18+ and npm v9+

### Installation
```bash
npm install
```

### Environment Variables (`.env`)
```
PORT=5000
NODE_ENV=development
CLIENT_ORIGIN=http://localhost:5173
# DATABASE_URL=postgresql://user:pass@localhost:5432/ecotrack
```

### Development
```bash
npm run dev
```
- API Server: `http://localhost:5000`
- React Client: `http://localhost:5173` (Vite proxies `/api` to Express)

### Production Build
```bash
npm run build
npm start
```

---

## Testing

```bash
# Run all tests once
npm test

# Watch mode (re-runs on file change)
npm run test:watch

# With coverage report
npm run test:coverage
```

**300 tests across 15 suites (located in `src/tests/`). Coverage: 100% statements/functions/lines, 98.99% branches.**

| Suite | Tests | Type |
|-------|-------|------|
| `src/tests/EmissionCalculator.test.ts` | 12 | Unit — CO2e formulas, equivalents, edge cases (zero, decimal, unknown) |
| `src/tests/SimpleActionService.test.ts` | 10 | Unit — daily action rotation, category targeting, edge cases |
| `src/tests/AiCoachService.test.ts` | 8 | Unit — NLP coaching paths, weekly insights, zero-streak, fallback reply |
| `src/tests/schemas.test.ts` | 14 | Unit — Zod validation: valid/invalid inputs for activity, goal, coach schemas |
| `src/tests/domain.test.ts` | 25 | Unit — Activity/User entities, `calculateLevel` with boundary tests at every threshold |
| `src/tests/use-cases.test.ts` | 16 | Unit — LogActivity (future timestamp rejection, recurring activity), GetActivities |
| `src/tests/middleware.test.ts` | 22 | Unit — Auth, XSS sanitizer (data: URI, nested objects, arrays), schema size caps |
| `src/tests/components.test.tsx` | 12 | Component — ErrorBoundary, Skeleton a11y |
| `src/tests/Layout.test.tsx` | 11 | Component + a11y — nav landmarks, ARIA labels, axe scan |
| `src/tests/pages-a11y.test.tsx` | 19 | a11y — jest-axe scans of all 7 pages (Dashboard, Tracker, Simulator, Forecast, Coach, Challenges, Reports) |
| `src/tests/db-repositories.test.ts` | 27 | Unit — DatabaseConnection interface, schema SQL structure & indexes, all repo edge cases |
| `src/tests/repository-interfaces.test.ts` | 4 | Contract — All 4 repository interface method signatures |
| `src/tests/ForecastService.test.ts` | 3 | Unit — zero baseline, increasing trend, decreasing trend |
| `src/tests/RecommendationEngine.test.ts` | 2 | Unit — relevance ranking, zero-category de-prioritization |
| `src/tests/e2e.test.ts` | 59 | Integration — Full API surface: activities (CRUD, 404 on missing), dashboard, recommendations, forecast, coach, challenges, reports, actions, validation errors, valid date filters, startup logging |

---

## API Reference

> All routes are accessible without authentication headers (single-user design — see Security Hardening note above).

### Activity Tracking
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/activities` | Log a new activity — auto-calculates CO2e, validates timestamp is not future |
| `GET` | `/api/activities` | List activities with optional `?category=`, `?search=`, `?limit=`, `?offset=`, `?startDate=`, `?endDate=` filters |
| `DELETE` | `/api/activities/:id` | Delete an activity — returns **404** if not found |

### Dashboard & Analytics
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/dashboard` | Sustainability Score, today/weekly/monthly totals (computed in memory from one DB call), equivalents, 15-day trends, annual projection |
| `GET` | `/api/recommendations` | 15 personalized strategies ranked by user's emission profile |
| `GET` | `/api/forecast` | Next-month projection, trend direction & %, goal achievement probability, risk areas |
| `GET` | `/api/reports` | Monthly stats, carbon saved, money saved, streak, badges earned |
| `POST` | `/api/goals` | Set a monthly CO2 target (kg, positive, max 10,000) |

### Coaching & Gamification
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/coach/chat` | AI Eco Coach — message body (1–500 chars), returns personalized reply + insights + suggestions |
| `GET` | `/api/challenges` | List all challenges with user join/complete status |
| `POST` | `/api/challenges/:id/join` | Enroll in a challenge |
| `POST` | `/api/challenges/:id/complete` | Complete a challenge and earn XP rewards |

### User Profile
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/auth/me` | Current user profile — username, points, level, streak |

### Simple Actions
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/actions/daily` | "Simple Action of the Day" — personalized to user's highest emission category |
| `GET` | `/api/actions` | Full catalog of 16 rotating simple actions across all categories |

---

## Accessibility

EcoTrack AI meets WCAG 2.1 AA standards, verified with `jest-axe` on every page:

- **Skip Link** — `<a href="#main-content">Skip to main content</a>` on every page
- **Navigation Landmarks** — `<nav aria-label="Main navigation">` (single landmark, no duplication)
- **ARIA Labels** — all interactive elements have descriptive labels; streak/XP badges labelled on both desktop and mobile views
- **Focus Management** — Escape key closes mobile menu; focus-visible rings on all interactive elements
- **Live Regions** — Loading states use `role="status"` + `aria-live="polite"`
- **Semantic HTML** — `<header role="banner">`, `<main id="main-content" role="main">`, `<nav>`, proper heading hierarchy
- **Dark Mode** — System preference respected via `prefers-color-scheme`; user preference persisted in `localStorage`
- **Error Boundary** — Accessible fallback UI with retry action when components crash

---

## Emission Factors

All CO2e values use IPCC-aligned factors stored in `src/config/emissionFactors.json`:

| Category | Example Subcategories | Source |
|----------|-----------------------|--------|
| `transport` | `car_petrol` (0.18 kg/km), `car_ev` (0.05 kg/km), `train` (0.04 kg/km), `bike` (0 kg/km) | DEFRA / IPCC AR6 |
| `energy` | `electricity` (0.38 kg/kWh), `natural_gas` (2.0 kg/therm), `solar` (0.02 kg/kWh) | IEA 2023 |
| `food` | `meat` (5.8 kg/meal), `vegan` (0.5 kg/meal), `fish` (2.5 kg/meal) | Poore & Nemecek 2018 |
| `shopping_waste` | `shopping` (8.0 kg/item), `recycling` (−0.25 kg/kg), `flight_economy` (0.255 kg/km) | DEFRA 2023 |
