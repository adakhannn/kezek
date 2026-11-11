# История планов и аудитов Kezek

Статус: действующий индекс истории, обновлён 30 октября 2026.

Текущая навигация — [индекс документации](../README.md), приоритет — [текущее состояние проекта](../PROJECT_STATUS.md). Архив не назначает работы. Отметки active, completed и закрытые задачи ниже относятся к конкретной прежней волне; они не подтверждают нынешнюю безопасность, приёмку или готовность к выпуску.

## Планы и снимки по прежним путям

Материалы сгруппированы по теме, а не по очереди исполнения. Файлы оставлены на местах для сохранения входящих ссылок. Верхняя пометка определяет их исторический статус; исходные наблюдения и результаты не пересчитаны.

### Общие планы и архитектура

- [Обзор проекта и инженерных проблем](../../PROJECT_REVIEW.md)
- [Проблемы из углублённого анализа](../../DEEP_ANALYSIS_ISSUES.md)
- [Ревью кода от 26 февраля 2026](../../DEEP_CODE_REVIEW_2026-02-26.md)
- [Прежний общий список улучшений](../../FUTURE_IMPROVEMENTS_TASKS.md)
- [План технического развития](../../EVOLUTION_TECH_PLAN.md)
- [Задачи по итогам ревью от 30 марта 2026](../PROJECT_REVIEW_ACTION_TASKS_2026-03-30.md)
- [План улучшения архитектуры проекта](../PROJECT_IMPROVEMENT_PLAN.md)
- [Снимок выполнения архитектурного плана от 30 марта 2026](../PROJECT_IMPROVEMENT_PROGRESS_2026-03-30.md)
- [Упорядочивание проекта и выбор следующего этапа](../CLEANUP_AND_NEXT_PHASE_PLAN.md)
- [План выделения общей доменной логики](../DOMAIN_EXPANSION_PLAN.md)
- [Продуктовый план и подготовка к хакатону от 7 октября 2026](../PRODUCT_AND_HACKATHON_PLAN_2026-10-07.md)
- [Задачи по упрощению проекта](../SIMPLIFICATION_TASKS.md)
- [Матрица функций и прежних статусов](../../FEATURE_MATRIX.md)

### Финансы, аналитика и функции продукта

- [Риски и улучшения кабинета владельца](../../OWNER_CABINET_RISKS_AND_IMPROVEMENTS_TASKS.md)
- [Задачи финансового домена](../../FINANCE_DOMAIN_TASKS.md)
- [Проблемы и план развития рейтингов](../../RATING_SYSTEM_ISSUES_AND_PLAN.md)
- [План аналитики для бизнеса](../../BUSINESS_ANALYTICS_DASHBOARD_PLAN.md)
- [План системной аналитики для суперадминистратора](../../SYSTEM_ANALYTICS_SUPERADMIN_PLAN.md)
- [План карты филиалов](../../BRANCHES_MAP_FEATURE_PLAN.md)
- [План выбора между несколькими бизнесами](../../MULTI_BUSINESS_SELECTION_PLAN.md)
- [Записи сотрудников и комплексы услуг](../STAFF_BOOKINGS_COMPLEX_SERVICES_TASKS.md)
- [Задачи производительности финансовых страниц](../FINANCE_PERFORMANCE_TASKS.md)
- [Задачи улучшения финансовых сценариев](../FINANCE_IMPROVEMENTS_TASKS.md)
- [Отложенное сохранение финансовых изменений](../FINANCE_DEBOUNCE_SAVE_TASKS.md)
- [Задачи улучшения рейтингов](../RATINGS_IMPROVEMENTS_TASKS.md)

### Мобильное приложение и авторизация

- [План укрепления мобильной архитектуры](../MOBILE_ARCHITECTURE_HARDENING_PLAN.md)
- [Анализ и план исправления мобильного интерфейса](../MOBILE_UI_UX_DEEP_ANALYSIS_AND_FIX_PLAN.md)
- [Мобильные исправления от 19 мая 2026](../MOBILE_BUGFIX_TASKS_2026-05-19.md)
- [План согласования мобильной и web-авторизации](../MOBILE_AUTH_WEB_PARITY_IMPLEMENTATION_PLAN.md)
- [Задачи разделения мобильного Google-входа и web-потока](../MOBILE_GOOGLE_AUTH_DECOUPLING_TASKS.md)
- [Задачи мобильной авторизации через WhatsApp](../MOBILE_WHATSAPP_AUTH_TASKS.md)
- [Задачи согласования web-авторизации через WhatsApp](../WEB_WHATSAPP_AUTH_PARITY_TASKS.md)
- [Задачи мобильных переходов из Telegram](../TELEGRAM_MOBILE_DEEPLINK_TASKS.md)

### Интерфейс, локализация и доступность

- [План развития локализации и пользовательских сценариев](../../EVOLUTION_I18N_UX_PLAN.md)
- [Прежние улучшения интерфейса и удобства работы](../../UI_UX_IMPROVEMENTS.md)
- [План улучшения представления WEB](../WEB_PRESENTATION_HARDENING_PLAN.md)
- [Дорожная карта переработки интерфейса](../UI_UX_REDESIGN_ROADMAP.md)
- [Аудит доступности: корневой отчёт](../../A11Y_AUDIT.md)
- [Аудит доступности: отчёт в docs](../A11Y_AUDIT.md)
- [Аудит терминов кабинетов](../CABINET_TERMINOLOGY_AUDIT.md)
- [Аудит форматирования дат, времени и сумм](../FORMATTING_AUDIT.md)

### Доступ к данным и качество проверок

- [Аудит политик RLS](../../RLS_AUDIT_REPORT.md)
- [План исправлений рабочего Supabase](../SUPABASE_PRODUCTION_FIX_PLAN.md)
- [Аудит service client и фильтрации по бизнесу](../SERVICE_CLIENT_AND_BIZ_FILTERS_AUDIT.md)
- [Аудит ролей и выбора бизнеса](../ROLES_AND_BUSINESS_SELECTION_AUDIT.md)
- [Аудит авторизации API](../../apps/web/src/lib/API_AUTH_AUDIT.md)
- [План покрытия API тестами](../../apps/web/src/__tests__/api/TEST_COVERAGE_PLAN.md)

## Ранее помещённые в архив материалы

Дополнительные снимки по прежним путям: [отчёт устранения дублирования](../../apps/web/src/lib/DUPLICATION_REFACTORING.md), [план выделения business resolver](../RESOLVE_BIZ_CONTEXT_SCENARIOS_AND_REFACTOR.md), [включение расписаний в октябре](../SCHEDULE_REMOTE_ROLLOUT.md), [откат расписаний в сентябре](../STAFF_SCHEDULE_ROLLBACK.md). Последние два содержат датированные первичные наблюдения; тела снимков этой редактурой не менялись.

- [Общий список прежних задач](TASKS.md)
- [Задачи рефакторинга](REFACTOR_TASKS.md)
- [Прежний список улучшений](IMPROVEMENT_TASKS.md)
- [План миграции консольного логирования](CONSOLE_LOG_MIGRATION.md)
- [Ход миграции консольного логирования](CONSOLE_LOG_MIGRATION_PROGRESS.md)
- [Сводка миграции](MIGRATION_SUMMARY.md)
- [Проблемы финансовых страниц сотрудника](ISSUES_STAFF_FINANCE_PAGES.md)
- [Сравнение финансовых страниц сотрудника](COMPARISON_STAFF_FINANCE_PAGES.md)

## История WEB-проверок

Источники приёмки, ограничения и точные указатели: [передача закрытой WEB-кампании](../WEB_AGENT_HANDOFF.md). Перечень первичных свидетельств: [указатель доказательств](../verification/README.md). Эти снимки и ledger редактурой руководств не изменяются. Читать только выбранные свидетельства по конкретному вопросу.
