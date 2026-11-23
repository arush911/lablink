# LabLink — Making College Laboratories More Accessible
> **PromptWars 2026** Master Implementation

LabLink is an AI-powered campus laboratory resource-sharing and intelligent scheduling platform. It enables university students, researchers, and laboratory coordinators to discover specialized equipment, submit project-based access requests, arbitrate scheduling contention fairly, and eliminate double-booking with mathematical and relational guarantees.

---

## 1. System Architecture & Core Innovations

```
                                      ┌────────────────────────────────────────────────────────┐
                                      │              Academic Precision UI                     │
                                      │   (Next.js 15 App Router + Tailwind CSS Tokens)         │
                                      └───────────────────────────┬────────────────────────────┘
                                                                  │
                                                HTTP / JSON (REST API v1)
                                                                  │
                                                                  ▼
┌─────────────────────────────────┐   Verify ID Token   ┌──────────────────────────────────────┐
│      Firebase Authentication     │ ◄─────────────────┤       Next.js Node.js Route Handlers  │
│  (Client SDK + Quick Evaluator) │                   │       (Authoritative Server RBAC)      │
└─────────────────────────────────┘                   └──────────────────┬───────────────────┘
                                                                         │
                                                       ACID Transactions │ Row-Level Locks
                                                                         ▼
                                                      ┌────────────────────────────────────────┐
                                                      │           PostgreSQL 18.4              │
                                                      │  - Generated TSTZRANGE stored column   │
                                                      │  - GiST Range Exclusion Constraint     │
                                                      │  - 12 Relational Tables                │
                                                      └──────────────────┬─────────────────────┘
                                                                         │
                                              Deterministic Scoring      ▼
                                      ┌────────────────────────────────────────────────────────┐
                                      │             AI Arbiter & Scheduling Engine             │
                                      │  - S_slot = 0.60 * S_contiguity + 0.40 * S_preference   │
                                      │  - Zero Double-Booking via SQLSTATE 23P01 catch        │
                                      │  - Natural Language Query Parser & ISO 42001 Audit     │
                                      └────────────────────────────────────────────────────────┘
```

### Core Architecture Pillars:
1. **Mathematical Scheduling Optimization:**
   - Evaluates laboratory operating hours (08:00 – 20:00) and instrument turnaround buffers (15–45 min).
   - Differentiates candidate time slots using:
     $$\mathcal{S}_{\text{slot}}(t, e, r) = 0.60 \cdot \mathcal{S}_{\text{contiguity}}(t, e) + 0.40 \cdot \mathcal{S}_{\text{preference}}(t, r)$$
   - Deterministic tie-breaking: `ORDER BY ROUND(S_slot, 6) DESC, start_time ASC`.
2. **PostgreSQL GiST Concurrency Lock (Zero Double-Booking):**
   - Bookings table enforces:
     `time_range TSTZRANGE GENERATED ALWAYS AS (tstzrange(start_time, end_time, '[)')) STORED NOT NULL`
     `CONSTRAINT no_overlapping_confirmed_bookings EXCLUDE USING gist (equipment_id WITH =, time_range WITH &&) WHERE (status = 'CONFIRMED')`
   - Simultaneous conflicting booking attempts are rejected with SQLSTATE `23P01`, returning HTTP 409 `SLOT_DOUBLE_BOOKED`.
3. **Strict Dual-Role RBAC:**
   - Two official roles: `student` and `faculty`.
   - The server verifies Firebase tokens, but resolves authorization exclusively from the PostgreSQL `users.role` column.
   - Prevents role spoofing and student self-promotion.
4. **Google Stitch "Academic Precision" Design System:**
   - 100% fidelity to the Stitch design specifications.
   - Deep Navy Primary (`#0037b0`), Laboratory Teal Secondary (`#006a61`), Academic Indigo Tertiary (`#311fca`), Crisp `#faf8ff` backgrounds, 1px `#e2e8f0` borders, Inter + JetBrains Mono typography.

---

## 2. Seeded Demonstration Accounts

For convenient evaluation, the platform includes pre-configured demo credentials:

| Role | Name | Email | Initial Quota | Default View |
| :--- | :--- | :--- | :--- | :--- |
| **Student** | Alex Chen | `student.demo@lablink.edu` | 25.0 Hours | Equipment Catalog & Request Submission |
| **Faculty PI** | Prof. Marcus Vance | `faculty.demo@lablink.edu` | Core Approver | Faculty Review Console & Master Calendar |

To sign in instantly, navigate to `/login` and click either the **Student Demo Login** or **Faculty Demo Login** button.

---

## 3. Route Map & Screen Implementation

| Route | Implemented Feature | Matching Stitch Screen |
| :--- | :--- | :--- |
| `/login` | Authentication Portal & One-Click Evaluator Tokens | Dual Role Portal |
| `/equipment` | Equipment Discovery Catalog with Filters & AI Parse | Stitch Screen 02 |
| `/requests/new` | Student Project Access Requisition Form | Stitch Screen 05 |
| `/requests` | Student Request Tracking & 4-Stage Stepper | Stitch Screen 08 |
| `/faculty/review` | Faculty Decision Console & Candidate Slot Selector | Stitch Screen 06 |
| `/calendar` | Weekly Laboratory Master Gantt Matrix | Stitch Screen 07 |
| `/recommendations/[id]` | Algorithmic Justification & ISO 42001 Dossier | Stitch Screen 09 |

---

## 4. API Specification Summary

### Authentication & User
- `POST /api/v1/auth/sync` — Synchronizes user profile while strictly preserving database role authority.
- `GET /api/v1/auth/me` — Returns current authenticated user and remaining monthly quota.

### Equipment Catalog
- `GET /api/v1/equipment` — Multi-attribute keyword search, department filter, and availability filter.
- `GET /api/v1/equipment/:id` — Complete instrument specifications, laboratory room location, and operating hours.

### Requisition Pipeline
- `POST /api/v1/requests` — Creates a project access request docket in `PENDING_REVIEW` with Zod validation.
- `GET /api/v1/requests` — Lists requests (scoped to student for students; global queue for faculty).
- `GET /api/v1/requests/me` — Returns student's own requests with zero cross-tenant leakage.
- `GET /api/v1/requests/:id` — Comprehensive docket dossier with project details and audit trail.
- `POST /api/v1/requests/:id/cancel` — Student self-service cancellation with audit log.

### Scheduling & Review
- `GET /api/v1/requests/:id/recommendations` — Generates ranked candidate slots via the multi-objective scoring formula.
- `PATCH /api/v1/requests/:id/review` — Faculty approval or rejection with mandatory justification.
- `POST /api/v1/bookings/confirm` — ACID transactional booking commitment with GiST exclusion lock and quota debit.
- `GET /api/v1/schedule/calendar` — 7-day multi-instrument master scheduling matrix across 08:00 – 20:00.

### GenAI & Explainability
- `POST /api/v1/ai/parse-query` — Natural language query translation into structured reservation parameters.
- `POST /api/v1/ai/explain-recommendation` — ISO/IEC 42001 algorithmic explainability report.

---

## 5. Local Development Setup

### Prerequisites
- Node.js 20+ or 22+
- PostgreSQL 16+ (Local instance running on port 5432)

### Step 1: Install Dependencies
```bash
npm install
```

### Step 2: Database Migration & Seeding
```bash
# Run isolated migration script (creates 'lablink' database with GiST extensions)
npx tsx scripts/migrate.ts

# Seed departments, laboratories, 10 instruments, and demo accounts
npx tsx scripts/seed.ts
```

### Step 3: Run Automated Test Suite
```bash
npm run test
```
All 21 integration and concurrency tests will execute against local PostgreSQL.

### Step 4: Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 6. Cloud Run Container Deployment

LabLink is pre-configured with a multi-stage `Dockerfile` outputting a standalone minimal container image:

```bash
# Build production image
docker build -t lablink:latest .

# Run container locally on port 8080
docker run -p 8080:8080 -e DATABASE_URL="postgresql://user:pass@host:5432/lablink" lablink:latest
```

When deploying to Google Cloud Run:
```bash
gcloud run deploy lablink \
  --image gcr.io/PROJECT_ID/lablink:latest \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars NODE_ENV=production,DATABASE_URL="postgresql://..."
```

---

## 7. Verification & Empirical Proof
- **Type Safety:** `npx tsc --noEmit` passed with 0 errors.
- **Code Quality:** `npm run lint` passed with 0 errors and 0 warnings.
- **Automated Tests:** 21 tests passed across 5 test suites:
  - `src/tests/auth-tampering.test.ts` (Anti-tampering role resolution)
  - `src/tests/concurrency-gist.test.ts` (50 concurrent overlapping bookings locked by GiST)
  - `src/tests/equipment-requests.test.ts` (Catalog search, request submission, quota tracking)
  - `src/tests/faculty-review-confirmation.test.ts` (Scoring formula, review actions, slot confirmation)
  - `src/tests/ai-scheduling.test.ts` (GenAI NLP query parsing and ISO 42001 explainability)
- **Git Compliance:** Single branch `master`, Git repository size < 1 MB.
