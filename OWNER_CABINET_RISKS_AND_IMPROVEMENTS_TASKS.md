## Риски и улучшения кабинета владельца — задачи

Документ-конкретизация разделов «4. Основные риски и слабые места» и «5. Конкретные идеи по улучшению» для дальнейшей реализации.

**Легенда статусов:** `[ ]` — не начато | `[~]` — в работе | `[x]` — сделано

**Итог:** задачи из блоков 4 и 5.1–5.10 выполнены. Документ используется как референс и чек-лист. При появлении новых рисков или идей — добавлять строки в соответствующие таблицы. Ручная проверка сценариев переключения ролей — по [docs/ROLE_SWITCHING_TEST_SCENARIOS.md](docs/ROLE_SWITCHING_TEST_SCENARIOS.md).

---

### Приоритетные UX-улучшения для владельца с несколькими бизнесами

| Статус | Задача | Детали |
|--------|--------|--------|
| [x] | Явный выбор бизнеса после логина | Если у пользователя доступно больше одного бизнеса и нет записи в `user_current_business`, вместо мгновенного редиректа в `/dashboard` отправлять на страницу выбора (например, `/select-business`), где пользователь сам выбирает активный бизнес; после выбора вызывать `POST /api/me/current-business` и только затем переходить в `/dashboard`. |
| [x] | Переключатель бизнеса в шапке кабинета | В layout `/dashboard` всегда показывать текущий бизнес (название + город) и добавить рядом дропдаун «Сменить бизнес» со списком доступных бизнесов, который по клику обновляет `user_current_business` и перезагружает кабинет. |
| [x] | Явное отображение текущего бизнеса во всех разделах | В заголовках ключевых страниц (`Сотрудники`, `Услуги`, `Финансы`, `Аналитика` и др.) дополнительно выводить название текущего бизнеса, чтобы снизить риск действий “не в том бизнесе”. |
| [x] | Корректное поведение при потере прав к текущему бизнесу | Если пользователь лишается прав к бизнесу из `user_current_business`, не переключать его тихо на другой бизнес, а показывать экран выбора/объясняющее сообщение и принудительно просить выбрать новый активный бизнес. |
| [x] | Единый дропдаун роли и бизнеса | В шапке кабинета объединить индикацию текущей роли (владелец/админ/менеджер/сотрудник/клиент) и текущего бизнеса в один элемент управления, из которого можно как переключать бизнес, так и переходить в другие типы кабинетов (`/dashboard`, `/staff`, `/cabinet`, `/admin`) при наличии прав. Реализовано: `RoleAndBusinessSwitcher` в layout. |

---

### 4. Основные риски и слабые места → задачи

| Статус | Риск | Задача |
|--------|------|--------|
| [x] | Дублирование логики ролей и выбора бизнеса | Провести аудит `middleware.ts`, `AuthStatusServer/Client`, `bizContextResolver`, миграций `user_current_business`, зафиксировать текущее поведение и подготовить план консолидации логики (единый модуль ролей и выбора кабинета, см. блок 5.1). Результат: `docs/ROLES_AND_BUSINESS_SELECTION_AUDIT.md`. |
| [x] | Service client без RLS (зависимость от ручных фильтров `biz_id`) | Собрать все места использования `getServiceClient`/service‑клиента, проверить наличие фильтров по `bizId`/`branch.biz_id`, зафиксировать требования к безопасному использованию и подготовить миграцию на обёртку `withManagerContext` (см. блок 5.2 и 5.7). Результат: `docs/SERVICE_CLIENT_AND_BIZ_FILTERS_AUDIT.md`. |
| [x] | Сложный и слабо тестируемый `resolveBizContextForManagers` | Разобрать все ветки (super_admin, `user_current_business`, роли, `owner_id`), описать сценарии в виде таблицы кейсов и подготовить refactor‑план (выделение подфункций и unit‑тесты, см. блок 5.3 и 5.6). Результат: `docs/RESOLVE_BIZ_CONTEXT_SCENARIOS_AND_REFACTOR.md`. |
| [x] | Размытая терминология в UI | Составить список всех текущих текстов про кабинеты в вебе и мобиле, определить целевую схему именования (`/dashboard`, `/staff`, `/cabinet`, `/admin`) и план по обновлению i18n/документации (см. блок 5.5). Результат: `docs/CABINET_TERMINOLOGY_AUDIT.md`. |
| [x] | Неочевидный UX при нескольких ролях у пользователя | Описать текущие сценарии (владелец+клиент, владелец+сотрудник, владелец+админ), зафиксировать проблемные точки (ручной ввод `/cabinet`, непонятно «в каком кабинете» сейчас пользователь) и подготовить UX‑решения (экран выбора роли, переключатель кабинетов, см. блок 5.9). Результат: `docs/MULTI_ROLE_UX_SCENARIOS.md`. |

---

### 5. Конкретные идеи по улучшению → задачи

#### 5.1. Централизовать вычисление ролей и кабинета (высокий приоритет)

| Статус | Задача | Детали |
|--------|--------|--------|
| [x] | Спроектировать API `getUserRoleProfile` и `resolveDefaultDashboard` | Описать структуру профиля ролей (флаги `isOwner`, `isManager`, `isStaff`, `isClient`, `isSuperAdmin`, список бизнесов и их ролей) и контракт выбора кабинета (`/dashboard`, `/staff`, `/cabinet`, `/admin`). Контракт зафиксирован в `docs/ROLES_AND_BUSINESS_SELECTION_AUDIT.md` (раздел 5.1.1) и в коде `lib/authContext.ts`. |
| [x] | Реализовать общий модуль вычисления ролей/кабинета | Создать модуль (например, `lib/authContext.ts`) с функциями `getUserRoleProfile`, `resolveDefaultDashboard`, не зависящий от UI. Реализовано: `apps/web/src/lib/authContext.ts` — `getUserRoleProfile(supabase)`, `resolveDefaultDashboard(profile)`, `shouldRedirectToSelectBusiness(profile, hasCurrentBusiness)`. |
| [x] | Перевести `middleware.ts` на новый модуль | Использовать `resolveDefaultDashboard` вместо локальной логики редиректов с `/`, добавить тесты на основные сценарии. Реализовано: middleware вызывает `getUserRoleProfile`, `resolveDefaultDashboard`, `shouldRedirectToSelectBusiness`; тесты в `__tests__/lib/authContext.test.ts`. |
| [x] | Перевести `AuthStatusServer` и `AuthStatusClient` | Использовать `getUserRoleProfile`/`resolveDefaultDashboard` для отображения кнопок кабинетов и исключить дублирование проверки ролей. Реализовано: оба компонента используют `authContext` (без локальных `getTargetPath`), профиль берётся через `getUserRoleProfile`, путь — через `resolveDefaultDashboard`. |
| [x] | Интегрировать новый модуль в `bizContextResolver` | Синхронизировать выбор текущего бизнеса с новым профилем ролей, минимизировать расхождения и задокументировать зависимость. Реализовано: `bizContextResolver` использует `MANAGER_ROLE_KEYS` из `authContext` для allowed-ролей и диагностики; зависимость зафиксирована в `docs/ROLES_AND_BUSINESS_SELECTION_AUDIT.md` (шаг 5). |

#### 5.2. Ввести обёртку для всех `/api/dashboard/*` (высокий приоритет)

| Статус | Задача | Детали |
|--------|--------|--------|
| [x] | Спроектировать `withManagerContext(handler)` | Определить интерфейс обёртки: получение `bizId`, `supabase` и/или `serviceClient`, формат ошибок при отсутствии авторизации/доступа. Реализовано: `lib/withManagerContext.ts` — тип `ManagerContext`, сигнатура и поведение описаны в `docs/SERVICE_CLIENT_AND_BIZ_FILTERS_AUDIT.md` (раздел 4.1). |
| [x] | Реализовать `withManagerContext` и базовые тесты | Обёртка в `lib/withManagerContext.ts`; тесты в `__tests__/lib/withManagerContext.test.ts`: успешный доступ, 401 при NOT_AUTHENTICATED, 403 при NO_BIZ_ACCESS, проброс прочих ошибок. |
| [x] | Перевести ключевые `/api/dashboard/*` роуты на обёртку | Все роуты приоритета 1 переведены на `withManagerContext`: `analytics/overview`, `analytics/load`, `branches/list`, `staff/finance/all`, `staff/[id]/shift/open`, `staff/[id]/finance` (route, stats, audit-log), `staff-shifts/[id]/update-hours`, `branches/[branchId]/promotions` (GET/POST), `branches/[branchId]/promotions/[promotionId]` (PATCH/DELETE), `integrations-status`. Тесты обновлены (моки `createSupabaseAdminClient`, ожидания `data.data.*`). |
| [x] | Задокументировать правила использования service client | В отдельном README/guide описать, что в `/api/dashboard/*` service client должен использоваться только через `withManagerContext` (кроме явных документированных исключений). Реализовано: `docs/SERVICE_CLIENT_USAGE_GUIDE.md`, см. также `docs/SERVICE_CLIENT_AND_BIZ_FILTERS_AUDIT.md` (разделы 3 и 4.5). |

#### 5.3. Ужесточить инварианты `user_current_business` (высокий приоритет)

| Статус | Задача | Детали |
|--------|--------|--------|
| [x] | Описать инварианты `user_current_business` | Зафиксировать: один активный бизнес на пользователя, соответствие ролям `owner|admin|manager` (и допустимые исключения), поведение при потере прав. Реализовано: `docs/USER_CURRENT_BUSINESS_INVARIANTS.md`. |
| [x] | Вынести изменение текущего бизнеса в единый модуль | Реализовать API/функцию смены текущего бизнеса с проверкой ролей и прав; запретить разрозненные обновления таблицы. Реализовано: единый endpoint `POST /api/me/current-business` (apps/web/src/app/api/me/current-business/route.ts) и клиентский `BusinessSwitcher` в layout, остальные места не пишут в `user_current_business` напрямую (см. также `docs/USER_CURRENT_BUSINESS_INVARIANTS.md` и `docs/AUTH_CHECK_GUIDE.md`). |
| [x] | Перепроверить миграции и backfill‑скрипты | Проверить `backfill_user_current_business` и связанные миграции на соответствие инвариантам; при необходимости подготовить корректирующие миграции. Реализовано: `create_user_current_business.sql` гарантирует одну запись на пользователя (PRIMARY KEY по user_id, CASCADE на auth.users/businesses и RLS‑политики), `backfill_user_current_business.sql` заполняет только пользователей с ролями owner/admin/manager или владельцев бизнеса, детерминированно выбирая минимальный biz_id и не создавая дубликатов; поведение зафиксировано в `docs/USER_CURRENT_BUSINESS_INVARIANTS.md` (разделы 2 и 5–6). |
| [x] | Добавить тесты на выбор бизнеса | Покрыть кейсы: только `owner_id`, только роли, несколько бизнесов, утрата ролей, `super_admin` без текущего бизнеса. Реализовано: базовые unit‑тесты выбора бизнеса в `apps/web/src/__tests__/lib/bizContextResolver.test.ts` (fallback по `owner_id`, `super_admin` без `current_biz`, отсутствие бизнеса → `BizAccessError`); при необходимости можно расширить кейсы по ролям. |

#### 5.4. Проверить и задокументировать Telegram‑линковку (средний приоритет)

| Статус | Задача | Детали |
|--------|--------|--------|
| [x] | Проверить соответствие Telegram Login | Сравнить реализацию проверки `hash`/`auth_date` в обработчике Telegram‑линковки с официальной документацией Telegram Login. Реализовано: `lib/telegram/verify.ts` использует ровно официальный алгоритм (HMAC-SHA256 по data-check-string с ключом SHA256(bot_token), поля сортируются по алфавиту, `auth_date` проверяется на свежесть 24ч); оба обработчика (`/api/auth/telegram/login`, `/api/auth/telegram/link`) вызывают `verifyTelegramAuth` и отклоняют запросы с неверной подписью/просроченным `auth_date`. |
| [x] | При необходимости доработать валидацию | Обновить функцию проверки подписи и обработку ошибок (невалидный `hash`, устаревший `auth_date`, повторы запросов). Реализовано: `verifyTelegramAuth` уже корректно обрабатывает невалидный `hash` и устаревший `auth_date` (логирование + возврат `false`), а обработчики `/api/auth/telegram/login` и `/api/auth/telegram/link` возвращают явный `validation`‑ответ с кодами `invalid_signature`/`missing_data`; защита от повторов реализована через проверку `auth_date` (24ч), дополнительных state‑хранилищ для одноразовости по текущим требованиям не требуется. |
| [x] | Оформить ADR/README по Telegram‑линковке | Описать поток (фронт → бэкенд → БД), формат данных, угрозы и то, как текущая реализация их закрывает. Реализовано: `docs/TELEGRAM_LINKING_ADR.md` с описанием потока Telegram Login/линковки, схемой данных, алгоритмом проверки подписи и анализом угроз. |

#### 5.5. Привести к единому неймингу кабинетов и улучшить переключение (средний приоритет)

| Статус | Задача | Детали |
|--------|--------|--------|
| [x] | Зафиксировать целевые названия кабинетов | Целевая схема: `/dashboard` — «Кабинет бизнеса», `/staff` — «Кабинет сотрудника», `/cabinet` — «Личный кабинет клиента», `/admin` — «Админ‑панель». Зафиксировано как целевые термины для UI/i18n и документации. |
| [x] | Обновить i18n и UI‑подписи | Все ключевые подписи обновлены: в `header.*.ts` `/dashboard` теперь «Кабинет бизнеса» / «Business cabinet» / «Бизнес кабинети», в `dashboard.*.ts` бейдж `dashboard.header.badge` приведён к «Кабинет бизнеса», компоненты `AuthStatusServer`, `AuthStatusClient`, `PersonalCabinetButton`, `DashboardHomeClient`, `RoleAndBusinessSwitcher` и `ErrorDisplay` используют эти ключи; `DashboardNav` уже не содержит терминов про владельца. |
| [x] | Спроектировать индикатор активной роли и переключатель | Продумать UI‑паттерн: отображение текущей роли (владелец / сотрудник / клиент / админ) и переключатель между доступными кабинетами. Реализовано: индикатор и переключатель встроены в `RoleAndBusinessSwitcher` в шапке (показывает текущую роль и бизнес, даёт переход в `/dashboard`, `/staff`, `/cabinet`, `/admin` при наличии прав). |
| [x] | Реализовать поведение при ручном вводе URL | При заходе владельца/сотрудника на `/cabinet` вверху личного кабинета отображается баннер (`cabinet.banner.alsoHasAccess`, `cabinet.banner.linkDashboard`/`linkStaff`/`linkAdmin`), который подсказывает про доступные кабинеты и даёт быстрые ссылки в `/dashboard`, `/staff`, `/admin`; тем самым ручной ввод `/cabinet` не «теряет» пользователя и явно предлагает перейти в кабинет бизнеса. |
| [x] | Обновить документацию по ролям/кабинетам | Внести изменения в README и системную документацию (SYSTEM_FEATURES_DOCUMENTATION, PROJECT_DOCUMENTATION, README мобильного приложения) с таблицей «Роль → Доступные кабинеты → Основные функции». Выполнено: таблица добавлена в SYSTEM_FEATURES_DOCUMENTATION.md (раздел «Роли и кабинеты»), в PROJECT_DOCUMENTATION.md (раздел 2.1 «Роли и кабинеты»), в README.md — ссылки на эти разделы, в apps/mobile/README.md — уточнены подписи кабинетов и ссылка на общую документацию. |

#### 5.6. Разбить и покрыть тестами `resolveBizContextForManagers` (средний приоритет)

| Статус | Задача | Детали |
|--------|--------|--------|
| [x] | Выделить подфункции из `resolveBizContextForManagers` | Разбить реализацию на функции типа `resolveForSuperAdmin`, `resolveFromCurrentBusiness`, `resolveFromUserRoles`, `resolveFromOwnerId` и т.п. Выполнено: в `apps/web/src/lib/bizContextResolver.ts` добавлены подфункции `resolveForSuperAdmin`, `resolveFromCurrentBusiness`, `resolveFromUserRoles`, `resolveFromOwnerId` и тип `BizContextDiagnostics`; основная функция вызывает их по цепочке. Тесты проходят. |
| [x] | Написать unit‑тесты по сценариям | Покрыть комбинации ролей и бизнесов: только owner, только роли, super_admin без `user_current_business`, несколько бизнесов, отсутствие прав. Выполнено: в `apps/web/src/__tests__/lib/bizContextResolver.test.ts` добавлены тесты — выбор по owner_id (был), super_admin без current_biz + kezek (был), NO_BIZ_ACCESS при отсутствии бизнеса (был), выбор только по user_roles (admin), super_admin с current_biz, несколько бизнесов по user_roles (детерминированный выбор по biz_id), отсутствие прав (current_biz без допустимой роли → NO_BIZ_ACCESS), NOT_AUTHENTICATED при отсутствии пользователя. |
| [x] | Задокументировать поведение `resolveBizContextForManagers` | Описать поддерживаемые сценарии и приоритеты выбора бизнеса в коротком README/ADR. Выполнено: создан `docs/BIZ_CONTEXT_RESOLVER_ADR.md` — назначение, приоритеты (super_admin: current_biz → kezek; обычный: current_biz → user_roles → owner_id), таблица сценариев, ошибки, ссылка на подфункции и тесты; в коде добавлена ссылка @see на ADR. |

#### 5.7. Проаудировать все места использования `getServiceClient()` (средний приоритет)

| Статус | Задача | Детали |
|--------|--------|--------|
| [x] | Собрать все вызовы `getServiceClient` | Через поиск по коду найти все использования и сгруппировать по доменам (аналитика, финансы, промо и др.). Выполнено: в `docs/SERVICE_CLIENT_AND_BIZ_FILTERS_AUDIT.md` добавлен раздел 2.8 «Полный перечень вызовов getServiceClient / createSupabaseAdminClient по доменам» — таблица по доменам (аналитика admin/cron, финансы/логи, рейтинги, система/здоровье, промо, метрики, cron, staff, branches, services, bookings, users, funnel, webhooks, auth WhatsApp, dashboard RSC, lib). |
| [x] | Проверить наличие фильтров по `bizId` и филиалам | Убедиться, что в каждом запросе есть `WHERE biz_id = :bizId` и, при работе с филиалами, `branch.biz_id = :bizId`. Выполнено: проверены маршруты dashboard, staff, branches, services, bookings, users/search; в `staff/avatar/upload` и `staff/avatar/remove` добавлены `.eq('biz_id', bizId)` в запросы к staff; в `docs/SERVICE_CLIENT_AND_BIZ_FILTERS_AUDIT.md` добавлен раздел 2.9 «Проверка фильтров по biz_id и филиалам» с таблицей по областям и правилом для филиалов. |
| [x] | Исправить случаи без достаточной фильтрации | Добавить недостающие условия и дополнительные проверки принадлежности сущностей к бизнесу. Выполнено: в `app/dashboard/staff/[id]/page.tsx` к запросу bookings добавлен `.eq('biz_id', bizId)`; в `app/dashboard/services/[id]/page.tsx` к запросу услуги добавлен `.eq('biz_id', bizId)`; ранее добавлены фильтры в staff/avatar (upload, remove). В аудите уточнены funnel-events (публичный, biz_id из тела) и metrics/frontend (системные метрики). |
| [x] | Описать безопасные паттерны использования service client | Подготовить краткий guide с примерами корректных запросов и анти‑паттернами. Выполнено: в `docs/SERVICE_CLIENT_USAGE_GUIDE.md` добавлен подраздел 2.1 «Примеры корректных запросов» (чтение с .eq('biz_id', bizId), проверка через checkResourceBelongsToBiz, вставка с biz_id из контекста, работа с филиалом); раздел 4 «Анти‑паттерны» расширен краткими примерами кода (прямой getServiceClient в дашборде, biz_id из query/body, запрос по id без проверки, вставка с biz_id из body, запрос без фильтра по biz_id, service client на клиенте). |

#### 5.8. Поправить обработку дат для промо‑акций (низкий приоритет)

| Статус | Задача | Детали |
|--------|--------|--------|
| [x] | Проанализировать текущую обработку дат | Найти места с `toISOString().split('T')[0]` для `valid_from/valid_to` и зафиксировать риски по таймзонам (±1 день). См. [docs/DATE_HANDLING_RISKS.md](docs/DATE_HANDLING_RISKS.md). |
| [x] | Выбрать целевую модель работы с датами | Решить, как храним даты (UTC или локальная без времени), и как фронт/бэкенд обмениваются ими, задокументировать решение. См. [docs/DATE_HANDLING_MODEL.md](docs/DATE_HANDLING_MODEL.md). |
| [x] | Обновить код и тесты | Переписать обработку дат под выбранную модель и добавить тесты на граничные случаи (смена дня, разные TZ). Реализовано: `lib/dateUtils.ts` (toNormalizedDateString), `lib/time.ts` (todayDateString, toDateString); промо-маршруты и staff update/create/transfer переведены на них; тесты в `__tests__/lib/dateUtils.test.ts` и `__tests__/lib/time.test.ts`. |

#### 5.9. Улучшить UX при нескольких ролях (низкий приоритет)

| Статус | Задача | Детали |
|--------|--------|--------|
| [x] | Спроектировать UX первого входа при нескольких ролях | Описать и спроектировать экран/диалог выбора «как вы хотите зайти: владелец / сотрудник / клиент» при первом входе. Результат: [docs/FIRST_LOGIN_ROLE_SELECTION_UX.md](docs/FIRST_LOGIN_ROLE_SELECTION_UX.md) — страница `/select-cabinet`, условия показа (≥2 типов кабинетов), элементы экрана, запоминание в cookie, интеграция с middleware. |
| [x] | Реализовать экран выбора кабинета при первом входе | Страница `/select-cabinet`, cookie `kezek_preferred_cabinet`, хелперы в `authContext` (`countAvailableCabinetTypes`, `getPathForPreferredCabinet`, `pathToPreferredCabinet`), правки middleware при заходе на `/`. |
| [x] | Реализовать переключение ролей в UI | Добавить явный переключатель между кабинетами (по аналогии с 5.5), с запоминанием последнего выбора пользователя. Реализовано: RoleAndBusinessSwitcher в шапке. |
| [x] | Протестировать сценарии переключения ролей | Проверить, что смена роли корректно влияет на редиректы, заголовки и доступные действия; зафиксировать найденные UX‑тонкости. Результат: [docs/ROLE_SWITCHING_TEST_SCENARIOS.md](docs/ROLE_SWITCHING_TEST_SCENARIOS.md) — чек-лист редиректов с `/` (один кабинет, несколько без/с cookie), страница `/select-cabinet`, RoleAndBusinessSwitcher, заголовки/контекст, страницы «нет доступа» и UX-заметки. |

#### 5.10. Админ-панель: раздел «Бизнесы» (средний приоритет)

| Статус | Задача | Детали |
|--------|--------|--------|
| [x] | Добавить раздел «Бизнесы» в админ-панели | В админ-панели (супер-админ) добавить раздел «Бизнесы»: список всех бизнесов с возможностью просмотра карточки и редактирования. Реализовано: раздел уже был (список `/admin/businesses`, карточка `/admin/businesses/[id]`); добавлено редактирование карточки — API `PATCH /admin/api/businesses/[id]/update` (name, slug, categories, address, phones, is_approved) и компонент `BusinessCardEdit` на странице детали бизнеса с кнопкой «Редактировать». |

---

### Как пользоваться этим документом

- Отмечайте выполнение задач, заменяя `[ ]` на `[x]`, а для задач «в работе» используйте `[~]`.
- При необходимости добавляйте подзадачи строками в соответствующие таблицы.
- При изменении архитектуры кабинетов, ролей и навигации обновляйте этот документ и связанные описания в общей документации.

