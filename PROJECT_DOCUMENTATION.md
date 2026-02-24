# Kezek — Документация проекта

## 1. Технологии и окружение

### Frontend
- **Next.js** (App Router), React/TypeScript
- Server/Client Components
- `dynamic = 'force-dynamic'` для динамических страниц

### Auth
- **Supabase Auth** (email OTP + SMS OTP)

### Database
- **Supabase Postgres** + **PostGIS** (география филиалов)
- RLS-политики, функции (RPC)

### Email
- **Resend** (триггеры уведомлений + .ics вложение)

### Time/TZ
- `date-fns` + `date-fns-tz`
- TZ = `Asia/Bishkek`

### Карты
- **Яндекс-карта** для выбора координат филиала

### Деплой/локалка
- `.env` задаёт `SITE_ORIGIN` и supabase-константы
- Для dev — `localhost:3000`

### Важные env-переменные (.env.local)

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...      # только на сервере!

# Таймзона
NEXT_PUBLIC_TZ=Asia/Bishkek

# Базовый origin
NEXT_PUBLIC_SITE_ORIGIN=http://localhost:3000

# Email/Resend
RESEND_API_KEY=...
EMAIL_FROM="Kezek <noreply@mail.kezek.kg>"

# Мониторинг (опционально): см. раздел «Мониторинг ошибок»
# NEXT_PUBLIC_SENTRY_DSN=https://...@....ingest.sentry.io/...
# SENTRY_ORG=...  SENTRY_PROJECT=...  SENTRY_AUTH_TOKEN=...
```

---

## 2. Структура кода (главное)

```
apps/web/src/app/
  _components/
    AuthPanel (AuthPanelLazy подключается динамически)
    AuthStatusServer.tsx              # серверный виджет «Вы вошли / Кабинет / Выйти»
    SignOutButton.tsx

  [slug]/
    page.tsx                          # сервер: грузит данные бизнеса (+ветки/услуги/сотрудники)
    view.tsx                          # клиент: весь UX бронирования, фильтры и hold/confirm

  booking/[id]/...                    # страница просмотра брони (была использована в редиректе)

  auth/
    sign-in/page.tsx                  # выбор режима: телефон/почта, отправка OTP
    verify/page.tsx                   # ввод кода (универсально)
    callback/route.ts                 # email-redirect завершение

  dashboard/
    ... клиентский кабинет (ClientCabinet + BookingCard)
    staff/[id]/{page,StaffForm,TransferStaffDialog,StaffServicesEditor,DangerActions}.tsx
    staff/[id]/schedule ...           # расписание мастера
    staff/[id]/slots ...              # свободные слоты мастера

  admin/
    businesses/[id]/branches/
      new/page.tsx                    # создание филиала (с выбором на карте)
      [branchId]/edit/page.tsx        # редактирование филиала
    api/businesses/[id]/branches/create/route.ts    # INSERT + coords (EWKT)
    api/businesses/[id]/branches/[branchId]/update/route.ts # UPDATE + coords (EWKT)

  api/
    staff/[id]/update/route.ts        # правки профиля сотрудника
    staff/[id]/transfer/route.ts      # перевод между филиалами (история назначений)
    notify/route.ts                   # отправка писем (hold/confirm/cancel) + ICS

lib/
  authBiz.ts        # getBizContextForManagers: проверка роли и извлечение bizId
  supabaseService.ts# серверный сервис-клиент (service key) для административных операций
  time.ts           # todayTz, dateAtTz, enumerateSlots, toLabel, TZ
  ics.ts            # buildIcs
  ...
```

---

## 3. Схема БД (основное)

### businesses
- `id` uuid PK
- `name` text, `slug` text UNIQUE
- `phones` text[], `address` text
- `coords` geography(Point,4326) (опц.)
- `categories` text[] DEFAULT '{barbershop}'
- `tz` text DEFAULT 'Asia/Bishkek'
- `plan` text DEFAULT 'pro'
- `is_approved` bool DEFAULT true
- `owner_id` uuid REFERENCES auth.users
- `email_notify_to` text[] — список адресов для уведомлений

### branches
- `id` uuid PK, `biz_id` uuid FK -> businesses
- `name` text, `address` text
- `coords` geography(Point,4326) + сгенерированные колонки:
  - `lat` double precision DEFAULT st_y((coords)::geometry)
  - `lon` double precision DEFAULT st_x((coords)::geometry)
- `is_active` bool DEFAULT true
- `created_at` timestamptz DEFAULT now()

**Вставка/обновление координат** идёт строкой EWKT:
```
SRID=4326;POINT(lon lat)
```
PostgREST сам приведёт к geography.

### staff
- `id` uuid PK, `biz_id` uuid FK, `branch_id` uuid FK
- `full_name` text, `email` text, `phone` text
- `skills` text[], `is_active` bool, `user_id` uuid (опц.)

**Кэш поле `branch_id`** — «текущий» филиал для быстрого доступа (историчность хранится отдельно, см. ниже).

### services
- `id` uuid PK, `biz_id` uuid FK, `branch_id` uuid FK
- `name_ru` text, `name_ky` text, `duration_min` int (>0)
- `price_from` int, `price_to` int
- `active` bool

### service_staff (многие-ко-многим)
- `service_id` uuid, `staff_id` uuid, `is_active` bool DEFAULT true
- PK (service_id, staff_id)

На клиенте мы читаем `service_staff` и строим `Map<service_id, Set<staff_id>>` для фильтрации доступных мастеров под услугу.

### bookings
- `id` uuid PK, `biz_id`, `branch_id`, `service_id`, `staff_id` — FK
- `client_id` uuid REFERENCES auth.users
- `status` booking_status DEFAULT 'hold' (hold|confirmed|paid|cancelled)
- `start_at` timestamptz, `end_at` timestamptz, `expires_at` timestamptz
- `time_range` tstzrange DEFAULT tstzrange(start_at, end_at, '[)')
- `client_phone` text, `client_name` text
- `created_at` timestamptz DEFAULT now()

Индексы по `staff_id/start_at` и т.п. (есть)

### Важные RPC (функции)

#### `hold_slot(p_biz_id, p_branch_id, p_service_id, p_staff_id, p_start)`
Резервирует слот (status = hold, TTL ≈ 2 минуты). Проверяет занятость/пересечения.

#### `confirm_booking(p_booking_id)`
Переводит в confirmed (и в нотифайке уходит письмо + .ics).

(есть и отмена, если нужно — через статус cancelled).

### reviews
- `id` uuid PK, `booking_id` uuid UNIQUE, `client_id` uuid
- `rating` smallint 1..5, `comment` text, `created_at`, `updated_at`

### working_hours
- `id` uuid PK, `biz_id`, `staff_id`, `day_of_week` smallint(0..6)
- `intervals` jsonb (массив {start: "HH:mm", end: "HH:mm"})
- `breaks` jsonb (аналогично)
- `exceptions` jsonb [] (пока не используем)

На клиенте читаем `intervals/breaks` для конкретного `day_of_week`.

### staff_branch_assignments (история закрепления мастера за филиалом)
- `id` uuid PK, `biz_id` uuid, `staff_id` uuid, `branch_id` uuid
- `valid_from` date NOT NULL, `valid_to` date NULL

**Exclusion constraint** (например, `sba_no_overlap`) не допускает пересечения диапазонов для одного `staff_id`.

**Логика перевода:**
- Закрываем старую запись `valid_to = вчера` (или удаляем, если начиналась сегодня)
- Создаём новую с `valid_from = сегодня` (или, если всё ещё конфликтует, со следующего дня)
- Синхронизируем «кэш» в `staff.branch_id`.

---

## 4. RLS / роли / функции

### `is_super_admin()`
RPC, которое проверяет, является ли текущий `auth.uid()` супер-админом (исторически хранилось в `super_admins_legacy` или через `user_global_roles / roles.key = 'super_admin'`).

### Менеджерские страницы (dashboard)
Используют `getBizContextForManagers()` — выдаёт `bizId` только если роль пользователя в бизнесе подходящая (owner/admin/manager). Иначе 403/redirect.

### Клиентские RLS
- У пользователя есть доступ читать/создавать/обновлять свои брони (`bookings.client_id = auth.uid()`)
- Мастерам/менеджерам выдаётся ограниченный доступ на чтение броней своего бизнеса/филиала (в рамках админки)

### Просмотр брони в кабинете
Выборки по текущему `auth.uid()` + `gte start_at now()` для предстоящих, `< now()` — для прошедших. Упрощённые JOIN-ы (только id/названия) — это помогло обойти ошибку колонок `branches_1.lat`.

---

## 5. Ключевые UX-потоки

### 5.1. Публичная запись на услугу ([slug]/view.tsx)

1. **Выбор филиала** → фильтруем услуги и сотрудников по `branch_id`
2. **Фильтр по навыкам**: таблица `service_staff` → маппинг, чтобы показывать только мастеров, у кого есть услуга
3. **Выбор даты** (`<input type="date">`, min=today, max=today+60)
4. **Расчёт рабочих слотов**:
   - Читаем `working_hours` (по `biz_id`, `staff_id`, `day_of_week`)
   - Применяем `intervals/breaks`
   - Шаг слота 15 мин, длительность — `service.duration_min`
5. **Занятость**: читаем `bookings` на выбранные сутки со статусами `['hold','confirmed','paid']` и помечаем «занятые минуты»
6. **hold(t)** вызывает RPC `hold_slot(...)`, ставит локальный таймер 120 сек; нотифаем `/api/notify` (type: 'hold')
7. **confirm()** вызывает RPC `confirm_booking(...)`, шлёт `/api/notify` (type: 'confirm'), редирект на `/booking/:id`

### 5.2. Авторизация

#### Телефон (SMS OTP)
1. `/auth/sign-in` → `signInWithOtp({ phone, options: { channel: 'sms' } })`
2. Редирект на `/auth/verify?mode=phone&phone=...&redirect=...`
3. Ввод кода → `verifyOtp` по коду
4. После успеха `decideAndGo(redirect)`

#### E-mail OTP
Тот же флоу, но с `emailRedirectTo = /auth/callback?next=...` (либо ввод кода на `/auth/verify?mode=email&email=...`).

На серверных компонентах статус проверяется через `AuthStatusServer` (SSRed, cookies only get()).

### 5.3. Клиентский кабинет

`ClientCabinet` показывает:

- **Предстоящие и прошедшие брони**, упрощённые выборки (id, status, start/end, названия)
- **Кнопка «Отменить»** для будущих (меняет статус на cancelled, при желании — уведомление)
- **Ссылка/карта** по филиалу (если есть lat/lon)
- **Возможность оставить отзыв** (таблица reviews) после прошедшего визита (1 отзыв на бронь)

### 5.4. Админка: филиалы

**Создание/редактирование филиала**: форма + карта Яндекса (клик ставит метку).

**На бэке:**

- **Create**: если пришли `lat/lon`, формируем `coords` как `SRID=4326;POINT(lon lat)`
- **Update**: если прислали `lat/lon` — аналогично, иначе `coords = null`

**Важно**: не передавать руками `lat/lon` в INSERT/UPDATE, это generated колонки — берём из `coords`.

### 5.5. Админка: сотрудники

- **StaffForm** редактирует `full_name`, `email`, `phone`, `branch_id`, `is_active`
- **TransferStaffDialog** — перевод между филиалами:
  1. Закрываем активное назначение (вчера/удаляем — избегая пересечения)
  2. Создаём новую строку в `staff_branch_assignments`
  3. Синхронизируем `staff.branch_id`
  4. Опционально копируем расписание (`working_hours`) для сотрудника

---

## 6. Уведомления (e-mail) и .ics

`/api/notify` аккуратно собирает данные `booking + services + staff + business + emails`.

### Кому:
- **Клиенту** — письмо с .ics (вложение)
- **Мастеру/владельцу/админам** — письмо без .ics (чтобы не спамить вложениями)

### Текст/HTML включает:
- `title`: 'Удержание слота' / 'Бронь подтверждена' / 'Бронь отменена'
- Данные сервиса, мастера, времени (с TZ), ссылку на `/booking/:id`
- `.ics` собираем через `buildIcs({...})`

### WhatsApp (webhook)
- Входящие сообщения обрабатываются в `api/webhooks/whatsapp/route.ts`.
- Команды: **отмена** (при нескольких бронях — «отмена 1», «отмена 2»), **подтвердить** (аналогично), **напомни** (список предстоящих записей), **помощь**.
- Интеграция с уведомлениями/CRM (исходящие напоминания, синхронизация с внешней CRM) зарезервирована на будущее при необходимости.

---

## 7. Мониторинг ошибок

В проекте используется **Sentry** как провайдер мониторинга ошибок поверх общей обёртки `apps/web/src/lib/errorMonitoring.ts`.

### Как это устроено

- **Обёртка** `reportErrorToMonitoring(payload)` в `errorMonitoring.ts`:
  - на сервере только логирует через `logError`;
  - в браузере при наличии `window.Sentry` вызывает `Sentry.captureException` и дополнительно пишет в локальный лог.
- **Инициализация Sentry** выполняется только при заданном `NEXT_PUBLIC_SENTRY_DSN`:
  - клиент: `src/sentry.client.config.ts` (выставляет `window.Sentry` для обёртки);
  - сервер: `src/sentry.server.config.ts`;
  - edge: `src/sentry.edge.config.ts`;
  - регистрация и перехват ошибок запросов: `src/instrumentation.ts` и `onRequestError`.
- **ErrorBoundary** и другие места вызывают `reportErrorToMonitoring`, поэтому при включённом Sentry все перехваченные ошибки уходят в дашборд.
- **Глобальные ошибки рендера** (выше boundary) перехватываются в `app/global-error.tsx` и отправляются в Sentry напрямую.

### Включение Sentry

1. Создайте проект в [sentry.io](https://sentry.io) и скопируйте DSN.
2. В `apps/web/.env.local` задайте:
   - `NEXT_PUBLIC_SENTRY_DSN=https://...@....ingest.sentry.io/...`
   - для загрузки source maps при локальной сборке (опционально): `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN`
3. Установите зависимости и соберите приложение: `pnpm install`, `pnpm build`. В production при возникновении ошибок события будут отправляться в Sentry.

### Source maps в CI

При сборке в GitHub Actions source maps загружаются в Sentry, если в настройках репозитория (Settings → Secrets and variables → Actions) заданы секреты:
- **SENTRY_AUTH_TOKEN** — обязателен для загрузки (токен из Sentry: Settings → Auth Tokens, scope `project:releases`).
- **SENTRY_ORG** — slug организации в Sentry (при необходимости, если не задан в конфиге).
- **SENTRY_PROJECT** — slug проекта в Sentry (при необходимости).

Job `build` в `.github/workflows/ci.yml` передаёт эти переменные в `pnpm build`; при отсутствии секретов сборка проходит без загрузки карт (Sentry-плагин в CI работает в silent-режиме).

Без DSN приложение работает как раньше: ошибки только логируются локально через `logError`. Альтернативный провайдер **LogRocket** поддерживается обёрткой (`window.LogRocket.captureException`), но инициализация LogRocket в проекте не настроена; при необходимости его можно подключить аналогично (отдельный конфиг и выставление на `window`).

---

## 8. Дополнительные заметки

### Важные моменты реализации:
- Использование PostGIS для геоданных (координаты филиалов)
- EWKT формат для вставки координат: `SRID=4326;POINT(lon lat)`
- Generated колонки `lat/lon` в branches — не обновлять напрямую
- Exclusion constraints для предотвращения пересечений в `staff_branch_assignments`
- TTL для hold-бронирований ≈ 2 минуты
- Упрощённые JOIN-ы для избежания ошибок с generated колонками

### Оптимизации:
- Кэширование `branch_id` в `staff` для быстрого доступа
- Индексы на `staff_id/start_at` в bookings
- Маппинг `service_staff` на клиенте для фильтрации

### Rate limiting (lib/rateLimit.ts)
- Endpoints оборачиваются в `withRateLimit(req, config, handler)`. Конфиги: `RateLimitConfigs.public | normal | critical | auth`.
- **Per-route**: отдельный счётчик на маршрут — `routeRateLimit(routeId, RateLimitConfigs.normal)` или `config.keyPrefix = 'api/notify'`. Ключ в Redis/памяти: `ratelimit:${keyPrefix}:${identifier}`.
- **Per-user**: лимит по пользователю вместо IP — передать в конфиг `identifier` в формате `user:${userId}` (из сессии). Экспортируется `getRateLimitIdentifier(req)` для получения IP при необходимости.

---

*Документация обновлена: {{ date }}*

