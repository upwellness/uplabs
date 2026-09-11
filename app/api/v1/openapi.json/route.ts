import { NextResponse } from "next/server";
import { SCOPES } from "@/lib/api/scopes";
import { INTENT_NAMES } from "@/lib/api/resolver";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/openapi.json — the schema ChatGPT Actions (or n8n) imports.
 *
 * Public on purpose: it is a description of the interface, not of anyone's data, and
 * every path behind it still demands a token. Making the schema itself token-gated
 * would break the one-click import that is the whole point of publishing it.
 *
 * Descriptions here are written for a model to read. They say when to reach for each
 * path, because that is what the caller's LLM uses to route a question.
 */
export async function GET(req: Request) {
  const base = (process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin).replace(/\/+$/, "");

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
                    intent: { type: "string", enum: INTENT_NAMES, description: "บังคับ intent ข้ามการเดา" },
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
            "★ ใช้ตัวนี้เมื่ออ่านค่าจากใบแล็บ/รูป/PDF มา — ไม่ใช่ addLabResult · " +
            "ค่าจะเข้าคิวให้คนตรวจเทียบกับใบจริงก่อน ยังไม่เข้าประวัติลูกค้าทันที · " +
            "ส่ง raw_text (ข้อความที่อ่านได้จากเอกสารแบบคำต่อคำ) มาด้วยเสมอ เพราะคนตรวจใช้เทียบว่าอ่านตรงแถวไหม · " +
            "ห้ามเดาค่าที่อ่านไม่ออก ให้ข้ามไปเลย และห้ามเดาสถานะ (ปกติ/สูง/ต่ำ) ถ้าใบไม่ได้พิมพ์ไว้",
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
            "★ ChatGPT/Gemini Actions ส่งไฟล์ multipart ไม่ได้ — ให้เปิดไฟล์ .xlsx ด้วย code interpreter อ่านคอลัมน์ Time กับ Glucose แล้วส่ง JSON {rows:[[\"2026-09-11 19:08\", 83], …]} ทุกแถว (ห้ามตัดทอน ห้ามสุ่มตัวอย่าง) · " +
            "ระบบที่ส่งไฟล์ได้ (n8n, curl) ใช้ multipart file= · " +
            "เวลาในไฟล์ถือเป็นเวลาไทย · อัปโหลดไฟล์เดิมซ้ำได้ ค่าที่มีอยู่แล้วจะถูกข้าม ไม่เขียนทับ · " +
            "profile_name ไม่ต้องส่งถ้าลูกค้ามีโปรไฟล์อยู่แล้ว (ใช้ของเดิมอัตโนมัติ) · ระบบไม่ยอมสร้างโปรไฟล์ที่สองซ้อนคนเดิม",
          parameters: [customerId],
          requestBody: {
            required: true,
            content: {
              "multipart/form-data": { schema: { type: "object", required: ["file"], properties: {
                file: { type: "string", format: "binary", description: ".xlsx หรือ .csv ไม่เกิน 5 MB" },
                profile_name: { type: "string", description: "ชื่อโปรไฟล์ CGM (ไม่บังคับ)" },
              } } },
              "application/json": { schema: { type: "object", required: ["rows"], properties: {
                rows: { type: "array", items: { type: "array", minItems: 2, maxItems: 2, items: {} }, description: "[[\"2026-09-11 19:08\", 83], …] เวลาไทย" },
                profile_name: { type: "string" },
              } } },
            },
          },
          responses: { "200": { description: "บันทึกแล้ว — inserted / skipped_existing / rejected" } },
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
      scopes: SCOPES,
      intents: INTENT_NAMES,
      compliance:
        "ข้อมูลนี้ใช้เพื่อการดูแลเชิงป้องกัน ไม่ใช่การวินิจฉัย · ห้ามนำไปสรุปว่าเป็นโรคใด · " +
        "ค่าผิดปกติให้แนะนำพบแพทย์ · อาหารเสริมต้องผ่านเภสัชกรและแพทย์",
    },
  };

  // ?flavor=gemini — Gemini's function-calling schema accepts only a subset of
  // OpenAPI (type, nullable, required, format, description, properties, items, enum).
  // Feeding it our full spec risks a rejected tool definition, so this strips the
  // unsupported keys and folds what they said into the description instead — the
  // model still learns the default and the ceiling, just as prose it can read.
  const flavor = new URL(req.url).searchParams.get("flavor");
  const body = flavor === "gemini" ? geminiFlavor(spec) : spec;

  return NextResponse.json(body, {
    headers: { "cache-control": "public, max-age=300" },
  });
}

const GEMINI_SCHEMA_KEYS = new Set([
  "type", "nullable", "required", "format", "description", "properties", "items", "enum",
]);

/** Deep-clone the spec, rewriting every schema node into Gemini's accepted subset. */
function geminiFlavor(spec: any): any {
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
