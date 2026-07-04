# Health Screening (เช็กสุขภาพ 60 วินาที)

เครื่องมือ health screening แบบ interactive สำหรับแจกในงานสัมมนา —
React + Tailwind, build เสร็จเป็น **ไฟล์ HTML เดียว** ที่เปิด offline ได้
(ฟอนต์ Prompt/Anuphan ฝังในไฟล์) แจกทาง LINE/อีเมล หรือเปิดผ่านเว็บก็ได้

ไฟล์ที่ deploy: [`public/health-screening-v1.html`](../../public/health-screening-v1.html)
→ เสิร์ฟที่ `/health-screening-v1.html`

## สิ่งที่คำนวณ

| ค่า | สูตร / เกณฑ์ |
| --- | --- |
| BMI | เกณฑ์ WHO Asia-Pacific (สมส่วน 18.5–22.9) |
| รอบเอว ÷ ส่วนสูง (WHtR) | เป้าหมาย < 0.50 + เกณฑ์อ้วนลงพุงไทย (ช 90 / ญ 80 ซม.) |
| BMR | Mifflin–St Jeor |
| TDEE | BMR × activity factor (1.2–1.9) |
| เป้าแคลอรี่ | ลดไขมัน −500 (มี floor 1200/1500), เพิ่มกล้าม +300 |
| โปรตีน | 1.0–2.2 g/kg ตามเป้าหมาย+กิจกรรม พร้อมเทียบอกไก่/ไข่ |
| น้ำ | 33 ml/kg |
| %ไขมัน (ประมาณ) | Deurenberg (จาก BMI + อายุ + เพศ) |
| โซนหัวใจ | HRmax = 208 − 0.7×อายุ (Tanaka), เน้น Zone 2 |

## Build

```bash
node tools/health-screening/build.mjs
```

- ครั้งแรกต้องมีเน็ต (ดึงฟอนต์จาก Google Fonts แล้ว cache เป็น `fonts-inline.css`)
- ใช้ `npx esbuild` + `tailwindcss` (มีใน devDependencies ของ repo)
- ธีมสว่าง/มืดสลับได้ (ปุ่มบนขวา) และตามระบบอัตโนมัติ, มี print stylesheet
  สำหรับปุ่ม "พิมพ์ / บันทึกเป็น PDF"
