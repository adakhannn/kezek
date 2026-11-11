# Проверка доступа в HTTP-обработчике

Статус: справочник helpers и правила нового кода; сверено по исходникам 1 ноября 2026. Полное соответствие существующих endpoints этим правилам не утверждается.

[Новый endpoint](HOWTO_NEW_API_ENDPOINT.md) описывает общую цепочку; [service client guide](../../../../docs/SERVICE_CLIENT_USAGE_GUIDE.md) — операции с привилегированным клиентом. Контракт конкретного маршрута искать в [API guide](../../../../API_DOCUMENTATION.md).

## Разные уровни проверки

| Уровень | Источник | Что проверяет |
| --- | --- | --- |
| Identity из запроса | [requestAuthContext](requestAuthContext.ts) | Разрешение Bearer/cookie пользователя |
| Управленческий бизнес | [authBiz](authBiz.ts), [withManagerContext](withManagerContext.ts) | Текущий разрешённый контекст; manager wrapper использует cookie-путь |
| Сотрудник в контексте бизнеса | [withManagerAndStaffContext](withManagerAndStaffContext.ts) | Конкретный staff ID и принадлежность выбранному бизнесу |
| Сущность по бизнесу | [authCheck](authCheck.ts) | Читает biz_id строки и сравнивает с переданным bizId |
| Прямой SQL/RPC | Функция, grants и RLS | Отдельная граница; Next.js helper этот вызов не защищает |

Проверка принадлежности не устанавливает identity и полномочия на операцию. Сначала получить доверенный bizId, затем проверять целевой объект и все вложенные booking/branch/service/package IDs. UUID из body является входными данными, а не доказательством доступа.

## Контракты authCheck

`checkResourceBelongsToBusiness(table, resourceId, bizId)` и helpers для branch/staff/service/booking/promotion возвращают `{ belongs, error? }`. Не найденная строка тоже может дать error. Их результат необходимо обработать; сам вызов не прерывает мутацию.

`checkBranchesBelongToBusiness(branchIds, bizId)` имеет другой результат: `{ allBelong, missing, error? }`. Прежнее утверждение, что все helpers возвращают belongs, неверно. Список таблиц и helper выбирает сервер, не произвольный пользовательский table.

HTTP 401/403/404/500 задаются конкретной цепочкой. `withManagerAndStaffContext` использует 404 для ряда отказов; это не универсальный контракт всего API. Семантика exceptions — в [форматах ошибок](API_ERROR_FORMATS.md).

## Текущий бизнес

[Инварианты current business](../../../../docs/USER_CURRENT_BUSINESS_INVARIANTS.md) задают правила выбора контекста. `user_current_business` хранит выбор, но не выдаёт права. Изменение выбора через API должно отдельно проверять доступ к бизнесу.

Известные нарушения границ доступа остаются в [инженерном реестре](../../../../docs/ENGINEERING_FINDINGS.md). Страница, роль в UI или название safe/atomic в SQL не заменяют проверки вызывающего и принадлежности данных.
