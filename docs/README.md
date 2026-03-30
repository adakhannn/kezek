# Документация Kezek

Этот файл — основной индекс документации проекта. Если нужно понять, какой документ считать актуальным по теме, начинайте отсюда.

## Источники истины

Для каждой темы есть один основной документ:

1. Onboarding / start
   - `GETTING_STARTED.md`
   - `docs/ONBOARDING.md`

2. Architecture / module boundaries
   - `PROJECT_DOCUMENTATION.md`
   - `apps/web/src/lib/HOWTO_NEW_API_ENDPOINT.md`

3. Product / feature reference
   - `SYSTEM_FEATURES_DOCUMENTATION.md`
   - feature-docs внутри `docs/`

4. Engineering process / testing / CI
   - `CONTRIBUTING.md`
   - `TESTING_GUIDE.md`
   - `API_TESTING.md`
   - `E2E_TESTING.md`

5. Improvement roadmap
   - `docs/PROJECT_IMPROVEMENT_PLAN.md`
   - `docs/PROJECT_IMPROVEMENT_PROGRESS_2026-03-30.md`
   - `docs/CLEANUP_AND_NEXT_PHASE_PLAN.md`

## Навигация

### Быстрый старт

- `GETTING_STARTED.md` — установка, env, команды запуска.
- `docs/ONBOARDING.md` — чеклист для входа в проект.
- `apps/mobile/README.md` — запуск и проверки mobile.

### Архитектура

- `PROJECT_DOCUMENTATION.md` — общая техническая архитектура проекта.
- `API_DOCUMENTATION.md` — карта API и контрактов.
- `apps/web/src/lib/HOWTO_NEW_API_ENDPOINT.md` — шаблон для новых API routes.

### Продукт и фичи

- `SYSTEM_FEATURES_DOCUMENTATION.md` — основной справочник по бизнес-функциям.
- `docs/SUBSCRIPTIONS_AND_PACKAGES_FEATURE.md` — спецификация по абонементам и пакетам.
- `docs/GLOSSARY.md` — словарь продуктовых терминов.

### Процессы и качество

- `CONTRIBUTING.md` — правила разработки и PR.
- `TESTING_GUIDE.md` — общий тестовый процесс.
- `API_TESTING.md` — тестирование API routes.
- `E2E_TESTING.md` — e2e-команды и сценарии.

### План улучшений

- `docs/PROJECT_IMPROVEMENT_PLAN.md` — единственный актуальный roadmap технических улучшений.
- `docs/PROJECT_IMPROVEMENT_PROGRESS_2026-03-30.md` — свежий progress-слепок по фактически завершенной серии `Phase 6.1` и текущему test baseline.
- `docs/CLEANUP_AND_NEXT_PHASE_PLAN.md` — рабочий план cleanup-фазы и выбора следующего архитектурного пакета работ.

## Что считать архивом

Эти документы полезны как исторический контекст, но не как главный источник истины:

- `DOCUMENTS_OVERVIEW.md`
- `PROJECT_REVIEW.md`
- `FUTURE_IMPROVEMENTS_TASKS.md`
- `EVOLUTION_TECH_PLAN.md`
- `docs/archive/`

Если архивный документ расходится с текущим процессом или кодом, ориентируйтесь на документы из раздела "Источники истины".
