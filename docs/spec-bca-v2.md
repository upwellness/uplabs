# UPLABS BCA Tracker — v2 Spec

**Feature:** BCA Dashboard improvements + Admin multi-user access  
**Date:** 2026-05-12  
**Status:** Approved → In Development

---

## Problem Statement

BCA Tracker v1 uses hardcoded demo data and a single merged trend chart that plots weight, fat%, and muscle% on the same Y-axis — making the lines unreadable (weight in kg vs % values are incompatible scales). Admin users cannot view any customer's data; the app is locked to the logged-in coach's own customer list.

---

## Goals

1. Replace single trend chart with 5 dedicated metric panels — each with correct scale and reference zones
2. Admin role can browse and view data for any customer across all coaches
3. Real data from Supabase replaces demo seed
4. CustomerPicker wires up to live API

---

## Non-Goals

- Edit or delete past measurements (v3)
- Multi-coach collaborative notes (v3)
- Export to PDF/CSV (v3)
- Push notifications for abnormal values (v3)

---

## User Stories

**As a coach (abo role):**
- I want to see each BCA metric in its own chart with appropriate scale so I can spot trends clearly
- I want to select any of my customers from a picker and see their history immediately

**As an admin:**
- I want to see a full customer list across all coaches so I can monitor the platform
- I want to view any customer's BCA data without being their assigned coach

---

## Requirements

### P0 — Must Have

| # | Requirement | Acceptance Criteria |
|---|-------------|---------------------|
| 1 | 5 separate trend chart panels | Weight / Fat+Fat% / Muscle% / Visceral Fat / Body Age — each renders with its own Y-axis scale |
| 2 | Admin sees all customers | `/api/customers` returns all rows when `profile.role === 'admin'`; returns `coach_id = user.id` otherwise |
| 3 | Admin can load any customer's measurements | `/api/customers/[id]/measurements` allows access if admin, else verifies coach ownership |
| 4 | BCA page loads real data | CustomerPicker fetches from `/api/customers`; selecting customer fetches measurements via API |
| 5 | Chart tab/panel switcher | User can switch between panels via tab bar or scrollable grid |

### P1 — Nice to Have

| # | Requirement |
|---|-------------|
| 6 | Reference zone shading on trend charts (e.g., green band = healthy range) |
| 7 | Body Age vs Chrono Age overlay on Body Age panel |
| 8 | Fat mass (kg) as secondary line on Fat panel |

---

## Chart Panels — Detail

| Panel | Metrics | Y-axis | Reference |
|-------|---------|--------|-----------|
| น้ำหนัก | weight (kg) | kg | none |
| ไขมัน | fat_pct (%) + fat_mass (kg) | % primary | ACE healthy range shaded |
| กล้ามเนื้อ | muscle_pct (%) | % | gender-specific healthy range |
| Visceral Fat | visceral (level) | 1–20 | ≤9 optimal zone shaded |
| Body Age | body_age vs chrono_age | years | chrono_age as reference line |

---

## API Changes

### `GET /api/customers`
```
if role === 'admin' → select * from customers order by name
else               → select * from customers where coach_id = user.id order by name
```

### `GET /api/customers/[id]/measurements`
```
if role === 'admin' → allow any customer_id
else               → verify customers.coach_id = user.id, else 403
```

---

## Open Questions

- [ ] **Data:** Do customers table and measurements table exist in production Supabase? Need to verify schema before wiring. *(Engineering)*
- [ ] **Fat mass:** Show as secondary line or separate panel? *(Design — defaulting to secondary line on Fat panel)*

---

## Timeline

- Spec: 2026-05-12 ✅
- Implementation: 2026-05-12 (same session)
- Deploy: auto via GitHub → Vercel
