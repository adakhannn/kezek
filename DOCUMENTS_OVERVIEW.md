# Обзор документации проекта Kezek

**Последнее обновление:** 2026-03-19  
**Назначение:** короткая карта документации в её текущем рабочем состоянии.  
**Источник навигации внутри `docs/`:** [docs/README.md](docs/README.md)

---

## Как читать документацию

Если вы только входите в проект, идите в таком порядке:

1. [README.md](README.md) — общее описание проекта и быстрый старт.
2. [GETTING_STARTED.md](GETTING_STARTED.md) — установка, env, локальный запуск.
3. [PROJECT_DOCUMENTATION.md](PROJECT_DOCUMENTATION.md) — архитектура, домены, роли, БД, основные потоки.
4. [SYSTEM_FEATURES_DOCUMENTATION.md](SYSTEM_FEATURES_DOCUMENTATION.md) — бизнес-функции системы.
5. [PROJECT_REVIEW.md](PROJECT_REVIEW.md) — текущее состояние проекта и направления улучшения.
6. [docs/README.md](docs/README.md) — тематический индекс документов внутри `docs/`.

---

## Главные документы

### Актуальные

- [README.md](README.md) — корневой вход в проект; содержит описание, быстрый старт и ссылки на основные техдоки.
- [GETTING_STARTED.md](GETTING_STARTED.md) — основной документ для локального старта.
- [PROJECT_DOCUMENTATION.md](PROJECT_DOCUMENTATION.md) — технический обзор проекта.
- [SYSTEM_FEATURES_DOCUMENTATION.md](SYSTEM_FEATURES_DOCUMENTATION.md) — карта бизнес-возможностей системы.
- [API_DOCUMENTATION.md](API_DOCUMENTATION.md) — справочник по API.
- [docs/README.md](docs/README.md) — индекс внутренней документации `docs/`.

### Нуждаются в проверке перед крупными изменениями

- [PROJECT_REVIEW.md](PROJECT_REVIEW.md) — полезен как обзор текущего состояния, но часть утверждений нужно сверять с кодом.
- [DEEP_ANALYSIS_ISSUES.md](DEEP_ANALYSIS_ISSUES.md) — исторически полезный аудит, но требует выборочной перепроверки.
- [DEEP_CODE_REVIEW_2026-02-26.md](DEEP_CODE_REVIEW_2026-02-26.md) — полезен как снимок состояния на дату ревью, не как абсолютный источник правды.

---

## Структура `docs/`

### Архитектура

- [docs/architecture/BIZ_CONTEXT_RESOLVER_ADR.md](docs/architecture/BIZ_CONTEXT_RESOLVER_ADR.md)
- [docs/architecture/USER_CURRENT_BUSINESS_INVARIANTS.md](docs/architecture/USER_CURRENT_BUSINESS_INVARIANTS.md)
- [docs/architecture/DATE_HANDLING_MODEL.md](docs/architecture/DATE_HANDLING_MODEL.md)
- [docs/architecture/DATE_HANDLING_RISKS.md](docs/architecture/DATE_HANDLING_RISKS.md)
- [docs/architecture/TIME_STANDARD.md](docs/architecture/TIME_STANDARD.md)
- [docs/architecture/TIMEZONE_USAGE_AUDIT.md](docs/architecture/TIMEZONE_USAGE_AUDIT.md)
- [docs/architecture/TIMEZONE_MIGRATION_PRIORITY.md](docs/architecture/TIMEZONE_MIGRATION_PRIORITY.md)
- [docs/architecture/LOCAL_BUSINESS_DATE_FLOWS.md](docs/architecture/LOCAL_BUSINESS_DATE_FLOWS.md)
- [docs/architecture/CORE_DOMAIN_BOUNDARY_AUDIT.md](docs/architecture/CORE_DOMAIN_BOUNDARY_AUDIT.md)
- [docs/architecture/CORE_DOMAIN_FLOW_REVIEW.md](docs/architecture/CORE_DOMAIN_FLOW_REVIEW.md)
- [docs/architecture/ROUTE_USECASE_REPOSITORY_AUDIT.md](docs/architecture/ROUTE_USECASE_REPOSITORY_AUDIT.md)
- [docs/architecture/VALIDATION_BOUNDARY_POLICY.md](docs/architecture/VALIDATION_BOUNDARY_POLICY.md)
- [docs/architecture/VALIDATION_DUPLICATION_AUDIT.md](docs/architecture/VALIDATION_DUPLICATION_AUDIT.md)
- [docs/architecture/CLIENT_DATA_FETCHING_STANDARD.md](docs/architecture/CLIENT_DATA_FETCHING_STANDARD.md)
- [docs/architecture/CLIENT_DATA_FETCHING_AUDIT.md](docs/architecture/CLIENT_DATA_FETCHING_AUDIT.md)
- [docs/architecture/BOOKING_FLOW_FETCHING_REVIEW.md](docs/architecture/BOOKING_FLOW_FETCHING_REVIEW.md)
- [docs/architecture/SERVICE_CLIENT_USAGE_GUIDE.md](docs/architecture/SERVICE_CLIENT_USAGE_GUIDE.md)
- [docs/architecture/SERVICE_CLIENT_AND_BIZ_FILTERS_AUDIT.md](docs/architecture/SERVICE_CLIENT_AND_BIZ_FILTERS_AUDIT.md)
- [docs/architecture/TELEGRAM_LINKING_ADR.md](docs/architecture/TELEGRAM_LINKING_ADR.md)

### Features и UX

- [docs/features/ROLES_AND_BUSINESS_SELECTION_AUDIT.md](docs/features/ROLES_AND_BUSINESS_SELECTION_AUDIT.md)
- [docs/features/RESOLVE_BIZ_CONTEXT_SCENARIOS_AND_REFACTOR.md](docs/features/RESOLVE_BIZ_CONTEXT_SCENARIOS_AND_REFACTOR.md)
- [docs/features/MULTI_ROLE_UX_SCENARIOS.md](docs/features/MULTI_ROLE_UX_SCENARIOS.md)
- [docs/features/FIRST_LOGIN_ROLE_SELECTION_UX.md](docs/features/FIRST_LOGIN_ROLE_SELECTION_UX.md)
- [docs/features/CABINET_TERMINOLOGY_AUDIT.md](docs/features/CABINET_TERMINOLOGY_AUDIT.md)
- [docs/features/BOOKING_SCREEN_STATE_DECISION.md](docs/features/BOOKING_SCREEN_STATE_DECISION.md)

### Operations

- [docs/operations/PROJECT_EVOLUTION_IMPLEMENTATION_PLAN.md](docs/operations/PROJECT_EVOLUTION_IMPLEMENTATION_PLAN.md)
- [docs/operations/ARCHIVE_CANDIDATES.md](docs/operations/ARCHIVE_CANDIDATES.md)
- [docs/operations/CONSOLE_USAGE_AUDIT.md](docs/operations/CONSOLE_USAGE_AUDIT.md)
- [docs/operations/FORMATTING_AUDIT.md](docs/operations/FORMATTING_AUDIT.md)
- [docs/operations/TRANSITIONAL_AREAS_AUDIT.md](docs/operations/TRANSITIONAL_AREAS_AUDIT.md)
- [docs/operations/DECOMPOSITION_CANDIDATES.md](docs/operations/DECOMPOSITION_CANDIDATES.md)

### Testing

- [docs/testing/ROLE_SWITCHING_TEST_SCENARIOS.md](docs/testing/ROLE_SWITCHING_TEST_SCENARIOS.md)

### Archive

- [docs/archive/](docs/archive/) — папка создана, но пока ещё не заполнена перенесёнными документами.

---

## Что изменилось в структуре

- `docs/` теперь разложена по подпапкам:
  - `docs/architecture/`
  - `docs/features/`
  - `docs/operations/`
  - `docs/testing/`
  - `docs/archive/`
- тематические и аудитные документы вынесены из плоского корня `docs/` ближе к своим областям;
- корень `docs/` оставлен только для индексного [docs/README.md](docs/README.md) и самих тематических папок.

---

## Следующие шаги

- начать первый реальный перенос исторических документов в [docs/archive/](docs/archive/);
- по мере касания старых документов поправлять в них оставшиеся текстовые ссылки на старые пути;
- держать [docs/README.md](docs/README.md) как главный актуальный индекс, а этот обзор — как краткую карту на уровне репозитория.
