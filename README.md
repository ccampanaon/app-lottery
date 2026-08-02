# Powerball Prediction Dashboard

A dashboard that reads historical Powerball results live from public open data,
analyses them, and stores the predictions you generate for upcoming draws.

> **Predictions here are pattern analysis, not forecasting.** Every Powerball draw
> is independent with fixed odds of 1 in 292,201,338. Nothing in this app — including
> the TensorFlow.js model — improves those odds. See [Does the model work?](#does-the-model-work)
> for the measured numbers.

---

## Quick start

```bash
npm install
cp .env.example .env.local     # then fill in MONGODB_URI and AUTH_SECRET
npm run seed:admin             # creates your login
npm run train:model            # optional — only needed for the "neural" strategy
npm run dev
```

Sign in at `http://localhost:3000/login` with the `SEED_ADMIN_EMAIL` /
`SEED_ADMIN_PASSWORD` from `.env.local`.

### Environment

| Variable | Required | Notes |
|---|---|---|
| `MONGODB_URI` | yes | Atlas connection string. **Declare it in exactly one file** — `.env.local` is read before `.env` and neither overwrites an already-set variable, so an empty declaration in one shadows a real value in the other. |
| `MONGODB_DB` | no | Defaults to `powerball`. Set explicitly because Atlas's connection string has no database segment and Mongoose silently falls back to `test`. |
| `AUTH_SECRET` | yes | `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` |
| `AUTH_URL` | no | **Leave unset in development.** Auth.js infers the origin from the request; pinning it to `:3000` breaks every redirect when `next dev` falls back to another port. |
| `SEED_ADMIN_*` | yes | Consumed once by `npm run seed:admin`. |

---

## What is stored, and what is not

Historical results are **not** stored. Powerball is a single national game published
as authoritative open data, so a local mirror could only ever drift from the source.

| Data | Where it lives |
|---|---|
| Past draws | Read live from `data.ny.gov` (Socrata `d6yy-54nr`), cached in-process for 1 hour |
| Users | MongoDB — `users` |
| Predictions | MongoDB — `predictions` |

The feed layer ([`powerball-feed.ts`](src/lib/powerball-feed.ts)) is a read-through
cache that:

- filters to draws on or after **2015-10-07**, when the current 69/26 matrix began — earlier draws used 59/35, where balls 60–69 could not be drawn at all;
- validates every row through the same Zod schema user input would face, reporting rejects rather than trusting them;
- pins Socrata's zone-less timestamps to UTC — `new Date("2026-07-22T00:00:00.000")` parses as *local* midnight, which shifts every draw back a day in any UTC+ zone;
- ignores `double_play_winning_numbers`, a separate side game that would double-count every statistic;
- serves the last good copy flagged `stale` if the upstream fetch fails, and coalesces concurrent requests into one fetch.

As of the last run that is **1,379 usable draws** out of 1,970 published.

---

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` / `build` / `start` | Next.js |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` / `format` | ESLint / Prettier |
| `npm test` | Vitest |
| `npm run seed:admin` | Create or reset the admin login |
| `npm run db:sync` | Rebuild indexes after a schema change (see below) |
| `npm run train:model` | Retrain the neural model into `public/model/` |

---

## Architecture notes

**Auth.** Auth.js v5 with a credentials provider, JWT session in an httpOnly cookie.
The config is split: [`auth.config.ts`](src/lib/auth.config.ts) is edge-safe and used
by [`src/proxy.ts`](src/proxy.ts); [`auth.ts`](src/lib/auth.ts) adds the provider that
touches Mongoose. The proxy is a redirect convenience, **not** the security boundary —
the `(app)` layout re-checks the session and every route handler calls `requireUser()`.

Login failures are uniform: a wrong password and a non-existent account are
indistinguishable in both response and timing (a dummy bcrypt comparison runs when no
user matches), so the form cannot be used to enumerate registered emails. Rate limiting
is **5 failures per account** per 15 minutes plus 20 per IP when a proxy identifies one —
keying on IP alone collapses to a single shared bucket when no forwarding header is set.

> The rate limiter is in-process. Behind multiple instances each keeps its own count;
> a real deployment should move it to Redis or Atlas.

**Charts.** The sequential ramp in [`chart-theme.ts`](src/components/dashboard/chart-theme.ts)
is six steps of one blue hue, validated against the card surface: monotone lightness,
every adjacent gap ≥ 0.06, darkest step 2.14:1 against the surface. Interpolating extra
steps fails the adjacent-lightness gate and the steps stop reading as distinct. Every
chart has a "Show data" table view — the accessibility fallback its colour encoding
leans on.

**Predictions are never deleted.** Generated numbers are sampled with a random
seed, so a deleted prediction cannot be reproduced — re-running a strategy invents
different numbers. Deletion therefore stamps `deletedAt` and every read filters on
`deletedAt: null`; the row stays. `POST /api/predictions/:id/restore` brings it
back. Three things make that hold:

- **Hard deletes throw at the model layer.** `deleteOne`, `deleteMany` and `findOneAndDelete` are blocked by pre-hooks on the Prediction schema. The only way through is the raw driver collection, which has to be reached for deliberately. This exists because a maintenance script once ran `deleteMany({ createdBy })` to reset its own fixtures and destroyed the real records for that account.
- **The unique index is partial.** `(createdBy, targetDrawDate, strategy)` is unique only `WHERE deletedAt IS NULL`, so deleting a strategy frees the key and it can be generated again, while every superseded copy is retained.
- **Test fixtures get their own user.** Never clean up by `createdBy` against a real account.

**Index changes need `npm run db:sync`.** Mongoose's `autoIndex` only *creates*
indexes — it never drops one that has been redefined. The old plain unique index
survived the switch to a partial one and kept blocking regeneration after a
delete until it was explicitly dropped.

**Schema and model changes need a dev-server restart.** Mongoose caches a compiled
model (`models.Prediction || model(...)`, required to survive Fast Refresh), and
TensorFlow.js keeps its variable registry on the global object. Neither is rebuilt
by a hot reload, so after editing a schema the running server keeps writing with the
*old* one — silently dropping any newly added field. That is not a theoretical
concern: adding `strategy` and generating without restarting wrote seven records
with `strategy: undefined`, which all collided on the same unique-index key and left
a single orphan. **Restart `next dev` after touching `src/models/` or `ml.ts`.**

**Three more things that silently break the app**, each of which cost real debugging time:

- `proxy.ts` **must live in `src/`.** At the project root it is still reported as `ƒ Proxy` by `next build` yet never runs, leaving protected pages reachable while signed out.
- **The matcher must be a catch-all.** `/dashboard/:path*` does not match the bare `/dashboard`.
- **Nav items cannot be mapped in a server component.** Each carries a lucide icon — a function — and functions cannot cross the server→client boundary. `next build` does not catch this, because the shell only renders for a signed-in request.

---

## Prediction strategies

Six statistical strategies plus the model. All are pure functions over the draw
history, tested with a seeded RNG so their output is reproducible.

| Strategy | What it does |
|---|---|
| Hot numbers | Samples from the 18 most-drawn numbers, weighted by count |
| Cold / overdue | Samples from those absent longest, weighted by gap |
| Weighted random | All 69 eligible, weighted by draw count |
| Frequent pairs | Seeds on the most-drawn pair, extends by co-occurrence |
| Positional Markov | Weights by what historically followed the latest draw |
| Ensemble | Pools 20 weighted runs across the other five |
| Neural | Samples the TFJS model's output distribution |

Each strategy *samples* rather than taking a deterministic top-five — otherwise
asking for ten sets would return the same line ten times. Every generated set ships
with a plain-language rationale, so the output reads as analysis rather than an oracle.

### The model

Two-headed network over a sliding window of the last 10 draws (950 input features):
`Dense(256, relu) → Dropout(0.3) → Dense(128, relu)`, splitting into a 69-unit
**sigmoid** head for the white balls (multi-label — five are drawn at once, so a single
softmax would wrongly model them as mutually exclusive) and a 26-way **softmax** head
for the Powerball. 288,607 parameters.

Training runs on the pure-JS CPU backend, not `@tensorflow/tfjs-node`: the native
package pulls ~49 dependencies carrying 15 high/critical advisories, and a model this
small trains in seconds either way. Inference runs **server-side**, which keeps the
1.1MB of weights off the client entirely — the browser only ever receives six numbers.

### Does the model work?

No, and it cannot. From the last training run, on a chronological validation split:

| Metric | Model | Random baseline |
|---|---|---|
| Top-5 white-ball hits per draw | 0.3544 | 0.3623 |
| Powerball accuracy | 1.46% | 3.85% |

The model is **0.0079 hits per draw worse than guessing** — statistically
indistinguishable from chance, which is the correct result for an independent uniform
draw. Trained to convergence it does worse still: validation loss climbs from 0.264 to
0.305 while training loss falls to 0.166, the model memorising noise in a target that
has none. Training stops at the validation minimum and restores those weights.

If you ever see a large positive number in that table, the split leaked — not that the
lottery was solved.

---

## Known issues

- **3 high-severity npm advisories** in production, all in `postcss` and `sharp` as bundled by Next. `npm audit fix --force` "resolves" them by downgrading to Next 9; they clear on a Next patch release instead.
- The in-process rate limiter and feed cache are per-instance; both need external storage for a multi-instance deployment.
