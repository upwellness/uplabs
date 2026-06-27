/**
 * POST /api/line/webhook — น้องจาน LINE bot webhook.
 *
 * Flow (per SPEC-LINE-BOT.md §6):
 *   1. Read the RAW body, verify x-line-signature (HMAC-SHA256). Bad → 401.
 *   2. Parse events, handle each, then ALWAYS return 200 fast (LINE requires a prompt 200).
 *
 * Supported interactions
 *   • postback  action=today / action=tomorrow / action=dayinfo
 *   • message text (Thai):
 *       "เมนูวันนี้" | "วันนี้"        → today
 *       "เมนูพรุ่งนี้" | "พรุ่งนี้"     → tomorrow
 *       "ผูกกลุ่ม" | "รหัสกลุ่ม"        → reply this group's id (coach maps it in UP Labs)
 *       "ตั้งวัน N"                     → set program day = N (updates program_start_date)
 *   • join (bot added to a group)       → welcome + group id + "ให้โค้ชผูกกลุ่มใน UP Labs"
 *
 * Buttons: group chats can't use a per-user Rich Menu, so every reply carries
 * Quick Reply buttons (today / tomorrow / day-info) — always available to the group.
 *
 * Every handled action is logged to line_bot_logs. Reply work is best-effort and
 * never blocks the 200 (we await it, but always end 200 even on internal errors).
 */
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifySignature, replyMessage, type LineMessage } from "@/lib/line/client";
import {
  resolveGroup,
  getDayMeals,
  buildMealFlex,
  textWithButtons,
  programDayFor,
  bangkokToday,
} from "@/lib/line/meal-plan";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const OK = () => NextResponse.json({ ok: true });

/* ───────────────── logging ───────────────── */

async function log(type: string, status: string, payload: Record<string, unknown>, groupRowId?: string | null) {
  try {
    const admin = createAdminClient();
    await admin.from("line_bot_logs").insert({
      group_id: groupRowId ?? null,
      type,
      status,
      payload,
    });
  } catch {
    /* logging is best-effort */
  }
}

/* ───────────────── webhook entry ───────────────── */

export async function POST(req: Request) {
  // 1) raw body + signature
  const raw = await req.text();
  const signature = req.headers.get("x-line-signature");
  if (!verifySignature(raw, signature)) {
    return NextResponse.json({ error: "bad signature" }, { status: 401 });
  }

  let body: { events?: LineEvent[] } = {};
  try {
    body = JSON.parse(raw);
  } catch {
    return OK(); // malformed JSON but signature OK — ack and move on
  }

  const events = Array.isArray(body.events) ? body.events : [];
  // Handle events; never let one failure abort the 200.
  for (const ev of events) {
    try {
      await handleEvent(ev);
    } catch (e) {
      await log("error", "fail", { msg: e instanceof Error ? e.message.slice(0, 300) : String(e), event: ev?.type });
    }
  }

  return OK();
}

/* ───────────────── event router ───────────────── */

type LineSource = { type?: string; groupId?: string; roomId?: string; userId?: string };
interface LineEvent {
  type?: string;
  replyToken?: string;
  source?: LineSource;
  message?: { type?: string; text?: string };
  postback?: { data?: string };
}

async function handleEvent(ev: LineEvent): Promise<void> {
  const replyToken = ev.replyToken;
  const groupId = ev.source?.groupId;

  // join: bot was added to a group/room
  if (ev.type === "join") {
    if (replyToken) {
      const gid = groupId || ev.source?.roomId || "(ไม่ทราบรหัส)";
      await replyMessage(replyToken, [
        textWithButtons(
          "สวัสดีครับ ผม “น้องจาน” 🍽️ ผู้ช่วยส่งเมนูอาหาร+วิตามินประจำวัน\n\n" +
            `รหัสกลุ่มนี้: ${gid}\n` +
            "ให้โค้ชนำรหัสนี้ไปผูกกลุ่มกับโปรไฟล์ลูกค้าใน UP Labs ก่อน แล้วผมจะส่งเมนูให้ได้เลยครับ",
        ),
      ]);
    }
    await log("join", "ok", { groupId: groupId || ev.source?.roomId || null });
    return;
  }

  // postback buttons
  if (ev.type === "postback") {
    const action = parseAction(ev.postback?.data);
    if (action === "today" || action === "tomorrow") {
      await replyDay(replyToken, groupId, action);
      return;
    }
    if (action === "dayinfo") {
      await replyDayInfo(replyToken, groupId);
      return;
    }
    return;
  }

  // text messages
  if (ev.type === "message" && ev.message?.type === "text") {
    const text = (ev.message.text || "").trim();

    if (/^(เมนูวันนี้|วันนี้|มื้อวันนี้)$/.test(text)) { await replyDay(replyToken, groupId, "today"); return; }
    if (/^(เมนูพรุ่งนี้|พรุ่งนี้|มื้อพรุ่งนี้)$/.test(text)) { await replyDay(replyToken, groupId, "tomorrow"); return; }

    if (/^(ผูกกลุ่ม|รหัสกลุ่ม)/.test(text)) { await replyGroupId(replyToken, groupId); return; }

    const setDay = text.match(/^ตั้งวัน\s*(\d{1,3})$/);
    if (setDay) { await handleSetDay(replyToken, groupId, parseInt(setDay[1], 10)); return; }

    if (/^(วันที่เท่าไร|วันที่เท่าไหร่|โปรแกรมวันที่)/.test(text)) { await replyDayInfo(replyToken, groupId); return; }

    // Unknown text in a group: stay quiet to avoid noise, but offer buttons on explicit help.
    if (/^(เมนู|help|ช่วย|คำสั่ง)/i.test(text)) {
      if (replyToken) {
        await replyMessage(replyToken, [
          textWithButtons("กดปุ่มด้านล่างเพื่อดู “มื้อวันนี้” หรือ “มื้อพรุ่งนี้” ได้เลยครับ 🍽️\nโค้ชตั้งวันโปรแกรมได้ด้วยคำสั่ง: ตั้งวัน 5"),
        ]);
      }
    }
    return;
  }

  // other event types (follow/leave/etc.) — ignore.
}

/* ───────────────── handlers ───────────────── */

async function replyDay(replyToken: string | undefined, groupId: string | undefined, which: "today" | "tomorrow") {
  if (!replyToken) return;
  if (!groupId) {
    await replyMessage(replyToken, [textWithButtons("ใช้ได้เฉพาะในกลุ่มที่ผูกกับลูกค้าครับ")]);
    return;
  }

  const group = await resolveGroup(groupId);
  if (!group) {
    await replyMessage(replyToken, [
      textWithButtons(`กลุ่มนี้ยังไม่ได้ผูกกับลูกค้า หรือยังไม่มีน้ำหนัก/ส่วนสูงในระบบ — แจ้งโค้ชให้ตั้งค่าใน UP Labs ครับ\n(รหัสกลุ่ม: ${groupId})`),
    ]);
    await log(which, "skip", { reason: "unbound_or_incomplete", groupId });
    return;
  }

  const result = await getDayMeals(group, which);
  const r = await replyMessage(replyToken, [buildMealFlex(result, which)]);
  await log(which, r.ok ? "ok" : "fail", { groupId, programDay: result.programDay, lineStatus: r.status, lineError: r.text || undefined }, group.groupRowId);
}

async function replyDayInfo(replyToken: string | undefined, groupId: string | undefined) {
  if (!replyToken) return;
  if (!groupId) { await replyMessage(replyToken, [textWithButtons("ใช้ได้เฉพาะในกลุ่มครับ")]); return; }

  const group = await resolveGroup(groupId);
  if (!group) {
    await replyMessage(replyToken, [textWithButtons(`กลุ่มนี้ยังไม่ได้ผูกกับลูกค้าครับ (รหัสกลุ่ม: ${groupId})`)]);
    return;
  }
  const N = programDayFor(group.programStartDate);
  await replyMessage(replyToken, [
    textWithButtons(`ตอนนี้เป็น “วันที่ ${N}” ของโปรแกรม${group.customerName ? ` (${group.customerName})` : ""} ครับ\nเริ่มโปรแกรมเมื่อ ${group.programStartDate}`),
  ]);
  await log("dayinfo", "ok", { groupId, programDay: N }, group.groupRowId);
}

async function replyGroupId(replyToken: string | undefined, groupId: string | undefined) {
  if (!replyToken) return;
  if (!groupId) {
    await replyMessage(replyToken, [textWithButtons("คำสั่งนี้ใช้ในกลุ่มเท่านั้นครับ — เชิญน้องจานเข้ากลุ่มก่อน")]);
    return;
  }
  await replyMessage(replyToken, [
    textWithButtons(`รหัสกลุ่มนี้คือ:\n${groupId}\n\nนำรหัสนี้ไปผูกกับโปรไฟล์ลูกค้าในหน้า “LINE Bot” ของ UP Labs ครับ`),
  ]);
  await log("bind", "ok", { groupId });
}

/**
 * "ตั้งวัน N" → make today = program day N by back-dating program_start_date:
 *   start = today - (N - 1) days.
 * Only updates an existing mapped group (won't create one).
 */
async function handleSetDay(replyToken: string | undefined, groupId: string | undefined, n: number) {
  if (!replyToken) return;
  if (!groupId) { await replyMessage(replyToken, [textWithButtons("ใช้ในกลุ่มเท่านั้นครับ")]); return; }
  if (!Number.isFinite(n) || n < 1 || n > 365) {
    await replyMessage(replyToken, [textWithButtons("กรุณาระบุเป็นตัวเลขวันที่ 1–365 เช่น “ตั้งวัน 5”")]);
    return;
  }

  const admin = createAdminClient();
  const { data: group } = await admin
    .from("line_bot_groups")
    .select("id, customer_id")
    .eq("line_group_id", groupId)
    .maybeSingle();

  if (!group) {
    await replyMessage(replyToken, [textWithButtons(`กลุ่มนี้ยังไม่ได้ผูกในระบบครับ (รหัสกลุ่ม: ${groupId}) — ให้โค้ชผูกใน UP Labs ก่อน`)]);
    return;
  }

  // start = today - (N-1) days, in Asia/Bangkok terms.
  const todayISO = bangkokToday();
  const start = new Date(Date.UTC(+todayISO.slice(0, 4), +todayISO.slice(5, 7) - 1, +todayISO.slice(8, 10)));
  start.setUTCDate(start.getUTCDate() - (n - 1));
  const startISO = start.toISOString().slice(0, 10);

  const { error } = await admin
    .from("line_bot_groups")
    .update({ program_start_date: startISO })
    .eq("id", group.id);

  if (error) {
    await replyMessage(replyToken, [textWithButtons("ตั้งวันไม่สำเร็จ ลองใหม่อีกครั้งครับ")]);
    await log("setday", "fail", { groupId, n, error: error.message }, group.id);
    return;
  }

  await replyMessage(replyToken, [textWithButtons(`ตั้งแล้วครับ — วันนี้คือ “วันที่ ${n}” ของโปรแกรม (เริ่ม ${startISO})`)]);
  await log("setday", "ok", { groupId, n, startISO }, group.id);
}

/* ───────────────── util ───────────────── */

function parseAction(data: string | undefined): string | null {
  if (!data) return null;
  // data is "action=today" style; parse robustly.
  const m = data.match(/(?:^|[?&])action=([a-z]+)/i);
  return m ? m[1].toLowerCase() : null;
}
