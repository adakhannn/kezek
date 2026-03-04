# ADR: resolveBizContextForManagers — выбор бизнеса для кабинета менеджмента

**Дата:** 2026-03-03  
**Статус:** принят  
**Область:** веб (`apps/web`), модуль `lib/bizContextResolver.ts`

---

## 1. Назначение

`resolveBizContextForManagers()` определяет **текущий бизнес** (`bizId`) для пользователя при работе с кабинетом владельца/админа/менеджера (дашборд, API `/api/dashboard/*`). Возвращает `{ supabase, userId, bizId }` или выбрасывает `BizAccessError`.

Используется в `getBizContextForManagers()` (authBiz) и в обёртке `withManagerContext`.

---

## 2. Приоритеты выбора бизнеса

### 2.1. Супер-админ (RPC `is_super_admin()` = true)

1. **user_current_business** — если есть запись и бизнес с этим `biz_id` существует в `businesses`, возвращается этот `biz_id`.
2. **Fallback** — бизнес с `slug = 'kezek'`. Если не найден или ошибка — возвращается `undefined` (далее → NO_BIZ_ACCESS).

### 2.2. Обычный пользователь

1. **user_current_business** — если есть запись, проверяется наличие у пользователя роли **owner**, **admin** или **manager** для этого `biz_id` (через `user_roles` + `roles`). Если роль есть — возвращается этот `biz_id`. Если записи нет или роли нет — переходим к шагу 2 **только если записи в user_current_business не было** (при «потере прав» автовыбор не делается).
2. **user_roles** — среди ролей пользователя выбираются записи с ключом `owner`/`admin`/`manager` и непустым `biz_id`; берётся первый бизнес по детерминированной сортировке по `biz_id`.
3. **owner_id** — первый бизнес из `businesses` по `owner_id = userId`, сортировка по `id`.

Если после всех шагов `bizId` не найден — выбрасывается `BizAccessError('NO_BIZ_ACCESS')` с диагностикой.

---

## 3. Поддерживаемые сценарии

| Сценарий | Результат |
|----------|-----------|
| Пользователь не аутентифицирован | `BizAccessError('NOT_AUTHENTICATED')` |
| Супер-админ, в user_current_business выбран существующий бизнес | Этот `biz_id` |
| Супер-админ, записи нет или бизнес удалён | Бизнес с slug `kezek` |
| Обычный пользователь, в user_current_business выбран бизнес и есть роль owner/admin/manager | Этот `biz_id` |
| Обычный пользователь, в user_current_business выбран бизнес, но роли нет (потеря прав) | Автовыбор **не** выполняется → при отсутствии других вариантов NO_BIZ_ACCESS |
| Обычный пользователь, записи в user_current_business нет | Автовыбор: сначала по user_roles (owner/admin/manager + biz_id), затем по owner_id |
| Несколько бизнесов по ролям/владельцу | Один бизнес: по user_roles — первый по сортировке `biz_id`; по owner_id — первый по `id` |
| Нет ни ролей, ни владения, ни валидного current_biz | `BizAccessError('NO_BIZ_ACCESS')` с диагностикой |

---

## 4. Ошибки и диагностика

- **NOT_AUTHENTICATED** — не удалось получить пользователя из Supabase Auth.
- **NO_BIZ_ACCESS** — бизнес не определён ни по одному правилу. В `diagnostics` передаются: `hasCurrentBizRecord`, `currentBizId`, `currentBizHasAllowedRole`, счётчики по ролям и владельцу, список ошибок загрузки (для логов и отладки).

---

## 5. Подфункции и тесты

Реализация разбита на подфункции (внутренние):

- `resolveForSuperAdmin(admin, userId)` — текущий бизнес или kezek.
- `resolveFromCurrentBusiness(admin, userId, diagnostics)` — проверка user_current_business и ролей.
- `resolveFromUserRoles(admin, userId, diagnostics)` — автовыбор по user_roles.
- `resolveFromOwnerId(admin, userId, diagnostics)` — фоллбек по owner_id.

Unit-тесты: `apps/web/src/__tests__/lib/bizContextResolver.test.ts` (сценарии: owner_id, только роли, super_admin с/без current_biz, несколько бизнесов, отсутствие прав, NOT_AUTHENTICATED).

---

## 6. Связанные документы

- `docs/ROLES_AND_BUSINESS_SELECTION_AUDIT.md` — обзор компонентов и дублирования логики.
- `docs/USER_CURRENT_BUSINESS_INVARIANTS.md` — инварианты таблицы user_current_business.
- `apps/web/src/lib/authContext.ts` — константа `MANAGER_ROLE_KEYS` (owner, admin, manager).
