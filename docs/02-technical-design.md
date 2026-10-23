# Step 2 - Technical Design (V1)

Based on `01-requirements-analysis.md` (including validated decisions).

## 1. Architecture overview

Single Next.js 15 App Router application, PostgreSQL via Prisma 7 (driver adapter `@prisma/adapter-pg`). No separate backend, no repository/service layers.

```
Browser (mobile) ── Server Components (read: Prisma directly)
                 └─ Client Components (form, chips, dialogs) ── Server Actions (write)
                                                                   │ Zod parse → auth check → transaction
                                                                   ▼
                                                              Prisma → PostgreSQL
```

- **Reads**: Server Components query Prisma directly (recent activities, history with `searchParams`).
- **Writes**: Server Actions `createActivity`, `updateActivity`, `deleteActivity`. Each action: (1) `auth()` check, (2) Zod `safeParse`, (3) serializable transaction (overlap check + write), (4) `revalidatePath("/")` and `/history`, (5) returns `{ ok: true } | { ok: false, fieldErrors, formError }` (no throwing for expected errors).
- **Shared logic** in `src/lib` and `src/features/activities`, imported by both client and server (same Zod schema, same time utilities).
- **Route protection**: Auth.js middleware (edge-safe) + `auth()` re-check in each action and page (defence in depth).
- **Timezone**: all instants stored as UTC `timestamptz`; conversion Date+time <-> instant done in `APP_TIMEZONE` through a small `Intl.DateTimeFormat`-based util in `src/lib/datetime.ts` (no new dependency; `date-fns` v4 core has no timezone support). Client receives `APP_TIMEZONE` as a prop from the server.
- **Duration**: computed on the fly (`endAt - startAt`) by a helper.

### Key behaviours (from validated decisions)

- Default start: `endAt` of the latest activity (max `endAt`) if it falls on the form's date (today in `APP_TIMEZONE`), else `00:00`; no activity -> current time.
- Future activity (`startAt` or `endAt` > now) rejected on create and update (client + server). "Now" is injected into the validation function to keep it testable.
- Overlap: `newStart < existingEnd && newEnd > existingStart`; on update excludes own `id`.

## 2. Folder structure

```
.
├── prisma.config.ts                 # schema, migrations path, seed (tsx), DATABASE_URL
├── next.config.ts                   # output: "standalone"
├── middleware.ts                    # Auth.js edge-safe protection
├── vitest.config.ts  vitest.setup.ts
├── playwright.config.ts             # webServer: build + next start
├── eslint.config.mjs  .prettierrc  .prettierignore
├── tailwind.config.ts  postcss.config.mjs  components.json
├── Dockerfile  docker-compose.yml  docker-entrypoint.sh  .dockerignore
├── .env.example
├── .github/workflows/ci.yml
├── e2e/                             # Playwright specs + helpers
├── public/
└── src/
    ├── app/
    │   ├── layout.tsx  globals.css
    │   ├── login/page.tsx
    │   ├── (app)/                   # protected group
    │   │   ├── layout.tsx           # nav (Home / History), logout
    │   │   ├── page.tsx             # form + recent activities
    │   │   └── history/page.tsx
    │   └── api/
    │       ├── auth/[...nextauth]/route.ts
    │       └── health/route.ts      # public, SELECT 1
    ├── components/
    │   └── ui/                      # shadcn (excluded from coverage)
    ├── features/
    │   ├── activities/
    │   │   ├── constants.ts         # CATEGORIES
    │   │   ├── schema.ts            # Zod schema + filters schema
    │   │   ├── time.ts              # Date+time -> startAt/endAt, defaults, duration
    │   │   ├── overlap.ts           # pure overlap predicate + in-tx check
    │   │   ├── actions.ts           # create / update / delete Server Actions
    │   │   ├── queries.ts           # getRecent, getHistory, getLatestEnd
    │   │   └── components/          # ActivityForm, CategoryChips, RecentList, HistoryTable, EditDialog, DeleteButton, Filters
    │   └── auth/
    │       ├── actions.ts           # login/logout Server Actions
    │       └── components/LoginForm.tsx
    ├── lib/
    │   ├── prisma.ts                # adapter-pg + dev global singleton
    │   ├── env.ts                   # Zod-validated env
    │   ├── datetime.ts              # tz helpers (Intl)
    │   ├── rate-limit.ts            # in-memory limiter
    │   └── utils.ts                 # cn()
    ├── auth.ts  auth.config.ts      # Auth.js (full / edge-safe)
    ├── prisma/
    │   ├── schema.prisma
    │   ├── migrations/
    │   └── seed.ts
    ├── generated/prisma/            # Prisma 7 client output (gitignored)
    └── types/
```

Tests are co-located (`*.test.ts(x)`) next to the code; e2e in `e2e/`.

Prisma 7 specifics (to verify against official docs at Phase 3): generator `prisma-client` with explicit `output`, imports from the generated path (not `@prisma/client`), `prisma.config.ts` replaces `package.json#prisma` and does not auto-load `.env` (use `dotenv`-free approach: `process.env` + `--env-file` / Node `--env-file` in scripts, or `import "dotenv/config"` only if added; decision at Phase 3).

## 3. Authentication architecture

- Auth.js v5 (`next-auth@beta`), **Credentials** provider, **JWT** session strategy (no Session/Account tables; `@auth/prisma-adapter` unused).
- Split config:
  - `auth.config.ts`: edge-safe (pages `{ signIn: "/login" }`, `authorized` callback). Used by `middleware.ts`.
  - `auth.ts`: Credentials `authorize` (Zod-validates input, rate-limit check, `prisma.user.findUnique`, `bcryptjs.compare`). Runs on Node only.
- Middleware matcher protects everything except `/login`, `/api/auth/*`, `/api/health`, `_next/*`, static assets. Authenticated user visiting `/login` is redirected to `/`.
- **Rate limiting** (`src/lib/rate-limit.ts`): `Map<key, { failures: number[] }>` keyed by `ip + ":" + normalisedEmail`; 5 failures per 15 min sliding window; checked before the password; generic message "Too many attempts, try again later."; reset on success; periodic cleanup of expired keys. IP from `x-forwarded-for` (first value) / `x-real-ip`, only when `AUTH_TRUST_HOST` is set. Clock injectable for tests.
- Credential errors always the same generic message ("Invalid email or password"); on unknown email a dummy bcrypt compare is run to reduce timing differences.
- **Seed** (`src/prisma/seed.ts`, run by `tsx`): reads `ADMIN_EMAIL` / `ADMIN_PASSWORD` (explicit error if missing), `bcryptjs.hash` (cost 12), `prisma.user.upsert({ where: { email }, update: { passwordHash }, create })`, never logs the password.
- Cookies: Auth.js defaults (httpOnly, sameSite=lax, secure in production behind HTTPS). `AUTH_SECRET` required.

## 4. Database design

Schema exactly as specified (User, Activity; timestamps only; indexes on `startAt`, `category`, `subcategory`). Mapped to `timestamptz` (Prisma `DateTime` -> `timestamp(3)` by default on PostgreSQL; UTC values stored, to be validated in Phase 3: use `@db.Timestamptz(3)` for `startAt`/`endAt` if it does not alter the specified model semantics - flagged for approval).

- **Concurrency**: `prisma.$transaction(fn, { isolationLevel: "Serializable" })`:
  1. `findFirst({ where: { id: { not: id }, startAt: { lt: newEnd }, endAt: { gt: newStart } } })`
  2. if found -> return overlap error (message includes conflicting activity times);
  3. else `create` / `update`.
     Serialization failures (`P2034`) are retried up to 3 times, then returned as a generic "Please retry" error.
- **Queries**:
  - Recent: `orderBy { startAt: "desc" }, take: 10`.
  - Latest end: `findFirst orderBy { endAt: "desc" }`.
  - History: `where` built from validated filters (`q` -> `notes contains, mode insensitive`; `category`; `subcategory`), `orderBy { startAt: "desc" }`, `skip/take` 20, plus `count` for pagination.
- **Migrations**: Prisma Migrate in `src/prisma/migrations`; initial migration only (no raw SQL, no exclusion constraint in V1).
- **Prisma client**: `src/lib/prisma.ts` - `new PrismaClient({ adapter: new PrismaPg({ connectionString }) })`, cached on `globalThis` outside production.

## 5. Validation strategy

- One shared Zod 4 schema `activityFormSchema` in `features/activities/schema.ts`:
  - input: `{ date: "yyyy-MM-dd", startTime: "HH:mm", endTime: "HH:mm", category, subcategory, notes? }`
  - field rules: required messages; `category` enum from `Object.keys(CATEGORIES)`; `notes` max 1000 (empty string -> undefined).
  - `superRefine`: subcategory must belong to `CATEGORIES[category]` (issue on `subcategory` path); `endTime > startTime` (issue on `endTime`); end not `00:00`; (same-day is implied since both times share one date).
  - Future check and conversion to instants live in a second step `toActivityInterval(values, timezone, now)` (pure, returns `{ startAt, endAt }` or errors) so the schema stays pure/time-independent and the check uses the same `now` injection on client and server.
- Used in: client form (inline messages, submit disabled until valid/pending), `createActivity`, `updateActivity`. Server is the source of truth; client re-uses it for fast feedback.
- Overlap is server-only (needs DB), surfaced as `formError`; the client also performs a best-effort check against the recent list loaded in the page (optional, not required).
- History filters: `historyFilterSchema` (`q` max 100, `category` in keys, `subcategory` in `CATEGORIES[category]`, `page` int >= 1); invalid values are ignored/reset instead of throwing.
- Env validated at startup via `src/lib/env.ts` (Zod).

## 6. Testing strategy

| Level     | Tool                                           | Scope                                                                                                                                                                                                                                                                     |
| --------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit      | Vitest (node)                                  | Zod schema (all rules), overlap predicate (partial, contained, back-to-back, self-exclusion), time util (DST days in Europe/Paris, midnight, future check), duration, defaults (decision 1), rate limiter (limit, window expiry, reset on success), env, category helpers |
| Component | Vitest + jsdom + RTL + user-event              | Category chips, subcategory filtering, form reset after save (action mocked), validation messages, recent list rendering                                                                                                                                                  |
| E2E       | Playwright (chromium, mobile viewport 390x844) | login, create + appears in recent, overlap rejected, edit, delete                                                                                                                                                                                                         |

- Coverage: `@vitest/coverage-v8`, `coverage.include: ["src/lib/**", "src/features/**"]`, exclude tests/`src/app/**`/`src/components/ui/**`/generated; thresholds 80% (lines, functions, statements, branches) so `npm run test` fails below it. Server Actions and DB-dependent code mock Prisma in unit tests and are covered end-to-end.
- `npm run test` = Vitest only; e2e via `npm run test:e2e`. E2E uses a seeded DB; each spec cleans activities (via Prisma in `beforeEach`) for determinism. Time-sensitive e2e avoid future-time checks by using past dates.

## 7. Docker architecture

- **Dockerfile** (Node 22 alpine/slim, multi-stage):
  1. `deps`: `npm ci`.
  2. `build`: copy source, `prisma generate`, `next build` (standalone).
  3. `runner`: non-root user; copies `.next/standalone`, `.next/static`, `public`, `src/prisma` (schema + migrations), `prisma.config.ts`, and the minimal `node_modules` needed for `prisma migrate deploy` (prisma CLI + its config deps); `docker-entrypoint.sh`.
- **Entrypoint**: `set -e; npx prisma migrate deploy; exec node server.js` - container exits non-zero if migration fails.
- **docker-compose.yml**:
  - `postgres`: `postgres:17-alpine`, env `POSTGRES_USER/PASSWORD/DB` from `.env`, named volume `postgres_data`, healthcheck `pg_isready -U $POSTGRES_USER -d $POSTGRES_DB` (interval 10s, timeout 5s, retries 5), `restart: unless-stopped`, no published port.
  - `app`: built from Dockerfile, `DATABASE_URL` composed from `POSTGRES_*` (host `postgres`), `AUTH_SECRET`, `AUTH_TRUST_HOST`, `APP_TIMEZONE`; `depends_on: postgres: condition: service_healthy`; healthcheck `wget -qO- http://localhost:3000/api/health`; `restart: unless-stopped`; port 3000 published.
- Seed run explicitly: `docker compose run --rm app npm run db:seed` (requires the runner to include `tsx`, `bcryptjs` and the seed file - decision: include them in the runner or provide a dedicated `seed` target; settled in Phase 9).
- `.env.example` documented, `.env` gitignored; `.dockerignore` excludes `node_modules`, `.next`, `.git`, `.env*`, `e2e`, docs, test artifacts.
- Optional `docker-compose.dev.yml` (postgres only, published on localhost) for local development.

## 8. CI/CD strategy

`.github/workflows/ci.yml`, trigger `pull_request` (plus `push` to main optional), Node 22 with npm cache.

- **`quality`**: `npm ci`, `npm run lint`, `npm run format:check`, `npm run typecheck`, `npm run test`, `npm run build` (placeholder env values for build, e.g. `AUTH_SECRET`, `DATABASE_URL`, so env validation does not fail build; env validation must be lazy or skipped at build).
- **`e2e`** (`needs: quality`): `postgres:17` service container with `pg_isready` health check; job env `DATABASE_URL`, `AUTH_SECRET`, `AUTH_TRUST_HOST`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `APP_TIMEZONE` (test-only values); steps: `npm ci`, `npx prisma migrate deploy`, `npx prisma db seed`, `npx playwright install --with-deps chromium`, `npm run test:e2e`; `actions/upload-artifact` of `playwright-report/` on failure.
- Playwright `webServer`: `npm run build && npm run start` (production), `reuseExistingServer: !process.env.CI`.
- **CD**: out of scope for V1 (self-hosted, deployed manually with `docker compose up -d`). A Docker image build check (`docker build`) can be added to CI as a follow-up in Phase 10 if time allows (satisfies Definition of Done "image builds").

## 9. Decisions (validated)

1. `@db.Timestamptz(3)` on `startAt` / `endAt`.
2. `postgres:17-alpine` and Node 22 alpine.
3. Seed in Docker via a separate `seed` Dockerfile build target (runner stays minimal).
4. Native `Intl` for timezone handling; add `@date-fns/tz` only if `Intl` proves insufficient during Phase 4.
5. CI includes a `docker build` check job.
