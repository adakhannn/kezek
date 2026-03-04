# resolveBizContextForManagers: сценарии и план рефакторинга

Документ разбирает все ветки функции `resolveBizContextForManagers`, фиксирует сценарии в виде таблицы кейсов и готовит план рефакторинга (подфункции + unit-тесты). Связанные задачи: блок 4 — «Сложный и слабо тестируемый resolveBizContextForManagers»; блоки 5.3, 5.6 в `OWNER_CABINET_RISKS_AND_IMPROVEMENTS_TASKS.md`.

---

## 1. Обзор потока

Функция возвращает `{ supabase, userId, bizId }` для кабинета владельца/менеджера или выбрасывает `BizAccessError`.

**Порядок шагов:**

1. **Авторизация** — `supabase.auth.getUser()`. При ошибке или отсутствии пользователя → `NOT_AUTHENTICATED`.
2. **Super admin** — RPC `is_super_admin()`. При `true` ветка super_admin, иначе — обычный пользователь.
3. **Super_admin-ветка:** читаем `user_current_business`; при наличии и существовании бизнеса в `businesses` → этот bizId; иначе ищем бизнес по `slug = 'kezek'` и берём его id.
4. **Обычный пользователь:**
   - Читаем `user_current_business`.
   - Если запись есть: проверяем в `user_roles` + `roles`, что у пользователя есть роль owner/admin/manager для этого biz_id. Если да → этот bizId. Если нет — не переключаем автоматически (bizId остаётся не задан, дальше попытка автовыбора только при отсутствии записи).
   - Если записи в `user_current_business` нет (или мы её не учитываем): автовыбор по `user_roles` (роли owner/admin/manager с ненулевым biz_id) — первый по biz_id; при отсутствии — по `businesses.owner_id = userId` (первый по id).
5. Если к концу bizId не определён → `NO_BIZ_ACCESS` с diagnostics.
6. Иначе возврат `{ supabase, userId, bizId }`.

Константа ролей: `ROLE_KEYS_ALLOWED = ['owner', 'admin', 'manager']`.

---

## 2. Таблица сценариев (кейсы)

| № | is_super_admin | user_current_business | user_roles (owner/admin/manager + biz_id) | businesses.owner_id | Ожидаемый результат |
|---|----------------|----------------------|--------------------------------------------|---------------------|----------------------|
| 1 | true | есть, biz_id = X, X есть в businesses | — | — | bizId = X |
| 2 | true | есть, biz_id = X, X нет в businesses | — | — | fallback: ищем slug=kezek → bizId = kezek или NO_BIZ_ACCESS |
| 3 | true | нет | — | — | bizId = id бизнеса с slug=kezek или NO_BIZ_ACCESS |
| 4 | true | нет, kezek не найден | — | — | NO_BIZ_ACCESS |
| 5 | false | есть, biz_id = X | есть роль owner/admin/manager для X | — | bizId = X |
| 6 | false | есть, biz_id = X | нет роли owner/admin/manager для X | — | Не переключаем; автовыбор по ролям не делаем (hasCurrentBizRecord). Если по owner_id есть бизнес — автовыбор по owner тоже не делаем. → NO_BIZ_ACCESS |
| 7 | false | есть, biz_id = X | нет записей user_roles для X | — | Аналогично п.6 → NO_BIZ_ACCESS |
| 8 | false | нет | есть роли с biz_id (например A, B) | — | bizId = первый по сортировке biz_id (детерминировано) |
| 9 | false | нет | только роли без biz_id (глобальные) | есть бизнес(ы) | bizId = первый бизнес по id по owner_id |
| 10 | false | нет | нет подходящих ролей | есть бизнес(ы) | bizId = первый бизнес по id по owner_id |
| 11 | false | нет | нет подходящих ролей | нет бизнесов | NO_BIZ_ACCESS |
| 12 | false | нет | нет user_roles / ошибка загрузки | есть owner_id | bizId = первый по owner_id или NO_BIZ_ACCESS при ошибке |
| 13 | — | — | — | — | Нет пользователя (getUser fail) → NOT_AUTHENTICATED |

**Уточнение по 6–7:** при наличии записи в `user_current_business` автовыбор по ролям и по owner_id отключён (`shouldAutoSelectFromRoles` и `shouldAutoSelectFromOwner` = false), поэтому если к текущему бизнесу прав нет, bizId так и остаётся пустым → NO_BIZ_ACCESS.

---

## 3. Ветки кода (отображение на подфункции)

| Ветка | Строки (приблизительно) | Ответственность |
|-------|--------------------------|------------------|
| Auth | 15–27 | getUser, выброс NOT_AUTHENTICATED |
| Super-admin check | 33–66 | RPC is_super_admin, флаг isSuper |
| Super-admin: current_biz | 86–149 | Чтение user_current_business, проверка бизнеса в businesses |
| Super-admin: fallback kezek | 151–190 | Поиск businesses по slug=kezek |
| Обычный: current_biz + валидация ролей | 193–286 | Чтение user_current_business, загрузка user_roles для currentBizId и roles, проверка hasAllowedRole |
| Обычный: загрузка user_roles/roles | 287–318 | Общая загрузка user_roles и roles для пользователя |
| Обычный: автовыбор по ролям | 320–412 | shouldAutoSelectFromRoles, eligibleRoles, выбор первого biz_id |
| Обычный: автовыбор по owner_id | 414–477 | shouldAutoSelectFromOwner, первый бизнес по owner_id |
| Финал: NO_BIZ_ACCESS / return | 480–525 | Проверка !bizId, diagnostics, выброс или возврат |

---

## 4. Предлагаемые подфункции

Цель: вынести чистые шаги в функции с явными входами/выходами, чтобы их можно было тестировать изолированно и вызывать из одной точки.

| Подфункция | Входы | Выход | Заметки |
|------------|--------|--------|---------|
| `resolveForSuperAdmin(serviceClient, userId)` | serviceClient, userId | `Promise<{ bizId: string \| null; diagnostics: SuperAdminDiagnostics }>` | Читает user_current_business, проверяет businesses, fallback на slug=kezek. Не бросает, возвращает null при отсутствии. |
| `resolveFromCurrentBusiness(serviceClient, userId, currentBizId)` | serviceClient, userId, currentBizId | `Promise<{ hasAllowedRole: boolean }>` | Загружает user_roles для (userId, currentBizId) и roles, проверяет наличие owner/admin/manager. |
| `resolveFromUserRoles(ur, roleRows, hasCurrentBizRecord)` | ur, roleRows, hasCurrentBizRecord | `string \| null` | Чистая логика: при !hasCurrentBizRecord фильтрует eligible (owner/admin/manager с biz_id), возвращает первый biz_id по сортировке или null. Данные уже загружены. |
| `resolveFromOwnerId(serviceClient, userId, hasCurrentBizRecord)` | serviceClient, userId, hasCurrentBizRecord | `Promise<{ bizId: string \| null; ownedCount?: number }>` | При !hasCurrentBizRecord запрашивает первый бизнес по owner_id, иначе null. Может возвращать count для diagnostics. |
| `loadUserRolesAndRoles(serviceClient, userId)` | serviceClient, userId | `Promise<{ ur: ...; roleRows: ...; errors?: ... }>` | Один раз загружает user_roles и roles. Переиспользуется для текущего бизнеса (если нужен только currentBizId) и для автовыбора. |

Текущая функция тогда: auth → is_super_admin → если super: resolveForSuperAdmin; иначе: читаем current → resolveFromCurrentBusiness (если есть current) → loadUserRolesAndRoles → resolveFromUserRoles → resolveFromOwnerId (если ещё нет bizId) → финал.

---

## 5. План рефакторинга

### 5.1. Выделение подфункций (блок 5.6)

1. **resolveForSuperAdmin** — вынести блок 86–190 в отдельную функцию в том же файле (или в `bizContextResolver/superAdmin.ts`). Вход: serviceClient, userId. Выход: bizId или null + минимальный diagnostics (hasCurrentBizRecord, currentBizId, ошибки загрузки kezek).
2. **resolveFromCurrentBusiness** — вынести проверку «есть ли у пользователя роль owner/admin/manager для currentBizId». Вход: serviceClient, userId, currentBizId. Выход: boolean hasAllowedRole. Загрузку user_roles и roles для этой пары можно оставить внутри или передать из общего loadUserRolesAndRoles (тогда нужна перегрузка/отдельная загрузка только по currentBizId).
3. **resolveFromUserRoles** — чистая функция: принимает массив user_roles (с полями role_id, biz_id), массив roles (id, key), флаг hasCurrentBizRecord. Возвращает первый допустимый biz_id (сортировка по biz_id) или null. Легко покрыть unit-тестами без БД.
4. **resolveFromOwnerId** — вынести запрос первого бизнеса по owner_id. Вход: serviceClient, userId, hasCurrentBizRecord. Выход: bizId или null, опционально count.
5. **loadUserRolesAndRoles** — общая загрузка user_roles по userId и всей таблицы roles. Возврат: { ur, roleRows, errors }.

Сохранить единую точку входа `resolveBizContextForManagers()`: внутри вызывать эти подфункции, собирать diagnostics и бросать NO_BIZ_ACCESS при отсутствии bizId.

### 5.2. Unit-тесты (блок 5.6)

- **resolveFromUserRoles** (чистая логика):
  - Нет записей → null.
  - Есть owner с biz_id A → A.
  - Несколько biz_id (A, B) → первый по сортировке.
  - Только роли без biz_id → null.
  - hasCurrentBizRecord = true и есть роли с biz_id → всё равно null (автовыбор отключён).
- **resolveFromCurrentBusiness** (с моками Supabase):
  - user_roles для (userId, bizId) содержат owner → true.
  - Не содержат owner/admin/manager → false.
  - Пустой user_roles → false.
- **resolveForSuperAdmin** (с моками):
  - Есть user_current_business и бизнес в businesses → возврат этого bizId.
  - Нет user_current_business, есть бизнес kezek → возврат kezek id.
  - Нет ни того ни другого → null.
- **resolveFromOwnerId** (с моками):
  - Есть бизнес по owner_id → возврат его id.
  - Нет → null.
- **Интеграционные сценарии** (моки на уровне БД/клиента):
  - Кейсы 1–4 (super_admin), 5–7 (current_biz без/с правами), 8–12 (автовыбор по ролям/owner), 13 (не авторизован).

### 5.3. Документация (блок 5.6)

- Краткий README или ADR в `docs/` или в коде: назначение `resolveBizContextForManagers`, приоритеты (super_admin → current_biz с проверкой ролей → автовыбор по ролям → по owner_id), поведение при потере прав (не переключаем, NO_BIZ_ACCESS), ссылка на таблицу сценариев в этом документе.

---

## 6. Зависимости и риски рефакторинга

- **authBiz.ts** — `getBizContextForManagers()` повторно экспортирует или вызывает тот же resolver; после рефакторинга оставить один реализационный модуль (bizContextResolver) и в authBiz только реэкспорт или тонкую обёртку.
- **Диагностика** — текущий объект diagnostics используется при NO_BIZ_ACCESS и в логах; при выделении подфункций нужно собирать его из возвращаемых ими данных и передавать в BizAccessError.
- **Логирование** — часть logDebug/logWarn можно оставить в подфункциях или вынести в оркестратор; важно не потерять информацию для отладки.

---

## 7. Ссылки

- Исходный код: `apps/web/src/lib/bizContextResolver.ts`.
- Ошибки: `BizAccessError` из `@/lib/authDiagnostics`.
- Задачи: `OWNER_CABINET_RISKS_AND_IMPROVEMENTS_TASKS.md` (блок 4 — «Сложный и слабо тестируемый…»; блоки 5.3, 5.6).
