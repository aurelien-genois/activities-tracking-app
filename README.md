# Activities Tracking

Mobile-first web app to log daily activities (what you did, from when to when) in a few seconds,
for a single administrator. Self-hosted with Docker Compose.

## Features

- Single admin account (Credentials login, Auth.js), no registration; every page is protected.
- Login rate limit (in-memory, 15-minute sliding window, checked before any password hashing):
  5 failed attempts per IP + email, 20 per IP, 100 overall.
- Security headers on every response (CSP, `X-Frame-Options`, `nosniff`, HSTS in production...).
- Quick entry form: date, start/end time with smart defaults, category and subcategory chips,
  optional note.
- Validation on client and server (Zod): end after start, no future activity, same calendar day,
  no overlap with an existing activity (back-to-back allowed).
- Latest 10 activities below the form.
- History page: pagination, notes search, category/subcategory filters, edit and delete.
- Public health endpoint `/api/health` (checks database connectivity).

## Stack

Next.js 15 (App Router, Server Actions, standalone output), React 19, TypeScript (strict),
Tailwind CSS v3 + shadcn/ui, Prisma ORM 7 (`@prisma/adapter-pg` driver adapter), PostgreSQL 17,
Auth.js v5, Zod, Vitest + Testing Library, Playwright, Docker / Docker Compose.

## Local development

Requirements: Node.js 22, npm, Docker (for the development database).

```bash
npm install                      # also runs `prisma generate`
cp .env.example .env             # then set AUTH_SECRET, ADMIN_* and the database password
docker compose -f docker-compose.dev.yml up -d   # PostgreSQL on 127.0.0.1:${POSTGRES_PORT:-5432}
npx prisma migrate deploy        # or `npm run db:migrate` to create a new migration
npm run db:seed                  # create/update the admin account (idempotent)
npm run dev                      # http://localhost:3000
```

`DATABASE_URL` in `.env` must match the `POSTGRES_*` values used by `docker-compose.dev.yml`.

## Environment variables

See [`.env.example`](.env.example).

| Variable                                            | Used by              | Description                                                         |
| --------------------------------------------------- | -------------------- | ------------------------------------------------------------------- |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD`                     | seed                 | Admin account created/updated by the seed.                          |
| `APP_TIMEZONE`                                      | app                  | IANA time zone (default `Europe/Paris`).                            |
| `AUTH_SECRET`                                       | app                  | Auth.js secret, at least 32 characters (`openssl rand -base64 32`). |
| `AUTH_TRUST_HOST`                                   | app                  | `true` in Docker / behind a reverse proxy (Auth.js host only).      |
| `TRUST_PROXY_HOPS`                                  | app                  | Trusted proxies appending to `X-Forwarded-For` (default `0`).       |
| `DATABASE_URL`                                      | app, Prisma CLI, e2e | Local development only; composed automatically in Docker Compose.   |
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` | Docker Compose       | Database credentials (use a URL-safe password).                     |
| `POSTGRES_PORT`                                     | dev compose          | Host port of the development database (bound to `127.0.0.1`).       |
| `APP_PORT`                                          | prod compose         | Host port published for the app (default `3000`).                   |
| `APP_BIND`                                          | prod compose         | Host interface of the published port (default `127.0.0.1`).         |

## Scripts

| Script                 | Description                                          |
| ---------------------- | ---------------------------------------------------- |
| `npm run dev`          | Development server.                                  |
| `npm run build`        | Production build (standalone output).                |
| `npm run start`        | Start a production build (`next start`).             |
| `npm run lint`         | ESLint.                                              |
| `npm run format`       | Format with Prettier.                                |
| `npm run format:check` | Check formatting.                                    |
| `npm run typecheck`    | TypeScript type-check (`tsc --noEmit`).              |
| `npm run test`         | Unit and component tests (Vitest, with coverage).    |
| `npm run test:e2e`     | End-to-end tests (Playwright).                       |
| `npm run db:generate`  | Generate the Prisma client (`src/generated/prisma`). |
| `npm run db:migrate`   | Create/apply migrations in development.              |
| `npm run db:seed`      | Create or update the admin account (idempotent).     |

## Quality gate

```bash
npm run lint && npm run format:check && npm run typecheck && npm run test && npm run build
```

## CI

`.github/workflows/ci.yml` runs on every pull request and on pushes to `main` (superseded runs
are cancelled):

- **`quality`**: `npm ci`, lint, format check, typecheck, unit tests, build (no database).
- **`e2e`** (after `quality`): throwaway `postgres:17-alpine` service, `prisma migrate deploy`,
  seed, Playwright (chromium) against a production build; the HTML report and traces are uploaded
  as an artifact when the job fails. All environment values are test-only.
- **`docker`** (after `quality`): builds the `runner` and `seed` images (never pushed).

## Tests

- **Unit and component tests**: `npm run test` (Vitest + Testing Library, coverage report in
  `coverage/`).
- **End-to-end tests** (Playwright, mobile viewport). They need the development database
  (migrated and seeded) and the `.env` values; Playwright builds and starts the app itself
  (`npm run build && npm run start`) or reuses a server already running on port 3000. The specs
  delete the activities of the database they use: never point them at real data.

  ```bash
  npx playwright install --with-deps chromium   # once
  npm run test:e2e
  ```

  Set `PLAYWRIGHT_BASE_URL` to test an already running instance.

## Docker (production)

`docker-compose.yml` runs two services: `app` (Next.js standalone server, non-root) and `postgres`
(`postgres:17-alpine`, data in the `postgres_data` named volume, port **not** published on the
host). On every start the app container applies pending migrations (`prisma migrate deploy`) and
exits with an error if they fail; the seed is never run automatically.

```bash
cp .env.example .env    # set AUTH_SECRET, POSTGRES_PASSWORD, ADMIN_* (DATABASE_URL is ignored)
docker compose up -d --build
docker compose ps       # both services should become "healthy"
docker compose run --rm seed   # create/update the admin account (idempotent, re-run to rotate the password)
```

The app listens on `http://127.0.0.1:${APP_PORT:-3000}` (localhost only; set `APP_BIND=0.0.0.0`
only if it must be reachable without a local reverse proxy). Compose refuses to start if a
required variable (`AUTH_SECRET`, `POSTGRES_*`) is missing.

- **Logs**: `docker compose logs -f app` (or `postgres`).
- **Update**: `git pull && docker compose up -d --build` (migrations run on start), then
  `docker compose build seed` if you need the seed again.
- **Stop**: `docker compose down` keeps the data; `docker compose down -v` **deletes** the database
  volume.
- **Backup / restore** (no published port, run inside the container):

  ```bash
  docker compose exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > backup.dump
  docker compose exec -T postgres sh -c 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists' < backup.dump
  ```

### Reverse proxy and HTTPS

Expose the app through a reverse proxy (Caddy, Traefik, nginx...) that terminates HTTPS. The
published port is bound to `127.0.0.1` by default (`APP_BIND`) so the proxy is the only entry point.

- Keep `AUTH_TRUST_HOST=true` so Auth.js uses the `Host` / `X-Forwarded-*` headers from the proxy.
  It does not affect the login rate limiter.
- **Client IP for the login rate limiter**: set `TRUST_PROXY_HOPS` to the number of reverse proxies
  in front of the app (usually `1`). The limiter then uses the `X-Forwarded-For` entry appended by
  the outermost trusted proxy, counted from the right; values a client puts on the left are
  ignored. Each proxy must append (`proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;`
  for nginx, the default for Caddy and Traefik) or overwrite the header. Only set it when the app
  cannot be reached without the proxy, otherwise a client could forge the right-most entry.
- With the default `TRUST_PROXY_HOPS=0` every client shares one "unknown" IP bucket.
- **Lockout trade-off**: the limits (5 failures per IP + email, 20 per IP, 100 overall per 15
  minutes) bound brute force and bcrypt CPU usage, but anyone can temporarily block logins: for the
  admin email from their IP bucket, for everyone in the shared bucket when `TRUST_PROXY_HOPS=0`, or
  globally with 100 failures (several IPs needed when the client IP is known). A block lifts as
  failures leave the 15-minute window, or on restart (state is in memory). Configure
  `TRUST_PROXY_HOPS` in production so one client cannot lock out others.

## Project structure

```
src/
  app/                  Routes (App Router): (app)/ protected pages, login/, api/auth, api/health
  components/ui/        shadcn/ui components
  features/activities/  Activity schema, validation, overlap, queries, Server Actions, components
  features/auth/        Login action, credentials check, client IP, login form
  lib/                  Prisma client, env validation, date/time utils, rate limiter, security headers, seed logic
  prisma/               Prisma schema, migrations and seed script
  auth.ts, auth.config.ts, middleware.ts   Auth.js setup and route protection
e2e/                    Playwright specs
docs/                   Requirements, technical design, delivery plan
prisma.config.ts        Prisma 7 configuration (schema, migrations, seed, datasource)
Dockerfile, docker-entrypoint.sh, docker-compose.yml, docker-compose.dev.yml
```

## Categories

Categories are fixed in code (`src/features/activities/constants.ts`) and not editable in the UI.
The labels below are the values stored in the database.

| Category   | Subcategories                              |
| ---------- | ------------------------------------------ |
| MANGER     | Ptit-dej, Dej, Gouter, Dîner               |
| TRAVAIL    | Job, Formation, Création                   |
| DOMESTIQUE | Administration, Courses, Ménage, Transport |
| LOISIR     | Jeu-vidéo, Lecture, Sortir, Écouter, Sport |
| REPOS      | Dormir, Douche, Trainer                    |
| FAMILLE    | Téléphone, Discussion                      |

## Time zone

Activities are stored as UTC timestamps (`timestamptz`). Dates and times entered in the form are
interpreted in `APP_TIMEZONE` (default `Europe/Paris`), which also defines "today" and the
calendar-day rule, whatever the server or container time zone. Changing `APP_TIMEZONE` later
changes how existing activities are displayed.
