# Документация Kezek

Этот файл — единая точка входа в документацию внутри папки `docs/`.

Цель индекса:

- быстро показать, что читать в первую очередь;
- разделить архитектурные документы, feature-материалы, операционные аудиты и тестовые сценарии;
- упростить онбординг и поиск нужного контекста перед изменениями.

Статусы в этом индексе:

- `актуален` — можно использовать как рабочий источник правды.
- `нуждается в проверке` — документ полезный, но перед изменениями лучше сверить с кодом и текущим поведением.
- `архивный` — исторический контекст; не использовать как основной источник правды без перепроверки.

---

## С чего начать

Если вы только входите в проект, рекомендуемый порядок чтения такой:

1. [README.md](../README.md) — общее описание проекта и быстрый старт.
  Статус: `актуален`
2. [GETTING_STARTED.md](../GETTING_STARTED.md) — локальный запуск, окружение, базовые команды.
  Статус: `актуален`
3. [PROJECT_DOCUMENTATION.md](../PROJECT_DOCUMENTATION.md) — архитектура, домены, роли, БД, ключевые потоки.
  Статус: `актуален`
4. [SYSTEM_FEATURES_DOCUMENTATION.md](../SYSTEM_FEATURES_DOCUMENTATION.md) — бизнес-функции системы.
  Статус: `актуален`
5. [PROJECT_REVIEW.md](../PROJECT_REVIEW.md) — текущее состояние проекта, техдолг и направления развития.
  Статус: `нуждается в проверке`

После этого переходите к тематическим разделам ниже.

---

## Структура папок

- [architecture/](./architecture/) — архитектурные решения, инварианты, boundary-аудиты, стандарты.
- [features/](./features/) — UX/feature-документы по ролям, кабинетам и продуктовым сценариям.
- [operations/](./operations/) — roadmap, операционные аудиты, transitional/formatting/decomposition документы.
- [testing/](./testing/) — тестовые сценарии и проверочные материалы.
- [archive/](./archive/) — архивные документы, если тема уже не является активной.

---

## Как понимать типы документов

В проекте теперь явно разделяются:

- `источник правды` — текущий рабочий документ по теме;
- `ADR` — зафиксированное архитектурное решение;
- `audit/review` — снимок состояния на дату проверки;
- `roadmap/plan` — документ про следующие шаги;
- `archive` — исторический материал, который не должен подменять актуальную документацию.

Базовое правило:

- по теме должен быть один главный актуальный статусный документ;
- всё остальное должно быть явно ADR, audit, roadmap или archive.

Подробная политика:

- [DOCUMENT_STATUS_POLICY.md](./operations/DOCUMENT_STATUS_POLICY.md)

---

## Архитектура и инварианты

- [BIZ_CONTEXT_RESOLVER_ADR.md](./architecture/BIZ_CONTEXT_RESOLVER_ADR.md) — архитектурное решение по выбору текущего бизнеса и manager context. Статус: `актуален`
- [USER_CURRENT_BUSINESS_INVARIANTS.md](./architecture/USER_CURRENT_BUSINESS_INVARIANTS.md) — инварианты таблицы `user_current_business` и правил выбора бизнеса. Статус: `актуален`
- [DATE_HANDLING_MODEL.md](./architecture/DATE_HANDLING_MODEL.md) — целевая модель работы с датами, timestamp и календарными днями. Статус: `актуален`
- [TIME_STANDARD.md](./architecture/TIME_STANDARD.md) — короткий обязательный стандарт по работе с календарными датами, timestamp и timezone в новом коде. Статус: `актуален`
- [TIMEZONE_USAGE_AUDIT.md](./architecture/TIMEZONE_USAGE_AUDIT.md) — аудит текущего использования глобального `TZ`, `NEXT_PUBLIC_TZ` и `biz.tz` с приоритетами миграции. Статус: `актуален`
- [TIMEZONE_MIGRATION_PRIORITY.md](./architecture/TIMEZONE_MIGRATION_PRIORITY.md) — практический порядок, в котором лучше выравнивать timezone-логику после уже закрытых high-risk API потоков. Статус: `актуален`
- [LOCAL_BUSINESS_DATE_FLOWS.md](./architecture/LOCAL_BUSINESS_DATE_FLOWS.md) — список API и UI-потоков, где поведение зависит от локальной даты бизнеса. Статус: `актуален`
- [DATE_HANDLING_RISKS.md](./architecture/DATE_HANDLING_RISKS.md) — найденные риски и проблемные места в date/time логике. Статус: `нуждается в проверке`
- [TELEGRAM_LINKING_ADR.md](./architecture/TELEGRAM_LINKING_ADR.md) — принятое решение по Telegram Login и линковке аккаунта. Статус: `актуален`
- [CORE_DOMAIN_BOUNDARY_AUDIT.md](./architecture/CORE_DOMAIN_BOUNDARY_AUDIT.md) — аудит того, какие бизнес-правила ещё живут в `apps/*`, хотя должны жить в `packages/core-domain`. Статус: `актуален`
- [CORE_DOMAIN_FLOW_REVIEW.md](./architecture/CORE_DOMAIN_FLOW_REVIEW.md) — разбор потоков `booking`, `schedule`, `staff finance`, `notifications` по слоям domain/application/infra и решение по `ports`. Статус: `актуален`
- [ROUTE_USECASE_REPOSITORY_AUDIT.md](./architecture/ROUTE_USECASE_REPOSITORY_AUDIT.md) — аудит того, какие route handlers уже следуют паттерну `route -> use case -> repository/port adapter`, а какие ещё слишком тесно связаны с Supabase. Статус: `актуален`
- [VALIDATION_BOUNDARY_POLICY.md](./architecture/VALIDATION_BOUNDARY_POLICY.md) — правило разделения между Zod-валидацией на boundary и доменной валидацией инвариантов. Статус: `актуален`
- [VALIDATION_DUPLICATION_AUDIT.md](./architecture/VALIDATION_DUPLICATION_AUDIT.md) — список уже найденных и устранённых дублей между boundary validation и `core-domain`, плюс остаточные зоны внимания. Статус: `актуален`
- [CLIENT_DATA_FETCHING_STANDARD.md](./architecture/CLIENT_DATA_FETCHING_STANDARD.md) — стандарт client-side data fetching: `React Query` как основной путь, ручные кеши только как редкое исключение. Статус: `актуален`
- [CLIENT_DATA_FETCHING_AUDIT.md](./architecture/CLIENT_DATA_FETCHING_AUDIT.md) — аудит ручного кеширования и `useEffect + fetch/debounce` сценариев с решением, где оставить исключение, а где переходить на query abstraction. Статус: `актуален`
- [BOOKING_FLOW_FETCHING_REVIEW.md](./architecture/BOOKING_FLOW_FETCHING_REVIEW.md) — разбор `useSlotsLoader.ts` по слоям `fetch/cache/post-processing/domain filtering` и промежуточное решение по booking-flow. Статус: `актуален`

---

## Features и UX

- [ROLES_AND_BUSINESS_SELECTION_AUDIT.md](./features/ROLES_AND_BUSINESS_SELECTION_AUDIT.md) — аудит логики ролей, кабинетов и выбора бизнеса. Статус: `нуждается в проверке`
- [RESOLVE_BIZ_CONTEXT_SCENARIOS_AND_REFACTOR.md](./features/RESOLVE_BIZ_CONTEXT_SCENARIOS_AND_REFACTOR.md) — сценарии и план рефакторинга business context. Статус: `нуждается в проверке`
- [MULTI_ROLE_UX_SCENARIOS.md](./features/MULTI_ROLE_UX_SCENARIOS.md) — UX-сценарии для пользователей с несколькими ролями. Статус: `нуждается в проверке`
- [FIRST_LOGIN_ROLE_SELECTION_UX.md](./features/FIRST_LOGIN_ROLE_SELECTION_UX.md) — поведение и UX при первом входе пользователя. Статус: `нуждается в проверке`
- [CABINET_TERMINOLOGY_AUDIT.md](./features/CABINET_TERMINOLOGY_AUDIT.md) — аудит терминологии кабинетов и интерфейсных названий. Статус: `нуждается в проверке`
- [BOOKING_SCREEN_STATE_DECISION.md](./features/BOOKING_SCREEN_STATE_DECISION.md) — решение по состоянию экрана booking-flow и критериям, когда нужен state machine/store. Статус: `актуален`

---

## Operations и roadmap

- [SERVICE_CLIENT_AND_BIZ_FILTERS_AUDIT.md](./architecture/SERVICE_CLIENT_AND_BIZ_FILTERS_AUDIT.md) — аудит рисков при использовании service client и фильтров по бизнесу. Статус: `нуждается в проверке`
- [SERVICE_CLIENT_USAGE_GUIDE.md](./architecture/SERVICE_CLIENT_USAGE_GUIDE.md) — практический guide по безопасному использованию service client в manager APIs. Статус: `актуален`
- [DOCUMENT_STATUS_POLICY.md](./operations/DOCUMENT_STATUS_POLICY.md) — правило разделения между текущим статусом, audit/review, ADR, roadmap и архивом. Статус: `актуален`
- [FORMATTING_AUDIT.md](./operations/FORMATTING_AUDIT.md) — аудит форматирования и единообразия представления данных. Статус: `нуждается в проверке`
- [CONSOLE_USAGE_AUDIT.md](./operations/CONSOLE_USAGE_AUDIT.md) — короткий аудит прямых `console.*` вызовов и список зон-исключений. Статус: `актуален`
- [TRANSITIONAL_AREAS_AUDIT.md](./operations/TRANSITIONAL_AREAS_AUDIT.md) — переходные, частично отключённые и legacy-участки, которые стоит упростить. Статус: `актуален`
- [DECOMPOSITION_CANDIDATES.md](./operations/DECOMPOSITION_CANDIDATES.md) — список крупных файлов-кандидатов на декомпозицию по размеру и смешению ответственности. Статус: `актуален`
- [PROJECT_EVOLUTION_IMPLEMENTATION_PLAN.md](./operations/PROJECT_EVOLUTION_IMPLEMENTATION_PLAN.md) — поэтапный план улучшения проекта с задачами и подзадачами. Статус: `актуален`
- [ARCHIVE_CANDIDATES.md](./operations/ARCHIVE_CANDIDATES.md) — список документов, которые являются кандидатами на перенос в архив. Статус: `актуален`

---

## Testing

- [TESTING_STRATEGY_PRINCIPLES.md](./testing/TESTING_STRATEGY_PRINCIPLES.md) — базовые принципы тестовой стратегии: покрываем риск и изменяемые сценарии, а не гонимся за coverage ради цифры. Статус: `актуален`
- [TEST_PRIORITY_AREAS.md](./testing/TEST_PRIORITY_AREAS.md) — карта сценариев, которые меняются чаще всего и должны первыми получать тестовые страховки. Статус: `актуален`
- [GOLDEN_SCENARIOS.md](./testing/GOLDEN_SCENARIOS.md) — минимальный список ключевых пользовательских путей, которые должны оставаться защищены тестами. Статус: `актуален`
- [E2E_VS_INTEGRATION_GUIDE.md](./testing/E2E_VS_INTEGRATION_GUIDE.md) — правило распределения между browser E2E и integration-level тестами. Статус: `актуален`
- [ROLE_SWITCHING_TEST_SCENARIOS.md](./testing/ROLE_SWITCHING_TEST_SCENARIOS.md) — тестовые сценарии для переключения ролей и кабинетов. Статус: `нуждается в проверке`

---

## Архивные документы

Первая архивная волна уже перенесена:

- [ISSUES_STAFF_FINANCE_PAGES.md](./archive/ISSUES_STAFF_FINANCE_PAGES.md) — исторический отчёт по закрытой волне проблем staff finance.
- [COMPARISON_STAFF_FINANCE_PAGES.md](./archive/COMPARISON_STAFF_FINANCE_PAGES.md) — историческое сравнение старых finance-страниц.
- [MIGRATION_SUMMARY.md](./archive/MIGRATION_SUMMARY.md) — промежуточный снимок старой console migration.

Для архивных документов правило такое:

- в начале файла должна быть пометка об архивировании;
- должен быть указан актуальный документ-замена или источник правды;
- архив не должен подменять рабочую документацию.

---

## Как выбирать документ под задачу

Если задача про доступы, роли, кабинеты или текущий бизнес:

- начинайте с [ROLES_AND_BUSINESS_SELECTION_AUDIT.md](./features/ROLES_AND_BUSINESS_SELECTION_AUDIT.md)
- затем смотрите [BIZ_CONTEXT_RESOLVER_ADR.md](./architecture/BIZ_CONTEXT_RESOLVER_ADR.md)
- затем [USER_CURRENT_BUSINESS_INVARIANTS.md](./architecture/USER_CURRENT_BUSINESS_INVARIANTS.md)

Если задача про даты, таймзоны, смены, периодизацию, границы суток:

- начинайте с [DATE_HANDLING_MODEL.md](./architecture/DATE_HANDLING_MODEL.md)
- затем проверьте [DATE_HANDLING_RISKS.md](./architecture/DATE_HANDLING_RISKS.md)

Если задача про manager APIs и service client:

- начинайте с [SERVICE_CLIENT_USAGE_GUIDE.md](./architecture/SERVICE_CLIENT_USAGE_GUIDE.md)
- затем смотрите [SERVICE_CLIENT_AND_BIZ_FILTERS_AUDIT.md](./architecture/SERVICE_CLIENT_AND_BIZ_FILTERS_AUDIT.md)

Если задача про Telegram auth/linking:

- начинайте с [TELEGRAM_LINKING_ADR.md](./architecture/TELEGRAM_LINKING_ADR.md)

Если задача про поэтапное улучшение проекта:

- начинайте с [PROJECT_EVOLUTION_IMPLEMENTATION_PLAN.md](./operations/PROJECT_EVOLUTION_IMPLEMENTATION_PLAN.md)

---

## Правила поддержки документации

- Для каждой важной темы должен быть один основной актуальный документ.
- Для каждой темы должно быть понятно, документ это про текущее состояние, audit/review, ADR, roadmap или archive.
- Если документ описывает исторический аудит или уже выполненный план, это нужно явно помечать в начале файла.
- При изменении критичной логики нужно обновлять не только код, но и документ-источник правды для этой области.
- Новые документы в `docs/` лучше создавать только для:
  - архитектурных решений;
  - устойчивых инвариантов;
  - аудитов с конкретным follow-up;
  - roadmap/планов внедрения.
