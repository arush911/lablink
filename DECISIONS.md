# LabLink 2026 - Architecture Decision Records (ADRs) & Trade-off Analysis

**Project:** LabLink  
**Document Version:** 1.2.0 (Final Targeted Pre-Implementation Revision)  
**Phase:** Pre-Implementation Architectural Sign-off  

---

## Document Revision History & Correction Log

| Version | Date | Author / Role | Key Revisions & Architectural Corrections |
|---|---|---|---|
| 1.0.0 | 2026-11-23 | Principal Architect | Initial baseline ADRs. |
| 1.1.0 | 2026-11-23 | Principal Architect | Added ADR-007 (Neon DB), ADR-008 (Two-Stage Lifecycle), ADR-009 (Repo Size Strategy). |
| 1.2.0 | 2026-11-23 | Principal Architect | **Targeted Architectural Corrections:**<br>• Added ADR-010: Generated Stored `tstzrange` Column for Invariant Concurrency.<br>• Added ADR-011: Server-Side Node.js Execution Boundary for Firebase Admin Verification.<br>• Added ADR-012: Two-Phase Scheduling Architecture (Request Priority vs Slot Selection).<br>• Added ADR-013: Pessimistic Row Locking for Request Duplicate Confirmation & Quota Race Defense.<br>• Added ADR-014: Configurable Demonstration Quotas & Cancellation Policy. |

---

## 1. Architecture Decision Records (ADRs)

### ADR-001: Next.js App Router for Unified Full-Stack Architecture
- **Status:** Approved
- **Decision:** Adopt **Next.js (App Router)** with **TypeScript** as the unified full-stack framework.
- **Rationale:** Unifies React Server Components for fast initial hydration with Route Handlers for the secure REST API backend. Eliminates CORS overhead and enables shared Zod validation schemas between client forms and server routes.

---

### ADR-002: PostgreSQL 18.4 with GiST Exclusion Constraints for Double-Booking Prevention
- **Status:** Approved
- **Decision:** Enforce reservation non-overlap at the database engine layer using PostgreSQL timezone-aware range types (`tstzrange`) with a GiST exclusion constraint (`EXCLUDE USING gist (equipment_id WITH =, time_range WITH &&) WHERE (status = 'CONFIRMED')`).
- **Rationale:** Application-level `SELECT WHERE NOT EXISTS` checks fail under concurrent race conditions. GiST exclusion constraints mathematically forbid overlapping intervals on exclusive equipment.

---

### ADR-003: Server-Authoritative RBAC & Anti-Self-Promotion in Auth Sync
- **Status:** Approved
- **Decision:** Use Firebase Authentication strictly for client identity and JWT token issuance. Internal user roles (`student` vs `faculty`) are stored and resolved exclusively from the PostgreSQL `users` table. The `POST /api/v1/auth/sync` endpoint strictly ignores client-supplied roles, defaulting new users to `student`. Faculty accounts can only be provisioned by administrators or verified faculty.
- **Rationale:** Completely eliminates client-side role tampering and privilege escalation vulnerabilities.

---

### ADR-004: Two-Phase Scheduling Architecture (Request Priority vs. Slot Selection)
- **Status:** Approved
- **Decision:** Formally separate scheduling into two independent phases:
  1. *Request Prioritization ($P_{\text{req}}(r)$):* Evaluates deadline urgency and remaining student quota. This score is invariant across candidate time slots for request $r$.
  2. *Candidate Slot Selection ($S_{\text{slot}}(t, e, r)$):* Prunes invalid slots via independent hard constraints, then ranks feasible slots by contiguity (gap minimization) and student window preference.
  3. *Deterministic Tie-Breaking:* Uses exact relational tuple comparisons without floating-point epsilon ambiguity.
  4. *Edge Cases:* Missing deadlines default to $U=0.10$; missing quotas default to configurable demo quota $Q_{\text{default}}$; empty feasible sets return diagnostic failure codes (`NO_FEASIBLE_SLOTS`).
- **Rationale:** Eliminates mathematical confusion caused by treating request-level attributes as differentiators between time slots.

---

### ADR-005: Academic Precision Stitch Design Tokens for Tailwind CSS
- **Status:** Approved
- **Decision:** Bind Tailwind CSS directly to the `Academic Precision` design tokens exported from Stitch project `15502302728869515424`.
- **Rationale:** Guarantees 100% visual fidelity with the Stitch designs, establishing consistent 1px borders (`#E2E8F0`), clinical neutrals, 6px/8px radii, and tabular numerals.

---

### ADR-006: Google Cloud Run Containerized Deployment for PromptWars 2026
- **Status:** Approved
- **Decision:** Package LabLink into a multi-stage Docker container (`node:24-alpine`) and deploy as a serverless container on Google Cloud Run.
- **Rationale:** Scales to zero when idle, minimizing costs while meeting the public deployment requirement of PromptWars 2026.

---

### ADR-007: Production Database Selection (Cloud SQL vs. Neon PostgreSQL)
- **Status:** Approved & Recommended
- **Context:** The application requires a managed PostgreSQL database accessible by the Cloud Run container over SSL.
- **Comparison & Analysis:**

| Decision Factor | Google Cloud SQL for PostgreSQL 18 | Neon Serverless PostgreSQL |
|---|---|---|
| **Cost** | $\approx \$35 - \$55/\text{month}$ minimum instance cost | **Free Tier** ($0 for up to 0.5 GB storage, ideal for demo) |
| **Cloud Run Integration** | Requires Cloud SQL Auth Proxy sidecar or connector | Standard PostgreSQL connection string with `?sslmode=require` |
| **Connection Pooling** | Requires separate PgBouncer deployment | **Built-in PgBouncer** connection pooling port out-of-the-box |
| **Database Branching** | Not available natively | **Instant copy-on-write branching** for isolated testing |
| **Demonstration Stability** | Enterprise SLA | High availability with SSL encryption |

- **Recommendation:** **Neon Serverless PostgreSQL** is recommended for the competition demonstration because it incurs zero ongoing hosting fees, requires zero proxy configuration on Cloud Run, and provides built-in PgBouncer pooling. Cloud SQL for PostgreSQL remains the documented enterprise production choice.

---

### ADR-008: Two-Stage Lifecycle (Request Approval vs. Booking Confirmation)
- **Status:** Approved
- **Decision:** Strictly separate the approval of a student's project access request from the confirmation of a calendar booking slot.
  1. *Request Approval:* Faculty signs off on project merit and safety declarations. (Status becomes `APPROVED`; zero calendar slots reserved).
  2. *Booking Confirmation:* Faculty selects a specific candidate time slot and commits the booking under the GiST exclusion constraint. (Status becomes `CONFIRMED`; calendar slot locked).
- **Rationale:** Prevents phantom calendar blocking by students who receive project permission but have not yet scheduled a specific laboratory session.

---

### ADR-009: Repository Size Control Strategy ($< 10$ MB PromptWars Constraint)
- **Status:** Approved
- **Decision:** Preserve all 13 original Stitch high-resolution PNG screenshots (14.2 MB) and raw photos locally in `LabLink/design/stitch/`, while adding them to `.gitignore`. Commit semantic HTML templates, design tokens, metadata, and web-optimized thumbnails ($< 500$ KB total) to Git.
- **Rationale:** Guarantees total Git repository size remains under **3-4 MB**, safely below the strict 10 MB competition limit, while permanently keeping all original design artifacts available locally.

---

### ADR-010: Generated Stored `tstzrange` Column for Range Invariance
- **Status:** Approved
- **Decision:** Implement `time_range tstzrange GENERATED ALWAYS AS (tstzrange(start_time, end_time, '[)')) STORED NOT NULL` in the `bookings` table.
- **Rationale:** Prevents null values, guarantees continuous mathematical consistency with `start_time` and `end_time` at the storage engine level, and allows the GiST exclusion constraint to index the generated range directly. Verified in PostgreSQL 18.4.

---

### ADR-011: Node.js Execution Boundary for Firebase ID Token Verification
- **Status:** Approved
- **Decision:** Confine Firebase ID token verification and database role resolution to Node.js Route Handlers (`app/api/v1/**/route.ts` with `export const runtime = 'nodejs'`). Prohibit executing `firebase-admin` inside Next.js Edge Middleware.
- **Rationale:** Next.js Edge Middleware runs in a V8 isolate without native Node.js crypto modules, causing runtime crashes when executing `firebase-admin`. The Route Handlers provide full Node.js support and direct database access.

---

### ADR-012: Pessimistic Row Locking for Duplicate Confirmations & Quota Protection
- **Status:** Approved
- **Decision:** Execute booking confirmation within an ACID transaction utilizing:
  1. `SELECT * FROM booking_requests WHERE id = $1 FOR UPDATE` (prevents double confirmation of the same request).
  2. `SELECT * FROM users WHERE id = $student_id FOR UPDATE` (serializes quota consumption and prevents race-condition over-allocation).
  3. `SELECT * FROM equipment WHERE id = $eq_id FOR UPDATE` (validates operating status and buffers).
- **Rationale:** Closes race conditions that could allow concurrent clicks to double-commit a request or exceed monthly quota budgets.

---

### ADR-013: Configurable Demonstration Quotas & Cancellation Policy
- **Status:** Approved
- **Decision:** Replace hardcoded institutional assumptions with configurable demonstration parameters:
  - Monthly student quotas are stored in `users.monthly_quota_hours` (default 25.0h, configurable per user/tier).
  - Cancellation policy buffer is stored in `laboratories.cancellation_buffer_minutes` (default 120 min, configurable per lab).
  - Physical/simulated access PIN tokens are deferred from MVP.
  - Equipment safety qualifications are optional flags on equipment records; baseline demo instruments require zero qualifications.
- **Rationale:** Keeps the MVP agile and focused on the core problem statement without unnecessary institutional friction.

---

## 2. Decisions Requiring Explicit User Confirmation

| # | Architecture Decision Point | Recommended Option | Alternative Option | Impact / Status |
|---|---|---|---|---|
| **D-1** | **Production PostgreSQL Host** | **Neon Serverless PostgreSQL** (Zero cost, built-in pooling) | Google Cloud SQL ($35-55/mo) | Free tier ideal for evaluation; no impact on code. |
| **D-2** | **Demonstration Quick-Login** | Dual-role quick-login buttons on login screen (Alex Chen & Prof. Marcus Vance) | Manual email/password typing | Evaluators can immediately test both roles without registration barriers. |
| **D-3** | **Single-Branch Git Policy** | Maintain all commits directly on `master` | Feature branches | Satisfies competition constraint (*"Exactly one branch"*). |
