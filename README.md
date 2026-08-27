# Spendly — chat-first expense tracker

Type what you spent. No forms.

```
food 300                    → ₹300 · Food & Drink · Today
groceries 2400 and auto 80  → two entries, split automatically
zomato 480 yest upi         → ₹480 · Food · Yesterday · UPI
petrol 1500 on 5th          → ₹1,500 · Fuel · 5th of this month
salary 45000 received       → +₹45,000 income
how much on food this month? → answered inline with a chart
```

Built with Expo + React Native. iOS and Android from one codebase, everything stored
locally on the device in SQLite.

---

## Running it

```bash
npm install
npx expo start
```

Press `i` for the iOS simulator, `a` for Android, or scan the QR code with Expo Go.

Checks:

```bash
npm run check          # typecheck + parser regression suite
npm run check:parser   # 31 real input strings the parser must get right
```

---

## What's in it

**Add (chat)** — the home screen. Type an entry, it commits instantly as an editable
card. Tap any card to fix the amount, category, date, payment method or note. A pinned
date chip at the top lets you log a whole backlog to a past day.

**Overview** — month total with a change-vs-last-month delta, budget ring, day-by-day
bars, a category donut with drill-down, plain-language insight cards, and recent entries.

**Analytics** — a dedicated charts page. Month / 3M / 6M / 1Y / All-time windows, a
monthly trend line, income-vs-spending bars, per-category totals with percentage change
against the previous equivalent window, weekday breakdown, payment-method split, records
(heaviest day, biggest single expense, average entry) and most-frequent items.

**History** — a calendar heat grid for the month, tap a day to filter, search notes,
filter by category, entries grouped by day with per-day totals.

**Settings** — theme (system/light/dark), currency, Indian vs international number
grouping, category manager with icons/colours/keywords, budgets (overall + per category),
accounts, learned-words list with a live parser tester, CSV export, and over-the-air
update check.

**Add past months** — three ways to backfill, since you probably didn't start tracking
on day one:
1. *Monthly totals* — one lump sum per category for a whole month.
2. *Paste a list* — many lines at once, previewed before saving.
3. *Day by day* — pin the chat to an older date and type normally.

---

## How the parser works

Three layers, first confident answer wins. Layers 0 and 1 run on-device, cost nothing
and work offline.

| Layer | What it does |
|---|---|
| **0 — Rules** | Regex + tokenizer. Amount (`300`, `3k`, `1.2L`, `₹300`, `1,250`, `300rs`), date phrase, payment keyword, quantity multiplier (`chai 20 x3`), and a category keyword matched against the built-in dictionary. |
| **1 — Memory** | The `aliases` table: keyword → category. Every time you correct a category, the word you typed is bound to it permanently. This is what makes the app faster the longer you use it. |
| **2 — Fuzzy** | Levenshtein and prefix matching, so `grocries` and `gro` still land on Groceries. |

**Dates** are resolved before amounts, so `on 5` is never mistaken for a number.
Supported: `today`, `yesterday`/`yest`, `day before yesterday`, `3 days ago`,
`last friday`, `last month`, `on 5`, `5th`, `5 aug`, `aug 5`, `5/8`, `2026-08-05`.
A bare day-of-month that would land in the future rolls back one month — nobody logs
expenses in advance.

Every entry stores `occurred_at` (UTC) **and** `local_date` (`YYYY-MM-DD`). Analytics
group on `local_date`, so an 11:45pm entry never lands on the wrong day.

Questions (`how much…`, `how many…`, `average…`, `top…`) are detected and answered in
the thread instead of being logged.

---

## Stack

| Concern | Choice |
|---|---|
| Framework | Expo SDK 57, React Native 0.86, TypeScript |
| Navigation | Expo Router (file-based) |
| Storage | `expo-sqlite`, local-first, no server |
| State | Zustand for UI state; SQLite holds truth |
| Charts | Hand-built on `react-native-svg` — donut, ring, bars, trend line, heat grid |
| Motion | `react-native-reanimated`, `expo-haptics` |
| Updates | `expo-updates` — JS changes ship over the air |

Money is stored as **integer minor units** (paise), never floats. Every row has a UUID,
`updated_at` and a soft-delete column so cloud sync can be added later without a
migration on live devices.

---

## Shipping updates

The app checks for updates on launch, and Settings › Check for updates forces it.

```bash
npm run update        # push JS changes to the preview channel
npm run update:prod   # push to production
```

A new native build is only needed when native dependencies change — the
`runtimeVersion` fingerprint policy detects that automatically.

```bash
npm run build:ios
npm run build:android
```

---

## Project layout

```
app/                    Expo Router routes
  (tabs)/               chat · overview · analytics · history · settings
  category/[id].tsx     per-category drill-down
  backfill.tsx          add past months
  manage/               categories · budgets · accounts · learned words
src/
  db.ts                 schema, migrations, every query
  parser.ts             the chat parser
  analytics.ts          month stats, range stats, query answers, insights
  charts.tsx            SVG chart primitives
  ui.tsx                design-system components
  theme.ts              light + dark tokens
  seed.ts               default categories and their keyword dictionary
scripts/parser-check.ts parser regression suite
```
