# เชื่อม AI เข้ากับ UP Labs

3 ไฟล์ เลือกใช้ตามเครื่องมือ

| ไฟล์ | ใช้กับ | ทำอะไรได้ | ตั้งค่า |
|---|---|---|---|
| **`claude-skill/`** | Claude Code · Claude Desktop | **เรียก API เองได้จริง** | วางโฟลเดอร์ + ตั้ง `UPLAB_TOKEN` |
| **`chatgpt/GPT-INSTRUCTIONS.md`** | ChatGPT (Custom GPT) | **เรียก API เองได้จริง** | 2 ขั้น — Actions + วาง Instructions |
| **`DROP-IN.md`** | แชทไหนก็ได้ | ผู้ช่วยเขียน `curl` ให้ เอาไปรันเอง แล้ววางผลกลับ | วางไฟล์ + token ในแชท |

## ทำไมต้องมี 3 แบบ

ChatGPT ในแชทธรรมดา **ส่ง HTTP พร้อม header เองไม่ได้** — ไฟล์ที่อัปโหลดเป็นความรู้ให้อ่าน
ไม่ใช่ความสามารถใหม่ · ความสามารถยิง API มาจาก Actions หรือ connector ซึ่งตั้งผ่านหน้าเว็บเท่านั้น
และ GPT ตั้ง Actions ให้ตัวเองไม่ได้

`DROP-IN.md` จึงเป็นทางที่ใช้ได้ทันทีโดยไม่ต้องตั้งอะไร แลกกับต้องก๊อป `curl` ไปรันเอง

## claude-skill — ติดตั้ง

```bash
# Claude Code (ใช้ได้ทุกโปรเจกต์)
cp -r integrations/claude-skill ~/.claude/skills/uplabs

# เฉพาะโปรเจกต์นี้
cp -r integrations/claude-skill .claude/skills/uplabs

export UPLAB_TOKEN="uplab_live_xxxxxxxx_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
```

จากนั้นถามได้เลย — Claude จะเรียก skill เองเมื่อคำถามเกี่ยวกับลูกค้า

```
เทียบผลแล็บย้อนหลัง 3 รอบของ ต้น หน่อย
```

## ขอ token

`https://upwellness-ops.vercel.app/v2/admin/api-tokens` (ต้องเป็นแอดมิน)

**ให้ scope เท่าที่จำเป็น** — ผู้ช่วยที่ต้องการแค่อ่าน ให้ `customers:read` + `labs:read` พอ
และตั้งวันหมดอายุไว้เสมอ

## ถ้าทำ MCP server แล้ว

ทั้ง Claude, ChatGPT และ Gemini รองรับ MCP หมดแล้ว — เซิร์ฟเวอร์ตัวเดียวจะแทนที่ทั้ง 3 ไฟล์นี้
และตั้งค่าเหลือขั้นเดียวคือวาง URL · ดู `docs/SPEC-External-API.md`
