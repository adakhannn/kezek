# Финансовый API: навигация по исходникам

Статус: справочный указатель, частичная сверка 30 октября 2026. Сопровождение: команда разработки финансового модуля. Документ не подтверждает полноту контракта, безопасность развёрнутой БД или успешную приёмку финансовых сценариев.

Основная карта API — [API_DOCUMENTATION.md](../API_DOCUMENTATION.md). Этот указатель помогает найти финансовую цепочку; схемы запроса и ответа следует проверять по выбранному route, HTTP/service-коду и [валидации](../apps/web/src/lib/validation/schemas.ts). Формат ответа формируется [apiErrorHandler](../apps/web/src/lib/apiErrorHandler.ts); примеры старых справочников не заменяют этот код.

## Открытые ограничения

- [ENG-02](ENGINEERING_FINDINGS.md#eng-02-привилегированные-rpc-без-проверки-бизнеса): определения некоторых `SECURITY DEFINER` RPC и grants допускают вызов без проверки бизнеса; фактические ACL сервера не проверены. Проверка контекста в Next.js не доказывает защищённость прямого RPC.
- [ENG-03](ENGINEERING_FINDINGS.md#eng-03-вложенные-booking-id-не-проверяются-при-сохранении-смены): при сохранении позиций проверка целевого сотрудника не распространяется на все вложенные booking ID перед обновлением их статусов через service client.
- [ENG-05](ENGINEERING_FINDINGS.md#eng-05-финансовое-сохранение-и-закрытие-не-защищают-всю-операцию): сохранение состоит из отдельных запросов, часть ошибок только логируется; при закрытии остаётся окно между чтением позиций и блокировкой смены в RPC. Наличие функции с названием `atomic` или `safe` не подтверждает атомарность всей цепочки.

Все три записи остаются OPEN. Редактура этого документа не исправляет доступ, списания или конкурентные изменения. Состояние приёмки и ограничения работы — в [PROJECT_STATUS.md](PROJECT_STATUS.md) и [WEB_AGENT_HANDOFF.md](WEB_AGENT_HANDOFF.md); прежняя кампания закрыта, `kezek` — PAUSED. Документационная задача не запускает запросы к БД или финансовые операции.

## Карта финансовых маршрутов

Назначение в таблице описывает ветки приложения, а не доказанную гарантию доступа. Полные структуры payload намеренно не дублируются.

| Метод и путь | Назначение | Где проверить цепочку |
| --- | --- | --- |
| `GET /api/staff/finance` | Данные смены; ветка сотрудника или менеджера при `staffId` | [HTTP](../apps/web/src/lib/staffFinanceHttpService.ts), [контекст и query](../apps/web/src/lib/staffFinanceRouteService.ts) |
| `POST /api/staff/shift/open` | Открытие смены текущего сотрудника | [HTTP](../apps/web/src/lib/staffShiftOpenHttpService.ts), [service](../apps/web/src/lib/staffShiftOpenService.ts) |
| `POST /api/dashboard/staff/[id]/shift/open` | Открытие смены выбранного сотрудника из dashboard | [HTTP](../apps/web/src/lib/dashboardStaffShiftOpenHttpService.ts), [service](../apps/web/src/lib/dashboardStaffShiftOpenService.ts) |
| `POST /api/staff/shift/close` | Закрытие смены текущего сотрудника | [HTTP](../apps/web/src/lib/staffShiftCloseHttpService.ts), [service](../apps/web/src/lib/staffShiftCloseService.ts) |
| `POST /api/dashboard/staff/[id]/shift/close` | Закрытие смены выбранного сотрудника из dashboard | [HTTP](../apps/web/src/lib/dashboardStaffShiftCloseHttpService.ts), [service](../apps/web/src/lib/dashboardStaffShiftCloseService.ts) |
| `POST /api/staff/shift/items` | Сохранение позиций своей смены или выбранного сотрудника | [контекст и schema](../apps/web/src/lib/staffShiftItemsRouteService.ts), [запись и статусы](../apps/web/src/lib/staffShiftItemsService.ts) |
| `GET /api/dashboard/staff/[id]/finance/stats` | Статистика; manager-ветка и отдельная Bearer-ветка для самого сотрудника | [HTTP и выбор ветки](../apps/web/src/lib/staffFinanceStatsHttpService.ts), [период и расчёт](../apps/web/src/lib/staffFinanceStatsService.ts) |
| `GET /api/dashboard/staff/[id]/finance/audit-log` | Аудит финансовых настроек | [HTTP](../apps/web/src/lib/staffFinanceAuditLogHttpService.ts), [service](../apps/web/src/lib/staffFinanceAuditLogService.ts) |
| `POST /api/dashboard/staff-shifts/[id]/update-hours` | Изменение часов закрытой смены | [HTTP и диапазон](../apps/web/src/lib/dashboardStaffShiftUpdateHoursHttpService.ts), [service и статус смены](../apps/web/src/lib/dashboardStaffShiftUpdateHoursService.ts) |

## Уточнения к прежней редакции

- `saveShiftItemsSchema` включает `items`, необязательные `staffId` и `shiftDate`. `closeShiftSchema` — строгая схема с `items`, `totalAmount`, `consumablesAmount` и дополнительным условием наличия данных. Формулировка «и т.д.» не описывает её контракт; актуальные поля и ограничения находятся в [schemas.ts](../apps/web/src/lib/validation/schemas.ts).
- Для финансовой статистики утверждение «только менеджер/владелец» неполно: [HTTP service](../apps/web/src/lib/staffFinanceStatsHttpService.ts) содержит Bearer-ветку сотрудника с проверкой собственного ID. Её наличие не означает, что все негативные проверки доступа пройдены.
- Универсального правила «все dashboard routes возвращают 404 при чужом объекте» здесь нет. Например, Bearer-ветка статистики возвращает 403 при несовпадении staff ID. Проверять код ответа нужно по конкретному обработчику.
- Для `update-hours` прежнее описание диапазона 0–24 не совпадает с [HTTP-валидацией](../apps/web/src/lib/dashboardStaffShiftUpdateHoursHttpService.ts), допускающей 0–48. При этом [миграция CHECK](../supabase/migrations/20260213000000_add_shift_constraints_and_transactions.sql) задаёт 0–24. Это расхождение исходников; фактическая запись значений выше 24 в удалённой БД не проверялась. Документ не объявляет ни один из диапазонов согласованным сквозным контрактом.

Связанные источники: [финансовые типы](../apps/web/src/lib/finance/types.ts), [общая финансовая логика](../packages/core-domain/src/finance/index.ts), [миграции и неизвестное состояние сервера](../supabase/README.md). Для новой проверки сначала выбираются точный сценарий, разрешённая среда и независимый ожидаемый результат.
