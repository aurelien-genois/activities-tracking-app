# GitHub Copilot Prompt

## Context

Build a self-hosted personal activity tracking web application.

The application is intended for a **single user only**.

The goal is to record daily activities throughout the day from a smartphone with minimal friction.

The application must be mobile-first and optimized for very fast activity entry.

The user is the only account and administrator.

V1 focuses exclusively on:

- recording activities
- viewing recent activities
- viewing history
- editing activities
- deleting activities
- preventing overlapping activities

Analytics, reporting and AI features are explicitly out of scope for V1.

# Implementation Process

Before generating any code, follow the process below.

## Step 1 - Requirements Analysis

Analyse the requirements and identify:

- functional requirements
- non-functional requirements
- technical constraints
- potential risks
- assumptions

Do not generate code yet.

Produce a concise analysis document.

## Step 2 - Technical Design

Produce a technical design document covering:

- architecture overview
- folder structure
- authentication architecture
- database design
- validation strategy
- testing strategy
- Docker architecture
- CI/CD strategy

Do not generate code yet.

Wait for validation.

## Step 3 - Delivery Plan

Produce a phased implementation roadmap.

Example:

```
1  Phase 1 - Project Bootstrap
2  Phase 2 - Authentication
3  Phase 3 - Database & Prisma
4  Phase 4 - Validation & Overlap Detection (Zod schema, categories constants, date/timestamp logic, overlap check, with unit tests)
5  Phase 5 - Activity Entry Form
6  Phase 6 - Recent Activities
7  Phase 7 - History Page
8  Phase 8 - Automated Tests (component and end-to-end tests; unit tests are written in the phase that introduces the code)
9  Phase 9 - Dockerization
10 Phase 10 - CI Pipeline
```

For each phase provide:

- objectives
- deliverables
- files impacted
- dependencies
- acceptance criteria

Do not generate code yet.

Wait for validation.

## Step 4 - Incremental Development

Implement only one phase at a time.

After each phase:

- explain architectural decisions
- list files created
- list files modified
- identify risks
- propose a git commit message

Then stop and wait for validation before starting the next phase.

## Step 5 - Quality Gate

Before considering any phase complete, verify:

```bash
npm run lint
npm run format
npm run typecheck
npm run test
npm run build
```

All commands must pass successfully.

## Step 6 - Definition of Done

A feature is considered complete only if:

- requirements are implemented
- tests pass
- type-checking passes
- linting passes
- formatting passes
- Docker image builds successfully
- docker compose starts successfully

# Technical Stack

Use the following stack:

- Next.js 15 (App Router)
- React 19
- TypeScript
- Tailwind CSS v3 (shadcn/ui is compatible with v3; do not upgrade to v4)
- shadcn/ui
- Prisma ORM 7 (see Prisma 7 requirements below)
- PostgreSQL
- Auth.js (`next-auth@beta`, v5)
- Zod
- Recharts (install now but do not build analytics yet)
- Docker
- Docker Compose

Already installed in the repository (do not reinstall; only configure):

- runtime: `next`, `react`, `react-dom`, `@prisma/client`, `@prisma/adapter-pg`, `pg`, `next-auth`, `@auth/prisma-adapter`, `bcryptjs`, `zod`, `date-fns`, `recharts`, `clsx`, `tailwind-merge`, `class-variance-authority`, `lucide-react`, `tailwindcss-animate`
- dev: `typescript`, `prisma`, `tailwindcss@3`, `postcss`, `autoprefixer`, `eslint`, `eslint-config-next`, `typescript-eslint`, `prettier`, `prettier-plugin-tailwindcss`, `tsx`, `vitest`, `@vitest/coverage-v8`, `@vitejs/plugin-react`, `jsdom`, `@testing-library/react`, `@testing-library/dom`, `@testing-library/jest-dom`, `@testing-library/user-event`, `@playwright/test`
- not installed yet: the Playwright browsers (`npx playwright install --with-deps chromium`) and the shadcn/ui components (`npx shadcn@latest init`, then add components as needed)

Prisma 7 requirements:

- `prisma.config.ts` at the repository root defines the schema path, migrations path, seed command and datasource URL (from `DATABASE_URL`)
- the Prisma client is created with the `@prisma/adapter-pg` driver adapter (`new PrismaClient({ adapter })`), in a single `src/lib/prisma.ts` module with a development-time global singleton
- check the generator and import path for the Prisma 7 client in the official documentation before writing the schema, as they differ from Prisma 5/6
- the seed script is run with `tsx`

# Architecture Principles

Follow these principles:

- Single Next.js application
- No separate backend repository
- Use Server Actions whenever appropriate
- Prefer Server Components by default
- Use Client Components only where interaction is required
- Use Prisma as the only database access layer
- Strong TypeScript typing everywhere
- Avoid over-engineering
- Avoid repository patterns
- Avoid unnecessary service layers
- Keep the codebase simple and understandable

Recommended structure:

```
src/
├── app/
├── components/
├── features/
│   ├── activities/
│   └── auth/
├── lib/
├── prisma/
└── types/
```

# Authentication

Implement authentication with Auth.js.

Requirements:

- Single admin account
- Credentials authentication
- Login page
- Protected routes
- Redirect unauthenticated users to login

Store credentials using hashed passwords.

Do not implement user registration.

A seed script should create the administrator account.

Seed requirements:

- reads `ADMIN_EMAIL` and `ADMIN_PASSWORD` from the environment and fails with a clear error if either is missing
- idempotent: uses `prisma.user.upsert` keyed on `email`, so running it several times never creates duplicates or fails
- the password is hashed with `bcryptjs` before being stored; the plain password is never stored or logged
- when the user already exists, the password hash is updated, so that changing `ADMIN_PASSWORD` and re-running the seed rotates the password
- the seed is never run automatically on application start

Login rate limiting:

- limit failed login attempts to 5 per 15 minutes per IP address and email combination; further attempts are rejected with a generic message ("Too many attempts, try again later.") before the password is checked
- a simple in-memory limiter in `src/lib` is sufficient (single user, single instance); no Redis or external service
- the limiter state resets on application restart, which is accepted for V1
- credential errors never reveal whether the email or the password was wrong
- add unit tests for the limiter (limit reached, window expiry, reset after successful login)

Environment variables:

```
ADMIN_EMAIL=
ADMIN_PASSWORD=
APP_TIMEZONE=Europe/Paris
DATABASE_URL=
AUTH_SECRET=
AUTH_TRUST_HOST=
POSTGRES_*=
```

# Mobile UX Requirements

The activity entry screen is the primary screen of the application.

The entire form should fit on a modern smartphone viewport without scrolling whenever possible.

Requirements:

- mobile-first design
- single-column layout
- large touch targets
- large category chips
- large subcategory chips
- save button always visible

The notes field must have lower visual priority.

# Activity Categories

Categories are fixed and must not be editable through the UI.

Store categories as constants in code.

```ts
export const CATEGORIES = {
  MANGER: ["Ptit-dej", "Dej", "Gouter", "Dîner"],
  TRAVAIL: ["Job", "Formation", "Création"],
  DOMESTIQUE: ["Administration", "Courses", "Ménage", "Transport"],
  LOISIR: ["Jeu-vidéo", "Lecture", "Sortir", "Écouter", "Sport"],
  REPOS: ["Dormir", "Douche", "Trainer"],
  FAMILLE: ["Téléphone", "Discussion"],
} as const;
```

Keys are the exact labels displayed on the chips and the exact values stored in `Activity.category` (no separate label mapping). Subcategory values are stored as-is in `Activity.subcategory`.

# Activity Creation Form

The activity creation form must contain:

## Date

Field:

```
Date
```

Rules:

- required
- default value = today

## Start Time

Field:

```
Start Time
```

Rules:

- required
- default value = end time of the latest activity
- if no activity exists, default value = current time

## End Time

Field:

```
End Time
```

Rules:

- required
- default value = current time
- must be greater than start time
- must be on the same calendar day as the start time (activities cannot cross midnight in V1)

Date handling:

- `Date` is a form-only field and is not stored in the database
- `startAt` and `endAt` are computed from `Date` + `Start Time` / `End Time` in the `APP_TIMEZONE` timezone
- the date shown when displaying or editing an activity is derived from `startAt` in `APP_TIMEZONE`
- an activity that needs to cross midnight must be entered as two activities (the last one ending at 23:59 is acceptable, 00:00 of the next day is not allowed as an end time)

## Main Category

Display as chips.

Example:

```
[Manger]
[Travail]
[Domestique]
[Loisir]
[Repos]
[Famille]
```

Single selection only.

## Subcategory

Display as chips.

Only show subcategories belonging to the selected main category.

Example:

```
Travail selected

[Job]
[Formation]
[Création]
```

Single selection only.

## Note

Field:

```
Optional note
```

Rules:

- optional
- maximum 1000 characters

## Save Behaviour

After successful save:

Show notification:

```
Activity saved
```

Immediately reset the form:

- date = today
- start time = end time of saved activity
- end time = current time
- category = none selected
- subcategory = none selected
- notes = empty

The user must be able to immediately enter the next activity.

# Recent Activities

Display recent activities directly below the form.

Show the latest 10 activities.

Example:

```
09:00 - 10:00
Travail > Job

10:00 - 10:30
Manger > Dej
```

Order:

- most recent first

# History Page

Create a dedicated page:

```
/history
```

Features:

- pagination
- sort by date descending
- edit activity
- delete activity
- search in notes
- filter by category
- filter by subcategory

# Validation Rules

Use Zod.

Rules:

```
Date is required.

Start time is required.

End time is required.

End time must be after start time.

Activity cannot cross midnight.

Category is required.

Subcategory is required.

Subcategory must belong to the selected category.

Notes maximum 1000 characters.
```

Category and subcategory rules:

- `category` must be one of the keys of `CATEGORIES`
- `subcategory` must be one of `CATEGORIES[category]`
- implement the cross-field check with `superRefine` (or `refine`) on the shared Zod schema, attached to the `subcategory` path
- the same schema is used client-side, in the create action and in the edit action
- the history filters (category / subcategory) are validated against the same constants

# Overlap Detection

Activities must not overlap.

Example:

Existing activity:

```
09:00 -> 10:00
```

New activity:

```
09:30 -> 10:30
```

The activity must be rejected.

Overlap rule:

- two activities overlap if `newStart < existingEnd && newEnd > existingStart`
- back-to-back activities are allowed (existing `09:00 -> 10:00`, new `10:00 -> 11:00` is valid)
- this is required because the default start time is the end time of the previous activity

The check and the insert/update must run atomically on the server (single Prisma transaction, serializable isolation or equivalent), so that concurrent requests cannot create overlapping activities.

Optionally, add a PostgreSQL exclusion constraint on the `tstzrange(startAt, endAt)` as a database-level safety net (requires the `btree_gist` extension and a raw SQL migration).

Display a clear validation message.

Validation must be performed:

- client-side
- server-side

Server-side validation is mandatory.

Edit behaviour:

- editing an activity uses the same Zod schema and the same overlap check as creation
- the activity being edited is excluded from the overlap check (it must not conflict with itself)
- the overlap check and the update run atomically, like on creation
- editing is allowed to change date, start time, end time, category, subcategory and notes
- deleting an activity never requires an overlap check

# Prisma Database Model

Use the following Prisma schema.

Do not store redundant date fields.

Use timestamps only.

```prisma
model User {
  id           String   @id @default(cuid())
  email        String   @unique
  passwordHash String

  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}

model Activity {
  id          String   @id @default(cuid())

  startAt     DateTime
  endAt       DateTime

  category    String
  subcategory String

  notes       String?

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([startAt])
  @@index([category])
  @@index([subcategory])
}
```

Notes:

- startAt represents the beginning of the activity.
- endAt represents the end of the activity.
- Do not store activityDate.
- Do not store derived duration values.
- Duration must always be calculated dynamically.

Generate:

- Prisma schema
- migrations
- seed script
- Prisma client configuration

# Docker

Create production-ready Docker files.

Provide:

```
Dockerfile
docker-compose.yml
```

Services:

```
app
postgres
```

Persist PostgreSQL data using Docker volumes.

Docker requirements:

- `next.config.ts` sets `output: "standalone"`
- multi-stage `Dockerfile` (dependencies, build, runner) based on a Node 22 slim/alpine image; the runner copies only the standalone output, `public`, `.next/static`, the Prisma schema/migrations/config and what is needed to run `prisma migrate deploy`; it runs as a non-root user
- the `app` container runs `prisma migrate deploy` on startup (entrypoint script), then starts `node server.js`; the container must exit with an error if the migration fails
- the seed script is not run automatically on every start; it must be idempotent (upsert the admin) and be run explicitly (for example `docker compose run --rm app npm run db:seed`, or an equivalent documented command)
- `postgres` has a healthcheck (`pg_isready -U $POSTGRES_USER -d $POSTGRES_DB`) with interval, timeout and retries
- `app` has `depends_on: postgres` with `condition: service_healthy`
- `app` has its own healthcheck against a lightweight unauthenticated endpoint (`/api/health`, which also checks database connectivity)
- `restart: unless-stopped` on both services
- PostgreSQL port is not published to the host in the production compose file; secrets come from an `.env` file (provide `.env.example`, never commit `.env`)
- add a `.dockerignore`

# Testing Strategy

Use:

- Vitest
- React Testing Library
- Playwright

## Unit Tests

Test:

- Zod validation schema
- overlap detection
- date calculations
- start/end timestamp logic
- activity duration calculations

Target:

```
> 80% coverage on src/lib and src/features
```

Coverage is measured with `@vitest/coverage-v8`, restricted through `coverage.include` to `src/lib/**` and `src/features/**` (UI-only files such as `src/app/**` and generated shadcn components in `src/components/ui/**` are excluded). The `test` script fails if the threshold is not met.

## Component Tests

Test:

- category chip selection
- subcategory filtering
- form reset after save
- validation messages
- recent activity rendering

## End-to-End Tests

### Login

```
User logs in successfully
```

### Create Activity

```
User creates an activity

Activity appears in recent activities
```

### Overlap Rejection

```
User creates an overlapping activity

Validation error is displayed
```

### Edit Activity

```
User edits an activity successfully
```

### Delete Activity

```
User deletes an activity successfully
```

# Code Quality

Install and configure:

## ESLint

Use:

```
eslint
typescript-eslint
eslint-config-next
```

CI must fail on linting errors.

## Prettier

Configure:

```
prettier
prettier-plugin-tailwindcss
```

Format:

- TypeScript
- TSX
- JSON
- Markdown
- YAML

## TypeScript

Use:

```json
{
  "strict": true
}
```

CI must fail if type-checking fails.

Command:

```bash
npm run typecheck
```

# GitHub Actions

Create:

```
.github/workflows/ci.yml
```

On every pull request execute:

```bash
npm ci
npm run lint
npm run format:check
npm run typecheck
npm run test
npm run build
```

The workflow must fail if any step fails.

The workflow contains two jobs:

1. `quality` (no database needed), runs the commands above.
2. `e2e` (runs after `quality` succeeds), uses a `postgres` service container and executes:

```bash
npm ci
npx prisma migrate deploy
npx prisma db seed
npx playwright install --with-deps chromium
npm run test:e2e
```

E2E job requirements:

- `DATABASE_URL`, `AUTH_SECRET`, `AUTH_TRUST_HOST`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` and `APP_TIMEZONE` are set as job environment variables (test-only values, never real secrets)
- the Postgres service has a health check, and the job waits for it
- Playwright starts the app itself through the `webServer` option of `playwright.config.ts` (production build + `next start`)
- the Playwright HTML report is uploaded as an artifact when the job fails
- the `test` script runs Vitest only (unit and component tests); end-to-end tests run through `npm run test:e2e`

# Deliverables

Generate:

- complete Next.js application
- Prisma schema
- database migrations
- authentication
- responsive UI
- Docker configuration
- automated tests
- CI pipeline
- README

The application must be fully functional after:

```bash
docker compose up -d
```

and ready for local development with:

```bash
npm install
npm run dev
```

# Success Criteria

The application is considered successful if:

1. A user can log an activity from a smartphone in less than 10 seconds.
2. Activities can be entered sequentially throughout the day.
3. Overlapping activities are prevented.
4. The application is secure, tested, and deployable via Docker.
5. The codebase remains simple, maintainable, and ready for future analytics features.
