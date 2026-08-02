# Powerball Prediction Dashboard — Build Plan

A dashboard that reads historical Powerball results live from public open data,
analyses them, and **stores the predictions you generate for upcoming draws**.

> **Architecture note.** Past results are *not* stored on our side. Powerball is a
> single national game published as authoritative open data, so a local mirror
> could only ever drift from the source. MongoDB holds exactly two collections:
> `users` and `predictions`.

---

## 1. Stack decisions

| Concern | Choice | Notes |
|---|---|---|
| Framework | **Next.js 16 (App Router)** | Server components + route handlers = one deployable; Mongo and the feed never touch the browser |
| Bundler | Next/Turbopack | **Vite is not used as a bundler** — it cannot coexist with Next. Kept as **Vitest** for unit tests |
| Language | TypeScript (strict) | |
| Styling | Tailwind CSS v4 | Dark-first theme, all surfaces driven by CSS variables |
| Server state | TanStack Query v5 | Route handlers are the API; Query owns cache/invalidation |
| Results data | **NY open data (Socrata `d6yy-54nr`)** | Read-through cache, 1h TTL. No API key required |
| DB | MongoDB Atlas + Mongoose 9 | `users` + `predictions` only |
| Auth | Auth.js v5 (`next-auth@beta`), Credentials provider | JWT session in httpOnly cookie, `middleware.ts` route guard |
| Forms | react-hook-form + Zod | |
| Table | TanStack Table v8 | |
| Charts | Recharts 3 | |
| ML | `@tensorflow/tfjs` (browser inference) + `@tensorflow/tfjs-node` (offline training) | |

### Reality check on predictions
Each Powerball draw is an independent event with fixed 1/292,201,338 odds.
Frequency, "overdue" numbers, and neural nets **cannot** improve those odds — the
historical record carries no signal about the next draw. The predictions page
ships with a persistent disclaimer and is presented as *pattern analysis*, not
forecasting. Every generated set shows the reasoning behind it, so the output is
transparent rather than mystical.

---

## 2. Domain rules

- 5 **white balls**: integers `1–69`, **distinct**, always sorted ascending.
- 1 **Powerball**: integer `1–26` — a *separate pool*, so it may repeat a white ball's value.
- Draws are held **Mon/Wed/Sat** at ~22:59 ET.
- A saved prediction holds **1–10 complete sets**, each a playable 5 + 1 line.

> The 69/26 matrix took effect with the **2015-10-07** draw. Earlier draws used
> 59/35, where balls 60–69 could not be drawn at all, so the feed layer discards
> everything before that date.

---

## 3. Data sources

### 3.1 Results — read live, never stored

`src/lib/powerball-feed.ts` is a read-through cache over the Socrata dataset.

| Property | Value |
|---|---|
| Endpoint | `https://data.ny.gov/resource/d6yy-54nr.json` |
| Auth | none |
| Rows available | 1,970 back to 2010-02-03 |
| Rows used | **1,379** (2015-10-07 onward) |
| Cache TTL | 1 hour, in-process |

Behaviour:
- **Paginated** fetch (`$limit`/`$offset`, 1000/page) filtered server-side to the current matrix.
- **Validated** — every row goes through `feedRowSchema`, the same strictness applied to user input. Malformed rows are collected and reported, never silently trusted.
- **Timezone-pinned** — Socrata sends a floating timestamp (`"2026-07-22T00:00:00.000"`, no zone). `new Date()` reads that as *local* midnight, which on any UTC+ machine shifts every draw back a day. The parser takes the calendar-date portion and pins it to UTC.
- **Double Play ignored** — `double_play_winning_numbers` is a separate side game with its own drawing; folding it in would double-count every frequency statistic.
- **Single-flight** — concurrent callers share one upstream fetch rather than stampeding the source.
- **Stale-on-error** — if the network fails, the last good copy is served flagged `stale: true` so the UI can say so. Only a cold cache plus a failure is a hard error.

### 3.2 Predictions — the only thing we write

```ts
// users
{ _id, email /* unique, lowercase */, passwordHash /* select:false */,
  name, role: 'admin' | 'viewer', createdAt, updatedAt }

// predictions
{ _id,
  targetDrawDate: Date,        // the upcoming draw this predicts, UTC midnight
  sets: [{                     // 1–10 playable lines
    numbers: [number x5],      // sorted, 1–69, distinct
    powerball: number,         // 1–26
    strategy: Strategy,
    rationale?: string,
  }],
  analysisWindow: number | null,   // how many past draws were analysed
  createdBy: ObjectId,
  createdAt, updatedAt }
```

**Indexes**

```
users:        { email: 1 } unique
predictions:  { createdBy: 1, targetDrawDate: -1 }   // "my predictions, newest first"
              { targetDrawDate: -1 }                  // scoring once a draw is published
```

---

## 4. Directory structure

```
app-lottery/
├── src/
│   ├── app/
│   │   ├── (auth)/login/page.tsx
│   │   ├── (app)/                       # protected group, shares sidebar layout
│   │   │   ├── layout.tsx
│   │   │   ├── dashboard/page.tsx
│   │   │   ├── results/page.tsx
│   │   │   └── predictions/page.tsx
│   │   ├── api/
│   │   │   ├── auth/[...nextauth]/route.ts
│   │   │   ├── draws/route.ts           # GET — paged view over the cached feed
│   │   │   ├── stats/route.ts           # GET — dashboard aggregations
│   │   │   ├── predictions/route.ts     # GET list · POST save
│   │   │   ├── predictions/[id]/route.ts        # DELETE
│   │   │   └── predictions/generate/route.ts    # GET — generate without saving
│   │   ├── layout.tsx · providers.tsx · globals.css
│   ├── components/
│   │   ├── layout/{Sidebar,Topbar,NavLink}.tsx
│   │   ├── draws/{DrawsTable,NumberBall,DrawFilters}.tsx
│   │   ├── dashboard/{StatCard,FrequencyChart,SumDistribution,OddEvenChart}.tsx
│   │   ├── predictions/{StrategyPicker,PredictionSetList,SavedPredictions,
│   │   │                DisclaimerBanner,Explanation,OutcomeBadge}.tsx
│   │   └── ui/{Button,Input,Dialog,Table,Skeleton,Select}.tsx
│   ├── lib/
│   │   ├── db.ts · auth.ts · api.ts · utils.ts · constants.ts
│   │   ├── powerball-feed.ts            # read-through cache over Socrata
│   │   ├── draw-schedule.ts             # Mon/Wed/Sat → next draw date
│   │   ├── validation/{draw.ts,prediction.ts}
│   │   └── prediction/
│   │       ├── frequency.ts  gaps.ts  pairs.ts  markov.ts
│   │       ├── ml.ts                    # TFJS load + infer
│   │       ├── ensemble.ts
│   │       └── score.ts                 # prediction vs actual, once drawn
│   ├── models/{User.ts,Prediction.ts}
│   ├── hooks/{useDraws,useStats,useGeneratePrediction,useSavePrediction}.ts
│   ├── types/{index.ts,next-auth.d.ts}
│   └── middleware.ts                    # MUST live in src/ — see note below
├── scripts/{load-env.ts,seed-admin.ts,train-model.ts}
├── public/model/                        # model.json + weights.bin
└── .env.local
```

---

## 5. Authentication & route security

1. **Credentials provider** — email + password, `bcryptjs` (12 rounds). No public signup; the first admin comes from `scripts/seed-admin.ts`.
2. **Session** — JWT strategy, httpOnly + sameSite=lax + secure cookie, 8h expiry, `role` embedded.
3. **`middleware.ts`** matches `/dashboard/:path*`, `/results/:path*`, `/predictions/:path*` and redirects unauthenticated users to `/login?callbackUrl=…`.
4. **Defense in depth** — middleware alone is not a security boundary. *Every* route handler calls `await auth()` and returns `401` when absent.
5. **Ownership** — a prediction is readable and deletable only by the user who created it. Enforced in the query filter, not in the UI.
6. **Rate limiting** — 5 failed attempts per *account* per 15 min, plus 20 per IP when a proxy identifies one. Keying on IP alone collapses to one shared bucket whenever no forwarding header is set, which would let five bad guesses lock out every user.
7. **Uniform failure** — a wrong password and a non-existent account are indistinguishable in both response and timing (a dummy bcrypt comparison runs when no user matches), so the login form cannot be used to enumerate registered emails.

### Three things that silently break this
Each cost real debugging time and is invisible once working:

- **`middleware.ts` must be inside `src/`.** At the project root it is still reported as `ƒ Proxy (Middleware)` by `next build`, yet never executes — protected pages return 200 while signed out.
- **The matcher must be a catch-all.** Listing `/dashboard/:path*` does not match the bare `/dashboard`. The config matches everything except static assets and `/api/auth`, and the `authorized` callback decides per path.
- **`AUTH_URL` must be unset in development.** Pinning it to `:3000` sends every redirect to that origin even when `next dev` has fallen back to another port. Auth.js infers the origin from the request under Next.
- **Nav items cannot be mapped in a server component.** Each carries a lucide `icon`, which is a React component — a function — and functions cannot cross the server→client boundary. `NavList` is a client component so `NAV_ITEMS` stays entirely client-side. `next build` does **not** catch this: the shell only renders for a signed-in request, which build-time prerendering never performs.

> The file convention is `src/proxy.ts`, not `middleware.ts` — Next 16 renamed it
> and warns on the old name.

---

## 6. API contract

| Method | Route | Auth | Query / Body | Returns |
|---|---|---|---|---|
| `GET` | `/api/draws` | user | `page`, `limit`, `sort`, `from`, `to` | `{ data: Draw[], total, page, limit, totalPages, stale }` |
| `GET` | `/api/stats` | user | `window?` | totals, latest draw, hot/cold, frequencies, sum & odd/even distribution |
| `GET` | `/api/predictions/generate` | user | `strategy`, `sets` (1–10), `window?` | `{ targetDrawDate, sets: PredictionSet[] }` — **not persisted** |
| `POST` | `/api/predictions` | user | `{ targetDrawDate, sets[1..10], analysisWindow? }` | `201 PredictionDTO` |
| `GET` | `/api/predictions` | user | `page`, `limit` | own predictions, newest target first, each scored if drawn |
| `DELETE` | `/api/predictions/:id` | owner | — | `204` |

Responses go through shared `ok()` / `fail(code, message)` helpers. Zod failures
return `422` with field-level messages.

---

## 7. Pages

### `/login`
Centered card, email + password, inline errors, redirect to `callbackUrl` or `/dashboard`.

### Shell layout (protected group)
Fixed left **sidebar**: brand, nav — **Dashboard**, **Previous Results**,
**Predictions** — active-route highlighting; collapses to icons under `lg`, drawer
on mobile. Topbar shows user email + sign-out.

### `/dashboard`
- Stat cards: total draws analysed, latest draw (rendered as balls), most frequent white ball, most frequent Powerball.
- `FrequencyChart` — 69-bar frequency with a hot/cold colour scale.
- `SumDistribution` — histogram of the 5-ball sum (most draws land 120–190).
- `OddEvenChart` — odd/even and high/low split ratios.
- Recent 10 draws, linking to the full list.
- A `stale` badge if the feed served a cached copy after a fetch failure.

### `/results` — read-only
- TanStack Table: Draw Date · 5 white balls as chips · Powerball chip · Sum · Odd/Even · Power Play.
- Pagination (25/50/100), date-range filter, sort by date — all applied server-side over the cached feed.
- **No entry form.** Results come from the feed; there is nothing to write.
- Loading skeleton, empty state, error state with retry.

### `/predictions`
- Persistent disclaimer banner.
- Target draw shown up front, derived from the feed (`getTargetDrawDate`).
- Strategy picker: **Hot numbers · Cold/overdue · Weighted random · Frequent pairs · Positional Markov · Neural net (TFJS) · Ensemble**.
- Analysis window (last 50 / 100 / all) and set count (**1–10**).
- **Generate** renders the sets with an `Explanation` panel per set ("61 appeared 34× in 200 draws"; "13 hasn't appeared in 47 draws"). Nothing is written yet.
- **Save prediction** persists the current sets against the target draw.
- **Saved predictions** list below: past predictions with their target date, and — once that draw has been published — an `OutcomeBadge` showing how each set actually did.

---

## 8. Prediction engine

Pure functions in `src/lib/prediction/`, each `(draws: Draw[], opts) => PredictionSet[]`,
individually unit-testable with a seeded RNG:

- **`frequency.ts`** — per-number counts over a window; hot = top-N, cold = bottom-N; weighted sampling without replacement.
- **`gaps.ts`** — draws elapsed since each number last appeared; "overdue" ranking.
- **`pairs.ts`** — 69×69 co-occurrence matrix; most common pairs/triples; consecutive runs (`14,15`) and their historical rate.
- **`markov.ts`** — positional transition matrix from draw *n* to *n+1*, sampled.
- **`ml.ts`** — TensorFlow.js:
  - *Encoding*: each draw → 69-dim multi-hot white vector + 26-dim one-hot Powerball.
  - *Input*: sliding window of the last 10 draws, flattened (950 features).
  - *Model*: `Dense(256, relu) → Dropout(0.3) → Dense(128, relu)` → two heads: `Dense(69, sigmoid)` (binary cross-entropy, top-5 by probability) and `Dense(26, softmax)`.
  - *Training*: `scripts/train-model.ts` with `@tensorflow/tfjs-node`, chronological train/val split, saved to `public/model/`. The browser only runs inference.
  - *Expectation*: with 1,379 draws and a genuinely random target, the model converges toward the uniform prior. That is the correct result, and the UI says so.
- **`ensemble.ts`** — weighted vote across strategies, ties broken by frequency.
- **`score.ts`** — given a saved prediction and the actual draw, per-set white-ball hits and Powerball hit.

---

## 9. Build milestones

| # | Milestone | Status | Deliverable / acceptance |
|---|---|---|---|
| **1** | Scaffold | ✅ **done** | Next 16 + TS + Tailwind 4, Prettier, Vitest, env files, providers. `npm run build` clean. |
| **2** | Feed + domain layer | ✅ **done** | `powerball-feed.ts`, `draw-schedule.ts`, validation schemas, shared types. **Verified live: 1,379 draws, 0 rejected, 0 invalid, cold fetch ~970ms / warm 0ms.** 50 unit tests green. |
| **3** | Persistence | ✅ **done** | `db.ts`, `User`/`Prediction` models + indexes, `seed:admin`. **Verified against Atlas:** admin created in the `powerball` database with a `$2b$12$` hash and a unique email index. |
| **4** | Auth | ✅ **done** | Auth.js split config, login page, `src/middleware.ts`, `requireUser()`. **Verified live:** signed-out `/dashboard` → 307 to `/login?callbackUrl=…`; wrong password → no session; correct password → session carrying `id` + `role`; all cookies `httpOnly`; signed-in `/login` → 302 to `/dashboard`. |
| **5** | Shell | ✅ **done** | Sidebar (icon rail at `md`, labelled at `lg`), Radix drawer below `md`, topbar, sign-out, SessionProvider, `PageHeader`. **Verified live:** all three routes 307 when signed out and 200 with full shell when signed in; active-link marker, user email and sign-out present on each; sign-out clears the cookie and re-protects. |
| **6** | Results | ✅ **done** | `/api/draws` over the cached feed, `useDraws`, table with pagination, sort and date filter. **Verified live:** 1,379 total / 460 pages, Q1-2026 filter → 38 draws, ascending sort → 2015-10-07, unauthenticated → 401. |
| **7** | Dashboard | ✅ **done** | `/api/stats`, stat cards, four charts with a validated palette + table views. **Verified live:** frequency counts total 6,895 = 5 × 1,379 exactly; odd/even buckets total the draw count; window=50 narrows correctly. |
| **8** | Predictions (stats) | ✅ **done** | Six strategies + 61 tests, generate/save/list/delete endpoints, disclaimer, scoring. **Verified live:** all strategies emit valid sorted distinct sets; scoring exact (3 hits + PB against a known draw); 11 sets and duplicate numbers both rejected 422; malformed and foreign IDs both 404. |
| **9** | Predictions (TFJS) | ✅ **done** | Training script with early stopping + best-weight restore, 288,607-parameter two-headed model, **server-side** inference. Validation metrics reported in the README. |
| **10** | Polish | ✅ **done** | Skeletons, empty/error states, toasts, table views, README. `npm run build` clean; all pages verified rendering signed-in. |

**Deviation from the original design (milestone 9):** inference runs server-side
rather than in the browser. Loading the model from disk keeps 1.1MB of weights off
the client entirely — the page only ever receives six numbers — and keeps all seven
strategies on one code path. `@tensorflow/tfjs-node` was also dropped: it pulls ~49
dependencies carrying 15 high/critical advisories, and the pure-JS CPU backend trains
this model in seconds.

---

## 10. Setup

**Environment (`.env.local`)**

```
MONGODB_URI=mongodb+srv://<user>:<pass>@<cluster>/powerball?retryWrites=true&w=majority
AUTH_SECRET=<32 random bytes, base64>
AUTH_URL=http://localhost:3000
SEED_ADMIN_EMAIL=...
SEED_ADMIN_PASSWORD=...
```

**Scripts**

```
npm run dev · build · start · lint · typecheck · format · test
npm run seed:admin      # creates the first admin user
npm run train:model     # regenerates public/model/
```

No import step — results are read live from the feed on first request.

**Testing** — Vitest runs in `node` by default (jsdom costs ~40s a run and most of
the suite is pure logic); component tests opt in per file with a
`@vitest-environment jsdom` docblock. Prediction strategies are tested with a
seeded RNG so they stay deterministic.

---

## 11. Risks

| Risk | Mitigation |
|---|---|
| Users read predictions as real forecasting | Permanent disclaimer + per-set rationale showing it is descriptive statistics |
| Third-party feed goes down or changes shape | Stale-on-error serving, strict per-row validation, rejected rows surfaced rather than swallowed |
| Feed latency on a cold cache (~1s) | 1h TTL + single-flight; the dashboard warms it on first load |
| TFJS bundle weight (~1MB+) | Dynamic `import()` on the predictions route only; never in the shared bundle |
| Thin dataset for ML (1,379 rows) | Keep the model small; report validation metrics honestly |
| Middleware alone as the security boundary | Every route handler re-checks the session server-side |
