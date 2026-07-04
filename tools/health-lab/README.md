# Health Lab (เช็กสุขภาพตัวเองแบบว้าว)

Hub เครื่องมือคัดกรองสุขภาพเบื้องต้น **5 อย่างในหน้าเดียว** สำหรับแจกในงานสัมมนา —
React + Tailwind, build เป็น **ไฟล์ HTML เดียว** เปิด offline ได้ (ฟอนต์ไทยฝังในไฟล์)
ไม่เก็บ/ไม่ส่งข้อมูลผู้ใช้

ไฟล์ deploy: [`public/health-lab-v1.html`](../../public/health-lab-v1.html) → `/health-lab-v1.html`

## เครื่องมือ

| # | เครื่องมือ | สูตร / เกณฑ์ | หมายเหตุ |
|---|---|---|---|
| 1 | เช็กสุขภาพ 60 วิ | BMI (WHO เอเชีย), Mifflin–St Jeor, Tanaka | โปรตีน/น้ำ/%ไขมัน/โซนหัวใจ |
| 2 | ทดสอบอายุหู | เล่นเสียง 8–20 kHz ด้วย WebAudio | เพื่อความสนุก แนะนำใช้หูฟัง |
| 3 | ทดสอบสายตา | Acuity + Ishihara-style + astigmatism fan + Amsler | คาลิเบรตด้วยบัตร ID-1 (85.6 มม.) |
| 4 | อายุหัวใจ | **Framingham 2008 non-lab (D'Agostino, Circulation)** | heart age + 10-yr CVD risk |
| 5 | เสี่ยงเบาหวาน 12 ปี | **Thai Diabetes Risk Score (Aekplakorn, Diabetes Care 2006)** | 0–17 คะแนน ตัดที่ 6 |

> ⚠️ ข้อ 4 ใช้โมเดล Framingham (ประชากรสหรัฐฯ) เป็นการประมาณเพื่อการศึกษา —
> ถ้าต้องการค่าที่แม่นสำหรับคนไทย ให้ทีมแพทย์เปลี่ยนไปใช้ Thai CV Risk Score
> (ต้องมีค่าสัมประสิทธิ์ทางการ) โครงคำนวณอยู่ใน `src/logic.js` (`heartAge`, `framRisk`)

## โครงสร้าง

```
src/
  logic.js            สูตรทั้งหมด (screening, heartAge, diabetesScore, hearingAge)
  ui.jsx              คอมโพเนนต์ร่วม (ปุ่ม สไลเดอร์ การ์ด ฟอร์มโปรไฟล์)
  main.jsx            hub + router + shared profile
  tools/*.jsx         หน้าจอของแต่ละเครื่องมือ
```

## Build

```bash
cd tools/health-lab
node build.mjs                     # ได้ health-lab.html ในโฟลเดอร์นี้
cp health-lab.html ../../public/health-lab-v1.html
```

ต้องมี `esbuild` + `tailwindcss` (อยู่ใน devDependencies ของ repo) — ครั้งแรก
ถ้าไม่มี `fonts-inline.css` ให้ดึงจาก Google Fonts (Prompt/Anuphan) แล้ว inline เป็น data URI
