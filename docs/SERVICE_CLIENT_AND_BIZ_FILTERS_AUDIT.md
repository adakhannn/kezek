# Аудит: Service client без RLS и фильтры по biz_id

Документ фиксирует все места использования service/client admin-клиента, наличие фильтров по `biz_id`/`branch.biz_id`, требования к безопасному использованию и план миграции на обёртку `withManagerContext` (блоки 5.2 и 5.7 в `OWNER_CABINET_RISKS_AND_IMPROVEMENTS_TASKS.md`).

---

## 1. Источники service-клиента

| Модуль | Функция | Назначение |
|--------|---------|------------|
| `@/lib/supabaseService` | `getServiceClient()` | Единая точка создания клиента с Service Role Key (обход RLS). |
| `@/lib/supabaseHelpers` | `createSupabaseAdminClient()` | То же, используется в authBiz, staffRoleSync, части API (whatsapp, restore/dismiss). |

Оба возвращают клиент без RLS; ответственность за ограничение доступа по бизнесу лежит на коде.

---

## 2. Сводная таблица использований

### 2.1. `/api/dashboard/*` (контекст владельца/менеджера)

Все маршруты сначала вызывают `getBizContextForManagers()` и получают `bizId`. Service client используется для запросов к таблицам, где явно фильтруют по `biz_id` или проверяют принадлежность ресурса через `checkResourceBelongsToBiz` / `checkResourceBelongsToBusiness`.

| Файл | Контекст | Фильтр по biz_id / проверка |
|------|----------|-----------------------------|
| `dashboard/analytics/overview/route.ts` | getBizContextForManagers → bizId | `.eq('biz_id', bizId)` на business_daily_stats |
| `dashboard/analytics/load/route.ts` | getBizContextForManagers → bizId | `.eq('biz_id', bizId)` на business_hourly_load |
| `dashboard/branches/list/route.ts` | getBizContextForManagers → bizId | `.eq('biz_id', bizId)` на branches |
| `dashboard/staff/[id]/shift/open/route.ts` | getBizContextForManagers → bizId | Проверка staff.biz_id === bizId; запись в staff_shifts с biz_id; все выборки по staff_id (косвенно по бизнесу) |
| `dashboard/staff/[id]/finance/route.ts` | getBizContextForManagers → bizId | checkResourceBelongsToBiz(staff); запросы с `.eq('biz_id', bizId)` |
| `dashboard/staff/[id]/finance/stats/route.ts` | getBizContextForManagers → bizId | checkResourceBelongsToBiz(staff); запросы с `.eq('biz_id', bizId)` |
| `dashboard/staff/[id]/finance/audit-log/route.ts` | getBizContextForManagers → bizId | checkResourceBelongsToBiz(staff); `.eq('biz_id', bizId)` |
| `dashboard/staff/finance/all/route.ts` | getBizContextForManagers → bizId | `.eq('biz_id', bizId)`; RPC с p_biz_id |
| `dashboard/staff-shifts/[id]/update-hours/route.ts` | getBizContextForManagers → bizId | checkResourceBelongsToBiz (shift через staff) |
| `dashboard/branches/[branchId]/promotions/route.ts` | getBizContextForManagers → bizId | check branch.biz_id === bizId; `.eq('biz_id', bizId)` |
| `dashboard/branches/[branchId]/promotions/[promotionId]/route.ts` | getBizContextForManagers → bizId | branch.biz_id === bizId; запросы с `.eq('biz_id', bizId)` |

**Вывод:** Везде есть явный контекст `bizId` и фильтрация или проверка принадлежности. Кандидаты на переход на `withManagerContext(handler)` с передачей `bizId` и единым получением service client внутри обёртки.

---

### 2.2. `/api/staff/*`, `/api/branches/*`, `/api/services/*`, `/api/bookings/*`

Аналогично: контекст через `getBizContextForManagers()`, затем проверки принадлежности и/или `.eq('biz_id', bizId)`.

| Домен | Файлы (примеры) | Контекст | Фильтрация |
|-------|-----------------|----------|------------|
| staff | `[id]/update`, `[id]/delete`, `[id]/transfer`, `[id]/restore`, `[id]/dismiss`, `create`, `create-from-user`, `update`, `sync-roles`, `avatar/upload`, `avatar/remove`, `shift/close`, `shift/items` | getBizContextForManagers или проверка staff/branch | checkResourceBelongsToBiz(staff/branch), insert с biz_id |
| branches | `create`, `[id]/update`, `[id]/delete`, `[id]/schedule` | getBizContextForManagers | insert/update с biz_id, проверка branch.biz_id |
| services | `create`, `[id]/update`, `[id]/delete` | getBizContextForManagers | checkResourceBelongsToBiz(service), insert с biz_id (через branch) |
| bookings | `[id]/mark-attendance` | getBizContextForManagers → bizId | Use case с bookingRepository и проверкой BOOKING_NOT_IN_BIZ |

**Вывод:** Паттерн единообразный: контекст → проверка принадлежности → работа через admin. Подходит для обёртки `withManagerContext`.

---

### 2.3. `/api/admin/*` (системные / super_admin)

Используют service client для операций без привязки к одному бизнесу (все бизнесы, рейтинги, аналитика платформы, здоровье). Проверка доступа — через `is_super_admin` RPC.

| Файл | Назначение | biz_id |
|------|------------|--------|
| `admin/ratings/debug-entities/route.ts` | Отладка сущностей с рейтингами | Перебор по businesses (is_approved) |
| `admin/initialize-ratings/route.ts` | Инициализация рейтингов | По всем одобренным бизнесам |
| `admin/ratings/status/route.ts` | Статус рейтингов | Агрегаты по платформе |
| `admin/health-check/route.ts` | Проверка здоровья | Системные проверки |
| `admin/system-analytics/overview/route.ts` | Аналитика платформы | Агрегаты без фильтра по одному biz |
| `admin/analytics/*` (overview, load, track, conversion-funnel, promotions) | Аналитика админки | Могут принимать biz_id параметром для одного бизнеса или все |
| `admin/promotions/debug/route.ts` | Отладка акций | По бизнесам/филиалам |
| `admin/performance/stats/route.ts` | Метрики производительности | Системные |
| `admin/api/funnel-analytics/route.ts` | Воронка | Платформа |
| `admin/api/system-health/route.ts` | Здоровье системы | Системные |
| `admin/api/finance-logs/route.ts` | Логи финансов | По запросу (biz/филиал) |
| `admin/api/metrics/route.ts`, `stats/route.ts` | Метрики API | Системные |

**Вывод:** Это не контекст «менеджера одного бизнеса»; обёртка `withManagerContext` для них не подходит. Оставить проверку `is_super_admin` и явно задокументировать, что в `/api/admin/*` service client используется для системных операций (исключение из правила 5.2).

---

### 2.4. `/api/cron/*`

Фоновые задачи без пользовательской сессии; работа по всем бизнесам или по расписанию.

| Файл | Назначение | biz_id |
|------|------------|--------|
| `cron/analytics/hourly-load/route.ts` | Расчёт почасовой нагрузки | Перебор biz из business_* или конфига |
| `cron/analytics/daily/route.ts` | Дневная аналитика | По всем бизнесам |
| `cron/recalculate-ratings/route.ts` | Пересчёт рейтингов | По всем одобренным бизнесам |
| `cron/data-retention/route.ts` | Очистка данных | Системная |
| `cron/health-check-alerts/route.ts` | Алерты здоровья | Системная |
| `cron/close-shifts/route.ts` | Закрытие смен | По сменам/бизнесам по логике |

**Вывод:** Исключение: нет пользователя и текущего bizId. Service client допустим без `withManagerContext`; доступ к cron должен быть защищён (cron secret / Vercel cron).

---

### 2.5. Прочие API

| Файл | Контекст | Фильтрация |
|------|----------|------------|
| `api/users/search/route.tsx` | getBizContextForManagers → bizId | `.eq('biz_id', bizId)` (staff) |
| `api/funnel-events/route.ts` | Публичный: biz_id из тела запроса (валидация zod) | Запись аналитики; biz_id приходит от клиента (страница бронирования), проверка принадлежности к пользователю не требуется. |
| `api/metrics/frontend/route.ts` | Нет контекста бизнеса | RPC `log_frontend_metric`: системные метрики (Core Web Vitals, page load); не привязаны к biz_id. |
| `api/webhooks/whatsapp/route.ts` | bizId из бронирований/профиля (не из сессии пользователя) | Работа с бронированиями по их biz_id; не контекст менеджера. |

---

### 2.6. Библиотеки (lib)

| Файл | Использование | Фильтрация |
|------|----------------|------------|
| `lib/authCheck.ts` | checkResourceBelongsToBusiness, checkBranchesBelongToBusiness | Все функции принимают `bizId` и используют его в запросах (.eq('biz_id', bizId) или сравнение с полем ресурса). |
| `lib/staffRoleSync.ts` | createSupabaseAdminClient: синхронизация ролей staff | Работа по user_id и biz_id из контекста (resolveStaffContext). |
| `lib/bizContextResolver.ts` | createSupabaseAdminClient: разрешение текущего бизнеса | Чтение user_current_business, businesses, user_roles; не фильтрует по «чужим» бизнесам — определяет свой контекст. |
| `lib/staffSchedule.ts` | getServiceClient в типах/параметрах | Используется в контексте, где уже есть bizId. |
| `lib/apiMetrics.ts` | getServiceClient для записи метрик | Системная запись; не привязана к одному бизнесу. |

**Вывод:** authCheck — безопасен (bizId обязательный аргумент). staffRoleSync и bizContextResolver — контекст определяют сами, не «произвольный доступ к любому biz». apiMetrics — системный слой.

---

### 2.7. Страницы и компоненты (Server/Client)

| Файл | Использование | Фильтрация |
|------|----------------|------------|
| `app/dashboard/staff/[id]/page.tsx` | getBizContextForManagers → bizId; getServiceClient для bookings | Проверка `staff.biz_id === bizId`; запрос bookings с `.eq('biz_id', bizId).eq('staff_id', id)`. |
| `app/dashboard/services/[id]/page.tsx` | getBizContextForManagers → bizId; getServiceClient для services/branches | Запрос услуги с `.eq('id', id).eq('biz_id', bizId)`; проверка `svc.biz_id === bizId`; branches с `.eq('biz_id', bizId)`. |

---

### 2.8. Полный перечень вызовов getServiceClient / createSupabaseAdminClient по доменам

Ниже — все места в коде (без тестов), где используется **getServiceClient()** (`@/lib/supabaseService`) или **createSupabaseAdminClient()** (`@/lib/supabaseHelpers`), сгруппированные по домену.

| Домен | Файл | Функция (источник клиента) |
|-------|------|----------------------------|
| **Аналитика (admin)** | `app/admin/api/system-analytics/overview/route.ts` | getServiceClient |
| | `app/admin/api/analytics/overview/route.ts` | getServiceClient |
| | `app/admin/api/analytics/track/route.ts` | getServiceClient |
| | `app/admin/api/analytics/promotions/route.ts` | getServiceClient |
| | `app/admin/api/analytics/load/route.ts` | getServiceClient |
| | `app/admin/api/analytics/conversion-funnel/route.ts` | getServiceClient |
| | `app/admin/api/funnel-analytics/route.ts` | getServiceClient |
| **Аналитика (cron)** | `app/api/cron/analytics/hourly-load/route.ts` | getServiceClient |
| | `app/api/cron/analytics/daily/route.ts` | getServiceClient |
| **Финансы / логи** | `app/admin/api/finance-logs/route.ts` | getServiceClient |
| **Рейтинги** | `app/api/admin/ratings/debug-entities/route.ts` | getServiceClient |
| | `app/api/admin/initialize-ratings/route.ts` | getServiceClient |
| | `app/api/admin/ratings/status/route.ts` | getServiceClient |
| **Система / здоровье** | `app/api/admin/health-check/route.ts` | getServiceClient |
| | `app/admin/api/system-health/route.ts` | getServiceClient |
| **Промо / отладка** | `app/api/admin/promotions/debug/route.ts` | getServiceClient |
| **Метрики** | `app/api/admin/performance/stats/route.ts` | getServiceClient |
| | `app/admin/api/metrics/route.ts` | getServiceClient |
| | `app/admin/api/metrics/stats/route.ts` | getServiceClient |
| | `app/api/metrics/frontend/route.ts` | getServiceClient |
| **Cron (прочие)** | `app/api/cron/recalculate-ratings/route.ts` | getServiceClient |
| | `app/api/cron/data-retention/route.ts` | getServiceClient |
| | `app/api/cron/health-check-alerts/route.ts` | getServiceClient (dynamic import) |
| | `app/api/cron/close-shifts/route.ts` | getServiceClient |
| **Staff** | `app/api/staff/[id]/update/route.ts` | getServiceClient |
| | `app/api/staff/update/route.ts` | getServiceClient |
| | `app/api/staff/sync-roles/route.ts` | getServiceClient |
| | `app/api/staff/shift/close/route.ts` | getServiceClient |
| | `app/api/staff/shift/items/route.ts` | getServiceClient |
| | `app/api/staff/create/route.ts` | getServiceClient |
| | `app/api/staff/create-from-user/route.ts` | getServiceClient |
| | `app/api/staff/avatar/upload/route.ts` | getServiceClient |
| | `app/api/staff/avatar/remove/route.ts` | getServiceClient |
| | `app/api/staff/[id]/transfer/route.ts` | getServiceClient |
| | `app/api/staff/[id]/restore/route.ts` | getServiceClient + createSupabaseAdminClient |
| | `app/api/staff/[id]/dismiss/route.ts` | getServiceClient + createSupabaseAdminClient |
| | `app/api/staff/[id]/delete/route.ts` | getServiceClient |
| **Branches** | `app/api/branches/create/route.ts` | getServiceClient |
| | `app/api/branches/[id]/update/route.ts` | getServiceClient |
| | `app/api/branches/[id]/schedule/route.ts` | getServiceClient |
| | `app/api/branches/[id]/delete/route.ts` | getServiceClient |
| **Services** | `app/api/services/create/route.ts` | getServiceClient |
| | `app/api/services/[id]/update/route.ts` | getServiceClient |
| | `app/api/services/[id]/delete/route.ts` | getServiceClient |
| **Bookings** | `app/api/bookings/[id]/mark-attendance/route.ts` | getServiceClient |
| **Users** | `app/api/users/search/route.tsx` | getServiceClient |
| **Воронка / события** | `app/api/funnel-events/route.ts` | getServiceClient |
| **Webhooks** | `app/api/webhooks/whatsapp/route.ts` | getServiceClient (несколько вызовов) |
| **Auth (WhatsApp)** | `app/api/auth/whatsapp/verify-otp/route.ts` | createSupabaseAdminClient |
| | `app/api/auth/whatsapp/send-otp/route.ts` | createSupabaseAdminClient |
| | `app/api/auth/whatsapp/create-session/route.ts` | createSupabaseAdminClient |
| **Dashboard (RSC)** | `app/dashboard/staff/[id]/page.tsx` | getServiceClient |
| | `app/dashboard/services/[id]/page.tsx` | getServiceClient |
| **Сервис данных (клиент)** | `app/staff/finance/services/shiftDataService.ts` | getServiceClient (dynamic import) |
| **Lib (контекст / проверки)** | `lib/bizContextResolver.ts` | createSupabaseAdminClient |
| | `lib/withManagerContext.ts` | createSupabaseAdminClient (внутри обёртки) |
| | `lib/staffRoleSync.ts` | createSupabaseAdminClient |
| | `lib/authCheck.ts` | getServiceClient |
| | `lib/staffSchedule.ts` | getServiceClient (тип/параметр) |
| | `lib/apiMetrics.ts` | getServiceClient |

**Итого:** getServiceClient — в маршрутах admin, cron, staff, branches, services, bookings, users, funnel, webhooks, в страницах dashboard и в lib (authCheck, staffSchedule, apiMetrics). createSupabaseAdminClient — в lib (bizContextResolver, withManagerContext, staffRoleSync), в staff/[id]/restore и dismiss, в auth/whatsapp. Дашбордные маршруты `/api/dashboard/*` переведены на `withManagerContext` и получают admin через обёртку (см. п. 4.3).

---

### 2.9. Проверка фильтров по biz_id и филиалам

Для всех маршрутов с контекстом «один бизнес» (getBizContextForManagers / withManagerContext / getStaffContext) проверено наличие фильтрации.

| Область | Статус | Примечание |
|---------|--------|------------|
| **Dashboard** (analytics, branches/list, staff/*, staff-shifts, promotions, integrations-status) | ✅ | Запросы к таблицам с данными бизнеса — `.eq('biz_id', bizId)`; вложенные сущности (staff, shift, branch) — проверка через `checkResourceBelongsToBiz` или сравнение `branch.biz_id === bizId`. integrations-status не обращается к БД. |
| **Dashboard RSC** (staff/[id]/page, services/[id]/page) | ✅ | staff: проверка staff.biz_id === bizId, запрос bookings с `.eq('biz_id', bizId)`. services: запрос услуги с `.eq('biz_id', bizId)`, проверка svc.biz_id. |
| **Staff** (create, update, [id]/update, transfer, restore, dismiss, delete, shift/close, shift/items, shift/today, sync-roles, create-from-user) | ✅ | Везде либо `checkResourceBelongsToBiz(staff/branch)` + последующие запросы с `.eq('biz_id', bizId)`, либо выборки/вставки с `.eq('biz_id', bizId)`. |
| **Staff avatar** (upload, remove) | ✅ | Добавлены `.eq('biz_id', bizId)` в select и update (bizId из getStaffContext). |
| **Branches** (create, [id]/update, [id]/delete, [id]/schedule) | ✅ | create — insert с `biz_id: bizId`; остальные — `checkResourceBelongsToBiz(branch)` и все запросы (в т.ч. branch_working_hours, services и т.д.) с `.eq('biz_id', bizId)`. |
| **Services** (create, [id]/update, [id]/delete) | ✅ | Проверка принадлежности услуги/филиала и запросы с `.eq('biz_id', bizId)`. |
| **Bookings** [id]/mark-attendance | ✅ | Контекст bizId передаётся в use case; проверка принадлежности брони к бизнесу в доменной логике (BOOKING_NOT_IN_BIZ). |
| **Users search** | ✅ | Выборка staff с `.eq('biz_id', bizId)`. |
| **Admin / cron / webhooks** | — | Исключения: системные операции или работа по множеству бизнесов; фильтр по одному biz_id не требуется. |

**Правило при работе с филиалами:** перед изменением/чтением данных филиала проверять `branch.biz_id === bizId` (или через `checkResourceBelongsToBiz(branch)`); в запросах к связанным таблицам (например, branch_working_hours, promotions) использовать `.eq('biz_id', bizId)`.

---

## 3. Требования к безопасному использованию

### 3.1. В маршрутах `/api/dashboard/*` и в API, привязанных к «кабинету бизнеса»

1. **Всегда получать контекст доступа к бизнесу** через `getBizContextForManagers()` (или в будущем через `withManagerContext`). Не брать `bizId` только из тела запроса или query без проверки прав.
2. **Все запросы к данным бизнеса через service client** должны содержать ограничение по бизнесу:
   - либо `.eq('biz_id', bizId)` для таблиц с полем `biz_id`;
   - либо проверка принадлежности связанной сущности (например, branch.biz_id, staff.biz_id) через `checkResourceBelongsToBiz` / `checkResourceBelongsToBusiness` перед изменением/чтением.
3. **При вставке строк** в таблицы с `biz_id` всегда подставлять проверенный `bizId` из контекста, а не из запроса пользователя.
4. **Для вложенных сущностей** (например, филиал, сотрудник, услуга): сначала проверить, что родитель принадлежит текущему бизнесу, затем выполнять операции.

### 3.2. В маршрутах `/api/admin/*` и `/api/cron/*`

- Проверка доступа: `is_super_admin` или защита cron (secret, IP).
- Допустимо использовать service client без контекста «один бизнес», так как операции системные или по множеству бизнесов. Явно документировать в коде/guide.

### 3.3. Анти-паттерны

- Использование service client в маршруте дашборда/менеджера без вызова `getBizContextForManagers()` (или без `withManagerContext`).
- Чтение/запись таблиц с `biz_id` без условия по `biz_id` или без предварительной проверки принадлежности ресурса.
- Подстановка `biz_id` из query/body без проверки прав пользователя на этот бизнес.

---

## 4. План миграции на `withManagerContext` (блок 5.2)

### 4.1. Обёртка `withManagerContext` (реализовано)

- **Модуль:** `@/lib/withManagerContext.ts`.
- **Тип контекста:** `ManagerContext = { supabase, admin, bizId, userId }` — server client (cookies, RLS), admin client (без RLS), текущий бизнес, ID пользователя.
- **Сигнатура:** `withManagerContext(req: NextRequest, scope: string, handler: (ctx: ManagerContext) => Promise<NextResponse>): Promise<NextResponse>`.
- **Поведение:** вызов `getBizContextForManagers()`; при успехе — создание `admin` через `createSupabaseAdminClient()`, вызов `handler(ctx)`; при `BizAccessError`: `NOT_AUTHENTICATED` → 401, иначе (в т.ч. `NO_BIZ_ACCESS`) → 403.
- **Формат ошибок:** `createErrorResponse('auth', 'Требуется авторизация', undefined, 401)` и `createErrorResponse('forbidden', 'Нет доступа к кабинету управления', undefined, 403)`.
- **Использование:** в route обернуть логику в `withManagerContext(req, 'ScopeName', async (ctx) => { ... })`; при необходимости поверх — `withErrorHandler('ScopeName', () => withManagerContext(req, 'ScopeName', async (ctx) => { ... }))`.

### 4.2. Реализовать и покрыть тестами (сделано)

- Успешный доступ (есть пользователь и бизнес) — `withManagerContext.test.ts`.
- 401 при отсутствии авторизации (NOT_AUTHENTICATED).
- 403 при отсутствии доступа к бизнесу (NO_BIZ_ACCESS).
- Проброс не-BizAccessError (rethrows).
- Базовый тест: handler получает корректный bizId и не видит чужие данные — обеспечивается тем, что контекст выдаётся только через getBizContextForManagers; в handler передан один раз полученный admin с тем же bizId.

### 4.3. Поэтапно переводить маршруты

**Приоритет 1 (дашборд, аналитика и финансы):**

- ~~`api/dashboard/analytics/overview`~~, ~~`api/dashboard/analytics/load`~~ — переведены
- ~~`api/dashboard/staff/[id]/finance/*`~~ (route, stats, audit-log), ~~`api/dashboard/staff/finance/all`~~ — переведены
- ~~`api/dashboard/staff/[id]/shift/open`~~ — переведён
- ~~`api/dashboard/staff-shifts/[id]/update-hours`~~ — переведён
- ~~`api/dashboard/branches/list`~~, ~~`api/dashboard/branches/[branchId]/promotions`~~ (GET/POST), ~~`api/dashboard/branches/[branchId]/promotions/[promotionId]`~~ (PATCH/DELETE) — переведены
- ~~`api/dashboard/integrations-status`~~ — переведён

**Приоритет 2 (staff, branches, services, bookings):**

- `api/staff/*` (create, update, [id]/update, [id]/delete, [id]/transfer, [id]/restore, [id]/dismiss, shift/close, shift/items, avatar, sync-roles, create-from-user)
- `api/branches/create`, `[id]/update`, `[id]/delete`, `[id]/schedule`
- `api/services/create`, `[id]/update`, `[id]/delete`
- `api/bookings/[id]/mark-attendance`

**Приоритет 3:**

- `api/users/search`
- Остальные dashboard-маршруты, если появятся.

После перевода в handler не вызывать `getBizContextForManagers()` и не создавать service client вручную — только использовать переданные из обёртки `bizId`, `supabase`, `serviceClient`.

### 4.4. Исключения (не переводить на withManagerContext)

- Все `/api/admin/*`: оставить проверку `is_super_admin` и прямое использование getServiceClient.
- Все `/api/cron/*`: без пользовательского контекста.
- `api/webhooks/whatsapp`: контекст по данным бронирований, не по сессии менеджера.
- `lib/authCheck.ts`: принимает bizId снаружи; вызывающий код уже должен получать контекст через withManagerContext или getBizContextForManagers.
- `lib/bizContextResolver.ts`, `lib/staffRoleSync.ts`: определяют контекст; не «handlers» запросов.

### 4.5. Документация

- В `docs/` или в README описать: в `/api/dashboard/*` и в API кабинета менеджера service client должен использоваться только через `withManagerContext` (или через явно разрешённые исключения с обоснованием в коде).
- Добавить раздел «Безопасное использование service client»: когда можно без обёртки (admin, cron, определение контекста в lib), когда обязательно с контекстом и фильтром по biz_id.

---

## 5. Ссылки

- Задачи: `OWNER_CABINET_RISKS_AND_IMPROVEMENTS_TASKS.md` (блок 4 — задача «Service client без RLS»; блоки 5.2, 5.7).
- Текущая обёртка/проверки: `getBizContextForManagers` в `@/lib/authBiz`, `checkResourceBelongsToBiz` в `@/lib/dbHelpers`, `checkResourceBelongsToBusiness` в `@/lib/authCheck`.
- Service client: `@/lib/supabaseService.ts` (getServiceClient), `@/lib/supabaseHelpers.ts` (createSupabaseAdminClient).
