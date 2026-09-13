/**
 * The OpenAPI document published at /api/v1/openapi.json — built here, outside the
 * route, so a test can load it without Next and enforce the importer limits.
 *
 * Descriptions are written for a model to read: they say when to reach for each path.
 * ChatGPT's Action importer rejects any operation description over 300 characters
 * (and drops multipart operations entirely) — those rules are pinned in
 * tests/api-openapi.test.mts because both bit us in production.
 */

/** OpenAI GPT Actions: operation.description must be ≤ 300 chars. */
export const MAX_OPERATION_DESCRIPTION = 300;

export interface SpecInputs { scopes: readonly string[]; intentNames: readonly string[] }

/** Pure: the live scope and intent lists are passed in, so tests can build the spec with no I/O. */
export function buildSpec(base: string, { scopes, intentNames }: SpecInputs) {
  const customerId = {
    name: "id", in: "path", required: true,
    schema: { type: "string", format: "uuid" },
    description: "customer id จาก /customers",
  };

  const spec = {
    openapi: "3.1.0",
    info: {
      title: "UP Labs External API",
      version: "1.0.0",
      description:
        "อ่านและอัปเดตข้อมูลสุขภาพลูกค้าใน UP Labs · ทุก endpoint ต้องมี Bearer token ที่แอดมินออกให้ " +
        "และสิทธิ์ถูกจำกัดตาม scope ของ token นั้น · ระบบคืนข้อมูลดิบพร้อมข้อจำกัดของข้อมูล " +
        "(caveats) ให้ผู้เรียกนำไปเรียบเรียงเอง — ไม่มีการตีความหรือวินิจฉัยจากฝั่งนี้",
    },
    servers: [{ url: `${base}/api/v1` }],
    security: [{ bearerAuth: [] }],
    components: {
      securitySchemes: {
        bearerAuth: { type: "http", scheme: "bearer", description: "token รูปแบบ uplab_live_…" },
      },
      schemas: {
        Error: {
          type: "object",
          properties: {
            ok: { type: "boolean" },
            error: { type: "string", description: "รหัสข้อผิดพลาด เช่น insufficient_scope, needs_disambiguation" },
            message: { type: "string" },
          },
        },
      },
    },
    paths: {
      "/meta": {
        get: {
          operationId: "getMeta",
          summary: "ดูว่า token นี้ทำอะไรได้บ้าง",
          description: "เรียกก่อนเสมอเมื่อไม่แน่ใจสิทธิ์ — คืน scope, ขอบเขตลูกค้า, จำนวนลูกค้าที่เห็น และรายการ intent",
          responses: { "200": { description: "ok" } },
        },
      },
      "/query": {
        post: {
          operationId: "askUpLabs",
          summary: "ถามด้วยภาษาคน (ไทย/อังกฤษ)",
          description:
            "ส่งคำสั่งเป็นประโยค เช่น 'ช่วยเทียบผลแล็บย้อนหลัง 3 รอบของ คุณสมหญิง หน่อย' · " +
            "ถ้าชื่อลูกค้ากำกวมจะคืน needs_disambiguation พร้อมรายชื่อผู้สมัคร ให้เรียกซ้ำโดยใส่ customer_id · " +
            "ถ้ารู้ customer_id อยู่แล้วให้ใส่มาด้วยเสมอ จะแม่นกว่า",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["q"],
                  properties: {
                    q: { type: "string", description: "คำสั่งภาษาคน" },
                    customer_id: { type: "string", description: "ระบุตัวลูกค้าให้ชัด (แนะนำ)" },
                    intent: { type: "string", enum: intentNames, description: "บังคับ intent ข้ามการเดา" },
                  },
                },
              },
            },
          },
          responses: { "200": { description: "ok" }, "400": { description: "กำกวมหรือไม่เข้าใจคำสั่ง" } },
        },
      },
      "/customers": {
        get: {
          operationId: "searchCustomers",
          summary: "ค้นหาลูกค้าด้วยชื่อ",
          description: "คืนเฉพาะโปรไฟล์ที่ยังใช้งานอยู่ · โปรไฟล์ที่ถูกปิดใช้งานจะไม่ขึ้นในผลค้นหา แต่ยังเปิดด้วย id ได้",
          parameters: [
            { name: "q", in: "query", schema: { type: "string" }, description: "ชื่อบางส่วน" },
            { name: "limit", in: "query", schema: { type: "integer", default: 20 } },
          ],
          responses: { "200": { description: "ok" } },
        },
        post: {
          operationId: "createCustomer",
          summary: "สร้างลูกค้าใหม่",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object", required: ["name"],
                  properties: {
                    name: { type: "string" },
                    gender: { type: "string", enum: ["male", "female"] },
                    birth_date: { type: "string", format: "date" },
                    height: { type: "string" },
                    coach_id: { type: "string" },
                  },
                },
              },
            },
          },
          responses: { "200": { description: "ok" } },
        },
      },
      "/customers/{id}": {
        get: {
          operationId: "getCustomer",
          summary: "โปรไฟล์ลูกค้า + สรุปว่ามีข้อมูลอะไรบ้าง",
          description: "ถ้า retired = true แปลว่าโปรไฟล์นี้ถูกปิดใช้งานแล้ว ข้อมูลยังอยู่ครบแต่อาจเป็นโปรไฟล์ซ้ำหรือเลิกใช้บริการ — ต้องบอกผู้ใช้ก่อนนำไปสรุป",
          parameters: [customerId],
          responses: { "200": { description: "ok" } },
        },
        patch: {
          operationId: "updateCustomer",
          summary: "แก้โปรไฟล์",
          parameters: [customerId],
          requestBody: {
            required: true,
            content: { "application/json": { schema: { type: "object", properties: {
              name: { type: "string" }, gender: { type: "string" },
              birth_date: { type: "string", format: "date" }, height: { type: "string" },
            } } } },
          },
          responses: { "200": { description: "ok" } },
        },
      },
      "/customers/{id}/labs": {
        get: {
          operationId: "getLabs",
          summary: "ผลแล็บย้อนหลัง",
          description: "ไม่ใส่ metric = คืนทั้งใบตรวจล่าสุด N รอบ · ใส่ metric = คืนค่าตัวนั้นทุกครั้งเรียงตามเวลา",
          parameters: [
            customerId,
            { name: "rounds", in: "query", schema: { type: "integer", default: 3, maximum: 20 } },
            { name: "metric", in: "query", schema: { type: "string" }, description: "เช่น hba1c, ldl, hdl" },
          ],
          responses: { "200": { description: "ok" } },
        },
        post: {
          operationId: "addLabResult",
          summary: "บันทึกผลแล็บใหม่ (1 ใบตรวจ + หลายค่า)",
          parameters: [customerId],
          requestBody: {
            required: true,
            content: { "application/json": { schema: {
              type: "object", required: ["recorded_at", "values"],
              properties: {
                recorded_at: { type: "string", format: "date", description: "วันเจาะเลือด ปี ค.ศ." },
                source: { type: "string", description: "ชื่อโรงพยาบาล/แล็บ" },
                notes: { type: "string" },
                values: {
                  type: "array",
                  items: {
                    type: "object", required: ["metric_key", "value"],
                    properties: {
                      metric_key: { type: "string" }, metric_label_th: { type: "string" },
                      value: { type: "string" }, value_num: { type: "number" },
                      unit: { type: "string" }, ref_text: { type: "string" }, category: { type: "string" },
                      status: { type: "string", enum: ["normal", "low", "high", "borderline"] },
                    },
                  },
                },
              },
            } } },
          },
          responses: { "200": { description: "ok" } },
        },
      },
      "/customers/{id}/labs/submit": {
        post: {
          operationId: "submitLabResult",
          summary: "ส่งผลแล็บที่อ่านจากเอกสารเข้าคิวรอตรวจสอบ",
          description:
            "★ ใช้ตัวนี้เมื่ออ่านค่าจากใบแล็บ/รูป/PDF — ไม่ใช่ addLabResult · ค่าเข้าคิวให้คนตรวจเทียบกับใบจริงก่อน ยังไม่เข้าประวัติ · " +
            "ส่ง raw_text ที่อ่านได้แบบคำต่อคำมาด้วย · อ่านไม่ออกให้ข้าม ห้ามเดา · ห้ามเดาสถานะถ้าใบไม่ได้พิมพ์",
          parameters: [customerId],
          requestBody: {
            required: true,
            content: { "application/json": { schema: {
              type: "object", required: ["recorded_at", "values"],
              properties: {
                recorded_at: { type: "string", format: "date", description: "วันเจาะเลือด ปี ค.ศ. (ใบไทยพิมพ์ พ.ศ. ต้องลบ 543)" },
                source: { type: "string", description: "ชื่อโรงพยาบาล/แล็บ ตามที่พิมพ์บนใบ" },
                notes: { type: "string" },
                raw_text: { type: "string", description: "ข้อความที่อ่านได้จากเอกสารแบบคำต่อคำ — คนตรวจใช้เทียบ" },
                source_file_url: { type: "string", description: "ลิงก์ไฟล์ต้นฉบับ ถ้ามี" },
                submitted_via: { type: "string", description: "เช่น ChatGPT, n8n" },
                values: {
                  type: "array",
                  items: {
                    type: "object", required: ["metric_key", "value"],
                    properties: {
                      metric_key: { type: "string", description: "เช่น hba1c, ldl, hdl, triglyceride, fbs" },
                      metric_label_th: { type: "string" },
                      value: { type: "string", description: "ตามที่พิมพ์บนใบ" },
                      value_num: { type: "number" },
                      unit: { type: "string" },
                      ref_text: { type: "string", description: "ช่วงอ้างอิงตามที่พิมพ์บนใบ" },
                      category: { type: "string", enum: ["cbc","glucose","lipid","kidney","liver","uric","thyroid","imaging","hepatitis","cancer","inflammation","cardiac","other"] },
                      status: { type: "string", enum: ["normal", "low", "high", "borderline"], description: "ใส่เฉพาะที่ใบติดธงไว้ — ห้ามเดาเอง" },
                    },
                  },
                },
              },
            } } },
          },
          responses: { "200": { description: "เข้าคิวแล้ว รอคนตรวจ" } },
        },
      },
      "/customers/{id}/labs/compare": {
        get: {
          operationId: "compareLabs",
          summary: "ตารางเทียบผลแล็บ N รอบล่าสุด",
          description:
            "ใช้ตัวนี้เมื่อถูกถามว่า 'เทียบผลแล็บย้อนหลัง N รอบ' · คืนแต่ละ metric เป็นแถว " +
            "แต่ละรอบเป็นคอลัมน์ พร้อม delta ของสองรอบล่าสุดที่มีค่า · ค่า null = รอบนั้นไม่ได้ตรวจตัวนี้ ห้ามตีความเป็น 0",
          parameters: [customerId, { name: "rounds", in: "query", schema: { type: "integer", default: 3, maximum: 20 } }],
          responses: { "200": { description: "ok" } },
        },
      },
      "/customers/{id}/overview": {
        get: {
          operationId: "getOverview",
          summary: "ภาพรวมสุขภาพทุกด้าน",
          description:
            "ใช้ตัวนี้เมื่อถูกถามให้ 'วิเคราะห์ภาพรวม' · คืนค่าล่าสุดแยกตามหมวด + สิ่งที่ผิดปกติ + " +
            "สิ่งที่ยังไม่เคยตรวจ + caveats · ต้องอ่าน caveats ก่อนสรุป เพราะ 'ไม่มีข้อมูล' ไม่เท่ากับ 'ปกติ'",
          parameters: [customerId],
          responses: { "200": { description: "ok" } },
        },
      },
      "/customers/{id}/measurements": {
        get: {
          operationId: "getMeasurements",
          summary: "ค่าองค์ประกอบร่างกาย (BCA)",
          parameters: [customerId, { name: "limit", in: "query", schema: { type: "integer", default: 12 } }],
          responses: { "200": { description: "ok" } },
        },
        post: {
          operationId: "addMeasurement",
          summary: "บันทึกค่า BCA",
          parameters: [customerId],
          requestBody: {
            required: true,
            content: { "application/json": { schema: {
              type: "object", required: ["recorded_at"],
              properties: {
                recorded_at: { type: "string", format: "date" },
                weight: { type: "number" }, fat_pct: { type: "number" }, muscle_pct: { type: "number" },
                visceral: { type: "number" }, body_age: { type: "number" }, bmr: { type: "number" },
              },
            } } },
          },
          responses: { "200": { description: "ok" } },
        },
      },
      "/customers/{id}/cgm": {
        get: {
          operationId: "getCgmReadings",
          summary: "ค่าน้ำตาลต่อเนื่อง (CGM) ดิบ ตามช่วงวัน",
          description: "ค่าทุก 5 นาทีจากเซ็นเซอร์ · ค่าเริ่มต้น = 14 วันล่าสุดที่มีข้อมูล · สูงสุด 90 วัน / 20,000 ค่า · ถ้าต้องการตัวเลขสรุป (TIR/CV) ใช้ getCgmMetrics แทน ไม่ต้องดึงดิบมาคำนวณเอง",
          parameters: [customerId,
            { name: "days", in: "query", schema: { type: "integer", default: 14, maximum: 90 }, description: "นับถอยหลังจากวันล่าสุดที่มีข้อมูล" },
            { name: "from", in: "query", schema: { type: "string", format: "date" } },
            { name: "to", in: "query", schema: { type: "string", format: "date" } }],
          responses: { "200": { description: "ok" } },
        },
      },
      "/customers/{id}/cgm/metrics": {
        get: {
          operationId: "getCgmMetrics",
          summary: "★ ตัวเลขสรุป CGM — TIR · TAR · TBR · CV · GMI + รายวัน",
          description:
            "คำนวณบนเซิร์ฟเวอร์จากค่าจริงในฐาน ตามเกณฑ์ International Consensus on Time in Range (Battelino 2019 / ADA) · " +
            "ดู reliable ก่อนเสมอ: false = ข้อมูลไม่ถึง 14 วันหรือไม่ครบ 70% ให้พูดเป็นแนวโน้ม ห้ามเทียบเกณฑ์ · " +
            "meets บอกว่าผ่านเป้าข้อไหน · caveats ต้องบอกผู้ใช้ทุกครั้ง · GMI เป็นค่าประมาณ ไม่ใช่ HbA1c",
          parameters: [customerId,
            { name: "days", in: "query", schema: { type: "integer", default: 14, maximum: 90 } },
            { name: "from", in: "query", schema: { type: "string", format: "date" } },
            { name: "to", in: "query", schema: { type: "string", format: "date" } }],
          responses: { "200": { description: "ok" } },
        },
      },
      "/customers/{id}/cgm/import": {
        post: {
          operationId: "importCgmFile",
          summary: "นำเข้าไฟล์ CGM (Ottai .xlsx/.csv) เข้าประวัติลูกค้า",
          description:
            "★ แกะไฟล์ .xlsx ด้วย code interpreter อ่านคอลัมน์ Time กับ Glucose แล้วส่ง rows ทุกแถว ห้ามตัดทอน · " +
            "เวลาในไฟล์ = เวลาไทย · อัปโหลดซ้ำได้ ค่าที่มีแล้วถูกข้าม · ไม่ต้องส่ง profile_name ถ้าลูกค้ามีโปรไฟล์อยู่แล้ว",
          parameters: [customerId],
          requestBody: {
            // JSON only in the published spec. ChatGPT Actions reject multipart/form-data and
            // drop the whole operation when it is listed — which surfaced as "this action is not
            // available to me". The server still accepts multipart (curl, n8n); see SPEC §8.4.
            required: true,
            content: {
              "application/json": { schema: { type: "object", required: ["rows"], properties: {
                rows: {
                  type: "array",
                  description: "ทุกแถวจากไฟล์ [[เวลา, ค่าน้ำตาล], …] เช่น [[\"2026-09-11 19:08\", 83], [\"2026-09-11 19:03\", 77]] · เวลาตามที่อยู่ในไฟล์ (เวลาไทย) · ห้ามตัดทอน ห้ามสุ่มตัวอย่าง ส่งได้ถึง 60,000 แถว",
                  items: { type: "array", minItems: 2, maxItems: 2, items: {} },
                },
                profile_name: { type: "string", description: "ไม่ต้องส่งถ้าลูกค้ามีโปรไฟล์ CGM อยู่แล้ว" },
              } } },
            },
          },
          responses: { "200": { description: "บันทึกแล้ว — inserted / skipped_existing / rejected" } },
        },
      },
      "/customers/{id}/assessment": {
        get: {
          operationId: "getAssessment",
          summary: "★ ผลประเมินสุขภาพรวม (UP Health Design) — 7 ด้าน จากแล็บ · BCA · CGM · นาฬิกา · อาหาร",
          description:
            "ใช้เมื่อถูกถาม 'สุขภาพโดยรวม / ควรทำอะไรก่อน' · แต่ละด้านมี level good/watch/attention + drivers บอกค่าและแหล่ง · " +
            "ไม่มีคะแนนรวมเลขเดียว · อ่าน data_gaps + confidence ก่อนสรุป — level null = ไม่มีข้อมูล ไม่ใช่ปกติ · priorities = 3 ด้านที่ควรทำก่อน",
          parameters: [customerId, { name: "history", in: "query", schema: { type: "boolean" }, description: "true = แนบ 10 ครั้งล่าสุด" }],
          responses: { "200": { description: "ok" } },
        },
        post: {
          operationId: "runAssessment",
          summary: "สั่งประเมินสุขภาพรวมใหม่เดี๋ยวนี้",
          description: "เรียกหลังนำเข้าข้อมูลใหม่ (ไฟล์ CGM, ผลแล็บ) เพื่อให้ผลประเมินสะท้อนข้อมูลล่าสุด · ระบบเก็บทุกครั้งเป็นประวัติ ไม่ทับของเดิม",
          parameters: [customerId],
          responses: { "200": { description: "ok" } },
        },
      },
      "/customers/{id}/food": {
        get: {
          operationId: "getFoodLog",
          summary: "บันทึกอาหารย้อนหลัง + สรุปรายวัน (แคลอรี · C:P:F · โปรตีน)",
          description: "ค่าเริ่มต้น 14 วัน · ค่าเฉลี่ยคิดเฉพาะวันที่มีบันทึก (coverage_pct บอกว่าบันทึกกี่วัน) · ตัวเลขเป็นค่าประมาณที่คนยืนยันแล้ว ไม่ใช่ค่าที่วัด · ห้ามสรุปว่า 'กินน้อย' จากวันที่ไม่ได้บันทึก",
          parameters: [customerId, { name: "days", in: "query", schema: { type: "integer", default: 14, maximum: 90 } }],
          responses: { "200": { description: "ok" } },
        },
        post: {
          operationId: "logFood",
          summary: "บันทึกมื้ออาหาร (พิมพ์บอก / รูปเก่า) — หลังคนยืนยันตัวเลขแล้ว",
          description:
            "★ ขั้นตอน: คนบอกว่ากินอะไร → คุณประมาณแคลอรี/มาโคร → แสดงให้คนดู → คนยืนยัน → ค่อยเรียกพร้อม confirmed:true · " +
            "eaten_at ต้องเป็นเวลาไทย เช่น '2026-09-12 12:30' หรือวันอย่างเดียวถ้าไม่รู้เวลา · ห้ามเดาเวลา ถ้าไม่รู้ให้ถาม · รูปเก่าใช้ readFoodPhotoDate หาเวลาก่อน",
          parameters: [customerId],
          requestBody: {
            required: true,
            content: { "application/json": { schema: {
              type: "object", required: ["entries"],
              properties: {
                entries: {
                  type: "array", minItems: 1, maxItems: 50,
                  items: {
                    type: "object", required: ["eaten_at", "description", "confirmed"],
                    properties: {
                      eaten_at: { type: "string", description: "เวลาไทย 'YYYY-MM-DD HH:MM' หรือ 'YYYY-MM-DD' (ไม่รู้เวลา)" },
                      description: { type: "string", description: "เช่น 'ข้าวมันไก่ 1 จาน + กาแฟเย็นหวานน้อย'" },
                      items: { type: "array", items: { type: "string" } },
                      meal_type: { type: "string", enum: ["breakfast", "lunch", "dinner", "snack"] },
                      calories: { type: "number" }, carb_g: { type: "number" }, protein_g: { type: "number" }, fat_g: { type: "number" }, fiber_g: { type: "number" },
                      glucose_impact_score: { type: "number", description: "0–10" }, health_score: { type: "number", description: "0–10" },
                      notes: { type: "string" },
                      confirmed: { type: "boolean", description: "ต้องเป็น true = คนเห็นตัวเลขแล้วยืนยัน" },
                    },
                  },
                },
              },
            } } },
          },
          responses: { "200": { description: "บันทึกแล้ว + ประเมินสุขภาพรวมใหม่อัตโนมัติ" } },
        },
      },
      "/food/photo-date": {
        post: {
          operationId: "readFoodPhotoDate",
          summary: "อ่านเวลาถ่ายจากรูปอาหารเก่า (EXIF) เพื่อลงย้อนหลัง",
          description: "คืน eaten_at_suggested (เวลาไทย) ถ้ารูปมี EXIF · ภาพหน้าจอ/รูปที่ส่งผ่านแชตมักไม่มี → ถามคนว่ากินวันไหนมื้อไหน ห้ามเดา · ไม่วิเคราะห์อาหารและไม่เก็บรูป",
          requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["photo_base64"], properties: { photo_base64: { type: "string", description: "JPEG base64 (≤4.5 MB)" } } } } } },
          responses: { "200": { description: "ok" } },
        },
      },
      "/customers/{id}/plan": {
        get: {
          operationId: "getPlan",
          summary: "แผนดูแล 90 วัน (UP Health Design)",
          description: "คืนแผนล่าสุด + progress (วันที่ x/90 · แต่ละเป้า achieved/improving/no_change/worsening/no_new_data จากค่าที่วัดใหม่เท่านั้น · due_now = ตรวจซ้ำที่ถึงกำหนด) · is_draft=true = โค้ชยังไม่ยืนยัน ห้ามบอกลูกค้าเป็นแผนจริง",
          parameters: [customerId],
          responses: { "200": { description: "ok" } },
        },
        post: {
          operationId: "draftPlan",
          summary: "ร่างแผนดูแลใหม่จากผลประเมินล่าสุด (โค้ชต้องยืนยันในแอปก่อนส่งลูกค้า)",
          description: "สร้างร่างจาก getAssessment ล่าสุด · goal เลือกได้ loss/longevity/muscle ไม่ใส่ = ระบบเลือกจากองค์ประกอบร่างกาย · ร่างเก่าที่ยังไม่ยืนยันถูกแทนที่ · ระบบไม่เสนออาหารเสริมเอง",
          parameters: [customerId],
          requestBody: { required: false, content: { "application/json": { schema: { type: "object", properties: { goal: { type: "string", enum: ["loss", "longevity", "muscle"] } } } } } },
          responses: { "200": { description: "ร่างแล้ว — รอโค้ชยืนยัน" } },
        },
      },
      "/customers/{id}/wearable": {
        get: {
          operationId: "getWearableSummary",
          summary: "ข้อมูลนาฬิกา/อุปกรณ์สวมใส่ — นอน · HRV · ชีพจรพัก · ก้าว · recovery รายวัน",
          description: "ค่าเริ่มต้น 14 วัน · Whoop ก่อน ไม่งั้น Apple Health/Google Fit · ค่าเฉลี่ยคิดเฉพาะวันที่มีข้อมูล · HRV/RHR ไม่มีเกณฑ์กลาง ให้เทียบกับตัวเองย้อนหลัง · ไม่มีข้อมูล = ยังไม่ได้เชื่อม ไม่ใช่ปกติ",
          parameters: [customerId, { name: "days", in: "query", schema: { type: "integer", default: 14, maximum: 90 } }],
          responses: { "200": { description: "ok" } },
        },
      },
      "/customers/{id}/supplements": {
        get: {
          operationId: "getSupplements",
          summary: "อาหารเสริมที่ทานอยู่ + ความปลอดภัยคู่ยา",
          parameters: [customerId],
          responses: { "200": { description: "ok" } },
        },
      },
      "/customers/{id}/notes": {
        get: {
          operationId: "getNotes",
          summary: "โน้ตโค้ช",
          parameters: [customerId, { name: "limit", in: "query", schema: { type: "integer", default: 20 } }],
          responses: { "200": { description: "ok" } },
        },
        post: {
          operationId: "addNote",
          summary: "เพิ่มโน้ตโค้ช",
          parameters: [customerId],
          requestBody: {
            required: true,
            content: { "application/json": { schema: {
              type: "object", required: ["body"],
              properties: { body: { type: "string" }, pinned: { type: "boolean" } },
            } } },
          },
          responses: { "200": { description: "ok" } },
        },
      },
    },
    "x-uplabs": {
      scopes,
      intents: intentNames,
      compliance:
        "ข้อมูลนี้ใช้เพื่อการดูแลเชิงป้องกัน ไม่ใช่การวินิจฉัย · ห้ามนำไปสรุปว่าเป็นโรคใด · " +
        "ค่าผิดปกติให้แนะนำพบแพทย์ · อาหารเสริมต้องผ่านเภสัชกรและแพทย์",
    },
  };

  return spec;
}

const GEMINI_SCHEMA_KEYS = new Set([
  "type", "nullable", "required", "format", "description", "properties", "items", "enum",
]);

/** Deep-clone the spec, rewriting every schema node into Gemini's accepted subset. */
export function geminiFlavor(spec: any): any {
  const seen = (node: any): any => {
    if (Array.isArray(node)) return node.map(seen);
    if (!node || typeof node !== "object") return node;

    const isSchema = "type" in node || "properties" in node;
    if (!isSchema) {
      const out: any = {};
      for (const [k, v] of Object.entries(node)) out[k] = seen(v);
      return out;
    }

    const out: any = {};
    const notes: string[] = [];
    for (const [k, v] of Object.entries(node)) {
      if (GEMINI_SCHEMA_KEYS.has(k)) { out[k] = seen(v); continue; }
      // keep the meaning, lose the keyword
      if (k === "default") notes.push(`ค่าเริ่มต้น ${v}`);
      else if (k === "maximum") notes.push(`สูงสุด ${v}`);
      else if (k === "minimum") notes.push(`ต่ำสุด ${v}`);
    }
    if (notes.length) {
      out.description = [out.description, `(${notes.join(" · ")})`].filter(Boolean).join(" ");
    }
    return out;
  };
  return seen(spec);
}
