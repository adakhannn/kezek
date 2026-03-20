# Приоритеты миграции на business timezone

**Статус:** актуален  
**Цель:** зафиксировать порядок выравнивания timezone-логики после аудита, чтобы следующие изменения шли по реальному риску, а не по случайному выбору файлов.

---

## Принцип приоритизации

Чем выше приоритет, тем сильнее одновременно выполняются эти условия:

- код влияет на бизнес-день, смены, booking availability или day-based finance;
- ошибка даёт скрытый доменный баг, а не просто неправильное форматирование;
- сценарий часто используется и имеет большую стоимость регрессии;
- в потоке уже известен конкретный бизнес, но код всё ещё опирается на глобальный `TZ`.

---

## Уже выровнено

Эта волна уже закрыта и не требует срочного продолжения:

- `apps/web/src/app/api/dashboard/staff/[id]/shift/open/route.ts`
- `apps/web/src/app/api/dashboard/staff/[id]/finance/route.ts`
- `apps/web/src/app/api/dashboard/staff/[id]/finance/stats/route.ts`
- `apps/web/src/app/api/dashboard/staff/finance/all/route.ts`
- `apps/web/src/app/api/staff/finance/route.ts`
- `apps/web/src/app/api/staff/shift/open/route.ts`
- `apps/web/src/app/api/staff/shift/close/route.ts`
- `apps/web/src/app/api/staff/shift/today/route.ts`
- `apps/web/src/app/api/staff/shift/items/shiftItemsShiftResolver.ts`
- critical public booking hooks в `apps/web/src/app/b/[slug]/hooks/*`

---

## P1. Самый высокий приоритет

### 1. `apps/web/src/app/dashboard/staff/[id]/schedule/Client.tsx`

Почему высоко:

- экран опирается на локальный день бизнеса;
- содержит вычисления расписания и day-boundaries;
- уже отмечен как крупный кандидат на декомпозицию, так что timezone-миграцию разумно делать вместе с выносом логики.

Что делать:

- передавать timezone бизнеса явно в schedule helpers;
- убрать расчёты через глобальный `TZ`;
- отделить display-formatting от business-day logic.

### 2. `apps/web/src/app/staff/finance/**/*`

Почему высоко:

- это пользовательский staff-flow поверх тех же смен и дневных границ;
- после выравнивания API именно UI и локальные hooks остаются главным источником рассинхрона.

Что делать:

- пробросить `businessTz` до hooks и view-моделей;
- убрать локальные вычисления "сегодня" через глобальный fallback;
- сверить поведение с уже выровненным `api/staff/finance`.

### 3. `apps/web/src/lib/staffSchedule.ts`

Почему высоко:

- это shared helper-слой, который может размазывать глобальный `TZ` по нескольким UI/route сценариям;
- исправление здесь даёт каскадный эффект.

Что делать:

- сделать timezone явным параметром;
- оставить глобальный fallback только как legacy-compatible крайний случай.

---

## P2. Высокий, но не блокирующий

### 4. `apps/web/src/app/api/webhooks/whatsapp/route.ts`

Почему:

- может давать неправильное локальное время в сообщениях и напоминаниях;
- это уже не границы бизнес-дня, но всё ещё пользовательски чувствительный сценарий.

### 5. `apps/web/src/app/cabinet/**/*`

Почему:

- влияет на отображение будущих и прошедших записей;
- чаще даёт UX-рассинхрон, чем критичный доменный баг.

### 6. `apps/web/src/app/staff/bookings/**/*`

Почему:

- booking list/view зависит от дня и отображения времени;
- ошибка заметна пользователю, но реже ломает сами мутации.

---

## P3. Средний приоритет

### 7. Mobile booking flow

Файлы:

- `apps/mobile/src/screens/booking/BookingStep4Date.tsx`
- `apps/mobile/src/screens/booking/BookingStep5Time.tsx`
- `apps/mobile/src/screens/booking/BookingStep6Confirm.tsx`

Почему:

- там ещё есть жёсткая привязка к одной timezone;
- риск реальный, но после web shift/finance и schedule это не самый дорогой следующий регресс.

### 8. Mobile cabinet / booking display

Файлы:

- `apps/mobile/src/screens/HomeScreen.tsx`
- `apps/mobile/src/screens/CabinetScreen.tsx`
- `apps/mobile/src/screens/BookingDetailsScreen.tsx`

Почему:

- в основном display-ошибки и неправильная классификация будущих/прошедших записей.

---

## Рекомендуемый порядок следующих задач

1. `dashboard/staff/[id]/schedule/Client.tsx`
2. `staff/finance` web feature
3. `lib/staffSchedule.ts`
4. `webhooks/whatsapp`
5. `cabinet` web flows
6. mobile booking flow
7. mobile cabinet / booking display

---

## Что считать завершением приоритета

Приоритет считается закрытым, когда:

- timezone бизнеса передаётся явно до уровня вычислений;
- глобальный `TZ` больше не участвует в day-boundary логике этого потока;
- в коде остаётся только display-level fallback, если бизнес timezone реально недоступна;
- связанный аудит или roadmap обновлён.
