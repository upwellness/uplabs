# Spec · Customer 360 View · v1

> **Status:** Draft · pending owner decisions (Q1-Q5)
> **Author:** UP Wellness Team
> **Date:** 24 พ.ค. 2569
> **Target:** UPLABS (Next.js · Supabase)
> **Replaces:** Current scrolling layout at `/customers/[id]`

---

## 1 · Problem Statement

ปัจจุบันหน้า Customer Profile แสดงข้อมูลหลายส่วนแยกกัน (BCA · Lab · Allergy · CGM · Pulse · Health Check) — coach ต้อง scroll ผ่าน 7-8 section ก่อนจะเข้าใจสถานะลูกค้าคนนี้ทั้งหมด

**ผลที่ตามมา:**
- Time-to-context สูง (5-10 นาที/คน) — limit จำนวนลูกค้าที่ดูแลได้ต่อวัน
- Coach มองไม่เห็น trend / pattern ที่สำคัญ (เช่น HbA1c ขึ้น 3 รอบติด · BCA หยุดมา 6 เดือน)
- ไม่มี "Next best action" — coach ต้องคิดเองทุกครั้งว่าจะทำอะไรต่อ
- ลูกค้าที่ออกห่าง (lapse) ถูกตรวจพบช้าเกินไป

**Evidence:** เคสพี่สุ + พิมพ์ปวีณ์ ที่ทำงานในช่วง 2 สัปดาห์ที่ผ่านมา · ทุกครั้งต้องเปิดหลายหน้าและสรุปใน memory เอง · ใช้เวลาประมาณ 15 นาที/รอบ

---

## 2 · Goals

| # | Goal | Measurable Target |
|---|------|-------------------|
| 1 | **Time-to-context** — coach เข้าใจสถานะลูกค้าได้ในแว้บเดียว | < 30 วินาทีจาก page load |
| 2 | **Next-best-action** ที่ explicit · ไม่ต้องคิดเอง | 100% ของ customer มี action card ขึ้นชัดเจน |
| 3 | **Trend visibility** — เห็น pattern โดยไม่ต้อง drill-down | KPI ที่เปลี่ยน ≥10% จาก baseline ต้องแสดง alert |
| 4 | **Cross-system unification** — รวมทุกแหล่งข้อมูล | 100% data sources visible in landing view |
| 5 | **Customer throughput** — coach ดูแลได้มากขึ้น | +50% customers reviewed/day |

---

## 3 · Non-Goals

| # | Non-Goal | Rationale |
|---|---------|-----------|
| 1 | แทนหน้า detail ทั้งหมด (BCA · Records · CGM · etc.) | หน้าเหล่านั้นยังอยู่เป็น drill-down · 360 = overview ไม่ใช่ replacement |
| 2 | Mobile-first design | Desktop workflow ก่อน · mobile = phase 2 |
| 3 | Customer-facing version | Coach view · customer view = Care Plan HTML แยก |
| 4 | Multi-customer comparison | Single customer focus · comparison ไปอยู่ที่ Customers list |
| 5 | Auto-diagnose / Medical advice | Data + rule-based flags · ไม่ระบุโรค |
| 6 | Voice notes / Photo attachments | Phase 3+ · ไม่ใช่ MVP |

---

## 4 · User Stories

### Persona A · Coach (Primary)

- **As a coach,** I want to open a customer's page and immediately see their overall health status so that I know what to focus on without scrolling
- **As a coach,** I want to see what has changed since their last visit so that I can mention specific improvements/concerns in conversation
- **As a coach,** I want to see a "what to do next" recommendation so that I don't have to decide from scratch every time
- **As a coach,** I want to see if a customer has been quiet for too long so that I can reach out before they churn
- **As a coach,** I want to see allergy/safety flags on their supplement stack so that I don't recommend the wrong product
- **As a coach,** I want to quickly initiate follow-up actions (LINE message · phone call · new record · schedule) so that work flows without context switching

### Persona B · Admin (Secondary)

- **As an admin,** I want to see customer activity timeline so that I can audit coach interactions
- **As an admin,** I want to see spend/order history alongside health data so that I can identify upsell opportunities

### Edge Cases

- **NEW customer** (no data yet) → clear next-step prompts (e.g. "Start with Health Check Quiz")
- **CHURNED customer** (no activity 90+ days) → win-back suggestions

---

## 5 · Requirements

### P0 · Must Have (MVP)

#### Zone 1 · Identity Bar (top sticky)

- [ ] Photo · Name (TH + nickname) · Age · Gender · Phone
- [ ] **Status badge** (1 of 6): 🟢 Healthy · 🟡 In Program · 🟠 At Risk · 🔴 Critical · 🌙 Lapsed · ⚪ New
- [ ] **Last touch:** "พบ 14 วัน · LINE 3 วัน · Order 47 วัน"
- [ ] **Top action bar:** 📞 Call · 💬 LINE · ➕ Record · 📊 BCA · 📝 Note · 📅 Schedule

#### Zone 2 · Vital Dashboard (4-6 KPI cards)

- [ ] **Health Score** composite (0-100 · weighted BCA + Lab + Adherence + Recency)
- [ ] **BMI · Visceral · Body Age** (current + delta vs last)
- [ ] **HbA1c · FBS · LDL** (latest + 12-month trend mini-sparkline)
- [ ] **Days in program** (if active) + adherence %
- [ ] Each KPI clickable → opens detail tab

#### Zone 3 · Smart Insights Panel (right column · sticky)

- [ ] **🚨 Alerts** (rule-based): allergy conflict · lab abnormal · long lapse · BCA trending wrong direction
- [ ] **📈 Trends Detected:** e.g. "HbA1c ลด 0.4% · 3 รอบติด"
- [ ] **🎯 Next Best Action** (1-3 cards): e.g. "นัด BCA · ห่างมา 45 วัน" · "Reorder Triple Omega · จะหมดวันที่..."

#### Zone 4 · Activity Timeline (left column · 90 days)

- [ ] Combined feed: BCA · Lab record · CGM upload · Pulse · Health Check · Order · Coach note
- [ ] Each event: icon · date · 1-line summary · clickable to detail
- [ ] Filter pills: All · Health Data · Communication · Orders
- [ ] Scroll lazy-load for older events

#### Zone 5 · Detail Tabs (lower section)

Replace existing scattered sections with tabbed interface:

- [ ] **Body** — BCA latest + trend charts (reuse existing)
- [ ] **Labs** — Latest labs + lab trend charts (reuse existing)
- [ ] **Allergy** — Food sensitivity + supplement safety (reuse `AllergyPanel`)
- [ ] **CGM** — Glucose patterns + link manager
- [ ] **Supplements** — Active stack with prices + reorder reminders (NEW)
- [ ] **Pulse** — Assessments + intake
- [ ] **Notes** — Coach log (NEW)

### P1 · Should Have

- [ ] **Supplement Stack tracker** — what customer is currently taking · last order date · estimated next reorder
- [ ] **Coach Notes** — timestamped log · markdown · pin important notes
- [ ] **Care Plan Progress** — if active program · phase tracker · adherence %
- [ ] **Relationships** — sponsor · downline · family members in system
- [ ] **Print/Export** — generate PDF summary for offline review
- [ ] **Goals** — customer's stated goals · progress against them

### P2 · Nice to Have / Future

- [ ] **AI Insights** (Claude API) — natural language summary
- [ ] **Voice notes** for coach log
- [ ] **Photo attachments** — progress photos with date
- [ ] **Comparison mode** — overlay this customer vs cohort average
- [ ] **Customer-facing portal** — share read-only view via tokenized link
- [ ] **Predictive churn flag** — ML-based

---

## 6 · Success Metrics

### Leading (week 1-2 post launch)

| Metric | Target | Source |
|--------|--------|--------|
| Time on page (median) | 30-60s (down from 3-5min) | Vercel Analytics |
| Tab expansion rate | <30% | Custom event |
| Action bar usage | ≥1 action/visit | Custom event |
| Bounce to detail page | ≥50% | Funnel |

### Lagging (month 1-3)

| Metric | Target | Source |
|--------|--------|--------|
| Customers reviewed per coach per week | +50% (8 → 12) | Audit log |
| Coach satisfaction (1-10) | ≥8 | Survey |
| Customer retention (90-day) | +10pp | Customer DB |
| Health outcomes (HbA1c trend) | More cases trending down | Lab data |

---

## 7 · Open Questions (Decisions Needed)

| # | Question | Owner | Blocking? |
|---|---------|-------|-----------|
| 1 | **Health Score formula** — weighting BCA / Lab / Adherence / Recency? | จิ้น + medical advisor | ⚠️ Blocking P0 KPI #1 |
| 2 | **Alert thresholds** — เกณฑ์ใดบ้างเป็น "Critical"? | จิ้น | ⚠️ Blocking P0 Zone 3 |
| 3 | **Phone integration** — VoIP หรือ tap-to-call? | ckawin | Non-blocking · default tap-to-call |
| 4 | **LINE integration** — LINE OA API หรือ `line://` deep link? | ckawin | Non-blocking · default deep link |
| 5 | **Notes editor** — Markdown · WYSIWYG · plain text? | UI/UX | Non-blocking |
| 6 | **Supplement stack** — manual entry หรือ auto-track from order history? | ckawin | P1 · need data source clarity |
| 7 | **AI Insights cost** — Claude API หรือ Gemini Flash? | engineering | P2 question |
| 8 | **Privacy** — แสดง phone/address ถาวร? PDPA implications? | legal/compliance | P0 · need decision |
| 9 | **Distributor access** — เห็น 360 view ของลูกค้าใครได้บ้าง? | ckawin | Pre-existing RLS rules ต้องตรวจ |
| 10 | **Empty state** — กรณีลูกค้าใหม่ UI เป็นยังไง? | design | Non-blocking |

---

## 8 · Timeline & Phasing

| Phase | Duration | Deliverable |
|-------|----------|------------|
| **Phase 1 · Foundation** | Week 1-2 | Identity Bar · Vital Dashboard · Activity Timeline (P0 Zones 1, 2, 4) |
| **Phase 2 · Intelligence** | Week 3-4 | Smart Insights · Detail Tabs · Action Bar wired (P0 Zones 3, 5) |
| **Phase 3 · Depth** | Week 5-6 | Supplement Stack · Coach Notes · Care Plan Progress · Print (P1) |
| **Phase 4 · Polish** | Week 7-8 | Mobile responsive · empty states · loading skeletons · QA |

### Dependencies

- ✅ Data layer exists (customers · measurements · records · allergy · pulse · CGM)
- ⚠️ Need Health Score formula (Q1)
- ⚠️ Need supplement stack data model (new table or reuse `customer_supplement_safety`?)
- ⚠️ Need `coach_notes` table (new migration)

---

## 9 · Implementation Plan (Engineering Breakdown)

### Phase 1 · Foundation (Week 1-2)

**New files:**
- `app/customers/[id]/Customer360.tsx` — orchestration component
- `app/customers/[id]/_360/IdentityBar.tsx` — Zone 1
- `app/customers/[id]/_360/VitalDashboard.tsx` — Zone 2
- `app/customers/[id]/_360/ActivityTimeline.tsx` — Zone 4
- `app/api/customers/[id]/360/route.ts` — single aggregated endpoint
- `lib/customers/health-score.ts` — composite scoring logic
- `lib/customers/status-classifier.ts` — derive 1 of 6 status badges

**Modified files:**
- `app/customers/[id]/page.tsx` — switch to Customer360 layout (keep old as fallback or `?legacy=1`)

### Phase 2 · Intelligence (Week 3-4)

- `app/customers/[id]/_360/InsightsPanel.tsx` — Zone 3
- `app/customers/[id]/_360/DetailTabs.tsx` — Zone 5
- `lib/customers/insight-rules.ts` — alert + trend detection
- `lib/customers/next-action.ts` — recommendation engine

### Phase 3 · Depth (Week 5-6)

- `supabase/migrations/XXX_coach_notes.sql` — new table
- `supabase/migrations/XXX_customer_supplements.sql` — supplement stack
- `app/customers/[id]/_360/SupplementStack.tsx`
- `app/customers/[id]/_360/CoachNotes.tsx`

---

## 10 · Mock Layout

```
┌────────────────────────────────────────────────────────────────────┐
│ ← Customers   ◇ พิมพ์ปวีณ์ นิลสุพรรณ · ♀ 38 ปี · 🟠 At Risk         │
│   📞 080-... · 💬 LINE · ➕ Record · 📊 BCA · 📝 Note · 📅 Schedule │
├──────────────────────────────────┬─────────────────────────────────┤
│ HEALTH SCORE  72 / 100  ↑ 5      │ 🚨 ALERTS (2)                   │
│ ▓▓▓▓▓▓▓▓▓░░░░░░                  │ • Allergy conflict: V.B Plus    │
│                                  │   มี yeast · score 81           │
│ ┌──────┬──────┬──────┬──────┐   │ • Lab overdue 47 days           │
│ │ BMI  │Visc. │HbA1c │ LDL  │   │                                 │
│ │ 24.1 │  8   │ 5.7% │ 135  │   │ 📈 TRENDS                       │
│ │ ↓0.3 │ ↑ 1  │ ↑0.2 │ ↓5   │   │ • BCA: น้ำหนัก -1.2 kg 3 เดือน │
│ └──────┴──────┴──────┴──────┘   │ • Fat% steady · muscle ↑        │
│                                  │                                 │
│ TIMELINE · 90 days               │ 🎯 NEXT BEST ACTION             │
│ ─────────────────                │ ┌─────────────────────────────┐ │
│ ● 17/5  Allergy Test (IgG)       │ │ นัด BCA · ห่าง 45 วัน      │ │
│ ● 14/5  BCA · -0.8 kg             │ │ → Schedule                  │ │
│ ● 02/5  Lab · ALT ↑               │ └─────────────────────────────┘ │
│ ● 28/4  Order ฿4,300              │ ┌─────────────────────────────┐ │
│ ● 15/4  Pulse intake              │ │ Reorder Triple Omega        │ │
│ ...                              │ │ จะหมด 3 มิ.ย. → Reorder    │ │
│                                  │ └─────────────────────────────┘ │
├──────────────────────────────────┴─────────────────────────────────┤
│ 🧪 Body · 📊 Labs · 🧬 Allergy · 📈 CGM · 💊 Supplements · 📝 Notes │
│ ┌──────────────────────────────────────────────────────────────┐  │
│ │ [Active tab content here — reuses existing components]      │  │
│ └──────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────┘
```

---

## 11 · Decision Required (Owner Checklist Before Dev)

- [ ] **Q1 · Health Score formula** — propose: BCA 30% · Lab 30% · Adherence 25% · Recency 15% · OK?
- [ ] **Q2 · Alert thresholds** — pin ตัวอย่างค่าวิกฤติ (HbA1c > 7? · Visceral > 15? · etc.)
- [ ] **Q3 · Phone/LINE** — confirm tap-to-call + `line://` deep link พอ
- [ ] **Q8 · PDPA** — approve การแสดง phone ในหน้านี้
- [ ] **Q9 · Distributor access** — confirm ใช้ RLS เดิม

ถ้า OK ทั้ง 5 → ลุย Phase 1 ได้ภายในสัปดาห์นี้

---

## References

- Related spec: `docs/spec-bca-v2.md`
- Related spec: `docs/spec-cgm-v2.md`
- Existing customer profile page: `app/customers/[id]/page.tsx`
- Existing components to reuse: `LatestLabsCard` · `LabTrendCharts` · `AllergyPanel` · `CgmLinkManager` · `WearableLinkPanel`
