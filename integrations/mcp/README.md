# UP Labs MCP server — ต่อ AI ทุกตัวด้วย URL เดียว

```
https://upwellness-ops.vercel.app/api/mcp
Authorization: Bearer uplab_live_xxxxxxxx_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

MCP (Model Context Protocol) คือมาตรฐานกลางที่ AI client ใช้ "เห็นเครื่องมือ" ของเซิร์ฟเวอร์

**2 วิธียืนยันตัวตน** — (ก) วาง Bearer token ที่แอดมินออกให้ (Claude Code, Cursor, n8n, สคริปต์) · (ข) **OAuth**: กด Connect แล้วล็อกอิน UP Labs (claude.ai, ChatGPT, client อื่นที่รองรับ OAuth) — ได้สิทธิ์เท่าบัญชีที่ล็อกอิน
UP Labs เปิด endpoint เดียว รับเฉพาะ `POST` (Streamable HTTP แบบไม่มี session) และให้ **tool 19 ตัว**
ซึ่งเป็น operation เดียวกับ REST API ทุกตัว — ชื่อ tool = `operationId` ใน `/api/v1/openapi.json`
(`searchCustomers`, `compareLabs`, `getOverview`, `getCgmMetrics`, `importCgmFile`, `submitLabResult`, …)

**สิทธิ์เหมือน REST ทุกประการ** — token เดิม · scope เดิม · ขอบเขตลูกค้าเดิม · rate limit เดิม · ลง audit log เดิม
(ในล็อกจะเห็น `user_agent` ขึ้นต้นด้วย `mcp:<tool>` เพื่อแยกจากการเรียกตรง)

## ต่อยังไง — เลือกตาม client

### Claude Code

```bash
claude mcp add --transport http uplabs https://upwellness-ops.vercel.app/api/mcp \
  --header "Authorization: Bearer uplab_live_xxxxxxxx_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
```

หรือใส่ใน `.mcp.json` ของโปรเจกต์ (ห้าม commit token — ใช้ตัวแปรแวดล้อม):

```json
{
  "mcpServers": {
    "uplabs": {
      "type": "http",
      "url": "https://upwellness-ops.vercel.app/api/mcp",
      "headers": { "Authorization": "Bearer ${UPLAB_TOKEN}" }
    }
  }
}
```

### Cursor · Windsurf · VS Code (Copilot agent) · Codex CLI · Gemini CLI

ทุกตัวรับ config รูปแบบเดียวกัน (`mcpServers` → `url` + `headers`):

```json
{
  "mcpServers": {
    "uplabs": {
      "url": "https://upwellness-ops.vercel.app/api/mcp",
      "headers": { "Authorization": "Bearer uplab_live_xxxxxxxx_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" }
    }
  }
}
```

| client | ไฟล์ |
|---|---|
| Cursor | `~/.cursor/mcp.json` หรือ `.cursor/mcp.json` |
| Windsurf | `~/.codeium/windsurf/mcp_config.json` |
| VS Code | `.vscode/mcp.json` (ใช้ key `servers` แทน `mcpServers` และ `"type": "http"`) |
| Gemini CLI | `~/.gemini/settings.json` (key `httpUrl` แทน `url`) |
| Codex CLI | `~/.codex/config.toml` → `[mcp_servers.uplabs] url = "…"` + `http_headers = { Authorization = "Bearer …" }` |

### Claude Desktop (แอป) · client ที่รับเฉพาะ stdio

ใช้ `mcp-remote` เป็นสะพาน:

```json
{
  "mcpServers": {
    "uplabs": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "https://upwellness-ops.vercel.app/api/mcp",
               "--header", "Authorization: Bearer ${UPLAB_TOKEN}"],
      "env": { "UPLAB_TOKEN": "uplab_live_xxxxxxxx_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" }
    }
  }
}
```

### n8n

node **MCP Client** → Server Transport = *HTTP Streamable* · URL ข้างบน · Authentication = *Header Auth* (`Authorization` / `Bearer …`)

### เขียนโปรแกรมเอง (TypeScript SDK)

```ts
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const transport = new StreamableHTTPClientTransport(new URL("https://upwellness-ops.vercel.app/api/mcp"), {
  requestInit: { headers: { Authorization: `Bearer ${process.env.UPLAB_TOKEN}` } },
});
const client = new Client({ name: "my-agent", version: "1.0.0" });
await client.connect(transport);
const { tools } = await client.listTools();
const r = await client.callTool({ name: "getCgmMetrics", arguments: { id: "<customer-id>", days: 14 } });
```

## claude.ai (เว็บ / มือถือ / Desktop) — ต่อด้วย OAuth ไม่ต้องมี token

1. claude.ai → **Settings → Connectors → Add custom connector**
2. Name: `UP Labs` · Remote MCP server URL: `https://upwellness-ops.vercel.app/api/mcp` · ไม่ต้องกรอก client id/secret (ระบบลงทะเบียนให้เอง)
3. กด **Connect** → หน้า login ของ UP Labs → เข้าสู่ระบบด้วยบัญชีเดิม → ติ๊กสิทธิ์ → **อนุญาต**
4. กลับมาที่ claude.ai แล้วเปิดใช้ connector ในแชท (ปุ่ม 🔌) — ถามได้เลย เช่น "สรุป CGM ของ พี่สุ 14 วันล่าสุด"

token ที่ได้เห็นลูกค้าเท่าที่บัญชีนั้นเห็นในเว็บ · อายุ 7 วัน ต่ออายุอัตโนมัติ · แอดมินเห็นเป็นแถว `OAuth · Claude` ใน `/v2/admin/api-tokens` และเพิกถอนได้

## ChatGPT — ต่อด้วย OAuth เช่นกัน

1. ChatGPT → **Settings → Connectors → Advanced → เปิด Developer mode** (ต้องมี Plus/Pro/Team/Enterprise)
2. **Create** → Name `UP Labs` · MCP server URL `https://upwellness-ops.vercel.app/api/mcp` · Authentication **OAuth** · ไม่ต้องกรอก client id/secret
3. Connect → login UP Labs → อนุญาต → ใช้ในแชทโดยเปิด connector ในเมนู "+"

> Custom GPT + Actions (`integrations/chatgpt/`) ยังใช้ได้ตามเดิม — ต่างกันที่ Actions ผูก token ตัวเดียวกับ GPT ทั้งตัว ส่วน connector ผูกกับบัญชีของคนที่ล็อกอิน

## ทดสอบด้วย curl

```bash
T="uplab_live_…"; U="https://upwellness-ops.vercel.app/api/mcp"
curl -s $U -H "Authorization: Bearer $T" -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"curl","version":"0"}}}'
curl -s $U -H "Authorization: Bearer $T" -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list"}' | jq '.result.tools[].name'
curl -s $U -H "Authorization: Bearer $T" -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"searchCustomers","arguments":{"q":"สม"}}}' | jq '.result.structuredContent'
```

## ข้อควรรู้

- **ไม่มี LLM ฝั่งเรา** — tool คืนข้อมูลดิบ + `caveats` ให้ AI ฝั่งคุณเรียบเรียง (เหมือน REST)
- ผลลัพธ์ทุก tool อยู่ทั้งใน `content[0].text` (JSON string) และ `structuredContent` (object) · ถ้า REST ตอบ 4xx/5xx จะได้ `isError: true` และ `http_status` ในผล
- `importCgmFile` รับ `rows: [[เวลา, ค่าน้ำตาล], …]` — client ที่มี file access ให้แกะ .xlsx เป็นแถวก่อนส่ง (ทางลัด: `integrations/claude-skill/scripts/uplabs cgm-import` แกะให้)
- ไม่มี `resources` / `prompts` — client ที่ถามจะได้ `-32601` ตามมาตรฐาน
- token = ตัวตน · ให้ scope เท่าที่จำเป็น · ตั้งวันหมดอายุ · เพิกถอนได้ที่ `/v2/admin/api-tokens` มีผลทันทีทุก client
