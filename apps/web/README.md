# Kezek Web

The web app is the main product surface for:

- public booking
- business dashboard
- staff workspace
- admin tools
- API routes

Stack:

- Next.js 16 App Router
- React 19
- TypeScript
- Tailwind 4
- Supabase

## Run

From the repository root:

```bash
pnpm install
pnpm -C apps/web dev
```

Open `http://localhost:3000`.

You can also work from `apps/web` directly:

```bash
cd apps/web
pnpm install
pnpm dev
```

## Core Commands

```bash
pnpm -C apps/web dev
pnpm -C apps/web build
pnpm -C apps/web start
pnpm -C apps/web lint
pnpm -C apps/web typecheck
pnpm -C apps/web test
pnpm -C apps/web test:coverage
pnpm -C apps/web test:e2e
```

Current unit/integration coverage gate:

- source of truth: `apps/web/jest.config.js`
- minimum threshold: `60%` for statements, branches, functions, and lines

## Environment

Create `apps/web/.env.local`.

Important variables:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_SITE_ORIGIN`
- `NEXT_PUBLIC_TZ`
- `RESEND_API_KEY`
- `EMAIL_FROM`

Additional integrations such as WhatsApp, Telegram, Yandex OAuth, Redis, and cron secrets depend on the feature set you are working on.

## Project Structure

- `src/app`: pages, layouts, and route handlers
- `src/app/api`: API routes
- `src/components`: shared UI
- `src/lib`: services, validation, infrastructure helpers, repositories
- `src/__tests__`: unit and integration tests
- `e2e`: Playwright scenarios

## Architecture Notes

The current web direction is:

- thin route handlers
- HTTP-layer parsing and response mapping in dedicated services
- business orchestration below the route layer
- domain logic moved into shared packages where reuse is justified

For the route pattern, see:
[HOWTO_NEW_API_ENDPOINT.md](/C:/projects/kezek/apps/web/src/lib/HOWTO_NEW_API_ENDPOINT.md)

## Main Documentation

- [README.md](/C:/projects/kezek/README.md): repo overview
- [docs/README.md](/C:/projects/kezek/docs/README.md): main docs index
- [GETTING_STARTED.md](/C:/projects/kezek/GETTING_STARTED.md): onboarding and setup
- [PROJECT_DOCUMENTATION.md](/C:/projects/kezek/PROJECT_DOCUMENTATION.md): technical architecture
- [CONTRIBUTING.md](/C:/projects/kezek/CONTRIBUTING.md): contribution rules
- [TESTING_GUIDE.md](/C:/projects/kezek/TESTING_GUIDE.md): testing workflow
- [docs/PROJECT_REVIEW_ACTION_TASKS_2026-03-30.md](/C:/projects/kezek/docs/PROJECT_REVIEW_ACTION_TASKS_2026-03-30.md): current review-driven improvement backlog
