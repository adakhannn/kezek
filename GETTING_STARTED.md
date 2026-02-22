# Быстрый старт — Kezek

Краткий гайд для новых разработчиков: установка, окружение и первые команды.

---

## 1. Установка

**Требования:** Node.js 18+, pnpm.

```bash
git clone <repo-url>
cd kezek
pnpm install
```

Монорепозиторий содержит:
- **apps/web** — Next.js (дашборд, бронирование, API)
- **apps/mobile** — Expo / React Native
- **packages/shared-client**, **packages/core-domain** — общий код

---

## 2. Переменные окружения

Единый гайд по переменным (web, mobile, интеграции): **[ENV_GUIDE.md](ENV_GUIDE.md)**.

### Web (`apps/web`)

1. Скопируйте шаблон и создайте локальный env:
   ```bash
   cp apps/web/.env.example apps/web/.env.local
   ```
2. Заполните в `.env.local` минимум:
   - `NEXT_PUBLIC_SUPABASE_URL` — URL проекта Supabase
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` — anon-ключ Supabase
   - `SUPABASE_SERVICE_ROLE_KEY` — service role ключ (из Supabase Dashboard → Settings → API)
   - `NEXT_PUBLIC_SITE_ORIGIN` — например `http://localhost:3000`
   - `RESEND_API_KEY` и `EMAIL_FROM` — для отправки писем (иначе часть флоу не будет работать)

Подробный список переменных — в `apps/web/.env.example` и в [apps/web/README.md](apps/web/README.md). Опционально: мониторинг ошибок (Sentry) — см. [PROJECT_DOCUMENTATION.md](PROJECT_DOCUMENTATION.md) (раздел «Мониторинг ошибок»).

### Mobile (`apps/mobile`)

1. Скопируйте шаблон:
   ```bash
   cp apps/mobile/.env.example apps/mobile/.env.local
   ```
2. Заполните:
   - `EXPO_PUBLIC_SUPABASE_URL`
   - `EXPO_PUBLIC_SUPABASE_ANON_KEY`
   - `EXPO_PUBLIC_API_URL` — URL веб-приложения (например `https://kezek.kg` или ваш tunnel)

Подробнее: [ENV_GUIDE.md](ENV_GUIDE.md) (раздел «2. Mobile»).

---

## 3. Первые команды

### Запуск web

```bash
pnpm -C apps/web dev
```

Откройте [http://localhost:3000](http://localhost:3000).

### Запуск mobile

```bash
pnpm -C apps/mobile start
```

Дальше — сканирование QR в Expo Go или запуск эмулятора (см. [apps/mobile/README.md](apps/mobile/README.md)).

### Проверка кода (web)

```bash
pnpm -C apps/web lint
pnpm -C apps/web typecheck
pnpm -C apps/web test:coverage
```

Порог покрытия тестов — 40%. При изменении критичных флоу запускайте E2E:

```bash
pnpm -C apps/web test:e2e
```

### Проверка кода (mobile)

```bash
pnpm -C apps/mobile test
```

(Smoke-тесты: рендер экранов, навигация.)

---

## 4. Документация

| Документ | Назначение |
|----------|------------|
| [CONTRIBUTING.md](CONTRIBUTING.md) | Как вносить изменения, тесты, чеклист перед PR |
| [PROJECT_DOCUMENTATION.md](PROJECT_DOCUMENTATION.md) | Архитектура, структура кода, домены |
| [TESTING_GUIDE.md](TESTING_GUIDE.md) | Роли, сценарии тестов, E2E |
| [FEATURE_MATRIX.md](FEATURE_MATRIX.md) | Модули, статусы, следующие задачи |
| [apps/web/README.md](apps/web/README.md) | Web: команды, env, структура |
| [apps/mobile/README.md](apps/mobile/README.md) | Mobile: запуск, env |

API-документация (Swagger): после запуска web — [http://localhost:3000/api-docs](http://localhost:3000/api-docs).

---

## 5. Частые проблемы

- **«Missing Supabase environment variables»** — проверьте, что `.env.local` в нужной папке (`apps/web` или `apps/mobile`) и переменные заданы (для web — перезапустите dev-сервер).
- **Тесты падают по покрытию** — порог 40%; добавьте тесты для нового/изменённого кода или временно правьте порог в `jest.config.js` (согласуйте с командой).
- **E2E требуют тестовые данные** — см. [apps/web/e2e/README.md](apps/web/e2e/README.md), там описан `.env.local` для E2E (опционально).

Если чего-то не хватает — смотрите [CONTRIBUTING.md](CONTRIBUTING.md) и [PROJECT_DOCUMENTATION.md](PROJECT_DOCUMENTATION.md).
