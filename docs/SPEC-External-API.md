# SPEC — UP Labs External API v1

> **Product:** UP Labs External API — ให้ระบบ AI ภายนอกถาม/อัปเดตข้อมูลได้ด้วย token
> **Version:** 1.0 · **Updated:** 2026-08-29 · **Owner:** ต้น (Chaiwat)
> **Status:** spec → build
> **Live:** `https://upwellness-ops.vercel.app/api/v1`

> ⚠️ **เอกสารนี้ generate จาก `SPEC-External-API.md`** — แก้ที่ `.md` แล้วรัน `npm run docs` · ห้ามแก้ `.html` มือ

---

## 1. Problem Statement

ทุกวันนี้ข้อมูลลูกค้าอยู่ครบใน UP Labs แล้ว แต่**เอาออกมาใช้ได้ทางเดียวคือเปิดเว็บ** — ต้นต้องล็อกอิน หาลูกค้า กดเข้าแท็บ อ่านเอง แล้วค่อยเอาไปคิด

สิ่งที่ต้องการคือ: เปิด ChatGPT (หรือ n8n / Make / สคริปต์อะไรก็ได้) แล้วพิมพ์

> *"ช่วยเทียบผลแล็บย้อนหลัง 3 รอบของคนนี้หน่อย"*
> *"ช่วยวิเคราะห์ภาพรวมทุก factor ของคนนี้"*
> *"ขอลิงก์สมัครให้ที"*

แล้ว**ได้ข้อมูลจริงกลับมาทันที** โดยไม่ต้องเปิดเว็บ

**ใครเจ็บ:** ต้น (ทุกวัน) + โค้ชในสายงานที่อยากให้ผู้ช่วย AI ของตัวเองเห็นข้อมูลลูกค้า
**ต้นทุนของการไม่ทำ:** ข้อมูลที่ลงทุนเก็บมา 2 ปีถูกใช้แค่ตอนเปิดหน้าจอ · งานวิเคราะห์ซ้ำ ๆ ยังต้องทำมือทุกครั้ง

---

## 2. Goals

1. **ระบบภายนอกดึงข้อมูลลูกค้าได้ด้วย HTTP + token เดียว** — ไม่ต้องมี session, ไม่ต้อง OAuth
2. **รับคำสั่งภาษาคน (ไทย/อังกฤษ) แล้วคืนข้อมูลที่ตรงคำถาม** โดย**ไม่ใช้ LLM ฝั่งเรา**
3. **แอดมินคุมได้ละเอียด** — token ไหนอ่านอะไรได้ เขียนอะไรได้ แตะลูกค้าคนไหนได้ หมดอายุเมื่อไหร่
4. **ตรวจสอบย้อนหลังได้ 100%** — ทุกการเรียกรู้ว่า token ไหน ถามอะไร ได้อะไรกลับไป
5. **ต่อกับ ChatGPT Actions ได้โดยไม่ต้องเขียนโค้ด** — มี OpenAPI schema ให้ import

## 3. Non-Goals

1. **ไม่ฝัง LLM ฝั่งเรา** — เราส่งข้อมูล ผู้เรียกคิดเอง (เหตุผลใน §5)
2. **ไม่ให้เขียนข้อสรุปทางคลินิก** — เขียนได้เฉพาะ *ค่าที่วัดได้* กับ *โน้ต* · ห้าม API เขียนคำวินิจฉัย
3. **ไม่เปิดให้ลูกค้าปลายทางเรียกเอง** — token ออกให้ระบบ/โค้ช ไม่ใช่ลูกค้า
4. **ไม่ทำ streaming / websocket** — request-response ธรรมดาพอ
5. **ไม่ทำ GraphQL** — REST + intent endpoint ครอบคลุมพอสำหรับ use case จริง
6. **v1 ยังไม่ทำ MCP server** — อยู่ใน roadmap แต่ REST + OpenAPI ใช้ได้กับ ChatGPT Actions แล้ว

---

## 4. User Stories

| # | ในฐานะ | ฉันอยาก | เพื่อ |
|---|---|---|---|
| 1 | ต้น (admin) | เปิด ChatGPT แล้วถาม "เทียบแล็บ 3 รอบล่าสุดของ คุณสมหญิง" | เตรียมคุยกับลูกค้าโดยไม่ต้องเปิดเว็บ |
| 2 | ต้น (admin) | ถาม "ค่าผิดปกติของคนนี้มีอะไรบ้าง" | จับประเด็นก่อนเข้าประชุม |
| 3 | ต้น (admin) | สร้าง token ให้ผู้ช่วย AI ตัวหนึ่ง **อ่านได้อย่างเดียว** | ไม่ต้องกลัวว่าจะเผลอแก้ข้อมูล |
| 4 | ต้น (admin) | จำกัด token ให้เห็นเฉพาะลูกค้าของโค้ชคนหนึ่ง | ให้โค้ชใช้ AI ของตัวเองได้โดยไม่เห็นข้อมูลคนอื่น |
| 5 | ต้น (admin) | เพิกถอน token ทันทีเมื่อสงสัยว่าหลุด | จำกัดความเสียหาย |
| 6 | ต้น (admin) | ดูว่า token ไหนถามอะไรไปบ้าง | ตรวจสอบย้อนหลังได้ |
| 7 | โค้ช | ขอลิงก์สมัครผ่านผู้ช่วย AI | ส่งให้ผู้สนใจได้ทันทีระหว่างคุย |
| 8 | ระบบ automation | ยิงผลแล็บใหม่เข้าไปอัตโนมัติ | ไม่ต้องคีย์มือ |

---

## 5. Architecture Decision — ทำไมไม่ฝัง LLM ฝั่งเรา

ต้นสั่งไว้ชัด: *"เราจะไม่ฝัง LLM ไว้ฝั่งเรา ให้คนเรียก API ได้ข้อมูลกลับไป แล้วไปทำการคิดเอง"*

เหตุผลที่การตัดสินใจนี้ถูก และมีผลต่อสถาปัตยกรรมทั้งหมด:

| ถ้าฝัง LLM ฝั่งเรา | แบบที่เลือก (ส่งข้อมูลดิบ) |
|---|---|
| เราจ่ายค่าโทเคนทุกครั้งที่มีคนถาม | ผู้เรียกจ่ายเอง เรา scale ได้ฟรี |
| คุณภาพคำตอบกลายเป็นความรับผิดชอบเรา | ผู้เรียกรับผิดชอบการตีความของตัวเอง |
| **โมเดลอาจแต่งค่าสุขภาพที่ไม่มีจริง** | ข้อมูลที่ส่งออกมาจากฐานข้อมูลตรง ๆ ตรวจสอบได้ทุกตัวเลข |
| ต้องเลือกโมเดล ดูแลเวอร์ชัน โดนปลดรุ่น | ไม่มีโมเดลให้ดูแล |
| แต่ละคนอยากได้สไตล์คำตอบต่างกัน | ผู้เรียกจัดรูปแบบเอง |

ข้อ 3 คือข้อที่สำคัญที่สุดสำหรับข้อมูลสุขภาพ — **ถ้าตัวเลขในคำตอบไม่ได้มาจาก DB โดยตรง เราจะพิสูจน์ไม่ได้ว่ามันจริง**

### 5.1 แล้วรับ "คำสั่งแบบ Vibe" ยังไงถ้าไม่มี LLM

ใช้ **intent resolver แบบกฎ (deterministic)** — ไม่เดา ไม่สุ่ม รันแล้วได้ผลเดิมทุกครั้ง

```
คำสั่ง → normalize → ให้คะแนน intent ตามคีย์เวิร์ด → สกัด entity → 
   ถ้ามั่นใจ  → เรียก handler เดียวกับ REST endpoint → คืนข้อมูล
   ถ้าไม่มั่นใจ → คืน "needs_disambiguation" + ตัวเลือก ไม่เดามั่ว
```

**จุดตายที่ออกแบบมากันไว้:** ถ้าเดาผิดว่าเป็นลูกค้าคนไหน = ส่งข้อมูลสุขภาพของคนอื่นออกไป
เคสแบบนี้เกิดขึ้นจริงในระบบแล้ว — มีลูกค้าสองคนที่**ชื่อเล่นเหมือนกัน ต่างกันแค่คำนำหน้าและปีเกิด** (ตัวอย่างสมมติ: "คุณมาลี ก." กับ "คุณมาลี ข.") · คำสั่งที่ระบุแค่ "มาลี" ต้อง**ไม่เดา** แต่ต้องคืนรายชื่อผู้สมัครให้ผู้เรียกเลือก

> 🚫 ตัวอย่างทั้งหมดในเอกสารนี้ใช้**ชื่อสมมติ** — repo นี้เป็น public จึงห้ามมีชื่อลูกค้าจริง

> ⚠️ **กฎเหล็กของ resolver:** ชื่อกำกวม = ไม่ตอบข้อมูล · คืนตัวเลือกเสมอ · ยอมให้ผู้เรียกถามซ้ำอีกรอบดีกว่าส่งข้อมูลผิดคน

### 5.2 ทางที่แนะนำสำหรับ ChatGPT

มี 2 ทาง ใช้คู่กันได้:

1. **ทางหลัก — ChatGPT Actions อ่าน OpenAPI ของเรา** (`/api/v1/openapi.json`) แล้ว ChatGPT เลือก endpoint เอง · แม่นที่สุด เพราะ LLM ฝั่งผู้เรียกทำหน้าที่ตีความอยู่แล้ว
2. **ทางสำรอง — `POST /api/v1/query`** ส่งข้อความดิบเข้ามา · สำหรับ client ที่ไม่มี LLM (n8n, สคริปต์, ปุ่มใน LINE)

---

## 6. Authentication

### 6.1 รูปแบบ token

```
uplab_<env>_<prefix8>_<secret32>
ตัวอย่าง: uplab_live_a3f9c210_7Kd2mQx9RtVb4NpLzE6WsYcH1JgFuA8T
```

- `prefix8` = ใช้ค้นในตาราง (index) · เก็บเป็น plaintext
- `secret32` = **เก็บเป็น SHA-256 hash เท่านั้น** · โชว์ค่าเต็มครั้งเดียวตอนสร้าง ปิดแล้วดูไม่ได้อีก
- ส่งมาทาง header: `Authorization: Bearer uplab_live_...`
  รองรับ `x-api-key: uplab_live_...` ด้วย (n8n/Make บางตัวใส่ header เองไม่สะดวก)

### 6.2 ตรวจอะไรบ้างในทุก request

| ลำดับ | ตรวจ | ไม่ผ่าน → |
|---|---|---|
| 1 | มี token ไหม | `401 missing_token` |
| 2 | รูปแบบถูกไหม | `401 malformed_token` |
| 3 | หา prefix เจอไหม + hash ตรงไหม (compare แบบ timing-safe) | `401 invalid_token` |
| 4 | ถูกเพิกถอนหรือยัง (`revoked_at`) | `401 token_revoked` |
| 5 | หมดอายุหรือยัง (`expires_at`) | `401 token_expired` |
| 6 | เกิน rate limit ไหม | `429 rate_limited` + `Retry-After` |
| 7 | scope พอไหมสำหรับ endpoint นี้ | `403 insufficient_scope` (บอกว่าต้องการ scope อะไร) |
| 8 | ลูกค้าคนนี้อยู่ในขอบเขตของ token ไหม | `403 customer_out_of_scope` |

ทุกกรณี **บันทึกลง `api_token_logs`** ไม่ว่าจะผ่านหรือไม่ผ่าน

---

## 7. Authorization Model

### 7.1 Scopes

| Scope | ให้ทำอะไร |
|---|---|
| `customers:read` | ค้นหา/อ่านโปรไฟล์ลูกค้า (ชื่อ เพศ วันเกิด ส่วนสูง) |
| `customers:write` | สร้าง/แก้โปรไฟล์ |
| `labs:read` | อ่านผลแล็บ · เทียบย้อนหลัง · ภาพรวม · ค่าผิดปกติ |
| `labs:write` | เพิ่มใบตรวจ + ค่าแล็บ |
| `measurements:read` / `measurements:write` | BCA |
| `supplements:read` | อาหารเสริม + ความปลอดภัยคู่ยา |
| `notes:read` / `notes:write` | โน้ตโค้ช |
| `links:write` | ขอลิงก์สมัคร |

**หลักการ:** scope เป็น **allow-list** — ไม่ระบุ = ไม่ได้ · ไม่มี scope แบบ `*`

### 7.2 ขอบเขตลูกค้า (customer scope)

`api_tokens.customer_scope` เลือกได้ 3 แบบ:

| แบบ | ความหมาย |
|---|---|
| `all` | ทุกคนในระบบ (ให้เฉพาะ token ของ admin) |
| `coach:<user_id>` | เฉพาะลูกค้าของโค้ชคนนั้น **+ สายงานลงไปทั้งหมด** (ใช้ `canManageCustomer` ตัวเดียวกับเว็บ) |
| `list:<uuid,uuid,…>` | เฉพาะลูกค้าที่ระบุ (เหมาะกับงานเฉพาะเคส) |

> ✅ **เหตุผลที่ยืมตรรกะจากเว็บมาใช้ทั้งดุ้น** — ถ้า API มีตรรกะสิทธิ์ของตัวเอง วันหนึ่งมันจะไม่ตรงกับเว็บ แล้วช่องโหว่จะโผล่ในฝั่งที่ไม่มีคนดู · ใช้ `lib/customers/access.ts` ที่เดียว

### 7.3 Rate limit

ค่าเริ่มต้น **60 ครั้ง/นาที ต่อ token** (ตั้งรายตัวได้) · นับจาก `api_token_logs` ใน 60 วินาทีที่ผ่านมา
ไม่ใช้ Redis — ที่สเกลนี้ query ตาราง log พอ และแลกกับความง่ายในการดูแลคุ้มกว่า

---

## 8. Endpoints

Base: `https://upwellness-ops.vercel.app/api/v1`

### 8.1 Discovery

| Endpoint | Scope | คืนอะไร |
|---|---|---|
| `GET /meta` | any | ชื่อ token · scope ที่มี · ขอบเขตลูกค้า · จำนวนลูกค้าที่เห็น · rate limit ที่เหลือ · รายการ intent ทั้งหมด |
| `GET /openapi.json` | public | OpenAPI 3.1 สำหรับ import เข้า ChatGPT Actions |

`GET /meta` คือ endpoint แรกที่ควรเรียก — บอกว่า token นี้ทำอะไรได้บ้างโดยไม่ต้องเดา

### 8.2 Customers

| Endpoint | Scope | หมายเหตุ |
|---|---|---|
| `GET /customers?q=&limit=` | `customers:read` | ค้นด้วยชื่อบางส่วน · คืนเฉพาะที่อยู่ในขอบเขต token |
| `POST /customers` | `customers:write` | `{name, gender, birth_date, height}` |
| `GET /customers/{id}` | `customers:read` | โปรไฟล์ + สรุปว่ามีข้อมูลอะไรบ้าง (กี่ใบตรวจ ล่าสุดเมื่อไหร่) |
| `PATCH /customers/{id}` | `customers:write` | แก้ field ที่ส่งมาเท่านั้น |

### 8.3 Labs

| Endpoint | Scope | หมายเหตุ |
|---|---|---|
| `GET /customers/{id}/labs?rounds=3&metric=hba1c` | `labs:read` | ค่าแล็บ · `rounds` = จำนวนใบตรวจล่าสุด (ค่าเริ่มต้น 3, สูงสุด 20) |
| `GET /customers/{id}/labs/compare?rounds=3` | `labs:read` | **ตารางเทียบพร้อมใช้** — แต่ละ metric เป็นแถว แต่ละรอบเป็นคอลัมน์ + delta ระหว่างรอบล่าสุดกับก่อนหน้า |
| `POST /customers/{id}/labs` | `labs:write` | สร้างใบตรวจ + ค่าในใบพร้อมกัน (atomic) |
| `GET /customers/{id}/overview` | `labs:read` | **ภาพรวมทุก factor** — ค่าล่าสุดต่อหมวด + สิ่งที่ผิดปกติ + สิ่งที่ยังไม่เคยตรวจ + ความพร้อมของ Health Age |

`/labs/compare` คือ endpoint ที่ตอบ user story ข้อ 1 โดยตรง — ผู้เรียกไม่ต้องมาเรียงข้อมูลเอง

### 8.4 อื่น ๆ

| Endpoint | Scope |
|---|---|
| `GET /customers/{id}/measurements?limit=` · `POST` | `measurements:read` / `:write` |
| `GET /customers/{id}/supplements` | `supplements:read` |
| `GET /customers/{id}/notes?limit=` · `POST` | `notes:read` / `:write` |
| `POST /links/invite` | `links:write` |

### 8.5 `POST /query` — คำสั่งภาษาคน

```jsonc
// request
{
  "q": "ช่วยเทียบผลแล็บย้อนหลัง 3 รอบของ คุณสมหญิง หน่อย",
  "customer_id": "33333333-…",   // ไม่บังคับ — ถ้าใส่มาจะข้ามการเดาชื่อ (แนะนำ)
  "intent": "labs.compare"       // ไม่บังคับ — ถ้าใส่มาจะข้ามการเดา intent
}
```

```jsonc
// response
{
  "ok": true,
  "intent": "labs.compare",
  "confidence": 0.92,
  "understood_as": "เทียบผลแล็บ 3 รอบล่าสุดของ คุณสมหญิง",
  "params": { "customer_id": "33333333-…", "rounds": 3 },
  "data": { /* เหมือน GET /customers/{id}/labs/compare */ },
  "alternatives": [{ "intent": "labs.latest", "confidence": 0.41 }],
  "disclaimer": "ข้อมูลสุขภาพเพื่อการดูแลเชิงป้องกัน ไม่ใช่การวินิจฉัย…",
  "meta": { "token": "ผู้ช่วยของต้น", "generated_at": "2026-08-29T…Z", "row_count": 42 }
}
```

**เมื่อไม่มั่นใจ** — ไม่เดา:

```jsonc
{
  "ok": false,
  "error": "needs_disambiguation",
  "reason": "พบลูกค้าที่ชื่อใกล้เคียงมากกว่า 1 คน",
  "candidates": [
    { "id": "11111111-…", "name": "คุณมาลี ก.", "birth_date": "1975-01-01" },
    { "id": "22222222-…", "name": "คุณมาลี ข.", "birth_date": "1991-01-01" }
  ],
  "next_step": "เรียกซ้ำโดยใส่ customer_id ที่ต้องการ"
}
```

### 8.6 Intent catalogue

| Intent | ตัวอย่างคำสั่ง | Scope |
|---|---|---|
| `customer.find` | "หาลูกค้าชื่อสมหญิง" · "find customer Malee" | `customers:read` |
| `customer.profile` | "โปรไฟล์ของ X" · "ข้อมูลทั่วไปของ X" | `customers:read` |
| `labs.latest` | "ผลแล็บล่าสุดของ X" | `labs:read` |
| `labs.compare` | "เทียบผลแล็บย้อนหลัง 3 รอบของ X" | `labs:read` |
| `labs.metric` | "ค่า HbA1c ของ X ย้อนหลัง" | `labs:read` |
| `labs.abnormal` | "ค่าผิดปกติของ X มีอะไรบ้าง" | `labs:read` |
| `overview.longevity` | "วิเคราะห์ภาพรวมทุก factor ของ X" | `labs:read` |
| `measurements.list` | "ค่า BCA / น้ำหนักของ X" | `measurements:read` |
| `supplements.list` | "X กินอาหารเสริมอะไรอยู่" | `supplements:read` |
| `notes.list` | "โน้ตของ X" | `notes:read` |
| `notes.add` | "จดโน้ตให้ X ว่า …" | `notes:write` |
| `links.invite` | "ขอลิงก์สมัครให้ที" | `links:write` |

---

## 9. Response & Error Contract

**สำเร็จ** — ทุก response มี `ok: true` · `data` · `meta` · และ **`disclaimer` เมื่อมีข้อมูลคลินิก**

**ผิดพลาด** — รูปแบบเดียวทั้งระบบ:

```jsonc
{ "ok": false, "error": "insufficient_scope", "message": "token นี้ไม่มีสิทธิ์อ่านผลแล็บ",
  "required_scope": "labs:read", "your_scopes": ["customers:read"] }
```

| HTTP | error | ความหมาย |
|---|---|---|
| 400 | `bad_request` / `needs_disambiguation` / `unknown_intent` | คำสั่งไม่ครบหรือกำกวม |
| 401 | `missing_token` / `invalid_token` / `token_expired` / `token_revoked` | ปัญหา token |
| 403 | `insufficient_scope` / `customer_out_of_scope` | token ถูกแต่สิทธิ์ไม่พอ |
| 404 | `not_found` | ไม่มีข้อมูลนี้ (หรือไม่มีสิทธิ์เห็น — ตอบเหมือนกันเพื่อไม่รั่วว่ามีตัวตน) |
| 429 | `rate_limited` | เกินโควตา |
| 500 | `internal_error` | ฝั่งเรา (ไม่คืนรายละเอียดภายใน) |

> 🚫 **ห้ามคืนข้อความ error ดิบจาก Postgres/Supabase** — รั่วโครงสร้างตาราง · แปลเป็น error code ของเราเสมอ

### 9.1 Compliance ที่ฝังใน response

ทุก payload ที่มีค่าสุขภาพจะมี field `disclaimer` ติดไปด้วยเสมอ และ `/overview` มี `caveats[]` บอกข้อจำกัดของข้อมูลชุดนั้น (เช่น *"ไม่ได้ระบุว่างดอาหารหรือไม่"*, *"ค่าหัวใจเป็นของ 45 วันก่อน ยังไม่ตรวจซ้ำ"*)

เหตุผล: ปลายทางคือ LLM ที่จะเอาไปเรียบเรียงต่อ — ถ้าเราไม่ส่ง caveat ไปด้วย มันจะสรุปเกินข้อมูล

---

## 10. Data Model

### 10.1 `api_tokens`

| คอลัมน์ | ชนิด | หมายเหตุ |
|---|---|---|
| `id` | uuid PK | |
| `name` | text | ชื่อที่คนอ่านรู้เรื่อง เช่น "ผู้ช่วย ChatGPT ของต้น" |
| `token_prefix` | text UNIQUE | 8 ตัวสำหรับค้น |
| `token_hash` | text | SHA-256 ของ secret |
| `scopes` | text[] | allow-list |
| `customer_scope` | text | `all` / `coach:<uuid>` / `list:<uuid,…>` |
| `rate_limit_per_min` | int | ค่าเริ่มต้น 60 |
| `expires_at` | timestamptz null | null = ไม่หมดอายุ |
| `revoked_at` | timestamptz null | เพิกถอน |
| `last_used_at` | timestamptz null | |
| `created_by` | uuid → profiles | |
| `created_at` | timestamptz | |
| `note` | text null | บันทึกว่าให้ใครใช้ |

### 10.2 `api_token_logs`

| คอลัมน์ | ชนิด |
|---|---|
| `id` | bigserial PK |
| `token_id` | uuid null → api_tokens (null = ยิงมาด้วย token ที่ไม่มีจริง) |
| `token_prefix` | text |
| `ts` | timestamptz |
| `method` · `path` | text |
| `intent` | text null |
| `customer_id` | uuid null |
| `status` | int |
| `error` | text null |
| `duration_ms` | int |
| `row_count` | int null |
| `ip` · `user_agent` | text null |

**เก็บ 90 วัน** แล้วลบ (ไม่เก็บ `q` ดิบเกิน 500 ตัวอักษร เพื่อไม่ให้ log กลายเป็นที่เก็บ PII อีกที่)

---

## 11. Admin UI — `/v2/admin/api-tokens`

| ส่วน | มีอะไร |
|---|---|
| ตาราง token | ชื่อ · prefix · scope (ชิป) · ขอบเขตลูกค้า · ใช้ล่าสุด · หมดอายุ · สถานะ |
| ปุ่มสร้าง | ชื่อ · เลือก scope (checkbox) · เลือกขอบเขตลูกค้า · วันหมดอายุ · rate limit |
| หลังสร้าง | **โชว์ token เต็มครั้งเดียว** + ปุ่มคัดลอก + คำเตือนว่าปิดแล้วดูไม่ได้อีก |
| เพิกถอน | ปุ่มเดียว มีกล่องยืนยัน |
| Log | 200 รายการล่าสุด กรองตาม token ได้ |

---

## 12. Acceptance Criteria

**Auth**
- [ ] ไม่มี token → 401 · token ผิด → 401 · token ที่เพิกถอนแล้ว → 401
- [ ] token หมดอายุ → 401 แม้ scope ครบ
- [ ] เทียบ hash แบบ timing-safe (ไม่ใช่ `===`)
- [ ] token เต็มไม่เคยถูกเก็บลง DB และไม่โผล่ใน log

**Scope**
- [ ] token ที่มีแค่ `customers:read` เรียก `/labs` → 403 พร้อมบอก scope ที่ต้องการ
- [ ] token `coach:X` เรียกลูกค้าของโค้ชอื่น → 403 `customer_out_of_scope`
- [ ] token `coach:X` เห็นลูกค้าของ downline ของ X ได้ (ตรงกับพฤติกรรมเว็บ)
- [ ] token `list:` เห็นเฉพาะ id ที่ระบุ

**Query resolver**
- [ ] "เทียบผลแล็บย้อนหลัง 3 รอบของ …" → `labs.compare` + `rounds=3`
- [ ] "ขอลิงก์สมัคร" → `links.invite`
- [ ] ชื่อกำกวม (มาลี) → `needs_disambiguation` + candidates **ไม่เดา**
- [ ] คำสั่งที่ไม่เข้าอะไรเลย → `unknown_intent` + รายการ intent ที่มี
- [ ] resolver เป็นฟังก์ชันบริสุทธิ์ ทดสอบได้โดยไม่ต้องมี DB
- [ ] intent ที่ต้องการ scope ที่ token ไม่มี → 403 ไม่ใช่ 400

**Data**
- [ ] `/labs/compare?rounds=3` คืน 3 คอลัมน์เรียงจากเก่า→ใหม่ + delta ของรอบล่าสุด
- [ ] ค่าที่ไม่ได้ตรวจในรอบนั้นคืน `null` ไม่ใช่ 0 หรือค่าของรอบก่อน
- [ ] `/overview` บอก "ยังไม่เคยตรวจ" แยกจาก "ตรวจแล้วปกติ"
- [ ] ทุก response ที่มีค่าสุขภาพมี `disclaimer`

**Ops**
- [ ] ทุก request ลง `api_token_logs` ทั้งที่ผ่านและไม่ผ่าน
- [ ] เกิน rate limit → 429 + `Retry-After`
- [ ] `/openapi.json` import เข้า ChatGPT Actions ได้จริง
- [ ] error จาก Postgres ไม่รั่วออก response

---

## 13. Rollout

| ขั้น | ทำอะไร |
|---|---|
| 1 | migration `api_tokens` + `api_token_logs` (RLS: admin เท่านั้น) |
| 2 | `lib/api/` — auth · scope · resolver · serializer (ทดสอบได้แยกจาก HTTP) |
| 3 | routes `/api/v1/**` + เพิ่ม `/api/v1` ใน `PUBLIC_PATHS` (auth เป็นของตัวเอง ไม่ใช่ session) |
| 4 | หน้า `/v2/admin/api-tokens` |
| 5 | `npx tsc --noEmit && npm run build` + ชุดทดสอบ resolver |
| 6 | push → Vercel deploy → สร้าง token ตัวจริง → ทดสอบด้วย ChatGPT |

> ⚠️ **ขั้นที่ 3 มีกับดัก:** `/api/v1/*` ต้องอยู่ใน `PUBLIC_PATHS` ของ `middleware.ts` ไม่งั้น middleware จะเด้งไป `/login` ก่อนที่ route จะได้ตรวจ token · แต่ "public" ที่นี่หมายถึง "ไม่ใช้ session cookie" **ไม่ได้แปลว่าไม่ต้องยืนยันตัวตน**

---

## 14. Open Questions

| # | คำถาม | ต้องการคำตอบจาก | บล็อกงานไหม |
|---|---|---|---|
| 1 | ให้ token เขียนผลแล็บได้เลย หรือให้ยิงเข้า "รอตรวจสอบ" ก่อน | ต้น | ไม่ — v1 ทำแบบเขียนตรง แต่ต้อง `labs:write` ซึ่งไม่ให้โดยค่าเริ่มต้น |
| 2 | ต้องมี token ที่คืนข้อมูลแบบไม่มีชื่อ (pseudonymous) ไหม | ต้น | ไม่ — เพิ่มทีหลังเป็น scope ใหม่ได้ |
| 3 | จะทำ MCP server ต่อไหม (Claude ต่อตรงได้) | ต้น | ไม่ — roadmap |
