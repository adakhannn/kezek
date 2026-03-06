# Пошаговый гайд по первому запуску Kezek

Этот гайд проводит через первый запуск проекта: от клонирования репозитория до первого успешного запроса через API / первой брони в веб‑интерфейсе.

## 1. Клонирование репозитория и установка зависимостей

```bash
git clone <repo-url>
cd kezek
pnpm install
```

Что делает:
- скачивает код проекта;
- ставит все пакеты монорепозитория (web, mobile, пакеты).

Подробнее: `GETTING_STARTED.md` (раздел «Установка»).

## 2. Настройка окружения (env)

### 2.1. Web (`apps/web`)

1. Скопируйте шаблон:

```bash
cp apps/web/.env.example apps/web/.env.local
```

2. Минимально заполните:

- `NEXT_PUBLIC_SUPABASE_URL` — URL вашего проекта Supabase;
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — anon‑ключ;
- `SUPABASE_SERVICE_ROLE_KEY` — service role ключ (только на сервере);
- `NEXT_PUBLIC_SITE_ORIGIN` — например `http://localhost:3000`;
- `RESEND_API_KEY`, `EMAIL_FROM` — для отправки писем (опционально, но нужно для части флоу).

Подробнее: `ENV_GUIDE.md` и `apps/web/.env.example`.

### 2.2. Mobile (`apps/mobile`) — по желанию

```bash
cp apps/mobile/.env.example apps/mobile/.env.local
```

Заполните:
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `EXPO_PUBLIC_API_URL` (обычно продовый или туннель на локальный web).

Подробнее: `ENV_GUIDE.md`, `apps/mobile/README.md`.

## 3. Подготовка базы данных / Supabase

### 3.1. Использование существующего облачного проекта Supabase

Если у вас уже есть развернутый Supabase‑проект для Kezek:
- убедитесь, что URL и ключи из Supabase Dashboard совпадают с указанными в `.env.local`;
- миграции и данные уже должны быть применены (см. `supabase/README.md`, `supabase/APPLY_MIGRATIONS.md` при необходимости).

### 3.2. Локальный Supabase (опционально)

При желании можно поднять локальный Supabase, следуя `supabase/README.md`:
- запустить локальный инстанс;
- применить миграции;
- прописать локальные URL/ключи в `.env.local`.

## 4. Запуск web‑приложения

```bash
pnpm -C apps/web dev
```

Откройте в браузере:

- `http://localhost:3000` — публичная часть / редирект в нужный кабинет;
- `http://localhost:3000/admin` — админские разделы (при наличии нужной роли);
- `http://localhost:3000/api-docs` — Swagger UI для API (если включён).

Проверки:
- страница открывается без ошибок «Missing Supabase env»;
- базовый маршрут `/` редиректит в нужный кабинет или экран выбора.

## 5. Первый запрос через API

### Вариант A: через Swagger (`/api-docs`)

1. Зайдите на `http://localhost:3000/api-docs`.
2. Найдите, например, endpoint `GET /api/me/current-business` или `GET /api/admin/health-check` (для суперадмина).
3. Авторизуйтесь, если требуется (Bearer токен или cookie, в зависимости от настройки).
4. Нажмите «Try it out» → «Execute» и убедитесь, что получаете 200 OK.

### Вариант B: через curl

Пример запроса health‑check (при наличии прав и настроек):

```bash
curl -X GET "http://localhost:3000/api/admin/health-check" \
  -H "Authorization: Bearer <ACCESS_TOKEN>"
```

Или более простой публичный/полу‑публичный endpoint в зависимости от вашего окружения (см. `API_DOCUMENTATION.md`).

## 6. Первая бронь через веб‑интерфейс

1. Залогиньтесь под тестовым пользователем (см. `TESTING_GUIDE.md` / `E2E_TESTING.md` для примеров данных).
2. Перейдите на публичную страницу бронирования:
   - `/b/{businessSlug}` или другой маршрут, описанный в `SYSTEM_FEATURES_DOCUMENTATION.md`.
3. Пройдите шаги:
   - выбрать филиал;
   - выбрать услугу и мастера;
   - выбрать дату и время;
   - ввести данные клиента;
   - подтвердить бронь.
4. Убедитесь, что бронь появляется:
   - в кабинете клиента;
   - в кабинете сотрудника / дашборде (в зависимости от сценария).

Если нужен готовый сценарий, можно ориентироваться на `apps/web/e2e/booking-flow.spec.ts`.

## 7. Где смотреть дальше

- **Архитектура и домены:** `PROJECT_DOCUMENTATION.md`, `SYSTEM_FEATURES_DOCUMENTATION.md`.
- **Тесты и сценарии:** `TESTING_GUIDE.md`, `E2E_TESTING.md`, `SCENARIO_TEST_REGISTRY.md`.
- **Мониторинг и здоровье системы:** `MONITORING_AND_ANALYTICS.md`, `MONITORING_AND_ALERTS.md`, `EVOLUTION_TECH_PLAN.md` §4.

