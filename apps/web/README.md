# Kezek Web

Веб-приложение Kezek: публичное бронирование, дашборд бизнеса, кабинет сотрудника, админка и API.

**Стек:** Next.js 16 (App Router), React 19, TypeScript, Tailwind 4, Supabase.

---

## Запуск (монорепозиторий)

Из **корня репозитория**:

```bash
pnpm install
pnpm -C apps/web dev
```

Откройте [http://localhost:3000](http://localhost:3000). Используется Turbopack.

Локальная разработка без `pnpm -C apps/web` возможна из папки `apps/web`:

```bash
cd apps/web
pnpm install
pnpm dev
```

---

## Переменные окружения

Создайте `apps/web/.env.local` (см. `.env.example` в этой папке). Основные переменные:

| Переменная | Описание |
|------------|----------|
| `NEXT_PUBLIC_SUPABASE_URL` | URL проекта Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Anon-ключ Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Service Role ключ (только сервер, не в клиенте) |
| `NEXT_PUBLIC_SITE_ORIGIN` | Origin сайта (например `http://localhost:3000`) |
| `NEXT_PUBLIC_TZ` | Таймзона (по умолчанию `Asia/Bishkek`) |
| `RESEND_API_KEY` | Ключ Resend для email |
| `EMAIL_FROM` | Адрес отправителя писем |

Опционально: WhatsApp, Telegram, Yandex OAuth, SMS (Twilio), Upstash Redis, cron-секреты. Подробнее — в [CONTRIBUTING.md](../../CONTRIBUTING.md) и [PROJECT_DOCUMENTATION.md](../../PROJECT_DOCUMENTATION.md).

---

## Полезные команды

| Команда | Описание |
|---------|----------|
| `pnpm -C apps/web dev` | Запуск dev-сервера (Turbopack) |
| `pnpm -C apps/web build` | Сборка для production |
| `pnpm -C apps/web start` | Запуск production-сборки |
| `pnpm -C apps/web lint` | Линтер |
| `pnpm -C apps/web typecheck` | Проверка типов |
| `pnpm -C apps/web test` | Unit/integration тесты |
| `pnpm -C apps/web test:coverage` | Тесты с отчётом покрытия (порог 45%) |
| `pnpm -C apps/web test:e2e` | E2E (Playwright) |

---

## Документация проекта

- **[CONTRIBUTING.md](../../CONTRIBUTING.md)** — как вносить изменения, тесты, чеклист перед PR.
- **[PROJECT_DOCUMENTATION.md](../../PROJECT_DOCUMENTATION.md)** — обзор архитектуры, структура кода, домены.
- **[GETTING_STARTED.md](../../GETTING_STARTED.md)** — быстрый старт для новых разработчиков (установка, env, первые шаги).
- **[TESTING_GUIDE.md](../../TESTING_GUIDE.md)** — роли, сценарии тестов, E2E.
- **API:** Swagger доступен по `/api-docs` при запущенном приложении.

---

## Структура (кратко)

- `src/app/` — App Router: страницы, API routes, layout.
- `src/app/api/` — API (бронирования, сотрудники, уведомления, cron и т.д.).
- `src/app/dashboard/` — дашборд бизнеса (брони, сотрудники, финансы, смены).
- `src/app/b/[slug]/` — публичная страница бронирования по slug бизнеса.
- `src/lib/` — утилиты, Supabase-клиент, env, логирование, доменная логика.

Подробнее — в [PROJECT_DOCUMENTATION.md](../../PROJECT_DOCUMENTATION.md).
