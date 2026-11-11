# ADR: resolveBizContextForManagers — выбор бизнеса для кабинета менеджмента

Дата исходного ADR: **3 марта 2026**, исходный статус — принят. Текущая редакция: архитектурный справочник, **сверено по исходникам 1 ноября 2026**. Сопровождение: разработчики auth/business-контекста. Runtime, роли и схема целевой БД этой редакцией не проверялись.

Область: web, [bizContextResolver](../apps/web/src/lib/bizContextResolver.ts) и его стратегии/helpers. Документ описывает реализованный алгоритм; ограничения модели выбора — [USER_CURRENT_BUSINESS_INVARIANTS](USER_CURRENT_BUSINESS_INVARIANTS.md), HTTP-контракты — [BUSINESS_WORKFLOWS](api/BUSINESS_WORKFLOWS.md#контекст-бизнеса-и-данные-кабинета).

## 1. Назначение

resolveBizContextForManagers определяет бизнес для пользователя в manager-сценариях и возвращает `{ supabase, userId, bizId, business }`. business содержит метаданные или null; city в нём всегда null, поле city из businesses не читается. При отсутствии результата выбора выбрасывается BizAccessError; другие исключения могут распространяться дальше.

[getBizContextForManagers](../apps/web/src/lib/authBiz.ts) делегирует resolver. [withManagerContext](../apps/web/src/lib/withManagerContext.ts) использует его результат и создаёт отдельный admin-клиент для handler. Возвращаемый resolver-ом supabase остаётся пользовательским; привилегированный клиент используется внутри выбора/загрузки метаданных и не включается в возвращаемый объект.

Текущий бизнес — контекст операции, не доказательство доступа к произвольному дочернему объекту. Проверки конкретного business/staff/branch/booking остаются обязанностью использующего контекст пути.

## 2. Приоритеты выбора бизнеса

Сначала создаётся cookie/server client и вызывается auth.getUser. После успешной идентификации resolver пытается создать service client; при ошибке создания возвращается к пользовательскому клиенту и его RLS. Затем вызывается RPC is_super_admin через пользовательский клиент. Исключение RPC даёт false; возвращённая ошибка логируется, результат определяется через `!!data`. Источник — [runtime helpers](../apps/web/src/lib/bizContextRuntimeHelpers.ts).

### Супер-администратор

1. Читается user_current_business. Если biz_id найден, дополнительно проверяется существование бизнеса.
2. Если выбранного существующего бизнеса нет, ищется бизнес со slug=kezek.
3. Отсутствие/ошибка fallback даёт отсутствие bizId и затем NO_BIZ_ACCESS.

Эта стратегия не равна списку и setter API текущего бизнеса: у тех нет отдельного super_admin-допуска. Нельзя переносить поведение resolver на весь dashboard или UI.

### Обычный пользователь

1. Читается user_current_business. Если найден biz_id, он принимается только при owner/admin/manager в user_roles с этим biz_id, ключи определяются через roles.
2. Если строка обнаружена, но подходящей роли нет, **автоподбор не выполняется**. Результат — NO_BIZ_ACCESS даже при других ролях/бизнесах или owner_id. Строка не очищается.
3. Только если current-строка не обнаружена, выбирается первый business из подходящих user_roles с непустым biz_id после сортировки строкового biz_id через localeCompare.
4. Если по ролям результата нет, выбирается первый businesses.id по owner_id пользователя, с сортировкой id ASC и limit 1.

[MANAGER_ROLE_KEYS](../apps/web/src/lib/userRoleProfile.ts) содержит owner, admin, manager; staff в него не входит. Стратегии — [bizContextResolutionStrategies](../apps/web/src/lib/bizContextResolutionStrategies.ts).

Проверка owner_id применяется только как последний fallback при отсутствии current-строки. Поэтому пользователь с одним лишь owner_id может пройти явный setter, но затем не пройти resolver с уже сохранённым выбором. Это фактическое расхождение, не общее правило «владелец всегда имеет доступ».

## 3. Поддерживаемые сценарии и границы

| Сценарий | Результат исходников |
| --- | --- |
| getUser вернул user без error | Переход к выбору бизнеса |
| user отсутствует либо возвращена ошибка отклонённой сессии | NOT_AUTHENTICATED / UNAUTHORIZED |
| getUser вернул иную ошибку | SERVICE_UNAVAILABLE / AUTH_SERVICE_UNAVAILABLE |
| Super-admin, выбран существующий бизнес | Выбранный bizId |
| Super-admin, выбора/бизнеса нет | Fallback slug=kezek, иначе NO_BIZ_ACCESS |
| Обычный user, current выбран и manager-роль есть | Выбранный bizId |
| Обычный user, current выбран, manager-роли нет | NO_BIZ_ACCESS без автоматического переключения |
| Current не найден, несколько подходящих бизнесов | Детерминированный первый по ролям, иначе owner_id; обязательного экрана выбора здесь нет |
| Автоподбор дал бизнес | Контекст возвращается; resolver не сохраняет этот выбор в таблицу |
| BizId выбран, но метаданные не загрузились | Возвращается контекст с business=null; логируется предупреждение |

Загрузка current-строки не проверяет её error отдельно. При ошибке без data обычная ветка может считать выбор отсутствующим и разрешить автоподбор. Ошибки чтения ролей в current-ветке также не превращаются в отдельную недоступность сервиса. Роль может дать bizId до проверки метаданных; их отсутствие затем не отменяет контекст. Эти особенности исключают общее обещание «все сбои БД безопасно и однозначно отличены от потери прав».

Resolver сам не проверяет is_approved/активность бизнеса, не назначает роли, не исправляет current-строку и не возвращает UI-redirect. [cabinetAccess](../apps/web/src/lib/cabinetAccess.ts) и [userRoleProfile](../apps/web/src/lib/userRoleProfile.ts) — отдельная логика видимости/навигации; совпадение их результата с каждым resolver-сценарием не гарантируется названием helper.

## 4. Ошибки и диагностика

[BizAccessError](../apps/web/src/lib/authDiagnostics.ts) содержит code, message и опциональную diagnostics. Для возвращённой ошибки getUser rejected session определяется как isAuthSessionMissingError, status 401/403 либо code=session_not_found. Эти случаи дают code=NOT_AUTHENTICATED, message=UNAUTHORIZED. Остальные возвращённые auth-ошибки дают code=SERVICE_UNAVAILABLE, message=AUTH_SERVICE_UNAVAILABLE. Это классификация результата getUser, не перехват любого исключения всей цепочки.

При невозможности выбрать бизнес code=NO_BIZ_ACCESS. Публичная структура diagnostics включает флаги пройденных проверок, currentBizId, hasCurrentBizRecord, currentBizHasAllowedRole, счётчики ролей/владения и errorsCount. Полный массив текстов ошибок находится во внутренней диагностике/логах, а не в возвращаемом BizAccessDiagnostics. Часть ошибок current-ветки в эти счётчики не попадает.

**HTTP-код зависит от вызывающей обёртки.** Текущий withManagerContext преобразует NOT_AUTHENTICATED в 401 auth, а любой другой BizAccessError — в 403 forbidden, включая SERVICE_UNAVAILABLE. Поэтому нельзя обещать HTTP 503 только на основании кода resolver. Непойманные исключения обрабатываются внешним handler, если он есть. Контракт конкретного маршрута нужно смотреть в [API-карте](../API_DOCUMENTATION.md).

## 5. Разделение реализации и проверок

| Файл | Ответственность |
| --- | --- |
| [bizContextResolver](../apps/web/src/lib/bizContextResolver.ts) | Аутентификация, оркестрация стратегий, общий результат и метаданные |
| [bizContextResolutionStrategies](../apps/web/src/lib/bizContextResolutionStrategies.ts) | resolveForSuperAdmin, resolveFromCurrentBusiness, resolveFromUserRoles, resolveFromOwnerId; внутренние диагностические данные |
| [bizContextRuntimeHelpers](../apps/web/src/lib/bizContextRuntimeHelpers.ts) | Клиенты/fallback, проверка super-admin, сведение диагностик и название пути выбора |
| [userRoleProfile](../apps/web/src/lib/userRoleProfile.ts) | MANAGER_ROLE_KEYS и роль/доступность кабинетов; authContext переэкспортирует их |
| [withManagerContext](../apps/web/src/lib/withManagerContext.ts) | Перевод BizAccessError в HTTP и создание admin-клиента для handler |
| [currentBusinessService](../apps/web/src/lib/currentBusinessService.ts) | Отдельные операции получения списка и явного сохранения выбора |

Стратегии являются экспортируемыми функциями отдельного файла, а не внутренними функциями resolver. Существующие [unit-тесты resolver](../apps/web/src/__tests__/lib/bizContextResolver.test.ts) — источник сценариев, не свидетельство выполнения этой редакцией. Новая продуктовая задача должна проверять отдельно ошибки Auth/БД, owner-only и role-only, потерю прав к current, несколько бизнесов и различия super-admin/UI/API; порядок проверок — [CONTRIBUTING](../CONTRIBUTING.md).
