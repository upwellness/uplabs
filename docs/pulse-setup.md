# UP Pulse — Setup Guide (v0)

## 1. Run SQL migration

Open Supabase SQL Editor and run:

```sql
-- file: supabase/migrations/20260512_pulse.sql
```

Verify:
```sql
select count(*) from pulse_invites;
select count(*) from pulse_connections;
select count(*) from pulse_readings;
```

## 2. Google Cloud Console setup (one-time, free)

1. https://console.cloud.google.com → **Create project** → "UPLABS"
2. **APIs & Services → Library** → enable **Fitness API**
3. **OAuth consent screen**:
   - User Type: External
   - App name: UPLABS
   - Add scopes:
     - `https://www.googleapis.com/auth/fitness.heart_rate.read`
     - `https://www.googleapis.com/auth/fitness.sleep.read`
     - `https://www.googleapis.com/auth/fitness.activity.read`
     - `https://www.googleapis.com/auth/fitness.body.read`
4. **Credentials → Create OAuth Client → Web application**:
   - Name: UPLABS Pulse
   - Authorized redirect URIs:
     - `https://uplabs.upwellness.coach/api/pulse/oauth/callback`
     - `http://localhost:3000/api/pulse/oauth/callback` (for local dev)
5. Copy Client ID + Client Secret

## 3. Generate token encryption key

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Copy the output (32-byte base64 string).

## 4. Vercel env vars

Add to Vercel project → Settings → Environment Variables (production + preview):

```
GOOGLE_FIT_CLIENT_ID       = <from step 2.5>
GOOGLE_FIT_CLIENT_SECRET   = <from step 2.5>
PULSE_ENC_KEY              = <from step 3>
NEXT_PUBLIC_SITE_URL       = https://uplabs.upwellness.coach   (already set?)
```

Redeploy after adding.

## 5. Test end-to-end

1. Login to UPLABS as a coach with a customer
2. Go to `/pulse`
3. Pick customer → click "**+ สร้างลิงก์เชื่อมต่อ**" → copy URL
4. Open URL in incognito (or another phone) → see consent page
5. Click "ยอมรับและเชื่อมต่อ Google Fit" → login Google → grant permissions
6. Should redirect to `/connect/{token}/success`
7. Back in coach view → refresh → see green "✓ Connected" + readings preview

## What's NOT in v0 yet (coming next)

- Light clinical intake (medication / conditions / pregnancy)
- Rule engine + Gemini AI rephrase
- Pharmacist review queue (จิ้น LINE notify)
- Coach draft view + send HTML report
- Manual "Sync Now" button (currently only initial 7-day on connect)

## Troubleshooting

- **"redirect_uri_mismatch"** — exact URI must be registered in Google Cloud Console. Trailing slash matters.
- **"invalid_grant" on callback** — code expired (10 min) · ask customer to re-open invite link
- **"PULSE_ENC_KEY missing"** — env var not set in Vercel
- **No readings appear after connect** — customer's Google Fit might be empty. Check Google Fit app on their phone has 7+ days of data.
