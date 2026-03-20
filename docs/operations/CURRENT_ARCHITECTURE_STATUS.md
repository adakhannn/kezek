# Текущее архитектурное состояние

Дата фиксации: 2026-03-20

Назначение документа:
- держать короткую актуальную картину по архитектурной волне;
- показывать, что уже достаточно выровнено;
- фиксировать, какие узлы сейчас в работе;
- не давать следующей работе превратиться в локальный рефакторинг вслепую.

Источник правды по задачам:
- [PROJECT_EVOLUTION_IMPLEMENTATION_PLAN.md](./PROJECT_EVOLUTION_IMPLEMENTATION_PLAN.md)
- [DECOMPOSITION_CANDIDATES.md](./DECOMPOSITION_CANDIDATES.md)
- [ARCHITECTURE_WAVE_SUMMARY.md](./ARCHITECTURE_WAVE_SUMMARY.md)

Когда пересматривать:
- после каждого крупного рефакторинга route/file;
- при смене активного P1-узла;
- если одновременно появляется больше двух тяжёлых активных файлов.

---

## 1. Цель текущей волны

Текущая волна не про новые фичи, а про выравнивание архитектуры:
- делать тяжёлые route handlers тонкими адаптерами;
- выносить сценарную и вычислительную логику из экранов и page/route-монолитов;
- фиксировать понятные границы:
  - `route/screen` = orchestration и wiring
  - `helper/hook/service/use-case` = сценарная логика
  - `core-domain` = устойчивые бизнес-инварианты
  - `infra adapter` = Supabase/HTTP/persistence без бизнес-решений

---

## 2. Уже выровнено

Эти зоны сейчас считаются `thin enough` или `good enough` для текущей волны:

### Route / API

- `apps/web/src/app/api/staff/shift/items/route.ts`
  Статус: `thin enough`

- `apps/web/src/app/api/dashboard/staff/[id]/shift/open/route.ts`
  Статус: `thin enough`

- `apps/web/src/app/api/dashboard/staff/[id]/finance/stats/route.ts`
  Статус: `thin enough`

- `apps/web/src/app/api/dashboard/staff/[id]/finance/route.ts`
  Статус: `thin enough`

- `apps/web/src/app/api/dashboard/staff/[id]/finance/audit-log/route.ts`
  Статус: `thin enough`

- `apps/web/src/app/api/webhooks/whatsapp/route.ts`
  Статус: `mostly aligned`
  Комментарий: handlers уже вынесены; возвращаться только если появится явная польза от общего facade/use-case слоя.

### Web screens / hooks

- `apps/web/src/app/b/[slug]/view.tsx`
  Статус: `thin enough`

- `apps/web/src/app/staff/finance/hooks/useShiftItems.ts`
  Статус: `thin enough`

- `apps/web/src/app/dashboard/staff/[id]/schedule/Client.tsx`
  Статус: `mostly aligned`
  Комментарий: можно ещё полировать, но архитектурная отдача уже резко ниже.

- `apps/web/src/app/staff/finance/components/FinancePage.tsx`
  Статус: `thin enough`

- `apps/web/src/app/dashboard/staff/[id]/finance/components/StaffFinanceStats.tsx`
  Статус: `thin enough`

- `apps/web/src/app/dashboard/finance/components/AllStaffFinanceStats.tsx`
  Статус: `thin enough`

- `apps/web/src/app/staff/bookings/StaffBookingsView.tsx`
  Статус: `thin enough`

- `apps/web/src/app/admin/page.tsx`
  Статус: `thin enough`

- `apps/web/src/app/dashboard/components/DashboardHomeClient.tsx`
  Статус: `thin enough`

- `apps/web/src/app/cabinet/components/BookingCard.tsx`
  Статус: `thin enough`

### Mobile

- `apps/mobile/src/navigation/RootNavigator.tsx`
  Статус: `thin enough`

- `apps/mobile/src/screens/ShiftQuickScreen.tsx`
  Статус: `thin enough`

- `apps/mobile/src/screens/HomeScreen.tsx`
  Статус: `thin enough`

- `apps/mobile/src/screens/ShiftsScreen.tsx`
  Статус: `thin enough`

---

## 3. Активный фокус

### Активный P1

- сейчас нет одного очевидного горящего P1-route, как раньше у manager finance API

Вывод:
- мы вышли из фазы “разгрузить самые опасные монолиты любой ценой”;
- дальше лучше идти более выборочно и брать узлы, где ещё есть понятная отдача.

### Активный P2

- активного очевидного P2-узла после `BookingDetailsScreen.tsx` сейчас нет
- следующий шаг: заново выбрать следующий кандидат по реальной отдаче, а не по инерции
- дополнительный фокус: точечные тестовые страховки вокруг недавно декомпозированных presentation-узлов

Недавняя стабилизация:
- `apps/web/src/app/dashboard/finance/components/AllStaffFinanceStats.tsx`
  Статус: `thin enough + covered`

- `apps/web/src/app/dashboard/staff/[id]/finance/components/StaffFinanceStats.tsx`
  Статус: `thin enough + covered`

Недавняя стабилизация:
- `apps/mobile/src/screens/BookingDetailsScreen.tsx`
  Статус: `thin enough`

Недавняя стабилизация:
- `apps/mobile/src/screens/DashboardScreen.tsx`
  Статус: `thin enough`

Недавняя стабилизация:
- `apps/mobile/src/screens/BookingScreen.tsx`
  Статус: `thin enough`

Недавняя стабилизация:
- `apps/web/src/app/cabinet/components/ProfileForm.tsx`
  Статус: `thin enough`

Недавняя стабилизация:
- `apps/web/src/app/dashboard/components/DashboardHomeClient.tsx`
  Статус: `thin enough + covered`

Недавняя стабилизация:
- `apps/web/src/app/cabinet/components/BookingCard.tsx`
  Статус: `thin enough + covered`

Активная работа:
- активного нового P2-узла после `BookingCard.tsx` пока не выбрано
  Статус: `selection`
  Комментарий: следующую точку снова лучше выбрать по отдаче, а не по инерции.

---

## 4. Что пока не трогаем

Это не означает “никогда”, а означает “сейчас это не лучший следующий шаг”.

- повторный polishing `HomeScreen.tsx`
- повторный polishing `ShiftQuickScreen.tsx`
- повторный polishing `Client.tsx`
- дополнительный facade для уже тонких route
- агрессивное объединение `StaffFinanceStats` и `AllStaffFinanceStats` в общий слой без явной боли

Причина:
- отдача ниже, чем у перехода к следующему реально тяжёлому узлу;
- есть риск уйти в косметический рефакторинг вместо архитектурной пользы.

---

## 5. Правило остановки

Файл считается достаточно выровненным, если:
- он больше не держит одновременно data loading, access, расчёты, persistence и presentation;
- основной файл читается как orchestration-layer;
- следующий разрез уже даёт меньше пользы, чем переход к следующему узлу;
- дальнейшее дробление становится косметическим.

Рабочие статусы:
- `planned` — ещё не начинали
- `in progress` — активная цель текущей волны
- `mostly aligned` — остался только необязательный polishing
- `thin enough` — останавливаемся и идём дальше
- `good enough` — возвращаемся только если появится конкретная боль

---

## 6. Следующий рекомендуемый шаг

Следующий основной шаг:
- не продолжать `BookingCard.tsx` по инерции дальше безопасной границы
- заново пересмотреть остаток `P2`-кандидатов и выбрать один следующий узел

Практический порядок:
1. коротко ревизовать оставшиеся mobile/web кандидаты после закрытия `BookingDetailsScreen.tsx`
2. выбрать один новый узел с максимальной отдачей
3. заранее зафиксировать для него цель разреза и критерий остановки
