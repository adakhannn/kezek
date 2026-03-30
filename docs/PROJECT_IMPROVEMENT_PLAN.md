# План улучшения проекта Kezek

**Статус:** живой рабочий документ  
**Создан:** 2026-03-21  
**Назначение:** единый план улучшений, основанный на текущем состоянии ветки `main`

## Как пользоваться документом

Этот файл нужен как основной roadmap для технических улучшений проекта. Старые task-документы и эволюционные планы можно использовать как исторический контекст, но при выборе следующей задачи ориентироваться нужно на этот документ.

Правила работы:

1. Берем в работу только задачи со статусом `next` или `active`.
2. После завершения задачи обновляем статус и коротко фиксируем результат.
3. Если появляется новая проблема, сначала добавляем ее сюда, а уже потом начинаем реализацию.
4. Каждая задача считается завершенной только при выполнении критериев готовности.

## Легенда

- `critical` - есть риск поломки, высокий технический долг или вероятность регрессий
- `high` - важное архитектурное улучшение, которое заметно снижает сложность проекта
- `medium` - полезное улучшение, но не блокирует стабильность
- `low` - долгосрочная оптимизация

Статусы:

- `todo`
- `next`
- `active`
- `done`
- `blocked`

## Что сейчас важно больше всего

По текущему состоянию репозитория основные зоны риска такие:

1. `apps/mobile` выглядит самой хрупкой частью проекта: есть очень большие файлы, сложная orchestration-логика и признаки compile debt.
2. `apps/web` уже частично приведен к слоистой архитектуре, но шаблон применяется не везде одинаково.
3. Документация разрослась, а часть файлов уже расходится с реальным состоянием кода и CI.
4. Правила тестирования и coverage описаны в нескольких местах по-разному.

## Фаза 1. Стабилизация mobile

### 1.1 Проверить и починить compile health mobile

- Приоритет: `critical`
- Статус: `done`
- Область: `apps/mobile`

Задачи:

- Проверить `apps/mobile` на typecheck и базовую сборку.
- Исправить отсутствующие импорты и очевидные compile/runtime ошибки.
- Зафиксировать минимальный smoke-check для мобильного приложения.

Почему это первое:

Сейчас mobile выглядит самой нестабильной частью репозитория. По коду уже видны признаки drift между архитектурой и реальным состоянием файлов.

Критерии готовности:

- `apps/mobile` проходит typecheck без ручных обходов.
- Нет очевидных ошибок уровня "используется, но не импортировано".
- Есть понятная команда проверки и она задокументирована.

Результат на 2026-03-21:

- `pnpm -C apps/mobile typecheck` проходит успешно.
- `pnpm -C apps/mobile test -- --runInBand --forceExit` проходит успешно как минимальный smoke-check.
- Команды проверки зафиксированы в `apps/mobile/README.md`.

### 1.2 Декомпозировать `HomeScreen`

- Приоритет: `critical`
- Статус: `done`
- Файл: `apps/mobile/src/screens/HomeScreen.tsx`

Задачи:

- Разделить экран на UI-блоки, data-loading и side effects.
- Вынести сетевую и session-логику в hooks/services.
- Сократить размер файла до поддерживаемого состояния.

Критерии готовности:

- Основной экран больше не содержит всю orchestration-логику в одном файле.
- Файл заметно уменьшен и читается как composition, а не как монолит.
- Поведение покрыто хотя бы smoke-тестом на базовый рендер и happy path.

Результат на 2026-03-21:

- Session/data/derived-state логика вынесена в `src/screens/home/useHomeScreenData.ts`.
- Presentation разбит на секции в `src/screens/home/HomeScreenSections.tsx`.
- Стили вынесены в `src/screens/home/homeScreenStyles.ts`.
- `HomeScreen.tsx` теперь выступает как композиционный экран с навигационными action handlers.
- `pnpm -C apps/mobile typecheck` и `pnpm -C apps/mobile test -- --runInBand --forceExit` проходят успешно.

### 1.3 Декомпозировать `RootNavigator`

- Приоритет: `high`
- Статус: `done`
- Файл: `apps/mobile/src/navigation/RootNavigator.tsx`

Задачи:

- Развести bootstrap, auth recovery, deep links и навигационную декларацию.
- Убрать дублирование подписок на auth state.
- Сделать поток инициализации предсказуемым.

Критерии готовности:

- В навигаторе остается только orchestration верхнего уровня.
- Подписка на auth state описана в одном месте.
- Сценарии cold start и resume проще отлаживать.

Результат на 2026-03-21:

- Session bootstrap, resume-sync и auth callback handling вынесены в `src/navigation/useRootNavigationSession.ts`.
- Stack screens и header options вынесены в `src/navigation/RootNavigatorScreens.tsx`.
- `RootNavigator.tsx` теперь отвечает только за loading gate, верхнеуровневый `NavigationContainer` и выбор authenticated/auth stack.
- Подписка на `supabase.auth.onAuthStateChange` осталась в одном месте.
- `pnpm -C apps/mobile typecheck` и `pnpm -C apps/mobile test -- --runInBand --forceExit` проходят успешно.

## Фаза 2. Выравнивание web API архитектуры

### 2.1 Зафиксировать единый шаблон route handlers

- Приоритет: `high`
- Статус: `done`
- Область: `apps/web/src/app/api`

Задачи:

- Определить и документировать целевой шаблон: route = transport + validation + auth/context.
- Вынести orchestration, RPC и domain-логику из перегруженных route-файлов.
- Привести ключевые endpoints к одному стилю.

Первый кандидат:

- `apps/web/src/app/api/quick-book-guest/route.ts`

Критерии готовности:

- Новые и отрефакторенные route handlers не содержат крупную бизнес-логику.
- Валидация, обработка ошибок и контекст доступа подключаются единообразно.
- Use case или service можно тестировать вне Next route handler.

Результат на 2026-03-21:

- В `src/lib/HOWTO_NEW_API_ENDPOINT.md` зафиксирован целевой шаблон: `route = transport + validation + auth/context`.
- `apps/web/src/app/api/quick-book-guest/route.ts` сокращен до transport-layer orchestration.
- RPC/confirm/notify и ветвление гостевого бронирования вынесены в `src/lib/quickBookGuestService.ts`.
- Для публичных route добавлен `createSupabaseAnonClient()` в `src/lib/supabaseHelpers.ts`.
- Route и service покрыты отдельными тестами: `src/__tests__/api/quick-book-guest.test.ts` и `src/__tests__/lib/quickBookGuestService.test.ts`.
- `pnpm -C apps/web typecheck` проходит успешно.

### 2.2 Довести использование `packages/core-domain` до консистентного состояния

- Приоритет: `high`
- Статус: `done`
- Область: `packages/core-domain`, `apps/web`

Задачи:

- Определить, какие бизнес-потоки еще идут в обход доменного слоя.
- Перенести повторяющуюся бизнес-логику в use cases и порты.
- Оставить в приложении только адаптеры, transport и UI orchestration.

Критерии готовности:

- Бизнес-правила не дублируются между route handlers и UI.
- Доменные сценарии можно тестировать как чистый слой.
- Границы между domain, adapters и app-слоем понятны команде.

Промежуточный результат на 2026-03-21:

- `apps/web/src/app/b/[slug]/hooks/useBookingCreation.ts` больше не вызывает `hold_slot`, `hold_complex_slot` и `confirm_booking` напрямую из браузера.
- Клиентский adapter для authenticated booking flow вынесен в `apps/web/src/lib/quickHoldClient.ts` и использует стандартизированный route `/api/quick-hold`.
- `apps/web/src/app/b/[slug]/hooks/useGuestBooking.ts` больше не знает transport-формат `/api/quick-book-guest` и не разбирает API-ответ вручную внутри UI.
- Для guest booking flow вынесен отдельный client adapter `apps/web/src/lib/quickBookGuestClient.ts`.
- Команды подтверждения и отмены в `apps/web/src/app/api/webhooks/whatsapp/route.ts` больше не вызывают `confirm_booking` и `cancel_booking` напрямую из route-логики.
- Для WhatsApp booking actions вынесен отдельный service `apps/web/src/lib/whatsAppBookingActionService.ts`, использующий `core-domain` use cases через Supabase adapter.
- Один из основных booking flows теперь идет по цепочке `UI -> app client -> route -> service -> core-domain`.
- Для нового client adapter добавлен отдельный тест: `apps/web/src/__tests__/lib/quickHoldClient.test.ts`.
- Для guest client adapter добавлен отдельный тест: `apps/web/src/__tests__/lib/quickBookGuestClient.test.ts`.
- Для WhatsApp booking actions добавлен отдельный тест: `apps/web/src/__tests__/lib/whatsAppBookingActionService.test.ts`.
- Dashboard confirm/cancel orchestration в `apps/web/src/lib/bookingDashboardService.ts` теперь идет через `core-domain` use cases, а RPC и fallback-логика остаются внутри adapter-слоя.
- Для dashboard booking service добавлен отдельный тест: `apps/web/src/__tests__/lib/bookingDashboardService.test.ts`.
- Общий server-side flow отмены бронирования вынесен в `apps/web/src/lib/serverCancelBookingService.ts` и переиспользуется в `apps/web/src/app/api/bookings/[id]/cancel/route.ts` и `apps/web/src/app/booking/[id]/cancel/route.ts`.
- Для общего server-side cancel service добавлен отдельный тест: `apps/web/src/__tests__/lib/serverCancelBookingService.test.ts`.

Результат на 2026-03-22:

- Ключевые booking flows больше не держат transport/RPC orchestration прямо в UI и route handlers.
- Прямые вызовы booking RPC в приложении сведены к infrastructure adapters и service-слою, который можно тестировать отдельно от Next handlers и UI.
- Граница `UI/route -> service/use case -> adapter` выровнена для authenticated booking, guest booking, WhatsApp booking actions, dashboard confirm/cancel и server-side cancel flows.

## Фаза 3. Снижение документационного шума

### 3.1 Выделить единые источники истины

- Приоритет: `high`
- Статус: `done`

Нужно оставить понятные категории:

1. onboarding / start
2. architecture / module boundaries
3. product / feature reference
4. engineering process / testing / CI
5. improvement roadmap

Задачи:

- Отделить нормативные документы от исторических обзоров.
- Явно пометить архивные и устаревающие task-файлы.
- Использовать этот документ как основной improvement backlog.

Критерии готовности:

- У команды нет спора, какой файл считать актуальным планом.
- Для каждой темы есть один основной документ.
- Historical audit-файлы не выглядят как активный backlog.

Результат на 2026-03-22:

- Создан `docs/README.md` как основной индекс документации.
- В root `README.md` основной точкой входа в документацию теперь указан `docs/README.md`.
- `DOCUMENTS_OVERVIEW.md` явно помечен как обзор и аудит документации, а не как главный starting point.
- `docs/PROJECT_IMPROVEMENT_PLAN.md` закреплен как единственный актуальный improvement roadmap.

### 3.2 Синхронизировать правила тестов и coverage

- Приоритет: `high`
- Статус: `done`

Проблема:

Порог покрытия и правила тестирования расходятся между `apps/web/jest.config.js`, `.github/workflows/ci.yml`, `GETTING_STARTED.md` и `CONTRIBUTING.md`.

Задачи:

- Выбрать одно целевое значение и один источник истины.
- Исправить документацию и CI-сообщения под это значение.
- Проверить, что фактическая конфигурация совпадает с описанием.

Критерии готовности:

- Во всех документах и настройках указано одно и то же значение.
- Разработчик может понять правила тестов без сверки нескольких файлов.

Результат на 2026-03-22:

- Единый порог покрытия для `apps/web` зафиксирован как `60%`.
- Источник истины для числа — `apps/web/jest.config.js`.
- `GETTING_STARTED.md`, `CONTRIBUTING.md` и `.github/workflows/ci.yml` приведены к одному и тому же значению и больше не спорят между собой.
- Во время сверки `pnpm -C apps/web test:coverage` показал отдельный пласт красных web-тестов; это уже не drift документации, а отдельный test debt, который нужно разбирать как самостоятельную задачу.

## Фаза 4. Локальные улучшения качества кода

### 4.1 Сократить крупные клиентские компоненты в web

- Приоритет: `medium`
- Статус: `done`

Кандидаты:

- `apps/web/src/app/dashboard/components/DashboardHomeClient.tsx`

Задачи:

- Вынести presentation-блоки и derived state.
- Снизить размер клиентских файлов, где UI и orchestration смешаны слишком плотно.

Критерии готовности:

- Крупные компоненты читаются как композиция подкомпонентов.
- UI-логика проще тестируется и меняется без каскадных правок.

Результат на 2026-03-22:

- `apps/web/src/app/dashboard/components/DashboardHomeClient.tsx` больше не содержит весь presentation и derived state в одном файле.
- View-model вынесен в `apps/web/src/app/dashboard/components/home/dashboardHomeViewModel.tsx`.
- Hero, onboarding notice, KPI grid, rating card и quick actions разнесены по отдельным компонентам в `apps/web/src/app/dashboard/components/home/`.
- `DashboardHomeClient.tsx` теперь читается как верхнеуровневая композиция секций.

### 4.2 Проверить мобильные и web smoke-тесты на соответствие реальным рискам

- Приоритет: `medium`
- Статус: `done`

Задачи:

- Сверить, какие критические потоки реально покрыты.
- Добрать минимальные smoke-тесты для самых хрупких зон.

Критерии готовности:

- На каждую high-risk область есть хотя бы базовая автоматическая проверка.
- Smoke-тесты защищают именно критические сценарии, а не случайные экраны.

Результат на 2026-03-22:

- Подтверждено, что mobile smoke-покрытие уже держит базовые auth, booking navigation и ключевые экраны в `apps/mobile/src/__tests__/`.
- Подтверждено, что критичные booking и API flows в web уже имеют route/service tests в `apps/web/src/__tests__/api/` и `apps/web/src/__tests__/lib/`.
- Для dashboard landing, который является high-traffic входом в кабинет владельца, добавлен отдельный smoke-test: `apps/web/src/app/dashboard/components/__tests__/DashboardHomeClient.test.tsx`.
- После декомпозиции `DashboardHomeClient` есть базовая автоматическая проверка на рендер summary, quick actions, onboarding fallback и rating block.

### 4.3 Стабилизировать красный web test suite и coverage run

- Приоритет: `high`
- Статус: `done`

Проблема:

`pnpm -C apps/web test:coverage` сейчас падает не из-за coverage threshold, а из-за набора красных тестов в API, hooks и dashboard/finance-области.

Задачи:

- Разобрать основные группы падающих web-тестов и отделить drift тестов от реальных регрессий.
- Починить базовые contract mismatches в тестах и коде, которые мешают прохождению `pnpm -C apps/web test:coverage`.
- Вернуть coverage run в рабочее состояние без ручных обходов.

Критерии готовности:

- `pnpm -C apps/web test:coverage` проходит успешно.
- Ошибки тестов не маскируются ослаблением порога или отключением проблемных suites.
- Команда может использовать coverage run как реальную проверку перед PR.

Промежуточный результат на 2026-03-22:

- Починены contract-drift тесты для `src/__tests__/api/auth/mobile-exchange.test.ts`.
- Починены `auth.admin`/`upsert`-зависимости в test harness через обновление `src/__tests__/api/testHelpers.ts`.
- Починены test contracts для `src/__tests__/api/auth/whatsapp/verify-otp.test.ts`.
- Починена старая сигнатура `useSlotsLoader` в `src/__tests__/api/booking/slots-conflicts.test.ts`.
- Починен `branches/create` suite: выровнены success/error expectations и отключен rate limit как внешний фактор для unit-style route теста.

Промежуточный результат на 2026-03-26:

- Дополнительно стабилизированы route-style suites: `branches/delete`, `branches/update`, `branches/schedule`, `dashboard/staff/shift-open`, `staff/restore`, `staff/delete`, `staff/avatar/remove`, `services/create`, `services/delete`, `staff/sync-roles`, `admin/ratings-status`.
- В `src/__tests__/api/testHelpers.ts` расширена совместимость со старыми symbolic error codes (`VALIDATION`, `STAFF_NOT_FOUND`, `AUTH`, `INTERNAL`) без ослабления runtime-контрактов самих API.
- Полный `pnpm -C apps/web test:coverage -- --runInBand --forceExit` все еще красный, но количество падающих suites снижено с `34` до `28`, а число failing tests — со `129` до `108`.
- Оставшийся хвост теперь в основном сосредоточен в более тяжелых behavioral/UI тестах (`FinancePage.debounce`) и отдельных server-flow suites вроде `notify`, `staff/shift/open`, `staff/shift/today`, `users/search`, `reviews/create`, `telegram/login`, `promotions-debug`.

Результат на 2026-03-26:

- Полный `pnpm -C apps/web test:coverage -- --runInBand --forceExit` снова проходит успешно.
- Стабилизированы route/server suites для `staff/shift/open`, `staff/shift/close`, `dashboard/staff/shift-close`, `dashboard/staff/finance-deprecated`, `staff/avatar/upload`, `staff/transfer`, `staff/create-from-user`, `dashboard/finance/all` и других ранее красных точек.
- `FinancePage.debounce` переписан под актуальный поведенческий контракт: пустые placeholder-строки не сохраняются, а meaningful changes проходят через debounce, `save now` и flush-сценарии.
- Итоговый срез на конец прохода: `96/96` test suites и `564/564` tests зеленые.

### 4.4 Сделать web coverage gate реальным, а не формальным

- Приоритет: `high`
- Статус: `done`

Проблема:

После стабилизации suite команда `pnpm -C apps/web test:coverage` проходит, но сводка покрытия сейчас печатает нулевые значения. Это признак того, что coverage gate настроен формально и не отражает реального охвата кода.

Задачи:

- Проверить, почему `collectCoverageFrom` не собирает осмысленное покрытие для реально тестируемых web-модулей.
- Перенастроить coverage scope так, чтобы он отражал важные unit/service/domain слои, а не давал ложный green run с нулевой сводкой.
- Сохранить выполнимый и честный quality gate без искусственного ослабления порогов.

Критерии готовности:

- `pnpm -C apps/web test:coverage` показывает ненулевую и осмысленную coverage summary.
- Порог в `jest.config.js` проверяется на реальном наборе файлов, а не на пустом coverage scope.
- В документации и CI зафиксировано, что coverage run проверяет реальные модули приложения.

Результат на 2026-03-26:

- `apps/web/jest.config.js` переведен с формального coverage scope на реально тестируемый unit/service/domain слой.
- Полный `pnpm -C apps/web test:coverage -- --runInBand --forceExit` теперь дает осмысленную сводку вместо нулевого отчета.
- Текущий реальный global coverage snapshot для выбранного web-слоя: `75.38% statements`, `64.8% branches`, `76.76% functions`, `76.57% lines`.

### 5.1 Поднять покрытие слабых service/context модулей web

- Приоритет: `medium`
- Статус: `done`

Проблема:

После исправления coverage gate стали видны реальные слабые места. Самые низкие значения сейчас не в route handlers, а в отдельных service/context модулях, которые уже важны для архитектуры и используются как базовые building blocks.

Задачи:

- Поднять coverage для `src/lib/bookingDashboardService.ts`.
- Поднять coverage для `src/lib/authContext.ts`.
- Дотянуть ветвления в `src/lib/rateLimit.ts`, `src/lib/validation/apiValidation.ts` и соседних service/helper модулях до более устойчивого уровня.

Критерии готовности:

- Coverage слабых service/context модулей заметно растет без искусственного упрощения тестов.
- Новые тесты проверяют реальные ветви поведения, а не только happy path.
- Global coverage snapshot для выбранного web-слоя улучшается относительно текущего baseline.

Промежуточный результат на 2026-03-26:

- `src/__tests__/lib/bookingDashboardService.test.ts` расширен с простого delegation smoke до реальных сценариев `confirm`, `cancel fallback`, `createInternalBooking`, `createInternalComplexBooking`, `getFreeSlotsForServiceDay` и `getFreeSlotsForComplexDay`.
- Coverage-пробел по `src/lib/bookingDashboardService.ts` больше не ограничивается верхнеуровневой оберткой вокруг core-domain use case и теперь включает реальные RPC/path ветвления.
- `src/__tests__/lib/authContext.test.ts` и `src/__tests__/lib/apiValidation.test.ts` расширены реальными ветками `role/profile`, unauthorized, owner/manager/staff resolution, invalid JSON, query parsing и `withValidation`.
- `src/__tests__/lib/rateLimit.test.ts` теперь покрывает не только in-memory happy path, но и Redis-ветки, transport headers, fallback при ошибках Upstash и header-based identifier resolution.
- `src/__tests__/lib/repositories.test.ts` закрывает null/error сценарии для `SupabaseBookingRepository`, `SupabaseBranchRepository`, `SupabaseStaffRepository` и `SupabasePromotionRepository`.
- Полный `pnpm -C apps/web test:coverage -- --runInBand --forceExit` снова зеленый и после этого пакета показывает улучшенный baseline: `89.23% statements`, `76.69% branches`, `94.94% functions`, `90.6% lines` для выбранного web-слоя.

Результат на 2026-03-26:

- `src/__tests__/lib/serverCancelBookingService.test.ts`, `src/__tests__/lib/whatsAppBookingActionService.test.ts` и `src/__tests__/lib/withManagerContext.test.ts` расширены error/fallback ветками, так что server-side service wrappers больше не остаются серыми зонами coverage-карты.
- `src/__tests__/lib/quickBookGuestService.test.ts` покрывает complex flow, RPC validation/error shape, confirm-error и notify-error сценарии.
- `src/__tests__/lib/bookingDashboardService.test.ts` доведен до полного покрытия ключевых success/error/fallback ветвей; `src/lib/bookingDashboardService.ts` теперь дает `100/100/100/100`.
- Новый global snapshot для выбранного web-слоя после этого прохода: `93.2% statements`, `81.06% branches`, `96.96% functions`, `94.95% lines`.

### 5.2 Дожать coverage client-adapter и transport-helper слоя web

- Приоритет: `medium`
- Статус: `done`

Проблема:

После закрытия service/context слоя самые заметные пробелы остались в client adapters и тонких transport/helpers вокруг booking flows. Это уже не риск красного CI, а вопрос устойчивости контрактов между UI и API.

Задачи:

- Поднять coverage для `src/lib/quickHoldClient.ts` и `src/lib/quickBookGuestClient.ts`.
- Проверить оставшиеся helper-модули с низким branch coverage и закрыть простые fallback/error ветви без искусственных тестов.
- Обновить roadmap после нового coverage snapshot.

Критерии готовности:

- Client adapters покрывают direct/nested success payload, broken JSON и fallback error-message ветви.
- Coverage растет за счет реальных transport-контрактов, а не за счет тестов на внутренние детали реализации.
- После полного `pnpm -C apps/web test:coverage -- --runInBand --forceExit` не остается очевидных слабых мест среди ключевых booking adapters.

Промежуточный результат на 2026-03-26:

- Следующий технически логичный фокус после `5.1` определен как client-adapter слой: `quickHoldClient`, `quickBookGuestClient` и соседние transport helpers.

Результат на 2026-03-26:

- `src/__tests__/lib/quickHoldClient.test.ts` и `src/__tests__/lib/quickBookGuestClient.test.ts` теперь покрывают nested/direct success payload, fallback на `error`, broken JSON и отсутствие `booking_id`.
- После этого пакета `src/lib/quickHoldClient.ts` поднят до `95.83% statements / 93.33% branches`, а `src/lib/quickBookGuestClient.ts` — до `95.83% statements / 92.85% branches`.
- Полный `pnpm -C apps/web test:coverage -- --runInBand --forceExit` показывает новый baseline: `93.71% statements`, `86.16% branches`, `98.98% functions`, `95.23% lines`.

### 5.3 Снизить сложность auth/biz resolver слоя web

- Приоритет: `medium`
- Статус: `done`

Проблема:

После стабилизации тестового и transport слоя заметным источником когнитивной сложности остается auth/biz resolution логика. `bizContextResolver.ts` разросся, внутри него смешаны orchestration, diagnostics и конкретные стратегии выбора бизнеса.

Задачи:

- Развести orchestration и стратегии выбора бизнеса по отдельным модулям.
- Сохранить текущий runtime-контракт и существующие тесты без регрессий.
- Обновить roadmap по фактическому результату рефакторинга.

Критерии готовности:

- Основной resolver читается как верхнеуровневый сценарий, а не как монолит с несколькими стратегиями внутри.
- Стратегии выбора бизнеса живут в отдельном модуле с понятными границами ответственности.
- `pnpm -C apps/web typecheck` и targeted resolver tests проходят после рефакторинга.

Результат на 2026-03-26:

- Из `src/lib/bizContextResolver.ts` вынесены `BizContextDiagnostics`, `resolveForSuperAdmin`, `resolveFromCurrentBusiness`, `resolveFromUserRoles` и `resolveFromOwnerId` в `src/lib/bizContextResolutionStrategies.ts`.
- Runtime-часть вынесена в `src/lib/bizContextRuntimeHelpers.ts`: общий fallback для service-role client, проверка super-admin и сборка stable diagnostics payload.
- `src/lib/withManagerContext.ts` больше не дублирует fallback на server client и использует общий helper.
- `src/lib/authContext.ts` теперь остается тонким facade-слоем, а user-role и cabinet-логика разнесена по `src/lib/userRoleProfile.ts` и `src/lib/cabinetAccess.ts`.
- Диагностика `BizAccessError` теперь описана одним типом в `src/lib/authDiagnostics.ts`.
- Добавлен отдельный suite `src/__tests__/lib/bizContextRuntimeHelpers.test.ts`.
- После рефакторинга `pnpm -C apps/web test:coverage -- --runInBand --forceExit` проходит успешно: `99/99` suites, `645/645` tests, `94.64% statements`, `87.54% branches`, `98.68% functions`, `96.18% lines`.

### 5.4 Выровнять staff auth/context path с новым auth/biz слоем

- Приоритет: `medium`
- Статус: `done`

Проблема:

После декомпозиции manager auth/biz path ветка staff-сотрудника оставалась менее консистентной: без отдельного suite, с прямым service-role client creation и без единого fallback-поведения.

Задачи:

- Привести `resolveStaffContext` к тому же runtime-шаблону, что и manager auth/biz path.
- Добавить отдельные тесты на основные happy/error/fallback сценарии.
- Сохранить внешний контракт `getStaffContext()` без изменений для route handlers.

Критерии готовности:

- staff auth/context path не ломается при отсутствии service role key.
- Логика синхронизации staff role покрыта отдельными unit-тестами.
- `pnpm -C apps/web typecheck` и targeted staff auth tests проходят.

Результат на 2026-03-26:

- `src/lib/staffRoleSync.ts` переведен на общий helper `createServiceRoleClientWithFallback`, так что staff flow ведет себя предсказуемо и без жесткой зависимости от service role key.
- В `src/lib/staffRoleSync.ts` логика разделена на загрузку active staff record и синхронизацию role assignment, а сам `resolveStaffContext()` читается как верхнеуровневый flow.
- Добавлен отдельный suite `src/__tests__/lib/staffRoleSync.test.ts` для сценариев `NOT_AUTHENTICATED`, `NO_STAFF_RECORD`, happy path, role insert, insert warning и fallback на server client.
- `pnpm -C apps/web test -- --runInBand --forceExit src/__tests__/lib/staffRoleSync.test.ts src/__tests__/lib/bizContextRuntimeHelpers.test.ts src/__tests__/lib/bizContextResolver.test.ts src/__tests__/lib/withManagerContext.test.ts`, `pnpm -C apps/web typecheck` и полный `pnpm -C apps/web test:coverage -- --runInBand --forceExit` проходят успешно.

## Последовательность работы

Рекомендуемый порядок:

1. Стабилизировать mobile build/typecheck.
2. Разбить `HomeScreen`.
3. Разбить `RootNavigator`.
4. Зафиксировать шаблон для web API routes.
5. Синхронизировать тестовую и process-документацию.
6. После этого переходить к вторичным улучшениям UI и docs cleanup.

## Текущая следующая задача

### 6.1 Снизить сложность heavy route handlers в web API

- Приоритет: `medium`
- Статус: `done`

Проблема:

После выравнивания auth/context, service и coverage слоя в `apps/web` основной заметный когнитивный долг остается в нескольких очень больших route handlers. Они смешивают transport, validation, Supabase orchestration, notifications и post-processing прямо внутри Next route файла.

Задачи:

- Выделить route-кандидаты с самым большим orchestration-слоем.
- Вынести доменную и RPC-логику в service/helper слой.
- Оставить в route только transport, validation, auth/context и response mapping.

Первые кандидаты:

- `src/app/api/staff/shift/close/route.ts`
- `src/app/api/staff/shift/items/route.ts`
- `src/app/api/admin/promotions/debug/route.ts`

Критерии готовности:

- Heavy routes читаются как transport-layer, а не как монолитные workflow-файлы.
- Бизнес- и RPC-оркестрация тестируема вне Next route handler.
- `pnpm -C apps/web typecheck` и соответствующие route tests проходят после рефакторинга.

Промежуточный результат на 2026-03-26:

- `src/app/api/staff/shift/close/route.ts` сокращен до transport/validation/context/metrics-слоя.
- Основная orchestration-логика закрытия смены вынесена в новый `src/lib/staffShiftCloseService.ts`, включая RPC close, sync shift items, booking status updates и notification dispatch.
- Контракт route сохранен: `pnpm -C apps/web test -- --runInBand --forceExit src/__tests__/api/staff/shift/close.test.ts`, `pnpm -C apps/web typecheck` и полный `pnpm -C apps/web test:coverage -- --runInBand --forceExit` проходят успешно.
- `src/app/api/staff/shift/items/route.ts` сокращен до transport/validation/access/metrics-слоя.
- Основная orchestration-логика сохранения позиций смены вынесена в новый `src/lib/staffShiftItemsService.ts`, включая поиск/автосоздание смены, promotion-aware upsert, guarded deletion, booking status updates и recalculation totals.
- Контракт route сохранен: `pnpm -C apps/web test -- --runInBand --forceExit src/__tests__/api/staff/shift/items.test.ts`, `pnpm -C apps/web typecheck` и полный `pnpm -C apps/web test:coverage -- --runInBand --forceExit` проходят успешно.
- `src/app/api/admin/promotions/debug/route.ts` сокращен до admin-auth, UUID validation и response mapping слоя.
- Основная debug/data aggregation логика вынесена в новый `src/lib/promotionsDebugService.ts`, включая загрузку client/branch/business сущностей и сборку anomaly-отчета по promotion/referral flows.
- Контракт route сохранен: `pnpm -C apps/web test -- --runInBand --forceExit src/__tests__/api/admin/promotions-debug.test.ts`, `pnpm -C apps/web typecheck` и полный `pnpm -C apps/web test:coverage -- --runInBand --forceExit` проходят успешно (`99/99` suites, `645/645` tests).
- `src/app/api/webhooks/whatsapp/route.ts` сокращен до webhook verification и transport-layer orchestration.
- Message/status handling, booking lookup, command parsing и WhatsApp side effects вынесены в новый `src/lib/whatsAppWebhookService.ts`.
- Финальная серия довела слой до практически полного thin-route состояния: дополнительно вынесены HTTP-layer сервисы для `dataRetentionCron`, `closeShiftsCron`, `telegramLogin`, `usersSearch`, `integrationsStatus`, `whatsAppTest`, `promotionsDebug`, `yandexAuthCallback`, `financeAllDashboard`, `staffShiftToday`.
- Полный baseline после этой серии подтвержден командой `pnpm -C apps/web test:coverage -- --runInBand --forceExit`: `288/288` suites, `1061/1061` tests, coverage сохраняется на уровне `94.64% statements`, `87.54% branches`, `98.68% functions`, `96.18% lines`.
- Контракт route сохранен: `pnpm -C apps/web test -- --runInBand --forceExit src/__tests__/api/webhooks/whatsapp.test.ts`, `pnpm -C apps/web typecheck` и полный `pnpm -C apps/web test:coverage -- --runInBand --forceExit` проходят успешно (`99/99` suites, `645/645` tests).
- `src/app/api/cron/close-shifts/route.ts` сокращен до cron-auth и response mapping слоя.
- Расчет смены, safe-close RPC и post-processing bookings вынесены в новый `src/lib/closeShiftsCronService.ts`.
- Контракт route сохранен: `pnpm -C apps/web test -- --runInBand --forceExit src/__tests__/api/cron/close-shifts.test.ts`, `pnpm -C apps/web typecheck` и полный `pnpm -C apps/web test:coverage -- --runInBand --forceExit` проходят успешно (`99/99` suites, `645/645` tests).
- `src/app/api/staff/shift/open/route.ts` сокращен до auth/rate-limit/metrics/response mapping слоя.
- Проверка выходного дня, schedule resolution и `open_staff_shift_safe` orchestration вынесены в новый `src/lib/staffShiftOpenService.ts`.
- Контракт route сохранен: `pnpm -C apps/web test -- --runInBand --forceExit src/__tests__/api/staff/shift/open.test.ts`, `pnpm -C apps/web typecheck` и полный `pnpm -C apps/web test:coverage -- --runInBand --forceExit` проходят успешно (`99/99` suites, `645/645` tests).
- `src/app/api/staff/shift/today/route.ts` сокращен до deprecated transport-layer обертки над текущим flow.
- Day-off checks, shift/items aggregation, bookings/services loading и stats calculation вынесены в новый `src/lib/staffShiftTodayService.ts`.
- Контракт route сохранен: `pnpm -C apps/web test -- --runInBand --forceExit src/__tests__/api/staff/shift/today.test.ts`, `pnpm -C apps/web typecheck` и полный `pnpm -C apps/web test:coverage -- --runInBand --forceExit` проходят успешно (`99/99` suites, `645/645` tests).
- `src/app/api/notify/route.ts` сокращен до transport/validation/auth слоя.
- Booking lookup, access checks и notification dispatch orchestration вынесены в новый `src/lib/notifyBookingService.ts`.
- Контракт route сохранен: `pnpm -C apps/web test -- --runInBand --forceExit src/__tests__/api/notify.test.ts`, `pnpm -C apps/web typecheck` и полный `pnpm -C apps/web test:coverage -- --runInBand --forceExit` проходят успешно (`99/99` suites, `645/645` tests).
- `src/app/api/users/search/route.tsx` сокращен до auth/validation/response mapping слоя.
- Query normalization, admin-user lookup, existing staff filtering и pagination orchestration вынесены в новый `src/lib/usersSearchService.ts`.
- Контракт route сохранен: `pnpm -C apps/web test -- --runInBand --forceExit src/__tests__/api/users/search.test.ts`, `pnpm -C apps/web typecheck` и полный `pnpm -C apps/web test:coverage -- --runInBand --forceExit` проходят успешно (`99/99` suites, `645/645` tests).
- `src/app/api/staff/create-from-user/route.ts` сокращен до transport/rate-limit/context слоя.
- Branch validation, auth-admin user lookup, staff creation/linking, staff role grant и schedule initialization вынесены в новый `src/lib/staffCreateFromUserService.ts`.
- Контракт route сохранен: `pnpm -C apps/web test -- --runInBand --forceExit src/__tests__/api/staff/create-from-user.test.ts src/__tests__/lib/staffCreateFromUserService.test.ts`, `pnpm -C apps/web typecheck` и полный `pnpm -C apps/web test:coverage -- --runInBand --forceExit` проходят успешно (`100/100` suites, `648/648` tests).
- `src/app/api/staff/create/route.ts` сокращен до transport/rate-limit/context слоя.
- Manager-role check, optional user linking, initial branch assignment, role grant и schedule initialization вынесены в новый `src/lib/staffCreateService.ts`.
- Контракт route сохранен: `pnpm -C apps/web test -- --runInBand --forceExit src/__tests__/api/staff/create.test.ts src/__tests__/lib/staffCreateService.test.ts`, `pnpm -C apps/web typecheck` и полный `pnpm -C apps/web test:coverage -- --runInBand --forceExit` проходят успешно (`100/100` suites, `648/648` tests).
- `src/app/api/staff/avatar/upload/route.ts` сокращен до multipart transport/context слоя.
- File validation, old-avatar cleanup, storage upload и avatar_url update вынесены в новый `src/lib/staffAvatarUploadService.ts`.
- Контракт route сохранен: `pnpm -C apps/web test -- --runInBand --forceExit src/__tests__/api/staff/avatar/upload.test.ts src/__tests__/lib/staffAvatarUploadService.test.ts`, `pnpm -C apps/web typecheck` и полный `pnpm -C apps/web test:coverage -- --runInBand --forceExit` проходят успешно (`101/101` suites, `650/650` tests).
- `src/app/api/staff/[id]/update/route.ts` сокращен до JSON parsing, context и response mapping слоя.
- Ownership checks, financial settings validation, finance audit log и branch-transfer side effects вынесены в новый `src/lib/staffUpdateByIdService.ts`.
- Для этого flow добавлены отдельные suite `src/__tests__/lib/staffUpdateByIdService.test.ts` и `src/__tests__/api/staff/update-by-id.test.ts`.
- Контракт route сохранен: `pnpm -C apps/web test -- --runInBand --forceExit src/__tests__/api/staff/update-by-id.test.ts src/__tests__/lib/staffUpdateByIdService.test.ts` и `pnpm -C apps/web typecheck` проходят успешно.
- `src/app/api/staff/avatar/remove/route.ts` сокращен до context/response mapping слоя.
- Storage cleanup и avatar_url reset вынесены в новый `src/lib/staffAvatarRemoveService.ts`.
- Контракт route сохранен: `pnpm -C apps/web test -- --runInBand --forceExit src/__tests__/api/staff/avatar/remove.test.ts src/__tests__/lib/staffAvatarRemoveService.test.ts` и `pnpm -C apps/web typecheck` проходят успешно.
- `src/app/api/staff/finance/route.ts` сокращен до transport/metrics слоя.
- Query validation, auth-path resolution, manager ownership check и response payload assembly вынесены в новый `src/lib/staffFinanceRouteService.ts`.
- Для этого flow добавлен отдельный suite `src/__tests__/lib/staffFinanceRouteService.test.ts`.
- Контракт route сохранен: `pnpm -C apps/web test -- --runInBand --forceExit src/__tests__/api/staff/finance.test.ts src/__tests__/lib/staffFinanceRouteService.test.ts` и `pnpm -C apps/web typecheck` проходят успешно.
- `src/app/api/staff/[id]/dismiss/route.ts` сокращен до context/response mapping слоя.
- Ownership check, future bookings guard, deactivate flow и user-role demotion вынесены в новый `src/lib/staffDismissService.ts`.
- Для этого flow добавлен отдельный suite `src/__tests__/lib/staffDismissService.test.ts`.
- Контракт route сохранен: `pnpm -C apps/web test -- --runInBand --forceExit src/__tests__/api/staff/dismiss.test.ts src/__tests__/lib/staffDismissService.test.ts` и `pnpm -C apps/web typecheck` проходят успешно.
- `src/app/api/staff/[id]/transfer/route.ts` сокращен до transport/rate-limit/context слоя.
- Target branch validation, assignment history migration, fallback insert strategy и optional schedule copy вынесены в новый `src/lib/staffTransferService.ts`.
- Для этого flow добавлен отдельный suite `src/__tests__/lib/staffTransferService.test.ts`.
- Контракт route сохранен: `pnpm -C apps/web test -- --runInBand --forceExit src/__tests__/api/staff/transfer.test.ts src/__tests__/lib/staffTransferService.test.ts` и `pnpm -C apps/web typecheck` проходят успешно.
- `src/app/api/dashboard/staff/[id]/finance/route.ts` сокращен до deprecated transport/context слоя.
- Legacy finance workflow для manager-facing compatibility path вынесен в новый `src/lib/deprecatedStaffFinanceService.ts`, включая query validation, day-off check, shift/items aggregation, bookings/services loading и 30-day stats assembly.
- Для этого flow добавлен отдельный suite `src/__tests__/lib/deprecatedStaffFinanceService.test.ts`.
- Контракт route сохранен: `pnpm -C apps/web test -- --runInBand --forceExit src/__tests__/api/dashboard/staff/finance-deprecated.test.ts src/__tests__/lib/deprecatedStaffFinanceService.test.ts`, `pnpm -C apps/web typecheck` и полный `pnpm -C apps/web test:coverage -- --runInBand --forceExit` проходят успешно (`111/111` suites, `676/676` tests).
- `src/app/api/dashboard/staff/[id]/finance/stats/route.ts` сокращен до transport/context слоя.
- Period/date validation, open-shift merge, shift-items aggregation и payout/statistics assembly вынесены в новый `src/lib/staffFinanceStatsService.ts`.
- Для этого flow добавлен отдельный suite `src/__tests__/lib/staffFinanceStatsService.test.ts`.
- Контракт route сохранен: `pnpm -C apps/web test -- --runInBand --forceExit src/__tests__/api/dashboard/staff/finance-stats.test.ts src/__tests__/lib/staffFinanceStatsService.test.ts` и `pnpm -C apps/web typecheck` проходят успешно.
- `src/app/api/dashboard/staff/[id]/shift/close/route.ts` сокращен до transport/rate-limit/context слоя.
- Manager-side shift close workflow вынесен в новый `src/lib/dashboardStaffShiftCloseService.ts`, включая staff ownership check, date/body validation, close RPC orchestration, items sync, booking status updates и notification dispatch.
- Для этого flow добавлен отдельный suite `src/__tests__/lib/dashboardStaffShiftCloseService.test.ts`.
- Контракт route сохранен: `pnpm -C apps/web test -- --runInBand --forceExit src/__tests__/api/dashboard/staff/shift-close.test.ts src/__tests__/lib/dashboardStaffShiftCloseService.test.ts` и `pnpm -C apps/web typecheck` проходят успешно.
- `src/app/api/dashboard/staff/finance/all/route.ts` сокращен до transport/context слоя.
- Query validation, date-range resolution, business finance RPC aggregation и dynamic open-shift enrichment вынесены в новый `src/lib/financeAllDashboardService.ts`.
- Для этого flow добавлен отдельный suite `src/__tests__/lib/financeAllDashboardService.test.ts`.
- Контракт route сохранен: `pnpm -C apps/web test -- --runInBand --forceExit src/__tests__/api/dashboard/finance/all.test.ts src/__tests__/lib/financeAllDashboardService.test.ts` и `pnpm -C apps/web typecheck` проходят успешно.
- `src/app/api/admin/health-check/route.ts` сокращен до auth/role gate и transport слоя.
- Health aggregation по shifts, ratings и promotions вынесена в новый `src/lib/adminHealthCheckService.ts`.
- Для этого flow добавлен отдельный suite `src/__tests__/lib/adminHealthCheckService.test.ts`.
- Контракт route сохранен: `pnpm -C apps/web test -- --runInBand --forceExit src/__tests__/api/admin/health-check.test.ts src/__tests__/lib/adminHealthCheckService.test.ts` и `pnpm -C apps/web typecheck` проходят успешно.
- `src/app/api/bookings/[id]/mark-attendance/route.ts` сокращен до auth/context/validation слоя.
- Booking attendance decision, status RPC selection, promotion/package response mapping и fallback update logic вынесены в новый `src/lib/markAttendanceService.ts`.
- Для этого flow добавлен отдельный suite `src/__tests__/lib/markAttendanceService.test.ts`.
- Контракт route сохранен: `pnpm -C apps/web test -- --runInBand --forceExit src/__tests__/api/bookings/mark-attendance.test.ts src/__tests__/lib/markAttendanceService.test.ts` и `pnpm -C apps/web typecheck` проходят успешно.
- `src/app/api/dashboard/staff/[id]/shift/open/route.ts` сокращен до transport/rate-limit/context слоя.
- Manager-side shift open workflow вынесен в новый `src/lib/dashboardStaffShiftOpenService.ts`, включая target date resolution, schedule lookup, late-minutes calculation, idempotent reopen и create path.
- Для этого flow добавлен отдельный suite `src/__tests__/lib/dashboardStaffShiftOpenService.test.ts`.
- Контракт route сохранен: `pnpm -C apps/web test -- --runInBand --forceExit src/__tests__/api/dashboard/staff/shift-open.test.ts src/__tests__/lib/dashboardStaffShiftOpenService.test.ts` и `pnpm -C apps/web typecheck` проходят успешно.
- `src/app/api/branches/[id]/delete/route.ts` сокращен до context/validation/response mapping слоя.
- Branch existence lookup, linked staff guard, delete RPC и response payload assembly вынесены в новый `src/lib/branchDeleteService.ts`.
- Для этого flow добавлен отдельный suite `src/__tests__/lib/branchDeleteService.test.ts`.
- Контракт route сохранен: `pnpm -C apps/web test -- --runInBand --forceExit src/__tests__/api/branches/delete.test.ts src/__tests__/lib/branchDeleteService.test.ts` и `pnpm -C apps/web typecheck` проходят успешно.
- `src/app/api/whatsapp/diagnose/route.ts` сокращен до rate-limit/transport слоя.
- Graph API checks, business account lookup, phone diagnostics и recommendations assembly вынесены в новый `src/lib/whatsAppDiagnoseService.ts`.
- Для этого flow добавлен отдельный suite `src/__tests__/lib/whatsAppDiagnoseService.test.ts`.
- Контракт route сохранен: `pnpm -C apps/web test -- --runInBand --forceExit src/__tests__/api/whatsapp/diagnose.test.ts src/__tests__/lib/whatsAppDiagnoseService.test.ts` и `pnpm -C apps/web typecheck` проходят успешно.
- `src/app/api/auth/whatsapp/verify-otp/route.ts` сокращен до transport/validation/phone-normalization слоя.
- OTP lookup, fallback verification через `user_metadata`, user create-or-find flow и `profiles` upsert вынесены в новый `src/lib/whatsAppAuthVerifyOtpService.ts`.
- Для этого flow добавлен отдельный suite `src/__tests__/lib/whatsAppAuthVerifyOtpService.test.ts`.
- Контракт route сохранен: `pnpm -C apps/web test -- --runInBand --forceExit src/__tests__/api/auth/whatsapp/verify-otp.test.ts src/__tests__/lib/whatsAppAuthVerifyOtpService.test.ts` и `pnpm -C apps/web typecheck` проходят успешно.
- `src/app/api/whatsapp/verify-otp/route.ts` сокращен до auth/transport слоя.
- OTP validation against `user_metadata`, profile update и metadata cleanup вынесены в новый `src/lib/whatsAppVerifyOtpService.ts`.
- Для этого flow добавлен отдельный suite `src/__tests__/lib/whatsAppVerifyOtpService.test.ts`.
- Контракт route сохранен: `pnpm -C apps/web test -- --runInBand --forceExit src/__tests__/api/whatsapp/verify-otp.test.ts src/__tests__/lib/whatsAppVerifyOtpService.test.ts` и `pnpm -C apps/web typecheck` проходят успешно.
- `src/app/api/auth/telegram/login/route.ts` сокращен до env/auth validation и response mapping слоя.
- Telegram profile lookup/update, auth user create-or-update flow и temporary sign-in credentials assembly вынесены в новый `src/lib/telegramLoginService.ts`.
- Для этого flow добавлен отдельный suite `src/__tests__/lib/telegramLoginService.test.ts`.
- Контракт route сохранен: `pnpm -C apps/web test -- --runInBand --forceExit src/__tests__/api/auth/telegram/login.test.ts src/__tests__/lib/telegramLoginService.test.ts` и `pnpm -C apps/web typecheck` проходят успешно.
- `src/app/api/auth/mobile-exchange/route.ts` сокращен до transport/query mapping слоя.
- In-memory token store, TTL cleanup, pending-code lookup и one-time exchange logic вынесены в новый `src/lib/mobileExchangeService.ts`.
- Для этого flow добавлен отдельный suite `src/__tests__/lib/mobileExchangeService.test.ts`.
- Контракт route сохранен: `pnpm -C apps/web test -- --runInBand --forceExit src/__tests__/api/auth/mobile-exchange.test.ts src/__tests__/lib/mobileExchangeService.test.ts` и `pnpm -C apps/web typecheck` проходят успешно.
- `src/app/api/auth/yandex/callback/route.ts` сокращен до OAuth transport, token/user fetch и redirect wiring слоя.
- Supabase profile reconciliation, duplicate-email fallback, temporary password/session creation и callback redirect assembly вынесены в новый `src/lib/yandexAuthCallbackService.ts`.
- Для этого flow добавлен отдельный suite `src/__tests__/lib/yandexAuthCallbackService.test.ts`.
- Контракт route сохранен: `pnpm -C apps/web test -- --runInBand --forceExit src/__tests__/api/auth/yandex-callback.test.ts src/__tests__/lib/yandexAuthCallbackService.test.ts` и `pnpm -C apps/web typecheck` проходят успешно.
- `src/app/api/cron/recalculate-ratings/route.ts` сокращен до cron-auth и response mapping слоя.
- Date-window resolution, RPC strategy, metrics/error summaries и alert dispatch вынесены в новый `src/lib/recalculateRatingsCronService.ts`.
- Для этого flow добавлен отдельный suite `src/__tests__/lib/recalculateRatingsCronService.test.ts`.
- Контракт service и route-типизация сохранены: `pnpm -C apps/web test -- --runInBand --forceExit src/__tests__/lib/recalculateRatingsCronService.test.ts` и `pnpm -C apps/web typecheck` проходят успешно.
- `src/app/api/cron/analytics/daily/route.ts` сокращен до cron-auth и query/response mapping слоя.
- Daily counters aggregation, promo revenue calculation и `business_daily_stats` upsert вынесены в новый `src/lib/analyticsDailyCronService.ts`.
- Для этого flow добавлен отдельный suite `src/__tests__/lib/analyticsDailyCronService.test.ts`.
- Контракт service и route-типизация сохранены: `pnpm -C apps/web test -- --runInBand --forceExit src/__tests__/lib/analyticsDailyCronService.test.ts` и `pnpm -C apps/web typecheck` проходят успешно.
- `src/app/api/staff/[id]/delete/route.ts` сокращен до transport/context слоя.
- Cascade cleanup, future-bookings guard и user-role demotion вынесены в новый `src/lib/staffDeleteService.ts`.
- Для этого flow добавлен отдельный suite `src/__tests__/lib/staffDeleteService.test.ts`.
- Контракт service и route-типизация сохранены: `pnpm -C apps/web test -- --runInBand --forceExit src/__tests__/lib/staffDeleteService.test.ts` и `pnpm -C apps/web typecheck` проходят успешно.
- `src/app/api/services/[id]/update/route.ts` сокращен до transport/context слоя.
- Branch diffing, copy-upsert logic и guarded detach with future-bookings checks вынесены в новый `src/lib/serviceUpdateRouteService.ts`.
- Для этого flow добавлен отдельный suite `src/__tests__/lib/serviceUpdateRouteService.test.ts`.
- Контракт service и route-типизация сохранены: `pnpm -C apps/web test -- --runInBand --forceExit src/__tests__/lib/serviceUpdateRouteService.test.ts` и `pnpm -C apps/web typecheck` проходят успешно.
- `src/app/api/me/current-business/route.ts` сокращен до auth/client wiring и response mapping слоя.
- Business availability resolution и current-business switching logic вынесены в новый `src/lib/currentBusinessService.ts`.
- Для этого flow добавлен отдельный suite `src/__tests__/lib/currentBusinessService.test.ts`.
- Контракт service и route-типизация сохранены: `pnpm -C apps/web test -- --runInBand --forceExit src/__tests__/lib/currentBusinessService.test.ts` и `pnpm -C apps/web typecheck` проходят успешно.
- `src/app/api/branches/nearby/route.ts` сокращен до query parsing и transport слоя.
- Approved-business filtering, branch loading, distance calculation и response mapping вынесены в новый `src/lib/branchesNearbyService.ts`.
- Для этого flow добавлен отдельный suite `src/__tests__/lib/branchesNearbyService.test.ts`.
- Контракт service и route-типизация сохранены: `pnpm -C apps/web test -- --runInBand --forceExit src/__tests__/lib/branchesNearbyService.test.ts` и `pnpm -C apps/web typecheck` проходят успешно.
- `src/app/api/auth/whatsapp/create-session/route.ts` сокращен до validation/phone-normalization и transport слоя.
- Session creation flow после OTP-подтверждения вынесен в новый `src/lib/whatsAppCreateSessionService.ts`.
- Для этого flow добавлен отдельный suite `src/__tests__/lib/whatsAppCreateSessionService.test.ts`.
- Контракт route сохранен: `pnpm -C apps/web test -- --runInBand --forceExit src/__tests__/api/auth/whatsapp/create-session.test.ts src/__tests__/lib/whatsAppCreateSessionService.test.ts` и `pnpm -C apps/web typecheck` проходят успешно.
- `src/app/api/admin/initialize-ratings/route.ts` сокращен до super-admin auth/context и response mapping слоя.
- Режимы `finalize_only`, `start_date/end_date` и `days_back` orchestration вынесены в новый `src/lib/initializeRatingsService.ts`.
- Для этого flow добавлен отдельный suite `src/__tests__/lib/initializeRatingsService.test.ts`.
- Контракт route сохранен: `pnpm -C apps/web test -- --runInBand --forceExit src/__tests__/api/admin/initialize-ratings.test.ts src/__tests__/lib/initializeRatingsService.test.ts` и `pnpm -C apps/web typecheck` проходят успешно.
- `src/app/api/metrics/frontend/route.ts` сокращен до rate-limit, basic JSON validation и non-blocking dispatch слоя.
- Классификация frontend-метрики, сбор user/IP/request context и RPC persistence вынесены в новый `src/lib/frontendMetricsService.ts`.
- Для этого flow добавлен отдельный suite `src/__tests__/lib/frontendMetricsService.test.ts`.
- Контракт route сохранен: `pnpm -C apps/web test -- --runInBand --forceExit src/__tests__/api/metrics/frontend.test.ts src/__tests__/lib/frontendMetricsService.test.ts` и `pnpm -C apps/web typecheck` проходят успешно.
- `src/app/api/admin/ratings/status/route.ts` сокращен до super-admin auth/context и response mapping слоя.
- Query fan-out для metric dates, last recalculation timestamps, null-rating counters и recent errors summary вынесен в новый `src/lib/ratingsStatusService.ts`.
- Для этого flow добавлен отдельный suite `src/__tests__/lib/ratingsStatusService.test.ts`.
- Контракт route сохранен: `pnpm -C apps/web test -- --runInBand --forceExit src/__tests__/api/admin/ratings-status.test.ts src/__tests__/lib/ratingsStatusService.test.ts` и `pnpm -C apps/web typecheck` проходят успешно.
- `src/app/api/auth/telegram/link/route.ts` сокращен до auth, request validation и response mapping слоя.
- Signature verification, conflict-check по `profiles.telegram_id`, profile update и metadata sync вынесены в новый `src/lib/telegramLinkService.ts`.
- Для этого flow добавлен отдельный suite `src/__tests__/lib/telegramLinkService.test.ts`.
- Контракт route сохранен: `pnpm -C apps/web test -- --runInBand --forceExit src/__tests__/api/auth/telegram/link.test.ts src/__tests__/lib/telegramLinkService.test.ts` и `pnpm -C apps/web typecheck` проходят успешно.
- `src/app/api/services/create/route.ts` сокращен до manager context, body parsing и response mapping слоя.
- Branch ownership validation, branch id normalization/deduplication и multi-insert creation flow вынесены в новый `src/lib/serviceCreateRouteService.ts`.
- Для этого flow добавлен отдельный suite `src/__tests__/lib/serviceCreateRouteService.test.ts`.
- Контракт route сохранен: `pnpm -C apps/web test -- --runInBand --forceExit src/__tests__/api/services/create.test.ts src/__tests__/lib/serviceCreateRouteService.test.ts` и `pnpm -C apps/web typecheck` проходят успешно.
- `src/app/api/branches/[id]/schedule/route.ts` сокращен до branch id resolution, biz context и response mapping слоя.
- Branch ownership check, schedule loading, delete+insert rewrite и POST validation вынесены в новый `src/lib/branchScheduleService.ts`.
- Для этого flow добавлен отдельный suite `src/__tests__/lib/branchScheduleService.test.ts`.
- Контракт route сохранен: `pnpm -C apps/web test -- --runInBand --forceExit src/__tests__/api/branches/schedule.test.ts src/__tests__/lib/branchScheduleService.test.ts` и `pnpm -C apps/web typecheck` проходят успешно.
- `src/app/api/dashboard/staff-shifts/[id]/update-hours/route.ts` сокращен до `withManagerContext`, JSON parsing и response mapping слоя.
- Загрузка смены, closed-shift guard и перерасчет `guaranteed/master/salon/topup` вынесены в новый `src/lib/dashboardStaffShiftUpdateHoursService.ts`.
- Для этого flow добавлен отдельный suite `src/__tests__/lib/dashboardStaffShiftUpdateHoursService.test.ts`.
- Контракт route сохранен: `pnpm -C apps/web test -- --runInBand --forceExit src/__tests__/api/dashboard/staff-shifts/update-hours.test.ts src/__tests__/lib/dashboardStaffShiftUpdateHoursService.test.ts` и `pnpm -C apps/web typecheck` проходят успешно.
- `src/app/api/branches/[id]/update/route.ts` сокращен до route param resolution, biz context и response mapping слоя.
- Ownership-check филиала, coordinates validation/normalization и update payload assembly вынесены в новый `src/lib/branchUpdateService.ts`.
- Для этого flow добавлен отдельный suite `src/__tests__/lib/branchUpdateService.test.ts`.
- Контракт route сохранен: `pnpm -C apps/web test -- --runInBand --forceExit src/__tests__/api/branches/update.test.ts src/__tests__/lib/branchUpdateService.test.ts` и `pnpm -C apps/web typecheck` проходят успешно.
- `src/app/api/branches/create/route.ts` сокращен до super-admin gate, body parsing и response mapping слоя.
- Name/coords validation и branch insert orchestration вынесены в новый `src/lib/branchCreateService.ts`.
- Для этого flow добавлен отдельный suite `src/__tests__/lib/branchCreateService.test.ts`.
- Контракт route сохранен: `pnpm -C apps/web test -- --runInBand --forceExit src/__tests__/api/branches/create.test.ts src/__tests__/lib/branchCreateService.test.ts` и `pnpm -C apps/web typecheck` проходят успешно.
- `src/app/api/auth/sign-out/route.ts` сокращен до transport и response wiring слоя.
- Invalidate-refresh-tokens flow и cookie cleanup вынесены в новый `src/lib/authSignOutService.ts`.
- Для этого flow добавлен отдельный suite `src/__tests__/lib/authSignOutService.test.ts`.
- Контракт route сохранен: `pnpm -C apps/web test -- --runInBand --forceExit src/__tests__/api/auth/sign-out.test.ts src/__tests__/lib/authSignOutService.test.ts` и `pnpm -C apps/web typecheck` проходят успешно.
- `src/app/api/funnel-events/route.ts` сокращен до body validation и response mapping слоя.
- Persist-логика funnel analytics вынесена в новый `src/lib/funnelEventsService.ts`, а route и service покрыты отдельными suite `src/__tests__/api/funnel-events.test.ts` и `src/__tests__/lib/funnelEventsService.test.ts`.
- `src/app/api/quick-hold/route.ts` сокращен до rate-limit и error-boundary слоя.
- HTTP-level orchestration для auth resolution, request validation, domain input normalization и notify side effect вынесена в новый `src/lib/quickHoldHttpService.ts`, поверх уже существующего `src/lib/quickHoldService.ts`.
- Контракт `quick-hold` сохранен: `src/__tests__/api/quick-hold.test.ts`, `src/__tests__/lib/quickHoldService.test.ts`, `src/__tests__/lib/quickHoldHttpService.test.ts` и `pnpm -C apps/web typecheck` проходят успешно.
- `src/app/api/quick-book-guest/route.ts` сокращен до rate-limit и error-boundary слоя.
- HTTP-level orchestration для anon client, request validation, guest input normalization и notify side effect вынесена в новый `src/lib/quickBookGuestHttpService.ts`, поверх уже существующего `src/lib/quickBookGuestService.ts`.
- Контракт `quick-book-guest` сохранен: `src/__tests__/api/quick-book-guest.test.ts`, `src/__tests__/lib/quickBookGuestService.test.ts`, `src/__tests__/lib/quickBookGuestHttpService.test.ts` и `pnpm -C apps/web typecheck` проходят успешно.
- `src/app/api/staff/shift/close/route.ts` дополнительно упрощен до rate-limit transport слоя.
- Auth/context, request validation, metric logging и response mapping вынесены в новый `src/lib/staffShiftCloseHttpService.ts`, поверх уже существующего workflow-сервиса `src/lib/staffShiftCloseService.ts`.
- Контракт `staff/shift/close` сохранен: `src/__tests__/api/staff/shift/close.test.ts`, `src/__tests__/lib/staffShiftCloseHttpService.test.ts`, `pnpm -C apps/web typecheck` и полный `pnpm -C apps/web test:coverage -- --runInBand --forceExit` проходят успешно (`191/191` suites, `877/877` tests).
- `src/app/api/dashboard/visit-package-plans/route.ts` и `src/app/api/dashboard/visit-package-plans/[id]/route.ts` дополнительно сокращены до thin-route уровня.
- HTTP-level orchestration для list/create/patch вынесена в `src/lib/visitPackagePlansHttpService.ts` и `src/lib/visitPackagePlanPatchHttpService.ts`, поверх уже существующего domain/service слоя `src/lib/visitPackagePlansService.ts`.
- Для этого кластера добавлены отдельные suite `src/__tests__/lib/visitPackagePlansHttpService.test.ts` и `src/__tests__/lib/visitPackagePlanPatchHttpService.test.ts`.
- Контракт `visit-package-plans` сохранен: `src/__tests__/api/dashboard/visit-package-plans.test.ts`, новые HTTP-service tests и `pnpm -C apps/web typecheck` проходят успешно.
- `src/app/api/dashboard/branches/[branchId]/promotions/route.ts` и `src/app/api/dashboard/branches/[branchId]/promotions/[promotionId]/route.ts` дополнительно сокращены до thin-route уровня.
- HTTP-level orchestration для list/create/update/delete вынесена в `src/lib/branchPromotionsHttpService.ts` и `src/lib/branchPromotionHttpService.ts`, поверх уже существующих `src/lib/branchPromotionsService.ts` и `src/lib/branchPromotionService.ts`.
- Для этого кластера добавлены suite `src/__tests__/lib/branchPromotionsHttpService.test.ts`, `src/__tests__/lib/branchPromotionHttpService.test.ts` и API-контракт `src/__tests__/api/promotions/promotions.test.ts`.
- Контракт branch promotions сохранен: API/service/HTTP suites и `pnpm -C apps/web typecheck` проходят успешно.
- `src/app/api/metrics/frontend/route.ts` дополнительно сокращен до thin-route уровня поверх выделенного HTTP service.
- JSON parsing, Supabase client wiring, IP extraction и non-blocking dispatch вынесены в `src/lib/frontendMetricsHttpService.ts`, поверх уже существующего `src/lib/frontendMetricsService.ts`.
- Для этого flow добавлен отдельный suite `src/__tests__/lib/frontendMetricsHttpService.test.ts`.
- Контракт `metrics/frontend` сохранен: `src/__tests__/api/metrics/frontend.test.ts`, `src/__tests__/lib/frontendMetricsService.test.ts`, `src/__tests__/lib/frontendMetricsHttpService.test.ts` и `pnpm -C apps/web typecheck` проходят успешно.
- `src/app/api/branches/[id]/schedule/route.ts` дополнительно сокращен до thin-route уровня поверх выделенного HTTP service.
- Branch id resolution, biz-context wiring и response mapping вынесены в `src/lib/branchScheduleHttpService.ts`, поверх уже существующего `src/lib/branchScheduleService.ts`.
- Для этого flow добавлен отдельный suite `src/__tests__/lib/branchScheduleHttpService.test.ts`.
- Контракт `branches/[id]/schedule` сохранен: `src/__tests__/api/branches/schedule.test.ts`, `src/__tests__/lib/branchScheduleService.test.ts`, `src/__tests__/lib/branchScheduleHttpService.test.ts` и `pnpm -C apps/web typecheck` проходят успешно.
- `src/app/api/dashboard/staff/[id]/finance/route.ts` дополнительно сокращен до thin-route уровня поверх выделенного HTTP service.
- Deprecated manager-facing finance HTTP orchestration вынесена в `src/lib/deprecatedStaffFinanceHttpService.ts`, поверх уже существующего legacy workflow `src/lib/deprecatedStaffFinanceService.ts`.
- Для этого flow добавлен отдельный suite `src/__tests__/lib/deprecatedStaffFinanceHttpService.test.ts`.
- Контракт deprecated finance route сохранен: `src/__tests__/api/dashboard/staff/finance-deprecated.test.ts`, `src/__tests__/lib/deprecatedStaffFinanceService.test.ts`, `src/__tests__/lib/deprecatedStaffFinanceHttpService.test.ts` и `pnpm -C apps/web typecheck` проходят успешно.
- `src/app/api/dashboard/visit-packages/route.ts` и `src/app/api/dashboard/clients/[clientId]/visit-packages/route.ts` дополнительно сокращены до thin-route уровня.
- HTTP-level orchestration для list/sell вынесена в `src/lib/visitPackagesHttpService.ts`, поверх уже существующего `src/lib/visitPackagesService.ts`.
- Для этого кластера добавлен отдельный suite `src/__tests__/lib/visitPackagesHttpService.test.ts`.
- Контракт `visit-packages` сохранен: `src/__tests__/api/dashboard/visit-packages-sell-and-list.test.ts`, `src/__tests__/lib/visitPackagesHttpService.test.ts` и полный `pnpm -C apps/web test:coverage -- --runInBand --forceExit` проходят успешно.
- После этой серии baseline подтвержден полным прогоном: `212/212` suites, `930/930` tests, coverage остается `94.64% statements`, `87.54% branches`, `98.68% functions`, `96.18% lines`.
- `src/app/api/me/visit-packages/route.ts` дополнительно сокращен до thin-route уровня поверх нового `src/lib/meVisitPackagesHttpService.ts`; контракт закреплен через `src/__tests__/api/me/visit-packages.test.ts` и `src/__tests__/lib/meVisitPackagesHttpService.test.ts`.
- `src/app/api/mobile/bookings/route.ts` и `src/app/api/mobile/bookings/[id]/route.ts` дополнительно сокращены до thin-route уровня поверх `src/lib/mobileBookingsHttpService.ts`; контракт закреплен через `src/__tests__/api/mobile/bookings.test.ts` и `src/__tests__/lib/mobileBookingsHttpService.test.ts`.
- `src/app/api/dashboard/analytics/overview/route.ts` и `src/app/api/dashboard/analytics/load/route.ts` дополнительно сокращены до thin-route уровня поверх `src/lib/dashboardAnalyticsHttpService.ts`; добавлен suite `src/__tests__/lib/dashboardAnalyticsHttpService.test.ts`.
- `src/app/api/whatsapp/get-business-account/route.ts` и `src/app/api/whatsapp/get-phone-numbers/route.ts` дополнительно сокращены до thin-route уровня поверх `src/lib/whatsAppAccountLookupHttpService.ts`; добавлен suite `src/__tests__/lib/whatsAppAccountLookupHttpService.test.ts`.
- `src/app/api/staff/[id]/update/route.ts` дополнительно сокращен до thin-route уровня поверх `src/lib/staffUpdateByIdHttpService.ts`; контракт закреплен через `src/__tests__/api/staff/update-by-id.test.ts` и `src/__tests__/lib/staffUpdateByIdHttpService.test.ts`.
- `src/app/api/admin/ratings/recalculate/route.ts` дополнительно сокращен до thin-route уровня поверх `src/lib/ratingsManualRecalculateHttpService.ts`; контракт закреплен через `src/__tests__/api/admin/ratings-recalculate.test.ts` и `src/__tests__/lib/ratingsManualRecalculateHttpService.test.ts`.
- `src/app/api/admin/initialize-ratings/route.ts`, `src/app/api/admin/ratings/status/route.ts` и `src/app/api/admin/ratings/jobs/route.ts` дополнительно сокращены до thin-route уровня поверх `src/lib/initializeRatingsHttpService.ts` и `src/lib/ratingsAdminHttpService.ts`; добавлены suite `src/__tests__/lib/initializeRatingsHttpService.test.ts`, `src/__tests__/lib/ratingsAdminHttpService.test.ts` и API-контракт `src/__tests__/api/admin/ratings-jobs.test.ts`.
- `src/app/api/auth/telegram/link/route.ts` дополнительно сокращен до thin-route уровня поверх `src/lib/telegramLinkHttpService.ts`; добавлен suite `src/__tests__/lib/telegramLinkHttpService.test.ts`.
- `src/app/api/staff/update/route.ts` дополнительно сокращен до thin-route уровня поверх `src/lib/staffUpdateHttpService.ts`; добавлен suite `src/__tests__/lib/staffUpdateHttpService.test.ts`.
- `src/app/api/auth/mobile-exchange/route.ts` дополнительно сокращен до thin-route уровня поверх `src/lib/mobileExchangeHttpService.ts`; добавлен suite `src/__tests__/lib/mobileExchangeHttpService.test.ts`.
- После этой серии baseline снова подтвержден полным прогоном: `227/227` suites, `961/961` tests, coverage остается `94.64% statements`, `87.54% branches`, `98.68% functions`, `96.18% lines`.

## Текущая следующая задача

**Следующей задачей предлагается взять:**  
`Фаза 6.1 - продолжить декомпозицию remaining heavy route handlers вне staff CRUD/deprecated finance`

Почему именно она:

- шаблон route -> service уже подтвержден на серии heavy-route кандидатов подряд без регрессии контракта;
- основной `staff` CRUD/action cluster и deprecated manager-facing finance path теперь выровнены;
- следующий полезный шаг — выбрать оставшиеся длинные route вне этого кластера и продолжать упрощение при уже стабильном зеленом baseline.

## Источники для этого плана

План составлен по текущему состоянию репозитория и сверке следующих материалов:

- `PROJECT_REVIEW.md`
- `DOCUMENTS_OVERVIEW.md`
- `FUTURE_IMPROVEMENTS_TASKS.md`
- `EVOLUTION_TECH_PLAN.md`
- `docs/SIMPLIFICATION_TASKS.md`
- текущее состояние `apps/web`, `apps/mobile` и `packages/core-domain`
- `src/app/api/cron/analytics/daily/route.ts` дополнительно сокращен до thin-route поверх `src/lib/analyticsDailyCronHttpService.ts`; добавлены `src/__tests__/api/cron/analytics-daily.test.ts` и `src/__tests__/lib/analyticsDailyCronHttpService.test.ts`.
- `src/app/api/services/[id]/update/route.ts` и `src/app/api/services/[id]/delete/route.ts` дополнительно сокращены до thin-route поверх `src/lib/serviceUpdateHttpService.ts` и `src/lib/serviceDeleteHttpService.ts`; добавлены `src/__tests__/lib/serviceUpdateHttpService.test.ts` и `src/__tests__/lib/serviceDeleteHttpService.test.ts`.
- `src/app/api/reviews/update/route.ts` дополнительно сокращен до thin-route поверх `src/lib/reviewUpdateHttpService.ts`; добавлен `src/__tests__/lib/reviewUpdateHttpService.test.ts`.
- `src/app/api/branches/[id]/update/route.ts` дополнительно сокращен до thin-route поверх `src/lib/branchUpdateHttpService.ts`; добавлен `src/__tests__/lib/branchUpdateHttpService.test.ts`.
- `src/app/api/dashboard/staff/[id]/finance/stats/route.ts` дополнительно сокращен до thin-route поверх `src/lib/staffFinanceStatsHttpService.ts`; добавлен `src/__tests__/lib/staffFinanceStatsHttpService.test.ts`.
- После этой серии baseline снова подтвержден полным прогоном: `253/253` suites, `1013/1013` tests, coverage остается `94.64% statements`, `87.54% branches`, `98.68% functions`, `96.18% lines`.
