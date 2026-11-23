# LabLink 2026 - Stitch Design Handoff & Visual Source of Truth

**Project Identifier:** `projects/15502302728869515424`  
**Stitch Title:** `LabLink Campus Resource Platform`  
**Design System:** `Academic Precision`  
**Color Mode:** Light Mode (`#FAF8FF` canvas surface, `#0F172A` neutral core)  
**Primary Typography:** Inter (Interface / Headings)  
**Telemetry / Code Typography:** JetBrains Mono (Asset IDs, Metrics, Tabular Numerals)  
**Component Style:** Structured Modern / Technical Minimalist (1px solid `#E2E8F0` borders, 6px controls, 8px cards, zero decorative glassmorphism)  
**Export Status:** 13 of 13 Screens Exported (9 Desktop + 4 Mobile Companion Screens) in HTML (Tailwind CSS) and Full Resolution PNG Screenshots  
**Document Version:** 1.1.0 (Post-Review Architectural Revision)  

---

## Document Revision History & Correction Log

| Version | Date | Author / Role | Key Revisions & Architectural Corrections |
|---|---|---|---|
| 1.0.0 | 2026-11-23 | Principal Architect | Initial baseline design handoff and screen inventory. |
| 1.1.0 | 2026-11-23 | Principal Architect | **Targeted Architectural Corrections:**<br>• Formalized Git repository size control strategy: raw high-resolution PNG screenshots (14.2 MB) are permanently preserved locally in `design/stitch/screens/`, but excluded via `.gitignore` to maintain repository size $< 10$ MB.<br>• Semantic HTML templates, design tokens, and metadata are committed to Git.<br>• Confirmed UI component mapping for the two primary roles: Student Researcher vs Faculty / Laboratory Coordinator.<br>• Clarified simulated digital check-in code vs physical hardware access PINs. |

---

## 1. Executive Summary & Visual Source of Truth

The visual foundation for LabLink has been designed using Google Stitch under the design system **Academic Precision**. This aesthetic reflects an institutional, high-density scientific computing environment tailored for research university laboratories, core instrumentation facilities, and principal investigators (PIs).

All designs have been exported directly from the Stitch MCP Server into the local workspace repository at `design/stitch/`. The implementation team must treat these exported materials as the authoritative visual specification. Arbitrary visual deviations, generic AI dashboard templates, or uncalibrated styles are strictly forbidden.

---

## 2. Screen Inventory & Export Verification Matrix

| # | Screen File Prefix | Screen ID | Title & Viewport | Dimensions | HTML Size | PNG Size | Local Status | Git Strategy |
|---|---|---|---|---|---|---|:---:|:---:|
| **01** | `01_student_laboratory_dashboard` | `861f410a28464f00bc4da9bad4ec3117` | Student Laboratory Dashboard (Desktop) | 2560 × 3802 | 46.4 KB | 1.33 MB | Verified ✅ | HTML committed; PNG local |
| **02** | `02_equipment_discovery_and_specifications` | `ea2aae7ce6354a89be96702002efbe1f` | Equipment Discovery & Specifications Catalog (Desktop) | 2560 × 3788 | 50.8 KB | 2.71 MB | Verified ✅ | HTML committed; PNG local |
| **03** | `03_faculty_laboratory_management` | `86b5609f50c34e79b9104edc2ff64e2e` | Faculty Laboratory Management Dashboard (Desktop) | 2560 × 3386 | 41.7 KB | 948 KB | Verified ✅ | HTML committed; PNG local |
| **04** | `04_intelligent_scheduling_and_conflict_resolution` | `a3e879db267a4331b665ce7e5dd21a02` | Intelligent Scheduling & Conflict Resolution Engine (Desktop) | 2560 × 3194 | 36.8 KB | 903 KB | Verified ✅ | HTML committed; PNG local |
| **05** | `05_student_project_access_request` | `275492e56d78477e90ebc7e99eb01cfe` | Student Project Access Request (Desktop) | 2560 × 4816 | 41.8 KB | 1.08 MB | Verified ✅ | HTML committed; PNG local |
| **06** | `06_faculty_request_review` | `d878408e8d89426da415003d87e7e211` | Faculty Request Review Console (Desktop) | 2560 × 3624 | 44.8 KB | 1.09 MB | Verified ✅ | HTML committed; PNG local |
| **07** | `07_weekly_laboratory_scheduling_calendar` | `5206f85945a548f4afd9c4fab109209f` | Weekly Laboratory Scheduling Calendar (Desktop) | 2560 × 4562 | 58.8 KB | 1.20 MB | Verified ✅ | HTML committed; PNG local |
| **08** | `08_student_request_tracking` | `b1cf784dbf854c4298f6c8eadf1f9d0c` | Student Request Tracking & Docket Details (Desktop) | 2560 × 4602 | 46.7 KB | 1.14 MB | Verified ✅ | HTML committed; PNG local |
| **09** | `09_scheduling_recommendation_details` | `d94c3396a7564e50a7fea23c6d8d683b` | Scheduling Recommendation & Arbitration Details (Desktop) | 2560 × 3548 | 48.1 KB | 1.21 MB | Verified ✅ | HTML committed; PNG local |
| **10** | `10_student_laboratory_dashboard_mobile` | `54f02155c5394fd6881f894a27c25089` | Student Laboratory Dashboard (Mobile) | 780 × 4996 | 34.7 KB | 643 KB | Verified ✅ | HTML committed; PNG local |
| **11** | `11_equipment_discovery_and_availability_mobile` | `c7b69f0899fc4b288974d31a399a2c99` | Equipment Discovery & Availability (Mobile) | 780 × 4422 | 35.1 KB | 1.40 MB | Verified ✅ | HTML committed; PNG local |
| **12** | `12_faculty_approvals_and_conflict_resolution_mobile` | `6a3b4c6396334631ac785067a15c5788` | Faculty Approvals & Conflict Resolution (Mobile) | 780 × 3766 | 24.6 KB | 409 KB | Verified ✅ | HTML committed; PNG local |
| **13** | `13_project_access_request_and_scheduling_mobile` | `08df62edd69542b6909ec312c4f503a4` | Project Access Request & Scheduling (Mobile) | 780 × 3218 | 21.9 KB | 387 KB | Verified ✅ | HTML committed; PNG local |

All materials are archived at:  
- HTML templates: `[LabLink/design/stitch/screens/](file:///d:/projects%20using%20antigravity/LabLink/design/stitch/screens/)`  
- Screenshots: `[LabLink/design/stitch/screens/*.png](file:///d:/projects%20using%20antigravity/LabLink/design/stitch/screens/)`  
- Downloaded Photographic Assets: `[LabLink/design/stitch/assets/](file:///d:/projects%20using%20antigravity/LabLink/design/stitch/assets/)` (18 high-resolution instrument photos)  
- Design Tokens: `[LabLink/design/stitch/design-tokens/](file:///d:/projects%20using%20antigravity/LabLink/design/stitch/design-tokens/)`  
- Manifest: `[LabLink/design/stitch/manifest.json](file:///d:/projects%20using%20antigravity/LabLink/design/stitch/manifest.json)`

---

## 3. Design Tokens & Visual Rules

### 3.1 Color Palette

| Token Name | Hex Value | Semantic Purpose / UI Context |
|---|---|---|
| `primary` | `#0037B0` / `#1D4ED8` | Restrained Technical Cobalt. Direct user actions, primary buttons, confirmed sessions, active tabs. |
| `primary-container` | `#1D4ED8` | Primary active accent fill container. |
| `on-primary` | `#FFFFFF` | Text/icons on primary surfaces. |
| `secondary` | `#006A61` / `#0D9488` | Deep Laboratory Teal. Telemetry data, instrument availability tags, calibrated status indicators. |
| `secondary-container`| `#86F2E4` | Soft teal container fill for badges and active telemetry callouts. |
| `tertiary` | `#311FCA` / `#4F46E5` | Academic Indigo. Dedicated strictly to AI optimization, algorithmic recommendations, and conflict arbitration. |
| `tertiary-container` | `#4B41E1` | AI notification callouts, left indicator bars on recommendation cards. |
| `surface` | `#FAF8FF` | Canvas background for main viewports. |
| `surface-container-lowest` | `#FFFFFF` | Card backgrounds, active data tables, modal shells. |
| `surface-container-low` | `#F2F3FF` | Secondary card backgrounds, table header bars, neutral filter chips. |
| `surface-container-high`| `#E2E7FF` | Hover states, selected row highlights, pill counters. |
| `outline` | `#747686` | Micro metadata text, inactive icon states, secondary timestamps. |
| `outline-variant` | `#E2E8F0` / `#CBD5E1`| Crisp 1px borders dividing all panels, data rows, and input fields. |
| `error` | `#DC2626` / `#BA1A1A` | Out of Service, Critical Conflict, Booking Rejection. |
| `status-active` | `#059669` (Emerald 600)| Hardware Operational / Calibrated / Ready for Check-in. |
| `status-review` | `#D97706` (Amber 600)  | Faculty Review In Progress / Scheduling Contention. |
| `status-queued` | `#0284C7` (Sky 600)    | Scheduled Future Booking / Approved Slot in Queue. |

### 3.2 Typography & Numerical Formatting
- **Primary Interface (Inter):** Clean administrative typography. Headings enforce tight letter-spacing (`-0.015em` to `-0.025em`).
- **Telemetry & Technical Metrics (JetBrains Mono):** Asset IDs (`EQ-LAB-1042`), docket numbers (`REQ-2026-001`), and all numerical values.
- **Tabular Figures:** Numbers in table cells, countdowns, and duration metrics must enforce `tabular-nums` (`font-variant-numeric: tabular-nums`) to prevent layout shifts.

### 3.3 Layout & Component Radii
- **Base Grid:** 12-column layout (desktop, max-width 1600px).
- **Controls & Inputs:** 6px radius (`rounded-md`).
- **Cards & Data Frames:** 8px radius (`rounded-lg`) with 1px border (`#E2E8F0`).
- **Prohibition:** Actionable buttons must **never** use full-pill styling (`rounded-full`); pills are reserved solely for status dot indicators and user avatars.

---

## 4. UI Component Mapping & Two-Role Viewport Architecture

### 4.1 Primary Role Toggle
- The sidebar navigation incorporates a top role switcher allowing instant toggle between **Student Researcher** and **Faculty Member / Laboratory Coordinator** viewports, facilitating transparent demonstration testing.

### 4.2 Component Allocation to Views
- **Student Viewports:**
  - `Screen 01 (Dashboard)`: Operational status banner, countdown timer, metric KPI cards, active booking dockets.
  - `Screen 02 (Catalog)`: Multi-faceted filtering, keyword/semantic search, technical specification modal.
  - `Screen 05 (Request)`: Structured docket submission form with duration picker and deadline calendar.
  - `Screen 08 (Tracking)`: 4-stage interactive milestone stepper with timestamped progression.
- **Faculty Viewports:**
  - `Screen 03 (Management)`: Laboratory asset roster, operational health toggles, utilization metrics.
  - `Screen 04 (Conflicts)`: Conflict detection console, constraint evaluation matrix, alternative candidate slots.
  - `Screen 06 (Review)`: Request review console with dual actions: "Approve Request" and "Reject Request" (with mandatory reason).
  - `Screen 07 (Calendar)`: Weekly laboratory scheduling calendar (Gantt schedule matrix).
  - `Screen 09 (Arbitration)`: Multi-objective score breakdown, radar charts, and plain-language explainability cards.
