# Northbound

Apparel storefront with cash-on-delivery orders, a Sinhala/English UI and an admin panel.
Next.js 16 (App Router), React 19, Tailwind v4, Supabase (Postgres + Storage), Auth.js v5.

## Run it

```bash
npm install
npm run dev     # http://localhost:3000
npm test        # Vitest (pure logic in lib/*.test.ts)
npm run lint
npm run build
```

Create `.env.local` with:

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase client |
| `SUPABASE_SECRET_KEY` | server-only admin client |
| `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` | Auth.js |
| `TEXTLK_API_TOKEN` | SMS (phone sign-in, order notifications) |
| `NEXT_PUBLIC_SITE_URL` | public origin once the domain exists |

## Where things are

- `CLAUDE.md`: full architecture, one section per feature part. Read this first.
- `supabase/migrations/`: SQL, applied by hand in the Supabase SQL editor.
- `docs/superpowers/{specs,plans}`: design specs and implementation plans.
- `docs/launch/`: go-live checklist and the demo-data reset script.
- `docs/superpowers/roadmap.md`: what is still to build.
