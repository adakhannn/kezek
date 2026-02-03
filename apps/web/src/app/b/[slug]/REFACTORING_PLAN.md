# План рефакторинга view.tsx

## Текущее состояние
- Файл: `view.tsx` - 1629 строк
- Проблемы: сложно поддерживать, тестировать, оптимизировать

## Структура рефакторинга

### 1. Типы и интерфейсы
**Файл:** `types.ts`
- `Biz`, `Branch`, `Service`, `Staff`, `Promotion`
- `Data`, `ServiceStaffRow`, `Slot`
- `BookingStep`

### 2. Утилиты
**Файл:** `utils.ts`
- `fmtErr()` - форматирование ошибок
- `isNetworkError()` - проверка сетевых ошибок
- `withNetworkRetry()` - повторная попытка при сетевых ошибках

### 3. Хуки
**Файлы:**
- `hooks/useBookingSteps.ts` - логика пошагового визарда
- `hooks/useBookingCreation.ts` - создание бронирования
- `hooks/useGuestBooking.ts` - гостевая бронь
- `hooks/useBookingState.ts` - управление состоянием (localStorage)

### 4. Компоненты UI
**Файлы:**
- `components/BookingHeader.tsx` - заголовок с информацией о бизнесе
- `components/BookingSteps.tsx` - навигация по шагам
- `components/BranchSelector.tsx` - выбор филиала
- `components/DateSelector.tsx` - выбор даты
- `components/StaffSelector.tsx` - выбор мастера
- `components/ServiceSelector.tsx` - выбор услуги
- `components/TimeSlotSelector.tsx` - выбор времени
- `components/BookingSummary.tsx` - итоговая информация
- `components/GuestBookingModal.tsx` - модальное окно для гостевой брони
- `components/PromotionsList.tsx` - список акций

### 5. Главный компонент
**Файл:** `view.tsx` (упрощенный)
- Только композиция компонентов
- Управление общим состоянием
- Координация между компонентами

## Порядок выполнения

1. ✅ Создать `types.ts` - вынести все типы
2. ✅ Создать `utils.ts` - вынести утилиты
3. ✅ Создать `hooks/useBookingSteps.ts` - вынести хук
4. ✅ Создать `hooks/useBookingCreation.ts` - логика создания бронирования
5. ✅ Создать `hooks/useGuestBooking.ts` - логика гостевой брони
6. ✅ Создать компоненты UI (по одному)
7. ✅ Обновить главный компонент `view.tsx`
8. ✅ Тестирование

## Ожидаемый результат

- `view.tsx`: ~200-300 строк (только композиция)
- Каждый компонент: 50-150 строк
- Каждый хук: 50-100 строк
- Улучшенная читаемость и поддерживаемость
- Легче тестировать отдельные части

