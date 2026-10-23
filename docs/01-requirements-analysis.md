# Step 1 - Requirements Analysis (V1)

## Functional requirements

| ID    | Requirement                                                                                                                                                                                           |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-1  | Single admin account, Credentials login (Auth.js), no registration; all routes protected, unauthenticated users redirected to login. `/api/health` is public.                                          |
| FR-2  | Admin created by idempotent seed (`upsert` on email, bcrypt hash, password rotated on re-run, fails if `ADMIN_EMAIL`/`ADMIN_PASSWORD` missing). Never run automatically.                              |
| FR-3  | Login rate limit: 5 failed attempts / 15 min per IP+email, in-memory, generic error, checked before password, reset on success.                                                                      |
| FR-4  | Create activity: Date (default today), Start (default = end of latest activity, else now), End (default now), category chip, subcategory chip (filtered by category), optional note (<= 1000 chars). |
| FR-5  | After save: toast "Activity saved", form reset (start = saved end, end = now, no category/subcategory, empty note).                                                                                   |
| FR-6  | Recent activities (latest 10, most recent first) below the form, shown as `HH:mm - HH:mm` and `Category > Subcategory`.                                                                               |
| FR-7  | `/history`: pagination, sort by date desc, edit, delete, notes search, category and subcategory filters (validated against `CATEGORIES`).                                                             |
| FR-8  | Edit uses the same Zod schema and overlap check as creation, excluding the edited activity. Delete needs no overlap check.                                                                           |
| FR-9  | Validation (Zod): required date/start/end, end > start, not in the future, same calendar day (no crossing midnight, end 00:00 next day refused), category in keys, subcategory in `CATEGORIES[category]`, notes <= 1000. |
| FR-10 | Overlap rule: `newStart < existingEnd && newEnd > existingStart`; back-to-back allowed; clear message; client + server (mandatory) validation.                                                       |
| FR-11 | Categories are fixed constants in code (keys = stored labels), not editable in UI.                                                                                                                    |

Out of scope: analytics, reporting, AI, registration, multi-user, Recharts charts (installed only).

## Non-functional requirements

- **Mobile-first UX**: entry form fits a phone viewport without scrolling, single column, large chips and touch targets, save button always visible, notes visually de-emphasised. Goal: log an activity in < 10 s.
- **Security**: hashed passwords, generic credential errors, rate limiting, server-side authorization on every action/page, secrets only via env, no `.env` committed.
- **Integrity**: overlap check + write atomic (serializable transaction); no DB exclusion constraint in V1.
- **Quality**: TS `strict`, ESLint, Prettier, Vitest > 80% coverage on `src/lib` and `src/features`, RTL component tests, Playwright e2e (login, create, overlap, edit, delete).
- **Simplicity**: single Next.js app, Server Components by default, Server Actions, Prisma only, no repository/service layers.
- **Deployability**: `docker compose up -d` yields a working app (migrations on start, healthchecks, non-root, persisted volume, Postgres not published).
- **CI**: `quality` job (lint, format:check, typecheck, test, build) then `e2e` job with Postgres service.

## Technical constraints

- Next.js 15 (App Router), React 19, TypeScript, Tailwind v3 (do not upgrade), shadcn/ui, Prisma 7, PostgreSQL, `next-auth@beta`, Zod.
- Prisma 7: `prisma.config.ts` at root (schema, migrations, seed, `DATABASE_URL`), `@prisma/adapter-pg`, single `src/lib/prisma.ts` with dev global singleton, new generator/import path (check docs first), seed via `tsx`.
- Dependencies already installed; Playwright browsers and shadcn components not yet.
- Schema fixed: timestamps only (`startAt`, `endAt`), no stored date or duration.
- `next.config.ts` with `output: "standalone"`; Node 22 image; `test` script runs Vitest only.
- Env: `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `APP_TIMEZONE=Europe/Paris`, `DATABASE_URL`, `AUTH_SECRET`, `AUTH_TRUST_HOST`, `POSTGRES_*`.
- Installed versions are newer than the prompt's baseline (e.g. TypeScript 6, Vitest 5, Zod 4, lucide-react 1.x, `@vitejs/plugin-react` 6, jsdom 30): compatibility must be checked at bootstrap.

## Risks

| #   | Risk                                                                                                                                                      | Mitigation                                                                                                      |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| R1  | Timezone/DST bugs converting Date + time to `startAt`/`endAt` in `APP_TIMEZONE` (spring/autumn Paris changes, ambiguous/non-existent local times).        | Single date util in `src/lib` (date-fns + tz handling), unit tests on DST days; server and client use same util. |
| R2  | Concurrent writes create overlaps.                                                                                                                        | Serializable transaction with retry on serialization failure (`P2034`); no exclusion constraint in V1.          |
| R3  | Prisma 7 / Next 15 / Auth.js v5 beta / TS 6 / Vitest 5 breaking changes (generator path, ESM config, adapter-pg, edge runtime incompatibilities).        | Read official docs before coding; Prisma and bcrypt not imported in middleware (edge); split Auth.js config.    |
| R4  | Auth.js middleware runs on edge and cannot use Prisma/bcrypt.                                                                                             | Split `auth.config.ts` (edge-safe) from `auth.ts` (credentials authorize); use JWT sessions.                    |
| R5  | In-memory rate limiter is lost on restart and not shared across instances; IP spoofing via headers.                                                      | Accepted for V1; trust proxy headers only with `AUTH_TRUST_HOST`; document.                                     |
| R6  | "No scroll" form plus keyboard and persistent save button on small viewports.                                                                             | Compact layout, sticky save bar, test on 360x640 viewport in Playwright.                                        |
| R7  | Client "default start = last end" can be stale (other device/tab).                                                                                        | Compute on server render and after each save; server re-validates overlap anyway.                               |
| R8  | Coverage threshold (> 80%) failing `npm test` due to scope config.                                                                                        | Configure `coverage.include` / thresholds early; keep logic in `src/lib` and `src/features`.                    |
| R9  | Docker: migrations in runner need Prisma CLI and config (TS config needs `tsx`/deps in the image); standalone output tracing misses Prisma engines files. | Verify the image builds and migrates early (Phase 9); copy required node_modules explicitly.                    |
| R10 | Unicode/accents in categories (`Dîner`, `Création`, `Écouter`) in URL filters and DB values.                                                              | Use exact constant values; test filters with accented values.                                                   |
| R11 | Zod 4 API differences (`superRefine` path issues, error format).                                                                                          | Verify against Zod 4 docs; test schema thoroughly.                                                              |

## Assumptions

1. One user, one instance, one timezone (`APP_TIMEZONE`, default Europe/Paris); UI language mixes English labels (form fields, toasts) with French category labels, as specified.
2. Time inputs have minute precision; seconds are 0. `endAt` of 00:00 next day is refused; 23:59 is the latest valid end.
3. "Latest activity" = activity with the greatest `endAt`; see decision 1 for the cross-day case.
4. History pagination is page-based (e.g. 20 per page) with filters in URL search params; search on notes is case-insensitive "contains".
5. Sessions use JWT strategy; `@auth/prisma-adapter` is installed but not required because only the `User` model exists (no Account/Session tables in the given schema).
6. Edit is done in the history page (dialog or inline page), not on the home screen.
7. Duration is computed on the fly (e.g. in the UI or helper), never stored.
8. Past dates may be entered (backfill allowed); future dates/times are rejected on creation (decision 2). Whether editing is also blocked from moving an activity into the future is assumed yes (same schema).
9. Deleting is permanent (hard delete) with a confirmation prompt.
10. `npm run format` rewrites files; the quality gate runs it, then `format:check` in CI verifies.

## Decisions (validated)

1. Default start: end of the latest activity if it ended on the form's date (today); if it ended on a previous day, default start is 00:00.
2. Future-dated activities are blocked on creation with an error message (client + server). A time later than now on today's date counts as future.
3. History page size: 20.
4. No PostgreSQL exclusion constraint / `btree_gist` in V1; atomicity relies on the serializable transaction only.

## Preparation done (no code, no installs)

`package.json` scripts added: `dev`, `build`, `start`, `lint`, `format`, `format:check`, `typecheck`, `test` (Vitest with coverage), `test:e2e`, `db:seed` (`prisma db seed`; the seed command itself will live in `prisma.config.ts`). The scripts will not work until the config files are created in Phase 1.
