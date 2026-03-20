# План поэтапного улучшения проекта Kezek

**Статус:** рабочий roadmap  
**Цель:** постепенно упростить проект, снизить стоимость изменений и убрать накопленную сложность без большого одномоментного рефакторинга.  
**Принцип:** идем небольшими итерациями, каждый этап должен приносить локальную пользу и не ломать текущую разработку.

---

## 1. Как пользоваться документом

- Выполнять задачи по этапам, не смешивая сразу несколько больших рефакторингов.
- Каждый этап завершать коротким итогом: что изменили, какие файлы стали проще, какие риски сняли.
- Перед началом крупной задачи фиксировать текущие инварианты тестами.
- Новую логику по возможности сразу класть в выделенный слой, а не усиливать старые монолиты.

---

## 2. Главные цели

1. Упростить самые перегруженные участки кода.
2. Довести архитектурную границу между `apps/*`, доменной логикой и инфраструктурой.
3. Убрать рассинхрон между кодом и документацией.
4. Централизовать работу со временем, бизнес-таймзонами и клиентскими данными.
5. Снизить риск регрессий через тесты на критичных потоках.

---

## 3. Этап 1. Быстрые выпрямления и снижение риска

### 3.1. Документация и карта проекта

- [x] Создать единый индекс документации в `docs/README.md`.
- [x] Перенести в индекс список главных документов:
  - `README.md`
  - `GETTING_STARTED.md`
  - `PROJECT_DOCUMENTATION.md`
  - `SYSTEM_FEATURES_DOCUMENTATION.md`
  - `PROJECT_REVIEW.md`
- [x] Пометить документы по статусам:
  - `актуален`
  - `нуждается в проверке`
  - `архивный`
- [x] Убрать рассинхрон в обзорах документации.

Подзадачи:

- [x] Обновить `DOCUMENTS_OVERVIEW.md`, так как он уже не соответствует текущему состоянию `README.md`.
- [x] Проверить `PROJECT_REVIEW.md` на утверждения, которые уже не совпадают с кодом.
- [x] Составить список документов, которые описывают уже завершенные работы и должны быть перемещены в архивный раздел.

### 3.2. Логирование и технические исключения

- [x] Провести короткий аудит прямых `console.*` вызовов в production-коде.
- [x] Зафиксировать список допустимых исключений.
- [x] Обновить документацию по логированию, чтобы она совпадала с реальным кодом.

Подзадачи:

  - [x] Проверить:
    - `apps/web/src/lib/apiMetrics.ts`
    - `apps/web/src/lib/apiLogger.ts`
    - `apps/web/src/lib/webVitals.ts`
    - `apps/web/src/lib/senders/whatsapp.ts`
  - `apps/web/src/lib/senders/whatsapp.ts`
- [x] Решить по каждому месту:
  - заменить на централизованный логгер
  - либо оставить как инфраструктурное исключение
- [x] Обновить документ с политикой логирования и явно перечислить разрешенные исключения.

### 3.3. Хвосты и временные ветки

- [x] Найти переходные участки, где функциональность отключена или оставлена наполовину.
- [x] Для каждого такого места принять одно из решений:
  - допилить
  - убрать
  - явно пометить как отложенное решение

Подзадачи:

- [x] Упростить `apps/web/src/app/auth/sign-in/SignInPage.tsx`, где сейчас фактически используется только email-flow.
- [x] Разобрать TODO в `apps/web/src/app/admin/api/businesses/[id]/members/invite/route.ts`.
- [x] Проверить мелкие TODO/FIXME в `apps/web`, `apps/mobile`, `packages`.

### 3.4. Базовые тестовые страховки

- [x] Для критичных рефакторингов этапа 2 сначала добавить тесты на текущее поведение.

Подзадачи:

- [x] Добавить или обновить тесты для:
  - [x] business context resolution
  - [x] sign-in redirect logic
  - [x] mobile auth/session bootstrap
  - [x] публичного booking-flow

---

## 4. Этап 2. Разделение крупных модулей

### 4.1. Публичный booking-flow

- [x] Упростить и дополнительно декомпозировать `apps/web/src/app/b/[slug]/view.tsx`.
- [x] Свести логику страницы к orchestration-уровню, а не к хранению всех правил внутри одного файла.

Подзадачи:

- [x] Выделить отдельный слой для:
  - синхронизации URL state
  - выбора branch/service/staff/day
  - правил переходов между шагами
  - побочных эффектов аналитики
- [x] Убрать остаточные вычисления, которые можно вынести в hooks/services/domain helpers.
- [x] Пересмотреть состояние экрана и решить, нужен ли здесь state machine/store вместо набора `useState`.

### 4.2. API route для смен и финансов

- [x] Разгрузить `apps/web/src/app/api/staff/shift/items/route.ts`.
- [x] Сделать route handler тонким адаптером.

Подзадачи:

- [x] Вынести отдельно:
  - авторизацию и определение режима доступа
  - загрузку смены
  - расчет процентов и нормализацию данных
  - сохранение shift items
  - api metrics/logging wrapper
- [x] Создать application/service слой для сценария “сохранить элементы смены”.
- [x] Оставить в route только:
  - валидацию входа
  - вызов use case/service
  - преобразование результата в HTTP response

### 4.3. Mobile navigation и auth orchestration

- [x] Упростить `apps/mobile/src/navigation/RootNavigator.tsx`.
- [x] Отделить навигацию от auth/session bootstrap.

Подзадачи:

- [x] Вынести в отдельный модуль:
  - обработку deep links
  - обмен токенов
  - проверку pending tokens
  - реакцию на `AppState`
- [x] Убрать дублирование подписок на `supabase.auth.onAuthStateChange`.

- [x] Свести `RootNavigator` к выбору ветки навигации и экранов.
### 4.4. Крупные UI/feature файлы

- [x] Составить список файлов-кандидатов на декомпозицию по размеру и ответственности.

Подзадачи:

- [x] Первыми рассмотреть:
  - `apps/web/src/app/staff/finance/hooks/useShiftItems.ts`
  - `apps/web/src/app/dashboard/staff/[id]/schedule/Client.tsx`
  - `apps/web/src/app/staff/finance/components/FinancePage.tsx`
  - `apps/mobile/src/screens/ShiftQuickScreen.tsx`
  - `apps/mobile/src/screens/HomeScreen.tsx`
- [x] Для каждого файла решить:
  - вынести вычисления
  - вынести side effects
  - вынести сетевой слой
  - разрезать UI на меньшие компоненты

Текущий прогресс по первой волне:

- [x] `apps/web/src/app/staff/finance/hooks/useShiftItems.ts`
  - [x] Вынесены чистые helpers сериализации, фильтрации, deduplication и обновления `expandedItems`.
  - [x] Вынесен повторяющийся API/error слой в отдельный модуль `shiftItemsApi.ts`.
  - [x] Вынесен autosave lifecycle в отдельный hook `useShiftItemsAutosave.ts`.
  - [x] Вынесена merge/sync стратегия в отдельный hook `useShiftItemsSync.ts`.
  - [x] Добавлены unit-тесты на helper-модуль.
- [~] `apps/web/src/app/dashboard/staff/[id]/schedule/Client.tsx`
  - [x] Вынесен первый UI-срез: экран переведён на внешний `DayRow` компонент.
  - [x] Добавлен smoke-test на импорт модуля.
  - [x] Вынесены week/date helper и page-level schedule rules hook.
  - [x] Старый встроенный data/effect слой убран из `Client.tsx`, экран переведён на `useScheduleRules`.
  - [x] Вынесен transfers/data orchestration hook для вкладки переводов.
  - [x] Вынесены tab-level sections в отдельные screen components.
  - [ ] При желании отдельным проходом можно вынести tabs navigation и ещё сильнее ужать page-container.
- [x] `apps/web/src/app/staff/finance/components/FinancePage.tsx`
  - [x] Подготовлены выносы для page-state и date-prefetch в отдельные hooks.
  - [x] `useFinancePageState.ts` подключён к экрану.
  - [x] `useFinanceDatePrefetch.ts` подключён к экрану.
  - [x] Вынесен loading-state derivation в `useFinanceLoadingState.ts`.
  - [x] Вынесен local items orchestration в `useFinanceLocalItems.ts`.
  - [x] Добавлен smoke-test на модуль страницы.
  - [x] Убран остаточный inline prefetch-код из страницы.
  - [x] Вынесены tab-level sections в `FinanceShiftTab.tsx`, `FinanceClientsTab.tsx`, `FinanceStatsTab.tsx`.
  - [x] Повторно пройден smoke-test после декомпозиции.
- [x] `apps/mobile/src/screens/ShiftQuickScreen.tsx`
  - [x] Вынесены shared types в `shiftQuick/types.ts`.
  - [x] Вынесен offline/cache storage слой в `shiftQuick/storage.ts`.
  - [x] Вынесены чистые расчёты в `shiftQuick/calculations.ts`.
  - [x] Вынесен state формы в `useShiftQuickAddClientForm.ts`.
  - [x] Вынесен mutation/offline orchestration слой в `useShiftQuickOperations.ts`.
  - [x] Вынесены UI-секции в `ShiftQuickStatusCard.tsx`, `ShiftQuickStatsGrid.tsx`, `ShiftQuickAddClientCard.tsx`, `ShiftQuickClientsSection.tsx`.
  - [x] Общие стили вынесены в `shiftQuick/styles.ts`.
  - [x] Staff-info и finance query слой вынесен в `useShiftQuickData.ts`.
  - [x] Добавлен unit-test на `shiftQuickCalculations.unit.test.ts`.
  - [x] Screen-level loading / not-staff / error ветки вынесены в `ShiftQuickScreenState.tsx`.
  - [x] Offline queue indicator вынесен в `ShiftQuickOfflineIndicator.tsx`.
  - [x] Unit-test `shiftQuickCalculations.unit.test.ts` повторно пройден после финального прохода.
- [x] `apps/mobile/src/screens/HomeScreen.tsx`
  - [x] Вынесены shared types в `home/types.ts`.
  - [x] Вынесены derived selectors в `home/selectors.ts`.
  - [x] Вынесен data/query слой в `home/useHomeData.ts`.
  - [x] Добавлен unit-test `homeSelectors.unit.test.ts`.
  - [x] Верхняя hero-секция вынесена в `HomeHeroSection.tsx`.
  - [x] Блок ближайших записей вынесен в `HomeUpcomingBookingsSection.tsx`.
  - [x] Search-секция вынесена в `HomeSearchSection.tsx`.
  - [x] Categories-секция вынесена в `HomeCategoriesSection.tsx`.
  - [x] Business-list секция вынесена в `HomeBusinessListSection.tsx`.
  - [x] Offline-banner секция вынесена в `HomeOfflineBannerSection.tsx`.
  - [x] Recent-places секция вынесена в `HomeRecentPlacesSection.tsx`.
  - [x] Unit-test `homeSelectors.unit.test.ts` повторно пройден после финальной декомпозиции.

Следующий шаг после первой волны:

Текущая общая картина и статусы активных файлов:
- [CURRENT_ARCHITECTURE_STATUS.md](./CURRENT_ARCHITECTURE_STATUS.md)

- [~] `apps/web/src/app/api/webhooks/whatsapp/route.ts`
  - [x] GET verification вынесена в `whatsappWebhookVerification.ts`.
  - [x] POST payload traversal вынесен в `whatsappWebhookPayload.ts`.
  - [x] Типы webhook/message/status вынесены в `whatsappWebhookTypes.ts`.
  - [x] Media handler вынесен в `whatsappWebhookMedia.ts`.
  - [x] Status update handler вынесен в `whatsappWebhookStatus.ts`.
  - [x] Text-command parser/dispatcher вынесен в `whatsappWebhookCommands.ts`.
  - [x] `cancel/confirm` handlers вынесены в `whatsappWebhookBookingActions.ts`.
  - [x] `help/remind/info` handlers вынесены в `whatsappWebhookBookingInfo.ts`.
  - [ ] Следующий проход: решить, нужен ли отдельный use-case/service facade над всеми webhook handlers.

- [x] `apps/web/src/app/api/dashboard/staff/[id]/finance/stats/route.ts`
  - [x] Query/date parsing и period/date range calculation вынесены в `financeStatsParams.ts`.
  - [x] Staff loading/access check вынесены в `financeStatsStaff.ts`.
  - [x] Shift loading и включение открытой смены вынесены в `financeStatsShifts.ts`.
  - [x] Shift items loading/grouping вынесены в `financeStatsShiftItems.ts`.
  - [x] Предварительные finance aggregates для открытых смен вынесены в `financeStatsAggregates.ts`.
  - [x] Финальная сборка `stats.shifts` и totals вынесена в `financeStatsPresentation.ts`.
  - [x] Отдельный facade не нужен: route уже достаточно thin-adapter уровня.

- [x] `apps/web/src/app/api/dashboard/staff/[id]/shift/open/route.ts`
  - [x] Query/date parsing вынесены в `ownerShiftOpenParams.ts`.
  - [x] Staff loading/access check вынесены в `ownerShiftOpenStaff.ts`.
  - [x] Schedule timing / late-minutes calculation вынесены в `ownerShiftOpenSchedule.ts`.
  - [x] Existing-shift resolution и create/reopen persistence вынесены в `ownerShiftOpenPersistence.ts`.
  - [x] Отдельный facade не нужен: route уже достаточно thin-adapter уровня.

- [x] `apps/web/src/app/api/dashboard/staff/[id]/finance/route.ts`
  - [x] Query/date parsing вынесены в `financeByIdParams.ts`.
  - [x] Staff loading/access check вынесены в `financeByIdStaff.ts`.
  - [x] Day-off / shift loading вынесены в `financeByIdShiftContext.ts`.
  - [x] Shift items loading вынесен в `financeByIdShiftItems.ts`.
  - [x] Bookings/services loading и нормализация вынесены в `financeByIdRelatedData.ts`.
  - [x] Current-hours/stats/all-shifts расчёты вынесены в `financeByIdStats.ts`.
  - [x] Финальная сборка response вынесена в `financeByIdResponse.ts`.
  - [x] Route теперь на thin-adapter уровне, отдельный facade сверху пока не нужен.

- [x] `apps/web/src/app/api/dashboard/staff/[id]/finance/audit-log/route.ts`
  - [x] Access-check вынесен в `financeAuditLogAccess.ts`.
  - [x] Загрузка audit rows и профилей вынесена в `financeAuditLogData.ts`.
  - [x] Mapping response entries вынесен в `financeAuditLogResponse.ts`.
  - [x] Route сведён к access -> data -> response.

---

## 5. Этап 3. Архитектурное выравнивание

### 5.1. Довести `core-domain` до системной роли

- [x] Определить, какие бизнес-правила еще живут в `apps/web` и `apps/mobile`, хотя должны жить в `packages/core-domain`.
- [x] Постепенно вынести их в доменные модули и use cases.

Текущий прогресс по переносу:

- [x] Вынести `booking` dashboard filter/status semantics из `apps/web/src/lib/dashboardBookingsLogic.ts` в `packages/core-domain/src/booking/dashboardFilters.ts`.
- [x] Вынести finance domain из `apps/web/src/lib/financeDomain/*` в `packages/core-domain/src/finance/*` с сохранением совместимости через re-export слой.
- [x] Вынести правило доступности мастеров по филиалу и временным переводам из `apps/web/src/app/b/[slug]/hooks/useBookingAvailability.ts` в `packages/core-domain/src/schedule/availability.ts`.

Подзадачи:

- [x] Провести ревизию потоков:
  - booking
  - schedule
  - staff finance
  - notifications
- [x] Для каждого потока описать:
  - что является domain rule
  - что является application orchestration
  - что является infra adapter
- [x] Расширить `ports`, если use cases уже упираются в конкретный Supabase/HTTP-код.
  В этой волне проверено, что расширение `ports` пока не требуется.

### 5.2. Валидация: единая стратегия

- [x] Зафиксировать границу между Zod-валидацией на входе и доменной валидацией инвариантов.
- [x] Убрать дублирование правил между `apps/web/src/lib/validation/schemas.ts` и `packages/core-domain`.

Подзадачи:

- [x] Описать правило:
  - API boundary валидирует форму payload
  - domain layer валидирует смысл и инварианты
- [x] Найти кейсы, где одна и та же проверка реализована дважды.
- [x] Упростить `packages/core-domain/src/booking/validation.ts`, если часть проверок уже надежно покрыта на boundary.

### 5.3. Репозитории и use-case слой

- [x] Укрепить паттерн “route -> use case -> repository/port adapter”.

Подзадачи:

- [x] Проверить, в каких endpoints route handler до сих пор напрямую знает слишком много о таблицах и Supabase.
- [x] Вынести повторяющиеся сценарии в application services/use cases.
- [x] Оставить `lib/repositories.ts` и смежные адаптеры как infra слой, а не место для бизнес-правил.

---

## 6. Этап 4. Время, таймзоны и дата-модель

### 6.1. Единая политика по времени

- [x] Сформулировать и закрепить единый стандарт работы с временем.
- [x] Сделать business timezone обязательной частью доменных сценариев, где это критично.

Подзадачи:

- [x] Проверить все места, где используется:
  - глобальная `TZ`
  - `NEXT_PUBLIC_TZ`
  - `biz.tz`
  - вычисление “сегодня” и границ дня
- [x] Составить список API и UI-потоков, завязанных на локальную дату бизнеса.
- [x] Убрать смешение global timezone и business timezone там, где это может дать скрытые баги.

### 6.2. Практическая миграция

- [x] Приоритизировать участки с самым высоким риском.

Подзадачи:

- [x] Сначала проверить и выровнять:
  - booking slot calculation
  - staff shifts
  - finance period boundaries
  - cabinet/bookings pages
- [x] Обновить связанные документы:
  - `docs/architecture/DATE_HANDLING_MODEL.md`
  - `docs/architecture/DATE_HANDLING_RISKS.md`

---

## 7. Этап 5. Клиентские данные и fetch-стратегия

### 7.1. Единый подход к client-side data fetching

- [x] Выбрать стандарт для клиентских данных: React Query как базовый путь, ручные кеши только как редкое исключение.

Подзадачи:

- [x] Провести аудит кастомных `useEffect` + cache + debounce решений.
- [x] Проверить, где ручное кеширование реально нужно, а где его лучше заменить query abstraction.
- [x] Начать с booking-flow, так как там уже есть смешение подходов.

### 7.2. `useSlotsLoader` и связанный booking stack

- [x] Пересмотреть `apps/web/src/app/b/[slug]/hooks/useSlotsLoader.ts`.

Подзадачи:

- [x] Определить, что из его логики относится к:
  - fetch
  - кэшу
  - post-processing
  - domain filtering
- [x] Перенести post-processing и domain filtering в переиспользуемые функции.
- [x] Решить, переводить ли загрузку слотов на query-слой с управляемым invalidation.

---

## 8. Этап 6. Документация, архив и инженерные процессы

### 8.1. Новая структура документации

- [x] Упорядочить документы по папкам внутри `docs/`.

Подзадачи:

- [x] Создать разделы:
  - `docs/architecture/`
  - `docs/features/`
  - `docs/operations/`
  - `docs/testing/`
  - `docs/archive/`
- [x] Перенести обзорные и аудитные документы ближе к тематическим разделам.
- [x] В корне репозитория оставить только действительно верхнеуровневые документы.

### 8.2. Статусные документы и архив

- [x] Отделить “текущее состояние” от “истории решений”.

Подзадачи:

- [x] Для документов-аудитов добавить короткий блок:
  - дата проверки
  - источник правды
  - когда пересматривать
- [x] Архивировать документы про уже решенные проблемы, если они больше не нужны в ежедневной работе.
- [x] Завести правило: один актуальный статусный документ на тему, остальное либо ADR, либо архив.

---

## 9. Этап 7. Тесты и защита от регрессий

### 9.1. Расширение покрытия там, где оно реально снижает риск

- [x] Не гнаться за процентом покрытия как самоцелью.
- [x] Фокусироваться на сценариях, где проект чаще всего будет меняться.

Подзадачи:

- [x] Добавить сценарные тесты для:
  - [x] booking flow
  - [x] auth redirect logic
  - [x] business selection
  - [x] mobile auth bootstrap
  - [x] staff shift lifecycle
- [x] Усилить тесты на domain rules в `core-domain`.
- [x] Проверить, есть ли отдельные тесты на timezone edge cases.

### 9.2. E2E как страховка на ключевых пользовательских путях

- [x] Построить короткий список золотых сценариев.

Подзадачи:

- [x] Минимальный набор:
  - [x] публичная запись
  - [x] вход и редирект по роли
  - [x] выбор бизнеса
  - [x] просмотр/отмена записи
  - [x] ключевой staff/finance сценарий
- [x] Определить, что тестируется в web E2E, а что лучше покрывать integration-level тестами.

---

## 10. Предлагаемый порядок выполнения

### Волна 1

- [ ] Этап 1 целиком
- [ ] Этап 2.2
- [ ] Этап 2.3

### Волна 2

- [ ] Этап 2.1
- [ ] Этап 5
- [ ] Этап 4.1

### Волна 3

- [ ] Этап 5.2
- [ ] Этап 3
- [ ] Этап 7.1

### Волна 4

- [ ] Этап 6
- [ ] Этап 7.2
- [ ] Точечная чистка больших файлов из этапа 2.4

---

## 11. Критерии успешности

- [ ] Крупные сценарии больше не завязаны на 1-2 перегруженных файла.
- [ ] Route handlers стали заметно тоньше и понятнее.
- [ ] `core-domain` используется как реальное ядро, а не как частичный helper package.
- [ ] Документация перестала спорить с кодом.
- [ ] Временные и timezone-правила стали единообразными.
- [ ] Основные пользовательские потоки защищены сценарными тестами.

---

## 12. Что не делать

- [ ] Не начинать сразу с тотального переписывания booking-flow и mobile auth одновременно.
- [ ] Не переносить код в `core-domain` без явного понимания границы между domain и infra.
- [ ] Не плодить новые статусные документы в корне репозитория.
- [ ] Не гнаться за размером файла как единственным критерием качества: важнее смешение ответственности.
- [ ] Не делать большие “героические” рефакторинги без промежуточных тестов и этапов стабилизации.
