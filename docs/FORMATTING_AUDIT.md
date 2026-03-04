# Аудит мест форматирования (даты, время, цены)

Задача 7.1 REFACTOR_TASKS. Все места использования formatTimeSlot, formatDateLabel, formatPrice и аналогов в mobile и web.

---

## 1. Mobile

### 1.1 Используют `@shared-client/formatters`

| Файл | Использует |
|------|------------|
| `BookingStep6Confirm.tsx` | `formatTimeSlot`, `formatDateLabel`, `formatServicePrice` |
| `BookingStep2Service.tsx` | `formatServicePrice` (замена локального formatPrice) |
| `BookingStep4Date.tsx` | `formatDateLabel` для day/month + локально weekday |
| `BookingStep5Time.tsx` | `formatTimeSlot` (замена локальной функции) |

### 1.2 Локальные дубликаты (оставшиеся)

Нет — шаги бронирования переведены на shared-client (задача 7.2).

### 1.3 Общие утилиты mobile (`apps/mobile/src/utils/format.ts`)

| Функция | Используется в |
|---------|----------------|
| `formatDate` | StaffScreen, ShiftsScreen, CabinetScreen, HomeScreen, BookingDetailsScreen, ShiftQuickScreen |
| `formatTime` | StaffScreen, CabinetScreen, HomeScreen, BookingDetailsScreen, ShiftQuickScreen |
| `formatDateTime` | (определена, использование — по коду) |
| `formatPrice(price, currency)` | ShiftsScreen, ShiftQuickScreen (число + валюта) |

Эти функции — для отображения даты/времени/цен в карточках и списках; контракт (число, дата ISO) отличается от shared `formatServicePrice` (объект с price_from/price_to). Вариант: вынести в shared-client аналог `formatPrice(amount, currency)` для единообразия.

### 1.4 Прямое использование нативного форматирования

| Файл | Код |
|------|-----|
| `ShiftsScreen.tsx` | `new Date(shift.opened_at).toLocaleTimeString('ru-RU', {...})`, `new Date(item.created_at).toLocaleTimeString('ru-RU', {...})` |

---

## 2. Web

### 2.1 Централизованный слой (`apps/web/src/lib/dateFormat.ts`)

- `formatDate`, `formatDateBrowser`, `formatMonthYear`, `formatTime`, `formatDateTime` — с локалями ru/ky/en и TZ.
- Используются в: staff/finance (utils, ShiftHeader, ClientItem, StaffFinanceStats), StaffBookingsView, admin (health-check, system-health, ratings-status, ratings-debug).

### 2.2 Локальные обёртки над formatDateTime/formatDate

| Файл | Что |
|------|-----|
| `admin/health-check/page.tsx` | `formatDate(value)` → `formatDateTime(value, 'ru', true)` |
| `admin/system-health/SystemHealthClient.tsx` | `formatDate(dateStr)` → `formatDateTime(dateStr, 'ru', true)` |
| `admin/ratings-status/page.tsx` | `formatDate(value)` → value ? formatDateTime(value, 'ru', true) : 'нет данных' |
| `staff/bookings/StaffBookingsView.tsx` | `formatDateTimeLocal(iso)` → `formatDateTime(iso, locale, true)` |
| `staff/finance/components/StaffFinanceStats.tsx` | Локальный `formatTime(iso)` в одном месте + пропс `formatDate` из dateFormat |

Имеет смысл оставить один общий хелпер в dateFormat для «дата+время с локалью», чтобы не дублировать обёртки.

### 2.3 Прямое использование `formatInTimeZone` (date-fns-tz)

Много мест для рабочих дат (yyyy-MM-dd, HH:mm, dd.MM.yyyy HH:mm):

- `QuickDesk.tsx`, `BookingsList.tsx`, `view.tsx` (dashboard/bookings), `useQuickDeskFormResets.ts`
- `lib/time.ts`, `lib/dateFormat.ts`, `lib/notifications/messageBuilders.ts`, `lib/notifications/shiftNotifications.ts`, `lib/staffSchedule.ts`
- `staff/finance` (hooks, StatsView, ShiftHeader, ClientsListHeader, ClientEditForm, FinancePage), `staff/bookings` (StaffBookingsView, page), `staff/schedule/ViewSchedule.tsx`
- `b/[slug]/view.tsx`, `useTemporaryTransfers.ts`, `cabinet/bookings/page.tsx`, `cabinet/components/BookingCard.tsx`
- `dashboard/staff/[id]/slots` (Client, page), `dashboard/finance/AllStaffFinanceStats.tsx`, `dashboard/page.tsx`
- API: `api/cron/close-shifts`, `api/dashboard/staff/[id]/shift/open`, `api/staff/shift/open`, `api/staff/shift/items`, `api/dashboard/staff/finance/all`, `api/webhooks/whatsapp`, `admin/api/system-health`
- Другие: `terms/page.tsx`, `privacy/page.tsx`, `data-deletion/page.tsx`, `admin/businesses` (page, [id]/branches, BusinessCardEdit), `admin/page.tsx`, `b/[slug]/promotions/PromotionsPageClient.tsx`

Часть из них — чисто «рабочие» форматы (yyyy-MM-dd для API/календаря), часть — для отображения пользователю (dd.MM.yyyy HH:mm). Для пользовательского отображения целесообразно везде идти через `@/lib/dateFormat` (или в перспективе через shared-client).

### 2.4 Прямое использование `toLocaleDateString` / `toLocaleTimeString`

| Файл | Контекст |
|------|----------|
| `terms/page.tsx` | Последнее обновление: new Date().toLocaleDateString('ru-RU', ...) |
| `privacy/page.tsx` | Аналогично |
| `data-deletion/page.tsx` | Аналогично |
| `admin/businesses/[id]/branches/page.tsx` | Создан: branch.created_at |
| `admin/businesses/page.tsx` | Создан: b.created_at |
| `admin/page.tsx` | b.created_at |
| `admin/businesses/[id]/BusinessCardEdit.tsx` | initial.created_at |
| `dashboard/finance/AllStaffFinanceStats.tsx` | Локализованные даты для date/month picker |
| `b/[slug]/promotions/PromotionsPageClient.tsx` | valid_from / valid_to по локали |

Имеет смысл заменить на вызовы из `@/lib/dateFormat` (или общего форматтера с локалью).

---

## 3. Итог по задачам 7.2

- **Mobile:** заменить локальные `formatTimeSlot` в Step5 и `formatPrice` (цена услуги) в Step2 на `@shared-client/formatters`; для Step4 решить, расширять ли `formatDateLabel` в shared полем `weekday` или оставить только day/month из shared.
- **Mobile:** рассмотреть перенос `formatDate`/`formatTime`/`formatPrice` из `utils/format.ts` в shared-client (или повторное использование существующих форматтеров с общим контрактом).
- **Web:** сократить дублирование обёрток `formatDate`/`formatDateTime` в admin и staff — один фасад в dateFormat; пользовательское отображение дат/времени вести через dateFormat; при необходимости вынести общие форматтеры в shared-client и использовать в web и mobile.
