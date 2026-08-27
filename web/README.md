# Spendly Web

The same chat-first expense tracker as the native app, running in a browser with
sign-in and cloud storage. Built mobile-first — on an iPhone you add it to the Home
Screen from Safari and it runs fullscreen, no App Store and no Apple Developer account.

Next.js 16 · Supabase (auth + Postgres) · Tailwind v4 · deployed on Vercel.

---

## Setup

### 1. Create a Supabase project

[supabase.com](https://supabase.com) → New project. Any region near you.

### 2. Run the schema

Supabase dashboard → **SQL Editor** → **New query**. Paste all of
[`supabase/schema.sql`](supabase/schema.sql) and run it. It creates seven tables,
turns on row-level security, and locks every row to its owner. Safe to re-run.

### 3. Copy the two keys

Supabase → **Project Settings** → **API**:

| Value | Environment variable |
|---|---|
| Project URL | `NEXT_PUBLIC_SUPABASE_URL` |
| `anon` / `public` key | `NEXT_PUBLIC_SUPABASE_ANON_KEY` |

The anon key is meant to be public — it ships inside every browser app. Row-level
security is what actually protects the data. Never put the `service_role` key here.

### 4. Point Vercel at this folder

The repo root holds the React Native app, so Vercel needs to be told where the web
app lives:

- Project → **Settings** → **Build & Deployment** → **Root Directory** → `web`
- Project → **Settings** → **Environment Variables** → add both variables above
- Redeploy

### 5. Run it locally

```bash
cd web
cp .env.example .env.local   # then paste your two values in
npm install
npm run dev
```

---

## Checks

```bash
npm run check          # typecheck + parser regression suite
npm run check:parser   # 23 real input strings the parser must get right
```

---

## How it fits together

**Storage.** Everything lives in Supabase. Sign in on your phone and your laptop and
you see the same data. The native app keeps its own local SQLite database — the two
are separate stores today, not two views of one.

**Seeding.** A brand new account has no categories, so the parser would have nothing
to match. The first load inserts the same 24 categories and 4 accounts the native app
ships with.

**The parser.** `src/lib/parser.ts`, `format.ts` and `seed.ts` are copies of the
native app's files — Vercel only uploads the `web/` folder, so they cannot be imported
across the repo. `scripts/parser-check.ts` runs the same corpus against this copy so
the two cannot silently drift apart. The one intentional difference: category ids are
uuids here, so the parser's fallbacks look up a stable `key` slug instead.

**Analytics.** One person's spending is a few thousand rows, so every transaction is
loaded once into memory and the charts are plain array reductions rather than SQL.

**Money** is stored as integer minor units (paise), never floats. Each row keeps
`local_date` alongside `occurred_at`, so an 11:45pm entry never lands on the wrong day.

---

## Layout

```
supabase/schema.sql        tables, indexes, row-level security
src/app/
  login/                   email + password sign in and sign up
  setup/                   shown until Supabase is configured
  auth/callback/           email confirmation redirect
  (app)/                   authenticated shell with the bottom tab bar
    add/                   the chat screen
    overview/              month summary, donut, insights
    analytics/             charts across any window
    history/               calendar heat grid and searchable list
    backfill/              add months that predate the app
    settings/              categories, budgets, accounts, learned words
    category/[id]/         per-category drill-down
src/lib/
  parser.ts                mirrored from the native app
  analytics.ts             month stats, range stats, answers, insights
  queries.ts               every Supabase read and write
  store.tsx                loads everything once, shares it via context
src/components/            ui, charts, pickers, transaction editor
src/proxy.ts               auth guard on every route
```
