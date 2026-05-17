# UP Pulse — Setup Guide (v0 complete)

## SQL Migrations (รันใน Supabase SQL Editor ตามลำดับ)

1. `supabase/migrations/20260512_pulse.sql` — pulse_invites, pulse_connections, pulse_readings
2. `supabase/migrations/20260513_pulse_assess.sql` — pulse_intakes, pulse_assessments

Verify:
```sql
select 'invites' as t, count(*) from pulse_invites
union all select 'connections', count(*) from pulse_connections
union all select 'readings', count(*) from pulse_readings
union all select 'intakes', count(*) from pulse_intakes
union all select 'assessments', count(*) from pulse_assessments;
```

## Env Vars (Vercel · all environments)

```
GOOGLE_FIT_CLIENT_ID       = <Google Cloud OAuth client>
GOOGLE_FIT_CLIENT_SECRET   = <same>
PULSE_ENC_KEY              = 32-byte base64 (node -e "...")
GEMINI_API_KEY             = <Google AI Studio key — free at aistudio.google.com/app/apikey>
NEXT_PUBLIC_SITE_URL       = https://upwellness.vercel.app
```

Redeploy after adding.

## End-to-end Workflow (Coach view)

The /pulse page now shows **3 workflow cards**:

### Step 1: Connect Google Fit
- Coach creates invite → ลูกค้าเปิด link → OAuth → ระบบดึง 7 วัน data
- Status: ❌ ยังไม่เชื่อม → ✓ Connected (with Last sync time)
- ปุ่ม "↻ Sync Now" ดึงข้อมูลใหม่ตอนนี้

### Step 2: Intake Form
- Coach สร้าง intake link → ลูกค้ากรอก 5 ข้อ (medication / condition / pregnancy / goal / budget)
- Status: ❌ ยังไม่กรอก → ✓ Submitted
- ใช้เวลาลูกค้ากรอก ~2 นาที

### Step 3: AI Assessment
- ปุ่ม "🧠 รัน AI Assessment" — activate เมื่อ Step 1 + 2 เสร็จแล้ว
- ระบบทำ: aggregate biomarkers → rule engine → exclusion check → Gemini rephrase
- ผลลัพธ์: draft assessment ที่ coach รีวิวก่อน publish

### Assessments list
- รายการ assessment ทั้งหมด — DRAFT / SENT / BLOCKED
- Coach ดู report ก่อน publish · Copy link · 🚀 เผยแพร่ให้ลูกค้า
- ลูกค้าเปิด `/r/[share_token]` → เห็น HTML report สวยๆ

## Public URLs

```
/connect/[token]          → Customer connects Google Fit (PDPA + OAuth)
/intake/[token]           → Customer fills 5-question intake
/r/[share_token]          → Customer reads final report
```

ทุกหน้า **ไม่ต้อง login UP Wellness Ops** · token-based access (expire 7-14 วัน)

## Architecture

```
Coach UI (/pulse)
  ├── Step 1: invite → /connect/[token] → OAuth → pulse_connections
  ├── Step 2: invite → /intake/[token] → form → pulse_intakes
  └── Step 3: assess → pipeline:
        1. fetch latest intake + 7-day readings
        2. checkExclusions()   ← block if pregnant/CKD/warfarin/etc
        3. aggregateBiomarkers ← HR avg/rhr/max · steps · active min · sleep
        4. evaluateRules       ← 10 seed rules (rules.ts)
        5. rephraseWithGemini  ← Gemini Flash → Thai coach-tone JSON
        6. save pulse_assessment
  ← coach reviews → PATCH status=sent → public /r/[share_token] activates
```

## Rule Engine (lib/pulse/rules.ts)

10 seed rules pharmacist can extend:
- RHR elevated → CoQ10 + Triple Omega
- HR variability high → Cal Mag D + Vitamin B Plus
- Low active minutes → Iron Folate + Vitamin B Plus
- Low steps (sedentary) → All Plant Protein + Cal Mag D
- Low heart minutes → CoQ10 + Omega-3
- Short sleep < 6h → Cal Mag D
- Low deep sleep → Cal Mag D + Omega-3
- High body fat → All Plant Protein + Omega-3 + Bodykey
- Metabolic inflammation → CMS Synbiotic + Omega-3
- Foundation default → Double X

Each rule has evidence_grade A/B/C + PubMed-style citation.

## Exclusion Block List (lib/pulse/exclusions.ts)

Hard stops:
- Pregnant / Breastfeeding
- CKD / kidney
- Warfarin
- Chemotherapy / immunosuppressant
- Age < 18

## Gemini Config

Model: `gemini-1.5-flash-latest` · Free tier 1,500 req/day
Strict system prompt:
- Rephrase only — no new SKUs
- No medical claims ("associated with" / "may support")
- JSON output validated against SKU whitelist
- Failed validation → fallback to rule engine raw

## Troubleshooting

| Symptom | Cause |
|---------|-------|
| "GEMINI_API_KEY missing" | ลืม env var ใน Vercel |
| "no submitted intake" | ลูกค้ายังไม่กรอก intake form |
| "ยังไม่มี biomarker" | ลูกค้ายังไม่ connect Google Fit หรือ Sync ครั้งแรกล้มเหลว |
| Blocked assessment | ลูกค้าอยู่ใน exclusion group — ส่งไปแพทย์ |
| Empty recommendations | ไม่มี rule match — ปกติแสดง Double X (default rule) |

## Status

✅ v0 complete: connect · sync · intake · assess · review · publish · public report
