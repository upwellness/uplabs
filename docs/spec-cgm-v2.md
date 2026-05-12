# UPLABS CGM Analyzer — v2 Spec

**Feature:** Continuous Glucose Monitor data viewer + meal logger + report export  
**Date:** 2026-05-12  
**Status:** v2 MVP shipped — same tone/UX as BCA v2

---

## Goals

1. View glucose readings with time-series chart, ADA reference zones, meal markers
2. Time-period filter (6h / 12h / 1d / 3d / 7d / 14d / all)
3. Log/edit/delete meals attached to a profile
4. Composable PNG report export (stats / graph / meals)
5. Tone-matched to BCA v2: ProfilePicker pattern, summary stats, period filter, action buttons

---

## Schema (v1 compatible)

- `cgm_readings` — profile_name (text), reading_timestamp (bigint epoch ms), date_str, glucose
- `cgm_meals` — id, profile_name, meal_timestamp, date_str, description, carbs, protein, fat

Note: profile_name is a string key, not FK to customers (v1 legacy).

---

## API Surface

```
GET    /api/cgm/profiles                   → list distinct profiles + counts
GET    /api/cgm/profiles/[name]            → readings + meals (?from=&to= epoch ms)
POST   /api/cgm/profiles/[name]/meals      → log meal
PATCH  /api/cgm/meals/[id]                 → edit meal
DELETE /api/cgm/meals/[id]                 → delete meal
```

---

## Reference Ranges (ADA)

| Level | Range (mg/dL) | Color |
|-------|---------------|-------|
| Low | <70 | amber |
| Optimal | 70-110 | green |
| Acceptable | 110-140 | yellow |
| High | >140 | red |

**GMI formula:** `3.31 + 0.02392 × avg_mg/dL` — estimated HbA1c%

---

## Components

- `ProfilePicker` — searchable dropdown, mirrors CustomerPicker from BCA
- `GlucoseChart` — Recharts ComposedChart with reference zones + meal scatter markers
- `MealForm` — datetime-local input, description, macros (carbs/protein/fat)
- `MealTable` — edit/delete actions per row
- `ReportBuilder` — composable PNG export (stats / graph / meals)

---

## Open Questions

- [ ] Per-coach scoping: should profile_name be filtered by coach? Currently all visible. Need FK to customers table or coach_id column.
- [ ] CSV import: deferred to v3
- [ ] AI Expert Analysis section (v1 had it): deferred to v3
- [ ] Meal response analysis (1-3hr postprandial): deferred to v3

---

## v2 Done / v3 Candidates

**v2 (this commit):**
- ProfilePicker · period filter · stats card · glucose chart with meal markers · meal log CRUD · report builder

**v3:**
- Per-coach scoping (link cgm profiles to customers table)
- CSV import for libre/dexcom dumps
- Postprandial response analysis (per-meal glucose excursion)
- AI Expert Analysis ("UP Labs" prompt)
- Comparison mode (this week vs last week)
