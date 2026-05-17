# UP Wellness Ops · BCA Tracker — v2 Spec

**Feature:** BCA Dashboard, multi-user access, edit/delete history, report export  
**Date:** 2026-05-12 (last updated 2026-05-12)
**Status:** In Development

---

## Problem Statement

BCA Tracker v1 limitations being solved in v2:
- Single merged trend chart plotted weight, fat%, muscle% on same Y-axis → unreadable
- Admin users couldn't view any customer's data; locked to logged-in coach's list
- Hardcoded demo data instead of real Supabase
- No way to edit or delete past measurements after they were saved
- No way to export reports / share with customer (no image, no print)

---

## Goals

1. Replace single trend chart with 5 dedicated metric panels — each with correct scale and trend line
2. Admin role can browse and view data for any customer across all coaches
3. Real data from Supabase replaces demo seed
4. Edit & delete history rows inline from the table
5. Export composable report (graph / history / session detail) as PNG image

---

## Non-Goals (v2)

- Export to PDF (PNG only for v2 — PDF is v3)
- Multi-coach collaborative notes (v3)
- Push notifications for abnormal values (v3)
- Customer-facing portal — they get the PNG via LINE, no login (v3)

---

## User Stories

**As a coach (abo role):**
- I want to see each BCA metric in its own chart with appropriate scale so I can spot trends clearly
- I want to select any of my customers from a picker and see their history immediately
- I want to fix a typo in a past measurement without manually editing the database
- I want to delete a bad entry (e.g., test data) cleanly
- I want to generate a one-page PNG report and send it via LINE to my customer

**As an admin:**
- I want to see a full customer list across all coaches so I can monitor the platform
- I want to view any customer's BCA data without being their assigned coach
- I want edit/delete privileges across all customers (data quality control)

---

## Requirements

### P0 — Must Have

| # | Requirement | Acceptance Criteria |
|---|-------------|---------------------|
| 1 | 5 stacked trend chart panels | Weight / Fat / Muscle% / Visceral / Body Age — each with its own Y-axis scale, data labels on every point, dashed trend line |
| 2 | Period filter | Buttons: 14d / 1m / 3m / 6m / 1y / all (default 6m) |
| 3 | Visibility toggles | Checkbox per chart to show/hide |
| 4 | Admin sees all customers | `/api/customers` returns all rows when `profile.role === 'admin'`; returns `coach_id = user.id` otherwise |
| 5 | Admin can access any customer's measurements | `/api/customers/[id]/measurements` allows access if admin, else verifies coach ownership |
| 6 | BCA page loads real data | CustomerPicker fetches from `/api/customers`; selecting customer fetches measurements via API |
| 7 | Edit measurement | "แก้ไข" button on each history row opens form pre-filled; PATCH `/api/measurements/[id]` |
| 8 | Delete measurement | "ลบ" button on each history row with confirm dialog; DELETE `/api/measurements/[id]` |
| 9 | Report builder modal | Checkboxes: กราฟแนวโน้ม / ประวัติการวัด / ค่าครั้งนี้ — generates PNG via `html-to-image` |
| 10 | Click history row → session report | Clicking any row in the history table opens the Report Builder with that session's detail pre-selected |

### P1 — Nice to Have

| # | Requirement |
|---|-------------|
| 11 | Reference zone shading on trend charts (e.g., green band = healthy range) |
| 12 | Fat chart dual Y-axis: Fat Mass (kg) left + Fat% right |
| 13 | Body Age chart overlays chronological age reference line |

### P2 — Future

| # | Requirement |
|---|-------------|
| 14 | PDF export (multi-page) |
| 15 | Public share link (no-login customer view) |
| 16 | Bulk CSV import (re-import from v1 dump) |
| 17 | Compare two sessions side-by-side |

---

## Chart Panels — Detail

| Panel | Metrics | Y-axis | Notes |
|-------|---------|--------|-------|
| น้ำหนัก | weight (kg) | kg | Auto domain, blue line |
| ไขมัน | fat_mass (kg) + fat_pct (%) | dual axis | Fat Mass solid yellow + %Fat dashed amber |
| กล้ามเนื้อ | muscle_pct (%) | % | Green line |
| Visceral Fat | visceral (level) | 0–dataMax+2 | Red line |
| Body Age | body_age vs chrono_age | years | Body Age purple + chrono dashed gray |

All charts include linear regression trend line (dashed gray) and data labels on each point.

---

## Permission Matrix

| Action | Coach | Admin |
|--------|-------|-------|
| View own customers | ✅ | ✅ |
| View other coaches' customers | ❌ | ✅ |
| Create measurement for own customer | ✅ | ✅ |
| Edit measurement of own customer | ✅ | ✅ |
| Edit measurement of other coach's customer | ❌ | ✅ |
| Delete measurement | ✅ (own) | ✅ (any) |

Enforced at API layer (`/api/measurements/[id]` PATCH/DELETE) — checks `customers.coach_id` join against session unless admin.

---

## Report Builder — Design

**Trigger:** "📄 สร้างรายงาน" button on patient card · OR click any history row.

**Sections (composable):**
- ☑ **กราฟแนวโน้ม** — full TrendCharts (filtered by current period)
- ☑ **ประวัติการวัด** — full table without action buttons
- ☐ **ค่าครั้งนี้** — single session metric grid (only enabled when triggered from a row click)

**Output:** PNG, filename `[customer]_BCA_YYYY-MM-DD.png`, white background, 2x pixel ratio for retina.

**Library:** `html-to-image` (toPng). Toolbar excluded via `.no-export` class filter.

---

## API Surface

```
GET    /api/customers
GET    /api/customers/[id]/measurements
POST   /api/customers/[id]/measurements
PATCH  /api/measurements/[id]
DELETE /api/measurements/[id]
```

All routes go through `getSession()` → check `profile.role === 'admin'` OR `coach_id = user.id`.

---

## Open Questions

- [ ] **Reference zone shading:** Add to v2 P1 or defer? *(Design — currently no shading, just trend lines)*
- [ ] **Inline-editable cells:** Should weight/fat% be inline-editable (Notion-style) instead of opening the form? *(UX — defer to v3)*
- [ ] **Multi-page PDF:** Worth the dependency cost (jsPDF + html2canvas)? *(Engineering — v3 candidate)*

---

## Timeline

- v2 P0 spec: 2026-05-12 ✅
- v2 P0 implementation: 2026-05-12 ✅
- v2 P1: TBD
- v3 (PDF, public share): TBD
