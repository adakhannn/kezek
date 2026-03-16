# Staff Bookings — поддержка комплексных услуг

Документ описывает задачи для реализации бронирований с комплексом услуг в кабинете сотрудника (`/staff/bookings`).

## 1. Backend: поддержка комплексных бронирований из кабинета сотрудника

### 1.1. Проанализировать текущие RPC ✅

- Проверено поведение существующих функций:
  - `hold_slot` — создаёт одно бронирование со статусом `hold` для **одной услуги**, берёт `client_id = auth.uid()` и заполняет `client_name`, `client_phone`, `client_email` из `profiles`, использует одиночный `service_id` в `bookings`.
  - `hold_complex_slot` — создаёт бронирование со статусом `hold` для **комплекса услуг**: принимает `p_services jsonb` (массив `{ service_id, duration_min, order_index }`), считает суммарную длительность, создаёт одну запись в `bookings` и несколько строк в `booking_services`.
  - `confirm_booking` — переводит статус из `hold` в `confirmed`, очищает `expires_at`.
- Отдельного RPC `create_internal_booking` в SQL нет: внутренняя запись из кабинета владельца/сотрудника создаётся через функцию `createInternalBooking` в `bookingDashboardService`, которая вызывает RPC `create_internal_booking` (определение в Supabase проекте, но не в текущей миграции; при проектировании комплексной версии нужно будет опираться на фактическую схему `bookings`/`booking_services` и текущий контракт `createInternalBooking`).
- Для внутреннего (staff) сценария важны данные:
  - `client_id` (может быть null), `client_name`, `client_phone`,
  - статусы `hold` / `confirmed` (и возможный `paid` для дальнейшего расширения),
  - корректное наполнение `booking_services` при комплексе.

### 1.2. Спроектировать новый RPC для комплексной записи ✅

- Рабочее имя: `create_internal_complex_booking`.
- Входные параметры (предложение):
  - `p_biz_id uuid`,
  - `p_branch_id uuid`,
  - `p_staff_id uuid`,
  - `p_start timestamptz` (в TZ бизнеса),
  - `p_services jsonb` — массив объектов `{ service_id uuid, duration_min int, order_index int }`,
  - `p_client_id uuid` (nullable),
  - `p_client_name text` (nullable),
  - `p_client_phone text` (nullable).
- Поведение:
  - Создаёт запись в `bookings` с:
    - корректной продолжительностью (сумма `duration_min` по всем услугам),
    - статусом (как в `create_internal_booking` — уточнить текущую модель).
  - Создаёт записи в `booking_services` для всех услуг комплекса с сохранением порядка `order_index`.
  - Возвращает `booking_id` (uuid).
- Требования:
  - Учитывать RLS: функция должна выполняться либо под service role, либо с использованием `security definer` и явных проверок `auth.uid()`.
  - Сохранить совместимость с существующей схемой и триггерами (если есть).

### 1.3. Написать SQL-миграцию для нового RPC ✅

- Создать миграцию `20YYMMDDHHMMSS_create_internal_complex_booking.sql`:
  - Определить функцию `create_internal_complex_booking`.
  - Добавить комментарии по параметрам и поведению.
  - Обработать основные ошибки:
    - конфликт временных слотов / двойное бронирование,
    - несуществующие `service_id` / `staff_id` / `branch_id`,
    - пустой массив `p_services`.
- При необходимости:
  - добавить индексы, если функция опирается на дополнительные фильтры,
  - скорректировать RLS или использовать `security definer` с внутренними проверками.

### 1.4. Обновить `bookingDashboardService` ✅

- В `apps/web/src/lib/bookingDashboardService.ts`:
  - добавить тип `CreateInternalComplexBookingParams` (массив услуг и остальные поля),
  - добавить функцию `createInternalComplexBooking(params)` — обёртку над новым RPC,
  - оставить `createInternalBooking` без изменений (backward compatible).

## 2. Backend: слоты под комплекс в кабинете сотрудника

### 2.1. Проверить текущий RPC слотов ✅

- Разобрать реализацию `get_free_slots_service_day_v2`:
  - умеет ли он работать с комплексом услуг (как в публичном потоке),
  - или рассчитывает слоты только для одиночной услуги (`p_service_id`).
- Сопоставить с публичным сценарием (`useBookingCreation`) и вычислением слотов для комплекса.

### 2.2. Расширить RPC слотов для комплексов (если нужно) ✅

- Вариант A: расширить текущий `get_free_slots_service_day_v2`:
  - добавить параметр `p_services jsonb` (массив услуг и длительностей),
  - при наличии `p_services` игнорировать одиночный `p_service_id`,
  - рассчитывать слоты по логике комплекса (последовательность/параллельность как в публичном потоке).
- Вариант B: создать отдельный RPC `get_free_slots_complex_service_day_v2`:
  - только для комплексных сценариев,
  - вызывается из staff UI при выборе нескольких услуг.
- В любом случае:
  - добавить SQL-миграцию,
  - задокументировать формат входного массива и ограничения.

## 3. Frontend: форма создания записи в кабинете сотрудника

Файлы:
- `apps/web/src/app/staff/bookings/CreateBookingForm.tsx`,
- `apps/web/src/app/staff/bookings/StaffBookingsView.tsx`.

### 3.1. UI для выбора комплекса услуг ✅

- Заменить текущий `serviceId: string` на:
  - `selectedServiceIds: string[]`,
  - возможно, `selectedServices: Service[]` для удобства.
- Обновить селект услуги:
  - Вариант: мульти-select (чекбоксы / тэги) по списку услуг выбранного филиала.
  - Показать подсказку: «Можно выбрать несколько услуг (комплекс)».
- Обновить валидацию:
  - запретить создание записи, если не выбрана ни одна услуга,
  - отдельные тексты ошибок для одиночной/комплексной записи.

### 3.2. Загрузка слотов с учётом комплекса ✅.

- Поведение в `CreateBookingForm`:
  - если `selectedServiceIds.length === 0`:
    - слоты не загружать, очистить `slots` и `slotStartISO`.
  - если `selectedServiceIds.length === 1`:
    - оставить текущий вызов `getFreeSlotsForServiceDay` с одним `serviceId`.
  - если `selectedServiceIds.length > 1`:
    - вызывать расширенный RPC слотов (из п.2),
    - передавать массив `{ service_id, duration_min, order_index }` по данным `servicesByBranch`.
- Обновить фильтрацию слотов (по филиалу, мастеру, минимальному времени).

### 3.3. Создание бронирования (одиночная vs комплекс) ✅.

- В `createBooking()`:
  - получить массив выбранных услуг `selectedServices` (по `selectedServiceIds`),
  - при `selectedServices.length === 1`:
    - использовать существующий поток `createInternalBooking` (без изменений).
  - при `selectedServices.length > 1`:
    - собрать `servicesPayload` (id + duration_min + order_index),
    - вызвать `createInternalComplexBooking({
        bizId,
        branchId,
        staffId,
        startAtISO: slotStartISO,
        services: servicesPayload,
        clientName,
        clientPhone,
        clientId: null,
      })`.
- После успешного создания:
  - показать тост/alert (как сейчас),
  - очистить форму,
  - перезагрузить список записей (можно оставить `window.location.reload()` на первый этап).

### 3.4. Валидация и UX ✅

- Обновить условие `canCreate`:
  - `branchId` выбран,
  - `selectedServiceIds.length >= 1`,
  - `slotStartISO` не пустой,
  - имя и телефон валидны.
- Сообщения об ошибках:
  - «Выберите хотя бы одну услугу»,
  - «Нет свободных слотов под выбранный комплекс услуг»,
  - прежние сообщения для имени/телефона/слотов.

## 4. Логирование и метрики

### 4.1. Funnel events для внутренних бронирований ✅

- В `useQuickBooking` уже есть поля:
  - `service_id`,
  - `service_ids`,
  - `services_count`.
- Для нового потока из `CreateBookingForm`:
  - добавить аналогичное событие `booking_success` с:
    - `service_id = первая услуга`,
    - `service_ids = массив всех`,
    - `services_count = длина массива`.
- Определить `source` (например, `'staff_cabinet'`).

### 4.2. Логи ошибок

- В новом RPC:
  - логировать конфликт слотов, отсутствие услуг, некорректные параметры.
- В `CreateBookingForm`:
  - оборачивать ошибки RPC в человекочитаемые сообщения (по аналогии с публичным `useBookingCreation` + `fmtErr` при необходимости),
  - логировать технические ошибки через `logError('StaffBookings', ...)`.

## 5. Тестирование и регресс

### 5.1. Регресс одиночной услуги

- Убедиться, что:
  - одиночная запись создаётся как раньше (через `createInternalBooking`),
  - существующие сценарии работы владельца и сотрудника не ломаются.

### 5.2. Тесты

- Добавить/обновить тесты:
  - unit/интеграционные для `create_internal_complex_booking` (минимум happy path + конфликт слотов),
  - тест для `CreateBookingForm`, проверяющий:
    - выбор нескольких услуг → вызов `createInternalComplexBooking`,
    - корректное поведение при ошибках RPC,
    - правильное формирование payload (порядок услуг, длительности).

