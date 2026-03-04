# Аудит: дублирование логики ролей и выбора бизнеса

Документ фиксирует текущее поведение и план консолидации (см. блок 5.1 в `OWNER_CABINET_RISKS_AND_IMPROVEMENTS_TASKS.md`).

---

## 1. Обзор источников

| Компонент | Назначение | Роли | Выбор бизнеса / кабинета |
|-----------|------------|------|---------------------------|
| `middleware.ts` | Редиректы с `/` по ролям | `my_role_keys`, super_admin, owner/admin/manager, staff | `user_current_business` + счёт бизнесов → `/select-business` или `/dashboard` |
| `AuthStatusServer.tsx` | Кнопки «куда идти» в хедере (сервер) | `is_super_admin`, businesses.owner_id, staff, `my_role_keys` | `getTargetPath()` → href + label |
| `AuthStatusClient.tsx` | То же для мобильного меню (клиент) | То же | `getTargetPath()` → href + label + isStaff |
| `bizContextResolver.ts` | Контекст бизнеса для дашборда | super_admin, user_roles + roles, owner_id | `user_current_business` → bizId, без автопереключения при наличии записи |
| `GET/POST /api/me/current-business` | Список бизнесов и текущий выбор | — | owner_id + user_roles (owner/admin/manager) → businesses; POST проверяет доступ и пишет в `user_current_business` |
| Миграция `user_current_business` | Таблица | — | Один biz_id на user_id, RLS по auth.uid() |
| Backfill `user_current_business` | Начальное заполнение | roles.key IN ('owner','admin','manager'), businesses.owner_id | Детерминированный выбор первого biz_id по ролям, затем по owner |

---

## 2. Текущее поведение по компонентам

### 2.1. middleware.ts (только pathname === '/')

- **Авторизация:** `supabase.auth.getUser()` (anon, cookies).
- **Роли:** один вызов `supabase.rpc('my_role_keys')` → массив ключей.
- **Порядок редиректов:**
  1. `super_admin` → `/admin`.
  2. `owner` или `admin`/`manager` → проверка `user_current_business` (через anon client, RLS):
     - если есть `biz_id` → `/dashboard`;
     - иначе: счёт бизнесов (businesses.owner_id + user_roles с join на roles.key, ключи `owner`/`admin`/`manager`); если > 1 → `/select-business`, иначе → `/dashboard`.
  3. Иначе: проверка записи в `staff` (user_id, is_active) → при наличии `/staff`.
  4. Иначе: при роли `staff` по RPC → `/staff`.
- **Дублирование:** константа `ALLOWED_ROLE_KEYS = ['owner','admin','manager']`, логика «доступные бизнесы» (owner_id + user_roles с фильтром по ролям) повторяет API и backfill.

### 2.2. AuthStatusServer.tsx — getTargetPath(supabase, userId)

- **Порядок (цель «куда вести пользователя»):**
  1. Нет userId → `/cabinet`, «Мои записи».
  2. `is_super_admin()` → `/admin`, «Админ-панель».
  3. Счёт `businesses` по `owner_id` > 0 → `/dashboard`, «Кабинет владельца».
  4. Запись в `staff` (user_id, is_active) → `/staff`, «Кабинет сотрудника».
  5. `my_role_keys` содержит owner/admin/manager → `/dashboard`, «Кабинет бизнеса».
  6. Иначе → `/cabinet`, «Мои записи».
- **Отдельно:** проверка «isStaff» для отображения кнопки «Кабинет сотрудника» (staff по таблице + fallback через user_roles + roles.key === 'staff').
- **Дублирование:** порядок приоритетов (super_admin → owner → staff → roles → cabinet) и константы ролей совпадают с middleware и AuthStatusClient.

### 2.3. AuthStatusClient.tsx — getTargetPath(userId, t)

- Логика совпадает с AuthStatusServer (super_admin → owner → staff → my_role_keys owner/admin/manager → cabinet), плюс возврат `isStaff` для UI.
- **Дублирование:** полный дубликат `getTargetPath` и проверки isStaff (включая fallback через user_roles + roles).

### 2.4. bizContextResolver.ts — resolveBizContextForManagers()

- **Клиент:** server client (auth) + admin/service client (обход RLS).
- **Порядок:**
  1. super_admin: читает `user_current_business`; при наличии и существовании бизнеса в `businesses` → этот bizId; иначе fallback на бизнес с slug `kezek`.
  2. Обычный пользователь: читает `user_current_business`; если есть запись — проверяет в user_roles + roles, что есть роль owner/admin/manager для этого biz_id; если да → этот bizId; если нет — не переключает автоматически (NO_BIZ_ACCESS при необходимости).
  3. Если записи в `user_current_business` нет: автовыбор по user_roles (роли owner/admin/manager, с biz_id) — первый по biz_id; при отсутствии — по businesses.owner_id (первый по id).
- **Константа:** `ROLE_KEYS_ALLOWED = ['owner','admin','manager']`.
- **Дублирование:** те же роли и понятие «доступные бизнесы»; логика «есть ли запись в user_current_business и есть ли права» нигде больше не собрана в одном месте.

### 2.5. GET /api/me/current-business

- **Клиент:** server (auth) + admin (чтение).
- Читает `user_current_business`, businesses по `owner_id`, user_roles по user_id; по role_id получает roles.key и фильтрует по owner/admin/manager; собирает список businesses с id/name/slug (city = null).
- **Дублирование:** определение «доступных бизнесов» совпадает с middleware и bizContextResolver, но реализовано отдельно (admin, без RPC).

### 2.6. POST /api/me/current-business

- Проверка доступа: owner_id бизнеса === user или в user_roles для этого biz_id есть роль owner/admin/manager (через admin + таблица roles).
- Запись: admin.upsert в `user_current_business`.
- **Дублирование:** проверка «имеет ли пользователь право на этот бизнес» — та же семантика, что в resolver и GET.

### 2.7. Миграции user_current_business

- **create:** таблица (user_id PK, biz_id NOT NULL, updated_at), RLS (SELECT/INSERT/UPDATE/DELETE только свой user_id).
- **backfill:** один раз заполняет запись для пользователей, у которых её ещё нет; приоритет: (1) роль owner/admin/manager с biz_id (минимальный biz_id), (2) иначе owner_id (минимальный id бизнеса).
- **Инвариант:** одна запись на пользователя; biz_id должен быть бизнесом, к которому у пользователя есть право (в миграции не проверяется явно, только выбор из «допустимых» источников).

---

## 3. Сводка дублирования

| Элемент | middleware | AuthStatusServer | AuthStatusClient | bizContextResolver | API current-business | Backfill |
|--------|------------|------------------|------------------|--------------------|----------------------|----------|
| Константа owner/admin/manager | ✓ (локально) | ✓ (в коде) | ✓ (в коде) | ✓ ROLE_KEYS_ALLOWED | ✓ ALLOWED_ROLE_KEYS | ✓ в SQL |
| is_super_admin | — | ✓ | ✓ | ✓ | — | — |
| my_role_keys | ✓ | ✓ | ✓ | — | — | — |
| «Владелец» (businesses.owner_id) | ✓ (счёт) | ✓ (счёт) | ✓ (счёт) | ✓ (выбор biz) | ✓ (список) | ✓ |
| «Доступные бизнесы» (owner + roles) | ✓ | — | — | ✓ | ✓ | ✓ |
| user_current_business (чтение) | ✓ | — | — | ✓ | ✓ | — |
| Проверка staff (таблица + fallback) | ✓ (таблица) | ✓ + fallback | ✓ + fallback | — | — | — |
| Решение «куда редиректить» | ✓ | ✓ getTargetPath | ✓ getTargetPath | — | — | — |

---

## 4. Риски текущего состояния

- Разное поведение при изменении правил: нужно править несколько мест (middleware, оба AuthStatus, resolver, API, backfill).
- Расхождение клиентов: middleware использует anon+RLS, resolver и API — admin; при жёстких RLS список бизнесов в middleware может не совпадать с API.
- Нет единого контракта «профиль ролей пользователя» и «дефолтный кабинет» — каждая точка сама интерпретирует роли и приоритеты.
- Проверка isStaff дублирована (таблица staff + fallback user_roles) в двух компонентах.

---

## 5. План консолидации (связь с блоком 5.1)

### 5.1. Единый модуль ролей и выбора кабинета

**Цель:** один источник истины для «кто пользователь по ролям» и «куда его вести по умолчанию».

| Шаг | Задача | Детали |
|-----|--------|--------|
| 1 | Спроектировать API профиля и дефолтного кабинета | Ввести типы/контракт: `UserRoleProfile` (isSuperAdmin, isOwner, isManager, isStaff, isClient, businessesWithRoles[]), `resolveDefaultDashboard(profile)` → { path, label }. Зафиксировать приоритет: super_admin → owner/admin/manager (dashboard) → staff → client (cabinet). |
| 2 | Реализовать общий модуль (lib/authContext.ts или lib/roleProfile.ts) | Функции: `getUserRoleProfile(supabase, userId?)` — опционально с admin-клиентом для списка бизнесов; `resolveDefaultDashboard(profile)`. Использовать RPC `my_role_keys` и `is_super_admin`, таблицы businesses, staff, user_roles, roles, user_current_business. Не зависеть от UI. |
| 3 | Перевести middleware на новый модуль | Вызывать `getUserRoleProfile` (в middleware только anon; при необходимости вынести «доступные бизнесы» в RPC или оставить минимальную логику редиректа по флагам профиля). Использовать `resolveDefaultDashboard` для выбора path при pathname === '/'. |
| 4 | Перевести AuthStatusServer и AuthStatusClient | Убрать локальные `getTargetPath`. Использовать `getUserRoleProfile` + `resolveDefaultDashboard`; isStaff брать из профиля. Единые подписи/лейблы из модуля или i18n-ключей, заданных в контракте. |
| 5 | Интегрировать с bizContextResolver | Профиль не заменяет resolver (resolver нужен для bizId и доступа к данным дашборда). Синхронизировать константы ролей (owner/admin/manager) и семантику «доступные бизнесы» с новым модулем; при необходимости вызывать общую функцию получения списка бизнесов из одного места. Реализовано частично: `bizContextResolver` использует экспортируемый `MANAGER_ROLE_KEYS` из `authContext`, так что список ролей и диагностические `allowedRoles` теперь совпадают с профилем. |
| 6 | API /api/me/current-business | Оставить как endpoint для списка и смены текущего бизнеса; при консолидации — переиспользовать из общего модуля логику «доступные бизнесы» и проверку прав на biz_id, чтобы не дублировать. |

### 5.1.1. Реализованный API (lib/authContext.ts)

**Модуль:** `apps/web/src/lib/authContext.ts`.

**Типы:**
- `UserRoleProfile` — профиль ролей: `userId`, флаги `isSuperAdmin`, `hasOwnerBiz`, `hasManagerRoles`, `hasStaff`, `isClient`; доступ к кабинетам `canAdmin`, `canDashboard`, `canStaff`, `canCabinet`; массив `businesses: { id, role: 'owner'|'admin'|'manager' }[]`.
- `DefaultDashboardResult` — путь по умолчанию: `{ path: '/admin' | '/dashboard' | '/select-business' | '/staff' | '/cabinet' }`.
- `BusinessWithRole` — `{ id: string; role: ManagerRoleKey }`.

**Функции:**
- `getUserRoleProfile(supabase)` — получает пользователя из `supabase.auth.getUser()`, дергает `is_super_admin`, `my_role_keys`, таблицы `businesses`, `staff`, `user_roles` + `roles`; собирает флаги и список бизнесов с ролями. Возвращает `UserRoleProfile | null` при неавторизованном пользователе.
- `resolveDefaultDashboard(profile)` — по профилю возвращает путь: приоритет super_admin → /admin; иначе hasManagerRoles → /dashboard; иначе hasStaff → /staff; иначе /cabinet.
- `shouldRedirectToSelectBusiness(profile, hasCurrentBusiness)` — true, если у пользователя несколько бизнесов и нет записи в user_current_business (для решения редиректа на /select-business после выбора /dashboard).

**Контракт:** один источник правды для приоритета кабинетов; не зависит от UI. Middleware и AuthStatus могут использовать профиль и результат resolveDefaultDashboard вместо локальной логики.

---

### 5.2. Инварианты user_current_business (кратко)

- Одна запись на пользователя; смена только через единый слой (POST /api/me/current-business или будущий сервис с проверкой прав).
- Допустимые значения biz_id: бизнес, где пользователь owner_id или имеет в user_roles роль owner/admin/manager (для super_admin — любой существующий бизнес при необходимости зафиксировать в доке).

### 5.3. Порядок внедрения

1. Добавить типы и контракт (профиль + resolveDefaultDashboard).
2. Реализовать `getUserRoleProfile` и `resolveDefaultDashboard` в lib, покрыть тестами основные кейсы.
3. Подключить middleware → затем AuthStatusServer и AuthStatusClient.
4. Вынести общую логику «доступные бизнесы» / проверку прав в модуль; подключить API current-business и при необходимости bizContextResolver.
5. Обновить документацию и OWNER_CABINET_RISKS_AND_IMPROVEMENTS_TASKS (отметить выполнение подзадач 5.1).

---

## 6. Ссылки

- Задачи кабинета владельца: `OWNER_CABINET_RISKS_AND_IMPROVEMENTS_TASKS.md` (блок 4, задача «Дублирование логики…»; блок 5.1).
- Миграции: `supabase/migrations/20260224000000_create_user_current_business.sql`, `20260224001000_backfill_user_current_business.sql`.
- RPC: `my_role_keys`, `is_super_admin` (типы в `apps/web/src/types/supabase.ts`).
