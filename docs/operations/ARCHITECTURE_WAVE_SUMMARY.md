# Итог архитектурной волны

**Дата фиксации:** 2026-03-20  
**Статус:** завершённый срез текущей волны  
**Источник правды:** [CURRENT_ARCHITECTURE_STATUS.md](C:\projects\kezek\docs\operations\CURRENT_ARCHITECTURE_STATUS.md), [DECOMPOSITION_CANDIDATES.md](C:\projects\kezek\docs\operations\DECOMPOSITION_CANDIDATES.md), [PROJECT_EVOLUTION_IMPLEMENTATION_PLAN.md](C:\projects\kezek\docs\operations\PROJECT_EVOLUTION_IMPLEMENTATION_PLAN.md)  
**Когда пересматривать:** при старте следующей волны или при появлении нового крупного монолита

---

## 1. Что было целью этой волны

Целью волны было не добавление новых фич, а выравнивание архитектуры:

- сделать тяжёлые `route`-обработчики тонкими адаптерами;
- вынести сценарную и вычислительную логику из крупных экранов, hooks и карточек;
- остановиться на понятной границе `thin enough`, а не доводить всё до бесконечного polishing;
- закрепить прогресс документацией и базовыми тестовыми страховками.

---

## 2. Что можно считать завершённым

### Route/API

- `apps/web/src/app/api/staff/shift/items/route.ts`
- `apps/web/src/app/api/dashboard/staff/[id]/shift/open/route.ts`
- `apps/web/src/app/api/dashboard/staff/[id]/finance/stats/route.ts`
- `apps/web/src/app/api/dashboard/staff/[id]/finance/route.ts`
- `apps/web/src/app/api/dashboard/staff/[id]/finance/audit-log/route.ts`

Эти узлы теперь читаются как thin adapters: вход, orchestration, response mapping.

### Web UI / hooks

- `apps/web/src/app/b/[slug]/view.tsx`
- `apps/web/src/app/staff/finance/hooks/useShiftItems.ts`
- `apps/web/src/app/staff/finance/components/FinancePage.tsx`
- `apps/web/src/app/dashboard/staff/[id]/finance/components/StaffFinanceStats.tsx`
- `apps/web/src/app/dashboard/finance/components/AllStaffFinanceStats.tsx`
- `apps/web/src/app/staff/bookings/StaffBookingsView.tsx`
- `apps/web/src/app/admin/page.tsx`
- `apps/web/src/app/cabinet/components/ProfileForm.tsx`
- `apps/web/src/app/dashboard/components/DashboardHomeClient.tsx`
- `apps/web/src/app/cabinet/components/BookingCard.tsx`

### Mobile

- `apps/mobile/src/navigation/RootNavigator.tsx`
- `apps/mobile/src/screens/ShiftQuickScreen.tsx`
- `apps/mobile/src/screens/HomeScreen.tsx`
- `apps/mobile/src/screens/ShiftsScreen.tsx`
- `apps/mobile/src/screens/CabinetScreen.tsx`
- `apps/mobile/src/screens/BookingDetailsScreen.tsx`
- `apps/mobile/src/screens/ProfileScreen.tsx`
- `apps/mobile/src/screens/DashboardScreen.tsx`
- `apps/mobile/src/screens/BookingScreen.tsx`
- `apps/mobile/src/screens/StaffScreen.tsx`

Общий смысл: экраны больше не держат одновременно query/mutation, вычисления, screen state и большой presentation-монолит в одном файле.

---

## 3. Что улучшилось системно

- Появилась рабочая граница `route/screen -> hook/helper/use-case -> infra/domain`.
- Уменьшилось число файлов, где UI, side effects и вычисления смешаны без явной структуры.
- Появилась более надёжная точка остановки: `thin enough`.
- Прогресс фиксируется не только чекбоксами, но и текущим архитектурным статусом.

---

## 4. Что сознательно не дожимали

Это не забытые долги, а осознанная остановка:

- `apps/web/src/app/api/webhooks/whatsapp/route.ts`
  Статус: `mostly aligned`
  Причина: handlers уже вынесены, отдельный facade нужен только при новой реальной боли.

- `apps/web/src/app/dashboard/staff/[id]/schedule/Client.tsx`
  Статус: `mostly aligned`
  Причина: архитектурная отдача от дальнейшего дробления уже заметно ниже.

- mobile smoke/render suites под обычный RN Jest env
  Причина: здесь проблема уже в test environment, а не в самих экранах.

---

## 5. Что осталось на следующую фазу

Следующая фаза уже не про массовую разгрузку самых опасных монолитов, а про выборочные узлы:

- `apps/web/src/app/staff/finance/components/ClientEditForm.tsx`
  Это самый тяжёлый и рискованный оставшийся web-узел.

- RN test environment
  Нужно отдельно починить обычный mobile Jest pipeline, чтобы smoke/render tests перестали упираться в `react-native/jest/setup.js`.

- новый P2/P3-кандидат
  Выбирать уже по реальной отдаче, а не просто потому что файл большой.

---

## 6. Практический вывод

Эту волну можно считать логически завершённой.

Следующий рабочий старт лучше делать так:

1. Не продолжать последние выровненные файлы по инерции.
2. Выбрать один новый узел с понятной отдачей.
3. До начала зафиксировать цель разреза и критерий остановки.
4. После завершения сразу обновить статусные документы.
