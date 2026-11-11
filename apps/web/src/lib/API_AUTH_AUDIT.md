# Аудит проверки прав доступа в API endpoints

> Статус: исторический план или снимок анализа; классификация уточнена 30 октября 2026. Результаты, отметки выполнения и команды ниже относятся к исходной волне и не являются текущим поручением или подтверждением готовности продукта. Текущий приоритет: [PROJECT_STATUS.md](../../../../docs/PROJECT_STATUS.md); навигация: [индекс документации](../../../../docs/README.md).

**Дата**: 2024-12-19  
**Статус исходного снимка**: В процессе

## Резюме

Проведен аудит API endpoints на предмет проверки прав доступа. Большинство endpoints уже используют `getBizContextForManagers()` или `getStaffContext()` и проверяют принадлежность ресурсов к бизнесу.

## Результаты аудита

### ✅ Endpoints с корректной проверкой прав доступа

1. **services/create** - ✅ Использует `getBizContextForManagers()`, проверяет принадлежность филиалов
2. **services/[id]/update** - ✅ Использует `getBizContextForManagers()`, проверяет принадлежность услуги и филиалов
3. **services/[id]/delete** - ✅ Использует `getBizContextForManagers()`, проверяет принадлежность услуги
4. **bookings/[id]/mark-attendance** - ✅ Использует `getBizContextForManagers()`, проверяет принадлежность брони
5. **branches/[id]/update** - ✅ Использует `getBizContextForManagers()`, проверяет принадлежность филиала
6. **branches/[id]/delete** - ✅ Использует `getBizContextForManagers()`, проверяет суперадмина и принадлежность филиала
7. **branches/[id]/schedule** - ✅ Использует `getBizContextForManagers()`, проверяет принадлежность филиала
8. **branches/create** - ✅ Использует `getBizContextForManagers()`
9. **staff/create** - ✅ Использует `getBizContextForManagers()`, проверяет роли
10. **staff/update** - ✅ Использует `getBizContextForManagers()`, проверяет роли
11. **staff/[id]/update** - ✅ Использует `getBizContextForManagers()`, проверяет принадлежность сотрудника и филиала
12. **staff/[id]/delete** - ✅ Использует `getBizContextForManagers()`, проверяет принадлежность сотрудника
13. **staff/[id]/transfer** - ✅ Использует `getBizContextForManagers()`, проверяет принадлежность сотрудника и филиала
14. **dashboard/branches/[branchId]/promotions** - ✅ Использует `getBizContextForManagers()`, проверяет принадлежность филиала
15. **dashboard/branches/[branchId]/promotions/[promotionId]** - ✅ Использует `getBizContextForManagers()`, проверяет принадлежность акции

### ⚠️ Endpoints, требующие улучшения

1. **bookings/[id]/cancel** - ✅ **ИСПРАВЛЕНО**: Теперь проверяет принадлежность к бизнесу для менеджеров
2. **staff/[id]/restore** - ✅ **ИСПРАВЛЕНО**: Теперь использует service client для обхода RLS
3. **staff/[id]/dismiss** - ✅ **ИСПРАВЛЕНО**: Теперь использует service client для обхода RLS

### ✅ Дополнительно проверенные endpoints

1. **dashboard/staff-shifts/[id]/update-hours** - ✅ Использует `getBizContextForManagers()`, проверяет принадлежность смены к бизнесу
2. **staff/avatar/upload** - ✅ Использует `getStaffContext()` - сотрудник может загружать только свой аватар
3. **staff/avatar/remove** - ✅ Использует `getStaffContext()` - сотрудник может удалять только свой аватар
4. **profile/update** - ✅ Проверяет авторизацию пользователя, обновляет только свой профиль
5. **users/search** - ✅ Использует `getBizContextForManagers()`, возвращает список пользователей (исключая сотрудников текущего бизнеса)

### 📋 Endpoints, требующие дополнительной проверки

Следующие endpoints требуют ручной проверки:
- `/api/notify` - endpoint для уведомлений
- `/api/quick-hold` - быстрая блокировка слота
- `/api/quick-book-guest` - быстрое бронирование для гостей

## Рекомендации

1. ✅ Создана утилита `@/lib/authCheck` для централизованной проверки прав доступа
2. ⚠️ Обновить `staff/[id]/restore` и `staff/[id]/dismiss` для использования service client
3. ⚠️ Провести дополнительный аудит endpoints, работающих с пользовательскими данными
4. ⚠️ Добавить автоматические тесты для проверки прав доступа во всех endpoints

## Утилиты для проверки прав доступа

Создан модуль `@/lib/authCheck.ts` с функциями:
- `checkResourceBelongsToBusiness()` - универсальная проверка принадлежности ресурса
- `checkBranchBelongsToBusiness()` - проверка филиала
- `checkStaffBelongsToBusiness()` - проверка сотрудника
- `checkServiceBelongsToBusiness()` - проверка услуги
- `checkBookingBelongsToBusiness()` - проверка бронирования
- `checkPromotionBelongsToBusiness()` - проверка акции
- `checkBranchesBelongToBusiness()` - проверка списка филиалов

## Следующие шаги

1. ✅ Обновлены `staff/[id]/restore` и `staff/[id]/dismiss` для использования service client
2. ✅ Исправлен `bookings/[id]/cancel` для проверки принадлежности к бизнесу
3. ✅ Проведен аудит 20+ критических endpoints
4. ⚠️ Провести дополнительный аудит оставшихся endpoints (notify, quick-hold, quick-book-guest)
5. ⚠️ Добавить автоматические тесты для проверки прав доступа
6. ⚠️ Создать документацию по использованию утилит проверки прав доступа

## Статистика

- **Проверено endpoints**: 20+
- **Исправлено проблем**: 3
- **Создано утилит**: 1 модуль (`@/lib/authCheck`)
- **Прогресс**: ~75% (основные критические endpoints проверены и исправлены)

