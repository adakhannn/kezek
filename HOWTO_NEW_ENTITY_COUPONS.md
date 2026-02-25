# HOWTO: добавить новую сущность (пример: `Coupons`)

Этот гид показывает типовой путь добавления новой сущности в систему Kezek на примере абстрактной сущности `Coupons`.  
По тем же шагам можно заводить другие доменные сущности.

---

## 1. Спроектировать модель данных и миграцию Supabase

- **1.1. Определить назначение сущности**
  - Что такое `Coupon` в терминах бизнеса (для чего используется, жизненный цикл).
  - Как он связан с существующими сущностями (`businesses`, `branches`, `bookings`, `profiles` и т.п.).

- **1.2. Описать таблицу (черновик)**
  - Базовые поля:
    - `id uuid primary key`
    - `biz_id uuid references businesses(id)`
    - `branch_id uuid references branches(id)` (если купоны филиальные)
    - `code text unique` (человекочитаемый/вводимый код)
    - `discount_percent smallint` или `discount_amount int`
    - `valid_from/valid_to timestamptz`
    - `max_usage_per_client int` / `max_total_usage int` (опционально)
    - `created_at timestamptz default now()`
    - `is_active boolean default true`
  - Индексы:
    - по `biz_id`, `branch_id`, `code`, комбинации `biz_id + code`.

- **1.3. Создать миграцию**
  - В `supabase/migrations/` создать файл `YYYYMMDDHHMMSS_add_coupons.sql`.
  - Описать:
    - создание таблицы `coupons`;
    - индексы;
    - при необходимости вспомогательные таблицы (`coupon_usages`).

- **1.4. Настроить RLS**
  - В той же миграции:
    - включить RLS на `coupons`;
    - политики:
      - для менеджеров/владельцев бизнеса — `select/insert/update/delete` в рамках своего `biz_id`;
      - для клиентов — только `select` активных купонов, применимых к их бизнесу.

- **1.5. При необходимости — RPC/функции**
  - Если логика применения купона сложная, вынести часть в RPC:
    - `apply_coupon(p_booking_id uuid, p_code text)` или похожую функцию.

---

## 2. CRUD API для новой сущности

Используем новый генератор API‑роутов как отправную точку (см. `DX_GENERATORS.md`).

- **2.1. Создать базовые CRUD‑роуты**

```bash
pnpm generate:api-route dashboard/coupons
pnpm generate:api-route dashboard/coupons/[id]
```

Это создаст скелеты:
- `apps/web/src/app/api/dashboard/coupons/route.ts` (GET/POST);
- `apps/web/src/app/api/dashboard/coupons/[id]/route.test.ts` (скелет теста).

- **2.2. Описать Zod‑схемы**
  - В `apps/web/src/lib/validation/schemas.ts` или отдельном модуле `couponSchemas.ts` добавить:
    - `couponCreateSchema` (название, тип скидки, проценты/суммы, сроки действия);
    - `couponUpdateSchema` (частичное обновление).

- **2.3. Реализовать CRUD‑обработчики**
  - В `api/dashboard/coupons/route.ts`:
    - `GET` — список купонов по `biz_id` текущего менеджера (`getBizContextForManagers`);
    - `POST` — создание купона:
      - `withRateLimit` + `withErrorHandler`;
      - `validateRequest(couponCreateSchema)`;
      - insert в `coupons` через Supabase;
      - возврат DTO (по паттерну `PromotionDto` / `BookingDto`).
  - В `api/dashboard/coupons/[id]/route.ts`:
    - `PATCH` — обновление;
    - `DELETE` — деактивация/удаление.

- **2.4. Обновить Swagger**
  - Добавить `@swagger`‑JSDoc над CRUD‑роутами:
    - пути `/api/dashboard/coupons` и `/api/dashboard/coupons/{id}`;
    - схемы запросов/ответов, коды ошибок;
    - тег `Dashboard` или `Admin` (в зависимости от зоны).

- **2.5. Проверки доступа**
  - Для всех действий использовать:
    - `getBizContextForManagers()` для получения `bizId`;
    - выбор/операции только в рамках `biz_id = bizId`.

---

## 3. Страница/раздел в админке

- **3.1. Определить место в UI**
  - Например: `apps/web/src/app/dashboard/coupons/page.tsx`.
  - Добавить пункт меню в соответствующую навигацию (дешборд владельца/менеджера).

- **3.2. Создать страницу**
  - Серверный компонент, который:
    - получает бизнес‑контекст (`getBizContextForManagers`);
    - делает `fetch` к `GET /api/dashboard/coupons`;
    - передаёт данные в клиентский компонент (таблица/форма).

- **3.3. Клиентские компоненты**
  - В `apps/web/src/app/dashboard/coupons/`:
    - `CouponsPageClient.tsx` — таблица купонов, кнопки создания/редактирования/удаления;
    - `CouponForm.tsx` — форма создания/редактирования (имя, тип скидки, сроки).
  - Использовать существующие дизайн‑компоненты из dashboard‑UI (см. `staff-finance-pages`, `promotion` и т.п.).

---

## 4. Тесты (SQL + API + E2E)

- **4.1. SQL‑тесты (опционально, для сложной логики)**
  - В `supabase/tests_coupons.sql`:
    - сценарии применения купона к броням;
    - ограничения по количеству использований и срокам действия.
  - Добавить выполнение в `test:sql`, если сценарий критичный.

- **4.2. API‑тесты**
  - В `apps/web/src/__tests__/api/dashboard/coupons/route.test.ts`:
    - авторизация (`401/403`);
    - валидация (`400` при невалидных полях);
    - happy path создания/обновления/удаления;
    - проверки, что менеджеры не могут работать с купонами чужого бизнеса.

- **4.3. E2E‑тест (минимум один сценарий)**
  - В `apps/web/e2e/coupons-management.spec.ts` (или добавить в существующий файл по тематике):
    - залогиненный владелец:
      - заходит в раздел `Coupons`;
      - создаёт купон;
      - видит его в списке;
      - редактирует/деактивирует;
      - при необходимости — проверяет применение купона в публичном/операторском флоу.

---

## 5. Мониторинг и логирование

- **5.1. Логирование ошибок**
  - Все новые API‑роуты должны использовать:
    - `withErrorHandler` для стандартизованных ошибок и логов;
    - `logDebug`/`logError` для важных событий (создание/обновление купона, ошибки применения).

- **5.2. Метрики и health**
  - При необходимости:
    - добавить простые метрики (количество применений купонов, ошибки применения);
    - отразить их в существующих админских панелях метрик/health (`/api/admin/*`).

---

## 6. Чек‑лист при добавлении новой сущности

1. **БД**: таблица + индексы + RLS + (опционально RPC).
2. **Домейн** (core-domain, если нужно):
   - типы/DTO/валидаторы для сущности;
   - доменные сервисы/правила.
3. **API**:
   - CRUD‑роуты с `withRateLimit` + `withErrorHandler`;
   - Zod‑схемы для запросов/ответов;
   - Swagger‑документация.
4. **UI**:
   - страница/раздел в dashboard или admin;
   - клиентый код, использующий API и доменнные типы.
5. **Тесты**:
   - SQL (если есть сложная бизнес‑логика в БД);
   - Jest API‑тесты;
   - хотя бы один E2E‑сценарий.
6. **Мониторинг**:
   - логирование ключевых ошибок и действий;
   - при необходимости — метрики/health.

