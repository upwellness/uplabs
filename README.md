# UPLABS v2

Health Intelligence Platform — Next.js 14 + Tailwind + BFF.

## Architecture

```
Frontend (React Server Components + Client Components)
    │
    ▼
BFF (Next.js API routes, /app/api/*)
    │
    ▼
Backend Services (Supabase, Gemini AI, ...)
```

- **Frontend** never touches secrets or DB directly.
- **BFF** owns auth, clinical thresholds, data shaping.
- **Backend services** are swappable; the BFF contract stays stable.

## Stack

- Next.js 14 (App Router) · React 18 · TypeScript
- Tailwind CSS with UPLABS brand tokens
- Supabase (data persistence)
- Recharts (visualization)

## Color Philosophy

- **Brand colors** (rose / wellness / science / amber) → identity, accents, decorative.
- **Medical status colors** (green / yellow / red) → ALWAYS standard traffic-light for any clinical indicator. Never substituted with brand palette, to convey clinical seriousness.

See `lib/medical-status.ts` for the canonical mapping and thresholds (ACE · WHO Asian · Tanita).

## Run

```bash
npm install
cp .env.example .env.local   # then fill in Supabase credentials
npm run dev
```

## Apps

| Slug | Audience | Status |
|------|----------|--------|
| `/` (upmenu) | All | Live |
| `/bca` | Business | Live |
| Others | Various | Migrating from v1 |

v1 archived at `../uplabs-v1-archive/`.
