# Step 3 - Delivery Plan (V1)

Each phase is implemented alone, then stops for validation with: decisions, files created/modified, risks, commit message. Quality gate per phase: `lint`, `format`, `typecheck`, `test`, `build` (tests/build pass once their tooling exists, from Phase 1).

| #   | Phase                               |
| --- | ----------------------------------- |
| 1   | Project Bootstrap                   |
| 2   | Database & Prisma                   |
| 3   | Authentication                      |
| 4   | Validation & Overlap Detection      |
| 5   | Activity Entry Form                 |
| 6   | Recent Activities                   |
| 7   | History Page                        |
| 8   | Automated Tests (component and e2e) |
| 9   | Dockerization                       |
| 10  | CI Pipeline                         |

Order note: Prisma comes before Authentication (the login needs the `User` model and the client); this swaps phases 2 and 3 from the prompt's example.

## Phase 1 - Project Bootstrap

- **Objectives**: runnable empty Next.js app with all tooling configured and the quality scripts passing.
- **Deliverables**: Next 15 app shell, TS strict, Tailwind v3, shadcn/ui init (`npx shadcn@latest init`, Tailwind v3 compatible) plus first components (button, input, textarea, sonner/toast, dialog, select, label), ESLint flat config, Prettier (+ tailwind plugin, TS/TSX/JSON/MD/YAML), Vitest (+ coverage thresholds, jsdom, RTL setup), Playwright config (webServer, mobile viewport), `next.config.ts` (`standalone`), `.env.example`, `.gitignore` update, a trivial passing test, `src/lib/utils.ts`, `src/lib/env.ts` (lazy validation), Playwright browsers install.
- **Files**: `tsconfig.json`, `next.config.ts`, `tailwind.config.ts`, `postcss.config.mjs`, `components.json`, `eslint.config.mjs`, `.prettierrc`, `.prettierignore`, `vitest.config.ts`, `vitest.setup.ts`, `playwright.config.ts`, `.env.example`, `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`, `src/components/ui/*`, `src/lib/utils.ts`, `src/lib/env.ts`; modifies `package.json`, `.gitignore`.
- **Dependencies**: none (dependencies already installed; check TS 6 / Vitest 5 / plugin-react 6 compatibility).
- **Acceptance**: `npm run dev` serves the page; `lint`, `format:check`, `typecheck`, `test` (coverage thresholds configured, passing on the sample), `build` succeed; `test:e2e` runs a smoke test.

## Phase 2 - Database & Prisma

- **Objectives**: schema, initial migration, client, seed.
- **Deliverables**: `src/prisma/schema.prisma` (User, Activity, Prisma 7 generator, `Timestamptz(3)`), `prisma.config.ts`, initial migration, `src/lib/prisma.ts` singleton with adapter-pg, `src/prisma/seed.ts` (idempotent upsert, hash, env checks), `docker-compose.dev.yml` (local Postgres), `/api/health` route (SELECT 1), unit test for seed logic (extracted pure function with injected client) and health.
- **Files**: `prisma.config.ts`, `src/prisma/{schema.prisma,seed.ts,migrations/*}`, `src/lib/prisma.ts`, `src/app/api/health/route.ts`, `docker-compose.dev.yml`, `.env.example`, `package.json` (if needed), `.gitignore` (generated client).
- **Dependencies**: Phase 1; Docker (local Postgres) for migration.
- **Acceptance**: `prisma migrate dev` creates tables; `npm run db:seed` run 3 times leaves exactly 1 user, rotates password on change, fails clearly without env vars; `/api/health` returns 200 / 503 when DB down.

## Phase 3 - Authentication

- **Objectives**: single-admin credentials login, protected routes, rate limiting.
- **Deliverables**: `auth.config.ts`, `auth.ts`, `middleware.ts`, `/api/auth/[...nextauth]`, `/login` page + `LoginForm`, logout action, `(app)` protected layout with nav, `src/lib/rate-limit.ts` with unit tests (limit reached, window expiry, reset on success), generic error messages, dummy compare on unknown email.
- **Files**: `src/auth.ts`, `src/auth.config.ts`, `src/middleware.ts`, `src/app/login/page.tsx`, `src/app/(app)/layout.tsx`, `src/app/api/auth/[...nextauth]/route.ts`, `src/features/auth/**`, `src/lib/rate-limit.ts(+test)`, `src/types/next-auth.d.ts`.
- **Dependencies**: Phases 1, 2.
- **Acceptance**: unauthenticated access redirects to `/login`; valid login reaches `/`; invalid credentials give one generic message; 6th failed attempt returns "Too many attempts, try again later." before password check; `/api/health` stays public; limiter tests pass.

## Phase 4 - Validation & Overlap Detection

- **Objectives**: all pure domain logic, fully unit-tested.
- **Deliverables**: `constants.ts` (`CATEGORIES`, types), Zod schemas (activity, history filters) with `superRefine`, `datetime.ts` / `time.ts` (Date+time to `startAt`/`endAt` in `APP_TIMEZONE` via `Intl`, instant to date/time, DST handling, future check with injected `now`, defaults incl. decision 1, duration), overlap predicate and in-transaction check function, retry on `P2034`, Server Actions `create/update/delete` (validated, authorized, atomic), queries (`getRecent`, `getLatestEnd`, `getHistory`).
- **Files**: `src/features/activities/{constants,schema,time,overlap,actions,queries}.ts` + tests, `src/lib/datetime.ts` + test.
- **Dependencies**: Phases 2, 3.
- **Acceptance**: unit tests cover every validation rule, overlap cases (partial, contained, identical, back-to-back allowed, self-exclusion on edit), DST days in Europe/Paris, midnight rule, future rejection, durations; coverage > 80% on the touched files; actions tested with mocked Prisma.

## Phase 5 - Activity Entry Form

- **Objectives**: mobile-first primary screen.
- **Deliverables**: home page (Server Component loading defaults) with `ActivityForm` (Client): date/start/end inputs, category and subcategory chips (large touch targets), note field with low visual priority, sticky always-visible Save, inline validation messages (shared schema), overlap/future error display, "Activity saved" toast, form reset (start = saved end, end = now, selections cleared), pending state.
- **Files**: `src/app/(app)/page.tsx`, `src/features/activities/components/{ActivityForm,CategoryChips}.tsx`, `src/components/ui/*` additions.
- **Dependencies**: Phase 4.
- **Acceptance**: form fits a 390x844 (and 360x640 where possible) viewport without scrolling; save blocked with clear messages on invalid input; successful save shows toast and resets as specified; creation takes under 10 s of interaction.

## Phase 6 - Recent Activities

- **Objectives**: show latest 10 below the form.
- **Deliverables**: `RecentList` Server Component (`HH:mm - HH:mm`, `Category > Subcategory`, optional duration), ordering most recent first, revalidation after create/edit/delete, empty state.
- **Files**: `src/features/activities/components/RecentList.tsx`, `src/app/(app)/page.tsx`, `queries.ts` tweaks.
- **Dependencies**: Phases 4, 5.
- **Acceptance**: list updates immediately after saving; max 10 items; times shown in `APP_TIMEZONE`.

## Phase 7 - History Page

- **Objectives**: browse, filter, edit, delete.
- **Deliverables**: `/history` with 20 per page pagination, sort by date desc, notes search (case-insensitive), category and subcategory filters (URL search params, validated), edit dialog (same schema, same overlap check excluding self, same future rule), delete with confirmation, empty/error states.
- **Files**: `src/app/(app)/history/page.tsx`, `src/features/activities/components/{HistoryList,Filters,Pagination,EditActivityDialog,DeleteActivityButton}.tsx`, `queries.ts`, `actions.ts` (if adjustments).
- **Dependencies**: Phases 4, 5 (form fields reused for edit).
- **Acceptance**: filters and search combine and persist in URL; invalid params ignored; edit rejects overlap/future; delete removes the row without overlap checks; page 2 appears beyond 20 entries.

## Phase 8 - Automated Tests (component and e2e)

- **Objectives**: complete the test pyramid and coverage target.
- **Deliverables**: RTL tests (chip selection, subcategory filtering, form reset after save, validation messages, recent rendering); Playwright specs: login, create (appears in recent), overlap rejection, edit, delete; e2e DB cleanup helpers; coverage > 80% on `src/lib` and `src/features` enforced.
- **Files**: `src/features/**/**/*.test.tsx`, `e2e/*.spec.ts`, `e2e/helpers.ts`, `vitest.config.ts`, `playwright.config.ts`.
- **Dependencies**: Phases 3 to 7, running Postgres.
- **Acceptance**: `npm run test` passes with thresholds; `npm run test:e2e` passes locally against a seeded DB.

## Phase 9 - Dockerization

- **Objectives**: production image and compose stack working with one command.
- **Deliverables**: multi-stage `Dockerfile` (deps, build, runner non-root, separate `seed` target), `docker-entrypoint.sh` (migrate then `node server.js`, fails on migration error), `docker-compose.yml` (app + postgres, volume, healthchecks, `depends_on: service_healthy`, `restart: unless-stopped`, Postgres unpublished), `.dockerignore`, finalised `.env.example`, README (setup, dev, Docker, seed command, env vars).
- **Files**: `Dockerfile`, `docker-compose.yml`, `docker-entrypoint.sh`, `.dockerignore`, `.env.example`, `README.md`.
- **Dependencies**: Phases 1 to 8, Docker available.
- **Acceptance**: `docker build` succeeds; `docker compose up -d` gives healthy services; `docker compose run --rm` seed target creates the admin; login works; data survives `docker compose down` / `up`; app exits with an error if migration fails.

## Phase 10 - CI Pipeline

- **Objectives**: automatic checks on every pull request.
- **Deliverables**: `.github/workflows/ci.yml` with `quality` (`npm ci`, lint, format:check, typecheck, test, build), `e2e` (needs quality; Postgres service with health check; migrate, seed, Playwright chromium install, `test:e2e`; HTML report artifact on failure) and `docker` job (`docker build` check); test-only env values.
- **Files**: `.github/workflows/ci.yml`, minor README update.
- **Dependencies**: Phases 8, 9.
- **Acceptance**: workflow YAML valid (prettier-checked); every step fails the workflow on error; all jobs pass on a PR (verified after push).

## Cross-cutting

- Every phase adds its own unit tests (coverage from Phase 4 onward) and keeps docs current.
- Commits follow one message per phase and include the `Co-authored-by: Copilot` trailer.
