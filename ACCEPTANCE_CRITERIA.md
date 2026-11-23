# LabLink 2026 - Testable Acceptance Criteria & Verification Protocol

**Project:** LabLink  
**Document Version:** 1.2.0 (Final Targeted Pre-Implementation Revision)  
**Testing Framework:** Vitest (Unit/Integration) & Playwright (E2E Browser Automation)  
**Specification Format:** Gherkin / BDD (Given - When - Then)  

---

## Document Revision History & Correction Log

| Version | Date | Author / Role | Key Revisions & Architectural Corrections |
|---|---|---|---|
| 1.0.0 | 2026-11-23 | Principal Architect | Initial baseline acceptance criteria. |
| 1.1.0 | 2026-11-23 | Principal Architect | Role tampering tests; approval vs confirmation separation; concurrent GiST exclusion test. |
| 1.2.0 | 2026-11-23 | Principal Architect | **Targeted Architectural Corrections:**<br>• Added `AC-CONCUR-02`: Duplicate request confirmation defense via request row lock (`FOR UPDATE`).<br>• Added `AC-CONCUR-03`: Concurrent quota over-consumption defense via user row lock (`FOR UPDATE`).<br>• Updated `AC-SCHED-01` & `AC-SCHED-02`: Separated Request Prioritization from Candidate Slot Selection; verified exact relational tie-breaking.<br>• Added `AC-SCHED-03`: Diagnostic handling for infeasible candidate slots.<br>• Updated cancellation criteria to reflect configurable laboratory buffer policy.<br>• Removed check-in PIN tokens from workflow. |

---

## 1. Authentication & Role Authorization Scenarios

### Scenario AC-AUTH-01: Successful Dual-Role Seeded Authentication
- **Given** seeded accounts exist in Firebase and PostgreSQL: `student.demo@lablink.edu` (role: `student`) and `faculty.demo@lablink.edu` (role: `faculty`).
- **When** an evaluator clicks "Quick Login as Student" on the login screen.
- **Then** Firebase client SDK authenticates and receives a valid JWT ID token.
- **And** the server-side Node.js environment (`runtime = 'nodejs'`) verifies the token signature via Firebase Admin SDK.
- **And** the server queries PostgreSQL `users.role` directly to verify authorization.
- **And** the server returns user profile with `role: "student"`.
- **And** the browser redirects to `/dashboard` (Student Laboratory Dashboard).

### Scenario AC-AUTH-02: Prevention of Role Tampering during Account Sync
- **Given** an authenticated user with a valid Firebase JWT ID token.
- **When** the client sends a `POST /api/v1/auth/sync` payload maliciously including `{"role": "faculty"}`.
- **Then** the server discards the client-provided `role` attribute.
- **And** assigns `role: "student"` in the PostgreSQL `users` table.
- **And** returns status `200 OK` with `role: "student"`.
- **And** database verification confirms the user role is strictly `student`.

### Scenario AC-AUTH-03: Server-Side RBAC Enforcement on Protected Faculty APIs
- **Given** an authenticated user with `role: "student"`.
- **When** the student sends a `POST` request to `/api/v1/bookings/confirm` or `/api/v1/faculty/equipment`.
- **Then** the Node.js Route Handler intercepts the request via `requireAuth(req, ['faculty'])`.
- **And** returns status `403 Forbidden` with body `{"error": "FORBIDDEN", "message": "Faculty credentials required"}`.
- **And** zero database records are created or altered.

---

## 2. Equipment Discovery & Semantic Search

### Scenario AC-DISC-01: Multi-Faceted Catalog Filtering
- **Given** a laboratory catalog containing instruments across multiple departments.
- **When** a user filters by department "Central Engineering" and status "AVAILABLE".
- **Then** the catalog displays only matching instruments within 150ms.
- **And** displays technical specifications, manufacturer model, and real-time availability.

### Scenario AC-DISC-02: Gemini Natural-Language Query Translation
- **Given** a conversational query: *"high vacuum electron microscope for surface imaging"*.
- **When** the query is posted to `/api/v1/equipment/search`.
- **Then** the Gemini API service extracts technical tags (`category: "Microscopy"`, `vacuum: "high"`).
- **And** the server validates the structured JSON with Zod before querying PostgreSQL.
- **And** returns matching instruments without executing raw SQL.

---

## 3. Two-Stage Lifecycle: Request Approval vs. Booking Confirmation

### Scenario AC-WORKFLOW-01: Student Submits Project Access Request
- **Given** an authenticated student researcher.
- **When** the student submits a project request docket with title, abstract, duration `3.5h`, and optional deadline date.
- **Then** a row is inserted into `booking_requests` with status `PENDING_REVIEW`.
- **And** the student tracking stepper shows Stage 1 complete and Stage 2 (Faculty Review) active.
- **And** no calendar slot is reserved.

### Scenario AC-WORKFLOW-02: Faculty Approves Request (Merit Sign-Off)
- **Given** a request in `PENDING_REVIEW` status.
- **When** the faculty coordinator clicks "Approve Request".
- **Then** `booking_requests.status` transitions to `APPROVED`.
- **And** the student is notified of project approval.
- **And** **no calendar reservation is created yet** (proving approval $\ne$ booking confirmation).

### Scenario AC-WORKFLOW-03: Faculty Confirms Specific Booking Slot
- **Given** an approved request docket.
- **When** the faculty coordinator selects a candidate slot (e.g. Thursday 14:00 - 17:30) and clicks "Confirm Booking".
- **Then** an ACID transaction executes with `SELECT ... FOR UPDATE` row locks on the request, student, and equipment.
- **And** an atomic insert is committed to `bookings` with status `CONFIRMED`.
- **And** the stored generated column `time_range` is automatically created.
- **And** `booking_requests.status` transitions to `BOOKED`.
- **And** the student's `used_quota_hours` is incremented by 3.5.
- **And** an immutable audit row is written to `booking_audit_logs`.

### Scenario AC-WORKFLOW-04: Faculty Rejects Request with Mandatory Rationale
- **Given** a request in `PENDING_REVIEW` status.
- **When** the faculty coordinator clicks "Reject" and provides justification: *"Project scope exceeds laboratory capabilities."*
- **Then** `booking_requests.status` transitions to `REJECTED`.
- **And** `booking_requests.rejection_reason` stores the exact justification.
- **And** an audit record is logged with action `REJECTED`.

---

## 4. Cancellation Policy Scenarios

### Scenario AC-CANCEL-01: Student Cancels Own Pending Request
- **Given** a request submitted by student Alex Chen in `PENDING_REVIEW` status.
- **When** Alex Chen sends a `POST /api/v1/requests/:id/cancel`.
- **Then** the request status transitions to `CANCELLED`.
- **And** an audit record is logged.

### Scenario AC-CANCEL-02: Student Cancels Confirmed Booking Within Configurable Policy Window
- **Given** a confirmed booking scheduled 24 hours in the future.
- **And** the laboratory's configurable `cancellation_buffer_minutes` is 120 minutes.
- **When** the student cancels the booking 24 hours before the start time.
- **Then** `bookings.status` transitions to `CANCELLED`.
- **And** the student's `used_quota_hours` is refunded by the booking duration.
- **And** the time slot immediately becomes available in the calendar.

### Scenario AC-CANCEL-03: Faculty Cancels Booking with Mandatory Reason
- **Given** an active confirmed booking.
- **When** a faculty coordinator cancels the booking entering reason: *"Emergency facility water pipe maintenance."*
- **Then** `bookings.status` transitions to `CANCELLED`.
- **And** the student's quota is refunded.
- **And** the audit log records action `CANCELLED` with the reason.

---

## 5. Two-Phase Scheduling & Concurrency Verification Scenarios

### Scenario AC-SCHED-01: Request Prioritization ($P_{\text{req}}$) & Edge Case Robustness
- **Given** two pending approved requests: Request A (deadline in 2 days) and Request B (no deadline provided, missing quota).
- **When** Request Prioritization ($P_{\text{req}}$) is computed.
- **Then** Request A evaluates $U(A) = \exp(-2/7) \approx 0.751$.
- **And** Request B evaluates default urgency $U(B) = 0.10$ and default demo quota $Q = 25.0$h without division-by-zero.
- **And** Request A receives higher request priority than Request B.
- **And** $P_{\text{req}}$ is verified to be identical across all candidate time slots for Request A.

### Scenario AC-SCHED-02: Feasible Slot Selection & Deterministic Tie-Breaking
- **Given** feasible candidate slots $t_1$ (Thursday 10:00 - 12:00) and $t_2$ (Thursday 14:00 - 16:00).
- **When** candidate slot scoring runs.
- **Then** hard constraints run independently first, passing only valid slots.
- **And** contiguity and student window preference are scored.
- **And** if composite scores are equal, tie-breaking selects $t_1$ based on exact relational sorting `(ROUND(score, 6) DESC, start_time ASC)`.

### Scenario AC-SCHED-03: Infeasible Candidate Slot Diagnostics
- **Given** a request submitted for an instrument that is fully booked during laboratory open hours.
- **When** candidate slot generation executes.
- **Then** the engine identifies zero feasible slots ($\mathcal{T}_{\text{feasible}} = \emptyset$).
- **And** returns `STATUS: NO_FEASIBLE_SLOTS`.
- **And** returns structured failure diagnostics: `{"code": "ALL_SLOTS_CONFLICTED", "conflictsCount": 4}`.
- **And** suggests alternative slots outside the requested window or on compatible instruments.

### Scenario AC-CONCUR-01: Concurrent GiST Exclusion Lock Defense (50 Threads)
- **Given** an open slot for an oscilloscope on Friday from 10:00 to 13:00.
- **When** 50 concurrent automated API requests attempt to confirm bookings overlapping with this slot.
- **Then** PostgreSQL executes serial row evaluation under the GiST range exclusion.
- **And** exactly **1 request succeeds** with `201 Created`.
- **And** exactly **49 requests fail** with `409 Conflict` (PostgreSQL error `23P01`, `SLOT_DOUBLE_BOOKED`).
- **And** database inspection confirms zero double bookings.

### Scenario AC-CONCUR-02: Simultaneous Duplicate Request Confirmation Defense
- **Given** an approved request docket in `APPROVED` status.
- **When** two concurrent API calls attempt to confirm the same request docket for different time slots.
- **Then** the first transaction acquires the `FOR UPDATE` lock on `booking_requests` and transitions status to `BOOKED`.
- **And** the second transaction unblocks, detects `status != 'APPROVED'`, immediately rolls back, and returns HTTP `409 Conflict` (`REQUEST_ALREADY_PROCESSED`).
- **And** exactly one confirmed booking exists for the request docket.

### Scenario AC-CONCUR-03: Concurrent Student Quota Exhaustion Defense (10 Threads)
- **Given** a student with 2.0 hours remaining in their configurable monthly quota.
- **When** 10 concurrent requests of 1.0 hour each attempt confirmation simultaneously.
- **Then** the user record is locked `FOR UPDATE` during each confirmation.
- **And** exactly **2 requests succeed** with `201 Created`.
- **And** exactly **8 requests fail** with `409 Conflict` (`QUOTA_EXCEEDED`).
- **And** the student's `used_quota_hours` strictly equals the quota limit without exceeding it.

---

## 6. Gemini AI Safety & Containment

### Scenario AC-AI-01: Advisory Sandboxing & Output Validation
- **Given** a request to generate plain-text explainability for a recommended slot.
- **When** the Gemini API returns a response.
- **Then** the output is validated against a strict Zod schema.
- **And** the text is rendered as an informational callout.
- **And** the Gemini service executes zero SQL queries or booking updates.
