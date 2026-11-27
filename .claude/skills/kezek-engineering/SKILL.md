---
name: kezek-engineering
description: How to change the Kezek monorepo safely — layout, commands, pre-commit gates, line endings, i18n, API contracts, migrations, commits and the owner's standing product decisions. Load before editing code, dictionaries, docs or SQL in this repo.
---

# Working in the Kezek repo

Kezek is an online booking and business-cabinet service for salons in Osh (Kyrgyzstan). The owner is the
only human; agents do the engineering. Russian is the primary UI language, Kyrgyz (ky) and English (en)
are full translations. Talk to the owner in Russian; write code, comments and commit messages in English.

## Layout

- `apps/web` — Next.js 16 on Vercel (prod: https://kezek.vercel.app; kezek.kg was lost, never point at it).
  API routes in `src/app/api/**/route.ts`, services in `src/lib`, dictionaries in
  `src/app/_components/i18n/dictionaries/*.{ru,ky,en}.ts` (server messages: `server*.ts`).
- `apps/mobile` — Expo SDK 54 / React Native app for clients, masters (staff) and business owners.
  Super-admin is web only — never add admin screens to the app. Design system: `src/constants/theme.ts`,
  `src/components/ui/*`, rules in `docs/mobile/UI_GUIDE.md`. Dictionaries `src/i18n/dictionaries/*.{ru,ky,en}.ts`.
  The app calls Supabase directly and the web API with a Bearer token (`createSupabaseServerClient` reads it).
- `packages/core-domain`, `packages/shared-client` — shared logic and formatters.
- `supabase/migrations` — squashed baseline `20261009110000_prod_baseline.sql` + later migrations.
- Key docs: `docs/OWNER_ACTIONS.md` (what only the owner can do), `docs/PROJECT_REVIEW_2026-11-25.md`
  (latest review, R25-xx ids), `docs/api/*.md` (API contracts), `docs/DOMAIN_LOSS_RUNBOOK.md`,
  `apps/web/src/lib/notifications/README.md`, `AGENTS.md`, `CONTRIBUTING.md`.

## Commands (run from the app folder)

- Mobile: `npx tsc --noEmit -p .`, `npx jest --silent` (CI runs `pnpm test:runInBand` on Linux, slower — give
  `findBy*` waits on heavy screens `{ timeout: 5000 }`).
- Web: `npx tsc --noEmit -p .`, `npx jest --silent` (~2 min, 4.4k tests), `pnpm -C apps/web lint`.
- Visual baselines (`apps/web/e2e/visual-regressions.spec.ts-snapshots/*-linux.png`) are Linux-only; an
  intended UI change needs a re-shoot in the Playwright container or the CI artifact's `*-actual.png`
  (look at it before committing). See `apps/web/e2e/README.md`.

## Pre-commit gates (husky) and how to satisfy them

Typecheck, doc links, OpenAPI freshness, i18n, encoding. When a gate fails:
- `ROUTE_CATALOG.md ... stale` / `openapi.json is stale` → from repo root:
  `node scripts/generate-api-catalog.mjs --write` and `pnpm -s generate:openapi`, then re-stage.
- New API route → add a `<!-- api-contract: METHOD /api/path -->` section in the right `docs/api/*.md`
  (copy the table format of a neighbour), then regenerate.
- i18n "untranslated text grew" → no Russian string literals in code; use dictionary keys in all three
  locales (server messages: import the value from `serverX.ru.ts`, `withErrorHandler` localizes it).
  Plural keys need `.one/.few/.many` in ru, ky and en and must be registered in
  `apps/mobile/src/__tests__/i18n/plural.test.ts`.
- Never bypass hooks (`--no-verify`).

## Line endings — the trap that bites here

`core.autocrlf=true` and many files are CRLF or mixed. **Never edit with `sed -i`** (it rewrites endings
and produces whole-file diffs). Edit with the Edit tool or a small node script that keeps `\r\n`.
After any scripted edit run `git diff --stat`; if a one-line change shows hundreds of lines, restore the
file with `git cat-file -p HEAD:<path> > <path>`, re-apply the edit with node, and if staging still
normalizes, stage raw bytes: `git update-index --cacheinfo 100644,$(git hash-object -w --no-filters <path>),<path>`.

## Commits and shipping

- Finished work is merged/pushed straight to `main` (owner's rule). Ask first only when a change affects
  production data, prod env vars, payments or anything irreversible.
- Several agents may share one working tree and one git index: stage and commit **only your files**
  (`git commit -- <paths>` or `git add <paths>`), never `git add -A` of others' work, never stash/reset others'.
- Message: imperative summary `fix(mobile): ...` / `fix(web): ...` / `fix(i18n): ...`, a body explaining the
  user-visible why, and the trailer line the session asks for.
- After pushing, CI status is public: `https://api.github.com/repos/adakhannn/kezek/actions/runs?branch=main`.

## Data, prod and safety

- Prod Supabase ref `beulnmftzbmtbdlgurht`; it is unreachable from the owner's network without a proxy/VPN.
  Migrations to prod only with the owner's go-ahead, verified with rolled-back probes (see memory/notes).
- Never run e2e against prod, never type passwords/tokens/OTP codes, never do financial actions, never
  put PII in the repo. Test data lives in «Тестовый бизнес 1/2».

## Owner decisions to respect (do not re-litigate)

- Booking statuses everywhere (app, site, notifications): «В ожидании / Подтверждено / Выполнено /
  Отменено / Не пришёл». There is no payment — never «Оплачено/Paid».
- A master creating a booking sees only the services they perform.
- English: «Business dashboard», «Staff workspace», «My account»; money in English is «som».
- Visit ranges «10:00–11:00» (en dash, no spaces); date+time «27 нояб. • 19:00»; month under a day number
  in genitive («27 ноября»).
- The booking confirmation step is the confirmation — no second «Создать запись?» dialog.
- Russian copy addresses the user as «вы», uses «ё».
- App and site must behave the same; when they differ, align them (and check which one is right).
