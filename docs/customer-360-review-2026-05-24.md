# Customer 360 · 5-Persona Review · 24 พ.ค. 2569

> Reviewers ran in parallel after Phase 1+1.5+2+3 shipped
> Subjects: implementation files + spec · no live demo
> Purpose: identify blockers before Phase 3 polish

---

## Score Card

| Persona | Score | Verdict |
|---------|-------|---------|
| 🎨 UI/UX Designer | **6.5/10** | Foundation strong · junior-mid polish · not investor-ready |
| ♿ Accessibility (WCAG 2.2 AA) | **4.5/10** | Multiple critical violations · blocks ship |
| 👨‍⚕️ Health Coach (target user) | **6/10** · PASS conditional | UI sufficient · missing core sales workflows |
| 🎙️ Brand Voice | **5.5/10** | Clinical/SaaS tone · not "หมอที่เป็นเพื่อน" yet |
| 🩺 Medical / Compliance | **4/10** | **TPM violation risk** · diagnosis language · no audit log |

**Average: 5.3/10** → Foundation valid · production-ship needs significant rework

---

## 🚨 BLOCKERS (must fix before any external use)

### B1 · Medical scope-of-practice (TPM ม.26/27 risk)

- `insight-rules.ts:78` shows `"HbA1c X% · เข้าเกณฑ์เบาหวาน"` — coach reads this and says to customer = **diagnosis = TPM violation**
- `insight-rules.ts:99` same with FBS
- `insight-rules.ts:130` "อันตราย" emotional pressure

**Fix:**
```ts
// Before
title: `HbA1c ${input.hba1c}% · เข้าเกณฑ์เบาหวาน`

// After
title: `HbA1c ${input.hba1c}% สูง · ต้องปรึกษาแพทย์ยืนยัน`
action: "บันทึก refer แพทย์แล้ว"  // new CTA
```

Add disclaimer footer to InsightsPanel + below Health Score:
> "ข้อมูลเพื่อ wellness coaching · ไม่ทดแทนการวินิจฉัยทางการแพทย์"

### B2 · PDPA audit log missing

Spec line 64 requires audit trail. No code implements it. Need:
```sql
create table customer_view_log (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references customers(id),
  viewer_id uuid references auth.users(id),
  viewed_at timestamptz default now(),
  source text  -- '360' | 'records' | 'bca'
);
```
Hit log on every `/api/customers/[id]/360` GET.

### B3 · A11y contrast violations on glass

- HbA1c "Pre-DM" gold `#CA8A04` on `liquid-watch` glass = ~3.9:1 → fail WCAG 1.4.3
- `text-ink-40` on glass → ~2.8:1 → fail
- `font-mono text-[10px] text-ink-40` (multiple files) → ~2.5:1 → critical fail

**Fix:**
- Darken status colors when over glass (use `#92400E` instead of `#CA8A04`)
- Minimum text size 11px on body · 10px only for ALL CAPS labels
- Add `prefers-reduced-transparency` media query → collapse glass to solid

### B4 · A11y · ARIA tab pattern broken

`Customer360.tsx:153-165` TabButton has `role="tab"` but missing:
- `aria-controls` linking to panel ID
- `<div role="tabpanel" id="X" aria-labelledby="tab-X">` wrapper
- Arrow-key navigation between tabs
- `tabIndex={-1}` on inactive tabs

→ Screen reader users can't navigate properly · 8 Tab presses required

---

## 🟡 HIGH PRIORITY (fix before next iteration)

### H1 · Health Score doesn't help conversation (coach feedback)

Score `72/100` is ambiguous. Customer would ask "ดี ไม่ดี?" → coach must explain formula → 3 min wasted.

**Fix:**
- Lead with **delta + reason** not absolute number
- e.g. `"+5 จากเดือนก่อน · Visceral ลด 1 ระดับ"` instead of `"72/100"`
- Composite score should never override critical labs (override rule)
- Display 3 sub-scores prominently · let coach choose talking point

### H2 · Brand voice cleanup (whole UI)

Off-brand strings to rewrite (Caregiver tone · Thai-first):

| Current | Better |
|---------|--------|
| "items detected" | "พบ X เรื่องน่าสนใจ" |
| "ไม่มี alert / trend / action ที่ต้องสนใจ" | "ทุกอย่างดูดีค่ะ ไม่มีสัญญาณที่ต้องกังวลตอนนี้" |
| "อันตราย" | "ต้องดูแลด่วน" |
| "Critical / At Risk / In Program / Lapsed / New / Healthy" | "ต้องดูแลด่วน · ต้องติดตาม · กำลังดูแล · ห่างหายไป · คนไข้ใหม่ · แข็งแรงดี" |
| "ส่ง message reconnect" | "ทักไปทักทาย" |
| "Allergy conflict · 5 supplements" | "พบสารที่อาจขัด · 5 ตัว" |
| "ดู Lab →" | "ไปดู Lab" |
| "Schedule BCA" | "นัด BCA ให้" |

### H3 · Coach workflow gaps

Reviewer (Health Coach) flagged 3 missing features:

1. **Orders missing from timeline** — coach can't see purchase history
2. **No "Reorder for customer" button** — must context-switch to Amway app
3. **LINE template launcher** — current LINE button just opens chat · need pre-filled messages

→ These are Phase 2+ scope but should be acknowledged in spec roadmap

### H4 · Emoji overload (design tells)

20+ emojis in single page (3 in header · 6 in action bar · 8 in tabs · 3+ in panels)

**Fix:** Replace with Lucide React icons:
- Phone · MessageCircle · Plus · Activity · FlaskConical · Sparkles · Heart · Pill · ClipboardEdit
- Inherit `currentColor` · scale consistently
- Keep emoji ONLY in Activity Timeline events (less formal context)

### H5 · Glass stacking + color palette clash

- 3-4 layers of `backdrop-filter` stacked → blurry / muddy
- Status colors (Tailwind raw `#16A34A`, `#DC2626`) clash with warm brand palette

**Fix:**
- Child surfaces (chips, pills, ScorePill) → flat `bg-white/70` no `backdrop-blur`
- Create semantic color tokens: `--status-ok #4A8B6B` desaturated to fit warm cream

---

## 🟢 LOW PRIORITY (polish)

- Typography hierarchy: missing 32-36px tier between Score (52px) and KPI (24px)
- Activity Timeline connector line too thin (1px → 2px)
- `hover:translate-x-0.5` micro-jitter — remove
- Tab pill `bg-ink` solid → should be `liquid-glow-rose` to match theme
- Body Age status uses ± sign confusingly · rephrase
- Notes textarea Enter key doesn't submit
- Delete confirm uses native `confirm()` · should be in-UI

---

## 💡 What's working (worth preserving)

- **5-zone IA** matches spec faithfully
- **Health Score caveat** (`⚠ no BCA`) — honest, not faked
- **Liquid CSS foundation** correctly written (multi-layer shadow · saturate · print fallback · `prefers-reduced-motion`)
- **Severity-tinted glass** distinguishes by color + opacity, not just border
- **Empty/error/loading states** all present
- **Skeleton matches glass aesthetic** (not gray rectangle)
- **Some lines hit Caregiver tone** (e.g. `"Visceral Fat ลด 2 จุด · ดีขึ้น"`)

---

## 📋 Recommended Fix Order (10-day plan)

### Sprint A (Day 1-2) · Compliance blockers
1. Rewrite all diagnosis-style strings in `insight-rules.ts` → "ปรึกษาแพทย์ยืนยัน" pattern
2. Add disclaimer footer to InsightsPanel + below Health Score
3. Add `customer_view_log` migration + log on /360 GET

### Sprint B (Day 3-4) · A11y compliance
4. Add `prefers-reduced-transparency` media query
5. Fix ARIA tab pattern (aria-controls + tabpanel role + arrow nav)
6. Darken text colors on glass surfaces · minimum 11px body
7. Add aria-labels to emoji + decorative SVG
8. Fix NotesTab textarea label

### Sprint C (Day 5-7) · Brand voice
9. Localize status badges to Thai (6 labels)
10. Rewrite alert/action microcopy per H2 table
11. Empty states humanized
12. Action verbs in CTAs

### Sprint D (Day 8-10) · UX refinement
13. Replace emoji with Lucide icons
14. Health Score: lead with delta+reason
15. Reduce glass stacking · child chips flat
16. Add Lab/BCA "improving trend" suppressor for critical alerts

---

## 📞 Next steps

After Sprint A (compliance) → safe to demo to internal team
After Sprint B (a11y) → safe to ship to all coaches
After Sprint C (voice) → safe to share screenshots externally
After Sprint D (polish) → investor/press-ready

---

*Compiled from 5 parallel reviews · 24 พ.ค. 2569*
*Reviewers: UI/UX Designer · A11y Expert · Health Coach (target user) · Brand Voice · Medical/Compliance*
