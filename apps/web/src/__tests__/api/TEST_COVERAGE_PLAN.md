# План покрытия тестами API Routes

## Текущее состояние

### Покрыто тестами (6):
- ✅ `quick-hold` - быстрое создание брони
- ✅ `quick-book-guest` - гостевая бронь (новый)
- ✅ `booking/slots-conflicts` - конфликты слотов
- ✅ `staff/shift/close` - закрытие смены
- ✅ `dashboard/finance/all` - финансовая статистика
- ✅ `cron/close-shifts` - cron закрытие смен
- ✅ `bookings/mark-attendance` - отметка посещения
- ✅ `staff/create` - создание сотрудника (новый)
- ✅ `bookings/[id]/cancel` - отмена брони (новый)

### Требуют тестов (~97 routes):

## Приоритет 1: Критичные endpoints (10 routes)

Эти endpoints критичны для основной функциональности:

1. ⏳ `notify` - отправка уведомлений
2. ⏳ `bookings/[id]/mark-attendance` - уже есть, проверить актуальность
3. ⏳ `staff/shift/open` - открытие смены
4. ⏳ `staff/shift/items` - получение элементов смены
5. ⏳ `staff/shift/today` - смена на сегодня
6. ⏳ `staff/update` - обновление сотрудника
7. ⏳ `services/create` - создание услуги
8. ⏳ `services/[id]/update` - обновление услуги
9. ⏳ `branches/create` - создание филиала
10. ⏳ `branches/[id]/update` - обновление филиала

## Приоритет 2: Важные endpoints (20 routes)

11. ⏳ `profile/update` - обновление профиля
12. ⏳ `user/update-phone` - обновление телефона
13. ⏳ `reviews/create` - создание отзыва
14. ⏳ `reviews/update` - обновление отзыва
15. ⏳ `staff/[id]/delete` - удаление сотрудника
16. ⏳ `staff/[id]/dismiss` - увольнение сотрудника
17. ⏳ `staff/[id]/restore` - восстановление сотрудника
18. ⏳ `staff/[id]/transfer` - перевод сотрудника
19. ⏳ `services/[id]/delete` - удаление услуги
20. ⏳ `branches/[id]/delete` - удаление филиала
21. ⏳ `branches/[id]/schedule` - расписание филиала
22. ⏳ `staff/avatar/upload` - загрузка аватара
23. ⏳ `staff/avatar/remove` - удаление аватара
24. ⏳ `staff/create-from-user` - создание из пользователя
25. ⏳ `staff/sync-roles` - синхронизация ролей
26. ⏳ `dashboard/finance/[id]/stats` - статистика по бизнесу
27. ⏳ `dashboard/staff/[id]/finance` - финансы сотрудника
28. ⏳ `dashboard/staff/[id]/finance/stats` - статистика сотрудника
29. ⏳ `dashboard/staff/finance/all` - все финансы сотрудников
30. ⏳ `dashboard/staff-shifts/[id]/update-hours` - обновление часов

## Приоритет 3: Дополнительные endpoints (30 routes)

31-60. Dashboard, promotions, branches endpoints
61-90. Admin endpoints
91-97. Auth, webhooks, диагностика

## План выполнения

### Фаза 1: Критичные endpoints (1-2 недели)
- Создать тесты для всех 10 критичных endpoints
- Обеспечить 100% покрытие для них

### Фаза 2: Важные endpoints (2-3 недели)
- Создать тесты для 20 важных endpoints
- Обеспечить 80%+ покрытие

### Фаза 3: Остальные endpoints (по необходимости)
- Добавлять тесты по мере необходимости
- Фокус на новых features

## Метрики

- **Текущее покрытие**: ~9% (9 из 97 routes)
- **Цель Фаза 1**: ~20% (19 из 97 routes)
- **Цель Фаза 2**: ~40% (39 из 97 routes)
- **Идеальная цель**: 80%+ для критичных, 60%+ для остальных

## Инструменты

- Jest - тестовый фреймворк
- `testHelpers.ts` - общие утилиты
- Coverage reports - отслеживание покрытия

## Автоматизация

После создания тестов:
1. Настроить pre-commit hooks для запуска тестов
2. Добавить в CI/CD pipeline
3. Настроить coverage reports в PR

