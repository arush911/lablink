# LabLink 2026 - Master Implementation Roadmap & Task Matrix

**Project:** LabLink  
**Document Version:** 1.2.0 (Final Targeted Pre-Implementation Revision)  
**Target Event:** PromptWars 2026 Submission  
**Host Machine:** Intel Core i7-1255U (10C/12T), 16 GB RAM, Windows 11  

> [!NOTE]
> **Implementation Time Notice:** Estimated task hours serve as architectural prioritization guidelines and do not constitute rigid completion guarantees. Implementation sequencing prioritizes the smallest complete end-to-end demonstrable workflow before secondary features.

---

## Document Revision History & Correction Log

| Version | Date | Author / Role | Key Revisions & Architectural Corrections |
|---|---|---|---|
| 1.0.0 | 2026-11-23 | Principal Architect | Initial baseline task breakdown. |
| 1.1.0 | 2026-11-23 | Principal Architect | Priorities 1, 2, 3 triage; Git $< 10$ MB size verification task; anti-tampering sync task. |
| 1.2.0 | 2026-11-23 | Principal Architect | **Targeted Architectural Corrections:**<br>• Structured Priority 1 around the smallest complete end-to-end demonstrable workflow (Auth -> Catalog -> Request -> Approval -> Slot Selection -> Confirmation -> Tracking).<br>• Specified Node.js execution environment (`runtime = 'nodejs'`) for Firebase verification tasks, explicitly omitting Edge Middleware.<br>• Added explicit tasks for generated `tstzrange` column and pessimistic row locking on requests and quotas.<br>• Updated scheduling tasks to reflect two-phase architecture ($P_{\text{req}}$ vs $S_{\text{slot}}$) with exact relational tie-breaking.<br>• Added automated concurrency tests for simultaneous booking, duplicate confirmation, and quota race conditions. |

---

## 1. Smallest Complete End-to-End Demonstrable Workflow (Priority 1 Core)

The minimum viable demonstration for PromptWars 2026 comprises seven uninterrupted steps:

```
┌────────────────────────────────────────────────────────────────────────┐
│ MINIMAL END-TO-END DEMONSTRABLE WORKFLOW (PRIORITY 1)                  │
│ 1. Student Sign-In (Alex Chen via quick login)                         │
│ 2. Equipment Discovery (Screen 02 - filter & view oscilloscope)        │
│ 3. Project Request Submission (Screen 05 - title, abstract, duration)  │
│ 4. Faculty Sign-In & Request Review (Screen 06 - approve request merit)│
│ 5. Feasible Candidate Slot Selection (Screen 04/06 - evaluated slots)  │
│ 6. Booking Confirmation Transaction (GiST exclusion lock + row locks)  │
│ 7. Student Request Tracking (Screen 08 - confirmed status reflected)   │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Priority 1: Critical Core MVP Tasks

### Phase 0: Project Scaffolding & Git Size Configuration
- [ ] **TASK-001:** Initialize Next.js 15+ App Router application with TypeScript and Tailwind CSS in `LabLink/`.
  - *Verification:* `npm run build` succeeds cleanly; TypeScript compiles with zero errors.
- [ ] **TASK-002:** Configure Tailwind CSS with the `Academic Precision` design tokens from `design/stitch/design-tokens/theme-tokens.json`.
  - *Verification:* Colors (`primary`, `secondary`, `tertiary`), typography (Inter, JetBrains Mono), and radiuses (6px, 8px) match Stitch design system.
- [ ] **TASK-003:** Initialize dedicated Git repository with `master` branch and configure `.gitignore` to keep raw PNG screenshots local.
  - *Verification:* `git count-objects -vH` confirms total repository size is under 3 MB (well below the 10 MB competition limit).

### Phase 1: Authentication, Server-Side RBAC & Seeded Accounts
- [ ] **TASK-101:** Configure Firebase Client SDK (`src/lib/auth/client.ts`) and Firebase Admin SDK in Node.js server environment (`src/lib/auth/admin.ts`).
  - *Verification:* Cryptographic token verification service functional in Route Handlers (`runtime = 'nodejs'`). Next.js Edge Middleware restricted to path routing.
- [ ] **TASK-102:** Execute PostgreSQL 18.4 migrations for `departments` and `users` tables (including configurable `monthly_quota_hours` and `used_quota_hours`).
  - *Verification:* Tables created with unique constraints and role check constraints (`student` vs `faculty`).
- [ ] **TASK-103:** Implement `POST /api/v1/auth/sync` with strict role protection (defaults new users to `student`; ignores any client-supplied role).
  - *Verification:* Automated test AC-AUTH-02 passes (attempted role injection to faculty is discarded).
- [ ] **TASK-104:** Seed demonstration accounts (`student.demo@lablink.edu` and `faculty.demo@lablink.edu`) with "One-Click Quick Login" UI helper.
  - *Verification:* Evaluators can log into both roles with one click without bypassing Firebase authentication.

### Phase 2: Equipment Discovery & Catalog
- [ ] **TASK-201:** Execute migrations for `laboratories`, `laboratory_operating_hours`, `equipment`, and `equipment_capabilities` (with configurable cancellation buffer and turnaround buffer).
  - *Verification:* Foreign keys, cascading rules, and GIN indexes created.
- [ ] **TASK-202:** Seed 10 synthetic instruments (Keysight Oscilloscope, FE-SEM, HPLC, SLA 3D Printer, Confocal Microscope) across 3 departments with realistic specs.
  - *Verification:* Equipment records populated with verified technical parameters, operating hours (08:00 to 20:00), and turnaround buffers.
- [ ] **TASK-203:** Implement Equipment Discovery Catalog UI (Stitch Screen 02) and `GET /api/v1/equipment` handler.
  - *Verification:* Filter by category, department, and status functional; renders specifications accurately.

### Phase 3: Project Access Request Pipeline
- [ ] **TASK-301:** Execute migrations for `booking_requests` and `project_details`.
  - *Verification:* Tables created with constraints for duration ($0.5$ to $12$h) and optional deadline date.
- [ ] **TASK-302:** Implement Request Submission UI (Stitch Screen 05) and `POST /api/v1/requests` handler with Zod validation.
  - *Verification:* Submits project docket; status set to `PENDING_REVIEW`; rejects malformed inputs with HTTP 422.

### Phase 4: Faculty Review, GiST Concurrency Lock & Booking Confirmation
- [ ] **TASK-401:** Execute migration for `bookings` with generated stored `time_range` column and PostgreSQL GiST exclusion constraint (`btree_gist`).
  - *Verification:* `time_range tstzrange GENERATED ALWAYS AS (tstzrange(start_time, end_time, '[)')) STORED NOT NULL` created with `CONSTRAINT no_overlapping_confirmed_bookings EXCLUDE USING gist (equipment_id WITH =, time_range WITH &&) WHERE (status = 'CONFIRMED')`.
- [ ] **TASK-402:** Implement Faculty Request Review Console UI (Stitch Screen 06) and `PATCH /api/v1/requests/:id/review` (Approve/Reject).
  - *Verification:* Approval sets request status to `APPROVED` (does not create booking); Rejection prompts for mandatory reason.
- [ ] **TASK-403:** Implement Booking Confirmation Handler (`POST /api/v1/bookings/confirm`) with isolated ACID transaction:
  1. `SELECT ... FOR UPDATE` on `booking_requests` (duplicate confirmation defense).
  2. `SELECT ... FOR UPDATE` on `users` (quota exhaustion defense).
  3. `SELECT ... FOR UPDATE` on `equipment` (buffer verification).
  4. Atomic insert to `bookings` under GiST exclusion lock.
  5. Status update to `BOOKED`, quota update, and audit log insert.
  - *Verification:* Automated 50-thread concurrent booking test yields exactly 1 success and 49 HTTP 409 conflicts. Duplicate confirmation and quota exhaustion tests pass.
- [ ] **TASK-404:** Implement Student Request Tracking Stepper UI (Stitch Screen 08).
  - *Verification:* Reflects real-time progression from Submitted -> Under Review -> Approved -> Confirmed Reservation.

---

## 3. Priority 2: Intelligent Scheduling & Console Experience

- [ ] **TASK-501:** Implement Two-Phase Scheduling Engine (`src/lib/scheduling/engine.ts`):
  - Phase 1: Request Prioritization ($P_{\text{req}}$) evaluating deadline urgency and quota fairness (invariant across candidate slots).
  - Phase 2: Hard Constraint Pruning (independent feasibility filter) and Feasible Slot Scoring ($S_{\text{slot}}$) for contiguity and window preference.
  - Deterministic relational tie-breaking (no epsilon ambiguity).
  - Edge-case diagnostics (`NO_FEASIBLE_SLOTS` with structured constraint failure codes).
  - *Verification:* Vitest unit tests verify score bounds $[0.0, 1.0]$, default fallback for missing deadlines/quotas, and deterministic ordering.
- [ ] **TASK-502:** Implement Intelligent Scheduling & Conflict Resolution UI (Stitch Screen 04 & Screen 09).
  - *Verification:* Displays detected contention, constraint breakdown matrix, and ranked candidate slots.
- [ ] **TASK-503:** Implement Weekly Laboratory Scheduling Calendar (Stitch Screen 07) with Gantt schedule matrix.
  - *Verification:* Color-coded reservations displayed across operating hours (08:00 to 20:00).
- [ ] **TASK-504:** Implement Faculty Laboratory Dashboard (Stitch Screen 03) and Student Laboratory Dashboard (Stitch Screen 01).
  - *Verification:* Real-time active dockets, utilization metrics, and upcoming reservations.

---

## 4. Priority 3: Gemini GenAI Polish & Cloud Packaging (Deferrable)

- [ ] **TASK-601:** Implement Gemini API Client (`src/lib/gemini/client.ts`) with strict Zod validation schemas.
  - *Verification:* Authenticates via `GEMINI_API_KEY`; handles errors safely with zero write access.
- [ ] **TASK-602:** Implement Natural-Language Equipment Search Query Translator (`POST /api/v1/equipment/search`).
  - *Verification:* Conversational queries accurately map to technical categories and specifications.
- [ ] **TASK-603:** Implement Explainable Scheduling Arbitration Rationale Generator.
  - *Verification:* Generates plain-text explainability cards matching deterministic scoring factors.
- [ ] **TASK-604:** Implement Facility Utilization Analytics & Quota Fairness Gauges on Faculty Dashboard.
  - *Verification:* Utilization heatmaps and fairness index widget rendered.
- [ ] **TASK-701:** Author multi-stage production Dockerfile (`node:24-alpine`) and verify local container build.
  - *Verification:* Container starts up in under 5 seconds, serves port 8080 as non-root user `nextjs`.
- [ ] **TASK-702:** Verify Git repository size and single-branch status.
  - *Verification:* `git branch -a` shows only `master`; `git count-objects -vH` shows repository size $< 5$ MB.
