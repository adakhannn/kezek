# Каталог документов

Статус: автоматически построенная навигация. Начать работу помогает [основной индекс](README.md); этот каталог позволяет найти остальные материалы.

Категория определяется путём и явным статусом документа, а не оценкой достоверности содержания. Метод и дату наблюдения читать в самом документе; отсутствие даты не означает свежую проверку. Каталоги первичных evidence и визуальных baseline не обходятся: читать их через handoff по выбранному вопросу.

Генератор: `node scripts/generate-docs-catalog.mjs --write`; проверка: `node scripts/generate-docs-catalog.mjs --check`. Новые Markdown-файлы в корне, docs, apps, packages и supabase обнаруживаются автоматически; зависимости, build output и локальная .expo исключены.

## Руководства и справочники

Документов: 100.

| Документ | Путь |
| --- | --- |
| [HTTP API Kezek](../API_DOCUMENTATION.md) | `API_DOCUMENTATION.md` |
| [Проверки API и сервисов](../API_TESTING.md) | `API_TESTING.md` |
| [Contributing To Kezek](../CONTRIBUTING.md) | `CONTRIBUTING.md` |
| [Cron: Vercel, выполнение и восстановление](../CRON_SETUP.md) | `CRON_SETUP.md` |
| [Хранение, очистка и анонимизация данных](../DATA_RETENTION.md) | `DATA_RETENTION.md` |
| [Указатель документации Kezek](../DOCUMENTS_OVERVIEW.md) | `DOCUMENTS_OVERVIEW.md` |
| [Генератор API-заготовки](../DX_GENERATORS.md) | `DX_GENERATORS.md` |
| [E2E-проверки WEB](../E2E_TESTING.md) | `E2E_TESTING.md` |
| [Переменные окружения Kezek](../ENV_GUIDE.md) | `ENV_GUIDE.md` |
| [Настройка среды Kezek](../GETTING_STARTED.md) | `GETTING_STARTED.md` |
| [HOWTO: добавить новую сущность (пример: `Coupons`)](../HOWTO_NEW_ENTITY_COUPONS.md) | `HOWTO_NEW_ENTITY_COUPONS.md` |
| [Исторические задачи](../IMPROVEMENT_TASKS.md) | `IMPROVEMENT_TASKS.md` |
| [Kezek — продукты и их назначение](../KEZEK_PRODUCTS.md) | `KEZEK_PRODUCTS.md` |
| [Health checks и уведомления об ошибках](../MONITORING_AND_ALERTS.md) | `MONITORING_AND_ALERTS.md` |
| [API-метрики, финансовые логи и бизнес-аналитика](../MONITORING_AND_ANALYTICS.md) | `MONITORING_AND_ANALYTICS.md` |
| [Предпочтения и доставка уведомлений](../NOTIFICATIONS_PREFERENCES.md) | `NOTIFICATIONS_PREFERENCES.md` |
| [Измерение производительности](../PERFORMANCE_MONITORING.md) | `PERFORMANCE_MONITORING.md` |
| [Архитектура Kezek](../PROJECT_DOCUMENTATION.md) | `PROJECT_DOCUMENTATION.md` |
| [Ограничение частоты API-запросов](../RATE_LIMITING.md) | `RATE_LIMITING.md` |
| [Kezek](../README.md) | `README.md` |
| [Исторические задачи](../REFACTOR_TASKS.md) | `REFACTOR_TASKS.md` |
| [HTTP security headers](../SECURITY_HEADERS.md) | `SECURITY_HEADERS.md` |
| [Staging-окружение](../STAGING_ENVIRONMENT.md) | `STAGING_ENVIRONMENT.md` |
| [Swagger и OpenAPI в Kezek](../SWAGGER_SETUP.md) | `SWAGGER_SETUP.md` |
| [Kezek — функциональная модель системы](../SYSTEM_FEATURES_DOCUMENTATION.md) | `SYSTEM_FEATURES_DOCUMENTATION.md` |
| [Исторические задачи](../TASKS.md) | `TASKS.md` |
| [Telegram: реализованные сценарии и настройка](../TELEGRAM_AUTH_IMPLEMENTATION.md) | `TELEGRAM_AUTH_IMPLEMENTATION.md` |
| [Проверки Kezek](../TESTING_GUIDE.md) | `TESTING_GUIDE.md` |
| [WhatsApp: конфигурация текущих интеграций](../WHATSAPP_SETUP.md) | `WHATSAPP_SETUP.md` |
| [Если mobile не получает конфигурацию](../apps/mobile/ENV_FIX.md) | `apps/mobile/ENV_FIX.md` |
| [Конфигурация мобильного приложения](../apps/mobile/ENV_SETUP.md) | `apps/mobile/ENV_SETUP.md` |
| [Учётная запись Expo](../apps/mobile/EXPO_LOGIN.md) | `apps/mobile/EXPO_LOGIN.md` |
| [Отладка мобильного приложения](../apps/mobile/HOW_TO_DEBUG.md) | `apps/mobile/HOW_TO_DEBUG.md` |
| [Ошибка загрузки мобильного приложения](../apps/mobile/QUICK_FIX.md) | `apps/mobile/QUICK_FIX.md` |
| [Kezek Mobile](../apps/mobile/README.md) | `apps/mobile/README.md` |
| [Smoke-сценарии mobile](../apps/mobile/SMOKE_TESTS.md) | `apps/mobile/SMOKE_TESTS.md` |
| [Проверки мобильного приложения](../apps/mobile/TESTING.md) | `apps/mobile/TESTING.md` |
| [Диагностика мобильного приложения](../apps/mobile/TROUBLESHOOTING.md) | `apps/mobile/TROUBLESHOOTING.md` |
| [Отладка производительности web](../apps/web/PERFORMANCE_DEBUGGING.md) | `apps/web/PERFORMANCE_DEBUGGING.md` |
| [Kezek Web](../apps/web/README.md) | `apps/web/README.md` |
| [Playwright reference](../apps/web/e2e/README.md) | `apps/web/e2e/README.md` |
| [Локальный справочник API-тестов](../apps/web/src/__tests__/api/TESTING_GUIDE.md) | `apps/web/src/__tests__/api/TESTING_GUIDE.md` |
| [Структура модульных словарей](../apps/web/src/app/_components/i18n/dictionaries/README.md) | `apps/web/src/app/_components/i18n/dictionaries/README.md` |
| [Dashboard UI Kit](../apps/web/src/components/dashboard/README.md) | `apps/web/src/components/dashboard/README.md` |
| [Форматы ответов API](../apps/web/src/lib/API_ERROR_FORMATS.md) | `apps/web/src/lib/API_ERROR_FORMATS.md` |
| [Проверка доступа в HTTP-обработчике](../apps/web/src/lib/AUTH_CHECK_GUIDE.md) | `apps/web/src/lib/AUTH_CHECK_GUIDE.md` |
| [Обработка ошибок HTTP](../apps/web/src/lib/ERROR_HANDLING_GUIDE.md) | `apps/web/src/lib/ERROR_HANDLING_GUIDE.md` |
| [HOWTO: новый API endpoint](../apps/web/src/lib/HOWTO_NEW_API_ENDPOINT.md) | `apps/web/src/lib/HOWTO_NEW_API_ENDPOINT.md` |
| [Политика логирования](../apps/web/src/lib/LOGGING_POLICY.md) | `apps/web/src/lib/LOGGING_POLICY.md` |
| [Маскирование и ограничения логов](../apps/web/src/lib/LOGGING_SECURITY.md) | `apps/web/src/lib/LOGGING_SECURITY.md` |
| [Персональные данные: границы реализации](../apps/web/src/lib/SECURITY.md) | `apps/web/src/lib/SECURITY.md` |
| [Finance Domain — слой совместимости web](../apps/web/src/lib/financeDomain/README.md) | `apps/web/src/lib/financeDomain/README.md` |
| [Уведомления о бронировании](../apps/web/src/lib/notifications/README.md) | `apps/web/src/lib/notifications/README.md` |
| [Валидация данных в API Routes](../apps/web/src/lib/validation/README.md) | `apps/web/src/lib/validation/README.md` |
| [Синхронизация типов и схем](../apps/web/src/lib/validation/README_TYPES.md) | `apps/web/src/lib/validation/README_TYPES.md` |
| [Application anti-abuse policy](APPLICATION_ANTI_ABUSE_POLICY.md) | `docs/APPLICATION_ANTI_ABUSE_POLICY.md` |
| [Модель работы с датами](DATE_HANDLING_MODEL.md) | `docs/DATE_HANDLING_MODEL.md` |
| [Известные риски дат и периодов](DATE_HANDLING_RISKS.md) | `docs/DATE_HANDLING_RISKS.md` |
| [Каталог документов](DOCUMENTATION_MAP.md) | `docs/DOCUMENTATION_MAP.md` |
| [Инженерные проблемы Kezek](ENGINEERING_FINDINGS.md) | `docs/ENGINEERING_FINDINGS.md` |
| [Явные расписания сотрудников — состояние реализации](EXPLICIT_STAFF_SCHEDULES.md) | `docs/EXPLICIT_STAFF_SCHEDULES.md` |
| [Финансовый API: навигация по исходникам](FINANCE_API.md) | `docs/FINANCE_API.md` |
| [Первый запуск: маршрут по документации](FIRST_RUN_WALKTHROUGH.md) | `docs/FIRST_RUN_WALKTHROUGH.md` |
| [Глоссарий Kezek](GLOSSARY.md) | `docs/GLOSSARY.md` |
| [Локальная проверка Telegram](LOCAL_TELEGRAM_TESTING.md) | `docs/LOCAL_TELEGRAM_TESTING.md` |
| [Mobile Google Auth: конфигурация приложения и среды](MOBILE_GOOGLE_AUTH_EPIC2_CONFIG.md) | `docs/MOBILE_GOOGLE_AUTH_EPIC2_CONFIG.md` |
| [Mobile Google Auth: rollout и разбор отказов](MOBILE_GOOGLE_AUTH_ROLLOUT_RUNBOOK.md) | `docs/MOBILE_GOOGLE_AUTH_ROLLOUT_RUNBOOK.md` |
| [Mobile WhatsApp: подключение provider-конфигурации](MOBILE_WHATSAPP_PROVIDER_SETUP.md) | `docs/MOBILE_WHATSAPP_PROVIDER_SETUP.md` |
| [Module Boundaries](MODULE_BOUNDARIES.md) | `docs/MODULE_BOUNDARIES.md` |
| [Первая задача разработчика](ONBOARDING.md) | `docs/ONBOARDING.md` |
| [Эксплуатация Kezek](OPERATIONS.md) | `docs/OPERATIONS.md` |
| [Текущее состояние Kezek](PROJECT_STATUS.md) | `docs/PROJECT_STATUS.md` |
| [Как считается рейтинг в Kezek](RATINGS_HOW_IT_WORKS.md) | `docs/RATINGS_HOW_IT_WORKS.md` |
| [Документация Kezek](README.md) | `docs/README.md` |
| [Service client и граница бизнеса](SERVICE_CLIENT_USAGE_GUIDE.md) | `docs/SERVICE_CLIENT_USAGE_GUIDE.md` |
| [Подключение другого Telegram к текущему профилю](TELEGRAM_PROFILE_LINK.md) | `docs/TELEGRAM_PROFILE_LINK.md` |
| [Telegram bot login с привязкой к браузеру](TELEGRAM_WEB_LOGIN.md) | `docs/TELEGRAM_WEB_LOGIN.md` |
| [UI Definition Of Done](UI_DEFINITION_OF_DONE.md) | `docs/UI_DEFINITION_OF_DONE.md` |
| [UI System Foundation](UI_SYSTEM_FOUNDATION.md) | `docs/UI_SYSTEM_FOUNDATION.md` |
| [user_current_business — модель выбора и границы инвариантов](USER_CURRENT_BUSINESS_INVARIANTS.md) | `docs/USER_CURRENT_BUSINESS_INVARIANTS.md` |
| [WhatsApp mobile auth: события, SQL и предлагаемые alerts](WHATSAPP_MOBILE_ALERTS_DASHBOARD.md) | `docs/WHATSAPP_MOBILE_ALERTS_DASHBOARD.md` |
| [API: административные операции](api/ADMIN_API.md) | `docs/api/ADMIN_API.md` |
| [API: аутентификация, администрирование и интеграции](api/AUTH_AND_INTEGRATIONS.md) | `docs/api/AUTH_AND_INTEGRATIONS.md` |
| [API: бронирования, филиалы, услуги, отзывы и профиль](api/BOOKING_AND_CATALOG.md) | `docs/api/BOOKING_AND_CATALOG.md` |
| [API бизнес-процессов, расписаний и пакетов](api/BUSINESS_WORKFLOWS.md) | `docs/api/BUSINESS_WORKFLOWS.md` |
| [API: клиентские сценарии и дополнительные способы входа](api/CLIENT_AND_AUTH_FLOWS.md) | `docs/api/CLIENT_AND_AUTH_FLOWS.md` |
| [Служебные маршруты, телеметрия и дополнительная конфигурация](api/OPERATIONS_AND_TELEMETRY.md) | `docs/api/OPERATIONS_AND_TELEMETRY.md` |
| [Полный каталог HTTP-маршрутов](api/ROUTE_CATALOG.md) | `docs/api/ROUTE_CATALOG.md` |
| [API сотрудников, смен и финансов](api/STAFF_AND_FINANCE.md) | `docs/api/STAFF_AND_FINANCE.md` |
| [История планов и аудитов Kezek](archive/README.md) | `docs/archive/README.md` |
| [@core-domain](../packages/core-domain/README.md) | `packages/core-domain/README.md` |
| [Booking Domain Module](../packages/core-domain/src/booking/README.md) | `packages/core-domain/src/booking/README.md` |
| [Schedule Domain Module](../packages/core-domain/src/schedule/README.md) | `packages/core-domain/src/schedule/README.md` |
| [Shared Client Package](../packages/shared-client/README.md) | `packages/shared-client/README.md` |
| [Проверенный subset SDK](../packages/shared-client/src/generated-sdk/README.md) | `packages/shared-client/src/generated-sdk/README.md` |
| [Миграции БД: порядок работы и исторические ссылки](../supabase/APPLY_MIGRATIONS.md) | `supabase/APPLY_MIGRATIONS.md` |
| [Резервное копирование и восстановление](../supabase/BACKUP_AND_RESTORE.md) | `supabase/BACKUP_AND_RESTORE.md` |
| [Исторический случай: `hours_worked` перед CHECK constraints](../supabase/FIX_BEFORE_MIGRATION.md) | `supabase/FIX_BEFORE_MIGRATION.md` |
| [Supabase: схема и подготовка окружения](../supabase/README.md) | `supabase/README.md` |
| [SQL scenarios: scope и ограничения](../supabase/TESTING.md) | `supabase/TESTING.md` |

## Архитектурные решения и сценарии

Документов: 13.

| Документ | Путь |
| --- | --- |
| [Дизайн базового оффлайн‑режима для мобильного приложения (MOB-2)](../MOBILE_OFFLINE_DESIGN.md) | `MOBILE_OFFLINE_DESIGN.md` |
| [Карта мобильных сценариев (MOB-1)](../MOBILE_SCENARIOS.md) | `MOBILE_SCENARIOS.md` |
| [ADR: resolveBizContextForManagers — выбор бизнеса для кабинета менеджмента](BIZ_CONTEXT_RESOLVER_ADR.md) | `docs/BIZ_CONTEXT_RESOLVER_ADR.md` |
| [UX выбора кабинета при первом входе (несколько ролей)](FIRST_LOGIN_ROLE_SELECTION_UX.md) | `docs/FIRST_LOGIN_ROLE_SELECTION_UX.md` |
| [ADR: Mobile Google Auth Without Web Callback](MOBILE_GOOGLE_AUTH_ADR.md) | `docs/MOBILE_GOOGLE_AUTH_ADR.md` |
| [MOBILE_WHATSAPP_AUTH_ADR](MOBILE_WHATSAPP_AUTH_ADR.md) | `docs/MOBILE_WHATSAPP_AUTH_ADR.md` |
| [Mobile WhatsApp: проверка замены OTP-шаблона](MOBILE_WHATSAPP_AUTH_TEMPLATE_MIGRATION_CHECKLIST.md) | `docs/MOBILE_WHATSAPP_AUTH_TEMPLATE_MIGRATION_CHECKLIST.md` |
| [UX при нескольких ролях у пользователя](MULTI_ROLE_UX_SCENARIOS.md) | `docs/MULTI_ROLE_UX_SCENARIOS.md` |
| [Сценарии тестирования переключения ролей](ROLE_SWITCHING_TEST_SCENARIOS.md) | `docs/ROLE_SWITCHING_TEST_SCENARIOS.md` |
| [Комплексы услуг (запись на несколько услуг за один визит) — описание фичи и план реализации](SERVICE_COMPLEXES_FEATURE.md) | `docs/SERVICE_COMPLEXES_FEATURE.md` |
| [Абонементы и пакеты визитов — описание фичи и план реализации](SUBSCRIPTIONS_AND_PACKAGES_FEATURE.md) | `docs/SUBSCRIPTIONS_AND_PACKAGES_FEATURE.md` |
| [TELEGRAM_LINKING_ADR](TELEGRAM_LINKING_ADR.md) | `docs/TELEGRAM_LINKING_ADR.md` |
| [UI Acceptance Checklist](UI_ACCEPTANCE_CHECKLIST.md) | `docs/UI_ACCEPTANCE_CHECKLIST.md` |

## Исторические планы и отчёты

Документов: 61.

| Документ | Путь |
| --- | --- |
| [Аудит доступности (a11y)](../A11Y_AUDIT.md) | `A11Y_AUDIT.md` |
| [Карта филиалов для клиентов — план реализации](../BRANCHES_MAP_FEATURE_PLAN.md) | `BRANCHES_MAP_FEATURE_PLAN.md` |
| [Витрина бизнес‑аналитики и конверсионных метрик](../BUSINESS_ANALYTICS_DASHBOARD_PLAN.md) | `BUSINESS_ANALYTICS_DASHBOARD_PLAN.md` |
| [CHANGELOG.md — история значимых изменений Kezek](../CHANGELOG.md) | `CHANGELOG.md` |
| [Глубокий анализ проекта Kezek - Проблемы и оптимизации](../DEEP_ANALYSIS_ISSUES.md) | `DEEP_ANALYSIS_ISSUES.md` |
| [DEEP_CODE_REVIEW_2026-02-26](../DEEP_CODE_REVIEW_2026-02-26.md) | `DEEP_CODE_REVIEW_2026-02-26.md` |
| [План эволюционных улучшений Kezek (i18n, UX, дашборд)](../EVOLUTION_I18N_UX_PLAN.md) | `EVOLUTION_I18N_UX_PLAN.md` |
| [План эволюционных технических улучшений Kezek (архитектура, DX, мониторинг, mobile)](../EVOLUTION_TECH_PLAN.md) | `EVOLUTION_TECH_PLAN.md` |
| [Feature Matrix — карта модулей Kezek](../FEATURE_MATRIX.md) | `FEATURE_MATRIX.md` |
| [FINANCE_DOMAIN_TASKS](../FINANCE_DOMAIN_TASKS.md) | `FINANCE_DOMAIN_TASKS.md` |
| [Задачи на будущее: максимальное улучшение проекта и кода](../FUTURE_IMPROVEMENTS_TASKS.md) | `FUTURE_IMPROVEMENTS_TASKS.md` |
| [MULTI_BUSINESS_SELECTION_PLAN](../MULTI_BUSINESS_SELECTION_PLAN.md) | `MULTI_BUSINESS_SELECTION_PLAN.md` |
| [OWNER_CABINET_RISKS_AND_IMPROVEMENTS_TASKS](../OWNER_CABINET_RISKS_AND_IMPROVEMENTS_TASKS.md) | `OWNER_CABINET_RISKS_AND_IMPROVEMENTS_TASKS.md` |
| [Проблемы и оптимизации проекта Kezek](../PROJECT_REVIEW.md) | `PROJECT_REVIEW.md` |
| [RATING_SYSTEM_ISSUES_AND_PLAN](../RATING_SYSTEM_ISSUES_AND_PLAN.md) | `RATING_SYSTEM_ISSUES_AND_PLAN.md` |
| [Отчет об аудите и усилении RLS политик](../RLS_AUDIT_REPORT.md) | `RLS_AUDIT_REPORT.md` |
| [System‑wide analytics для суперадмина (черновик плана)](../SYSTEM_ANALYTICS_SUPERADMIN_PLAN.md) | `SYSTEM_ANALYTICS_SUPERADMIN_PLAN.md` |
| [История UI и UX задач](../UI_UX_IMPROVEMENTS.md) | `UI_UX_IMPROVEMENTS.md` |
| [Обновление дизайна мобильного приложения](../apps/mobile/DESIGN_UPDATE.md) | `apps/mobile/DESIGN_UPDATE.md` |
| [План покрытия тестами API Routes](../apps/web/src/__tests__/api/TEST_COVERAGE_PLAN.md) | `apps/web/src/__tests__/api/TEST_COVERAGE_PLAN.md` |
| [Аудит проверки прав доступа в API endpoints](../apps/web/src/lib/API_AUTH_AUDIT.md) | `apps/web/src/lib/API_AUTH_AUDIT.md` |
| [Рефакторинг дублирования кода](../apps/web/src/lib/DUPLICATION_REFACTORING.md) | `apps/web/src/lib/DUPLICATION_REFACTORING.md` |
| [Accessibility Audit (UI-27)](A11Y_AUDIT.md) | `docs/A11Y_AUDIT.md` |
| [Аудит терминологии кабинетов в UI](CABINET_TERMINOLOGY_AUDIT.md) | `docs/CABINET_TERMINOLOGY_AUDIT.md` |
| [Cleanup And Next Phase Plan](CLEANUP_AND_NEXT_PHASE_PLAN.md) | `docs/CLEANUP_AND_NEXT_PHASE_PLAN.md` |
| [Domain Expansion Plan](DOMAIN_EXPANSION_PLAN.md) | `docs/DOMAIN_EXPANSION_PLAN.md` |
| [Задачи: дебаунс-сохранение клиентов смены (batch save)](FINANCE_DEBOUNCE_SAVE_TASKS.md) | `docs/FINANCE_DEBOUNCE_SAVE_TASKS.md` |
| [Задачи по улучшению раздела финансов](FINANCE_IMPROVEMENTS_TASKS.md) | `docs/FINANCE_IMPROVEMENTS_TASKS.md` |
| [Оптимизация производительности раздела «Финансы»](FINANCE_PERFORMANCE_TASKS.md) | `docs/FINANCE_PERFORMANCE_TASKS.md` |
| [Аудит мест форматирования (даты, время, цены)](FORMATTING_AUDIT.md) | `docs/FORMATTING_AUDIT.md` |
| [Mobile Architecture Hardening Plan](MOBILE_ARCHITECTURE_HARDENING_PLAN.md) | `docs/MOBILE_ARCHITECTURE_HARDENING_PLAN.md` |
| [История UI и UX задач](MOBILE_AUTH_WEB_PARITY_IMPLEMENTATION_PLAN.md) | `docs/MOBILE_AUTH_WEB_PARITY_IMPLEMENTATION_PLAN.md` |
| [Mobile Bugfix Tasks (2026-05-19)](MOBILE_BUGFIX_TASKS_2026-05-19.md) | `docs/MOBILE_BUGFIX_TASKS_2026-05-19.md` |
| [Mobile Google Auth Decoupling Tasks](MOBILE_GOOGLE_AUTH_DECOUPLING_TASKS.md) | `docs/MOBILE_GOOGLE_AUTH_DECOUPLING_TASKS.md` |
| [История UI и UX задач](MOBILE_UI_UX_DEEP_ANALYSIS_AND_FIX_PLAN.md) | `docs/MOBILE_UI_UX_DEEP_ANALYSIS_AND_FIX_PLAN.md` |
| [История UI и UX задач](MOBILE_WHATSAPP_AUTH_TASKS.md) | `docs/MOBILE_WHATSAPP_AUTH_TASKS.md` |
| [Kezek: анализ продукта и план подготовки к Build Global](PRODUCT_AND_HACKATHON_PLAN_2026-10-07.md) | `docs/PRODUCT_AND_HACKATHON_PLAN_2026-10-07.md` |
| [Project Improvement Plan](PROJECT_IMPROVEMENT_PLAN.md) | `docs/PROJECT_IMPROVEMENT_PLAN.md` |
| [Project Improvement Progress 2026-03-30](PROJECT_IMPROVEMENT_PROGRESS_2026-03-30.md) | `docs/PROJECT_IMPROVEMENT_PROGRESS_2026-03-30.md` |
| [Project Review Action Tasks 2026-03-30](PROJECT_REVIEW_ACTION_TASKS_2026-03-30.md) | `docs/PROJECT_REVIEW_ACTION_TASKS_2026-03-30.md` |
| [RATINGS_IMPROVEMENTS_TASKS](RATINGS_IMPROVEMENTS_TASKS.md) | `docs/RATINGS_IMPROVEMENTS_TASKS.md` |
| [resolveBizContextForManagers: сценарии и план рефакторинга](RESOLVE_BIZ_CONTEXT_SCENARIOS_AND_REFACTOR.md) | `docs/RESOLVE_BIZ_CONTEXT_SCENARIOS_AND_REFACTOR.md` |
| [Аудит: дублирование логики ролей и выбора бизнеса](ROLES_AND_BUSINESS_SELECTION_AUDIT.md) | `docs/ROLES_AND_BUSINESS_SELECTION_AUDIT.md` |
| [История включения расписаний: 1–9 октября 2026](SCHEDULE_REMOTE_ROLLOUT.md) | `docs/SCHEDULE_REMOTE_ROLLOUT.md` |
| [Аудит: Service client без RLS и фильтры по biz_id](SERVICE_CLIENT_AND_BIZ_FILTERS_AUDIT.md) | `docs/SERVICE_CLIENT_AND_BIZ_FILTERS_AUDIT.md` |
| [Задачи по упрощению проекта (Simplification Tasks)](SIMPLIFICATION_TASKS.md) | `docs/SIMPLIFICATION_TASKS.md` |
| [Staff Bookings — поддержка комплексных услуг](STAFF_BOOKINGS_COMPLEX_SERVICES_TASKS.md) | `docs/STAFF_BOOKINGS_COMPLEX_SERVICES_TASKS.md` |
| [Исторический откат расписаний: 18 сентября 2026](STAFF_SCHEDULE_ROLLBACK.md) | `docs/STAFF_SCHEDULE_ROLLBACK.md` |
| [Supabase production fix plan](SUPABASE_PRODUCTION_FIX_PLAN.md) | `docs/SUPABASE_PRODUCTION_FIX_PLAN.md` |
| [История UI и UX задач](TELEGRAM_MOBILE_DEEPLINK_TASKS.md) | `docs/TELEGRAM_MOBILE_DEEPLINK_TASKS.md` |
| [История UI и UX задач](UI_UX_REDESIGN_ROADMAP.md) | `docs/UI_UX_REDESIGN_ROADMAP.md` |
| [Web Presentation Hardening Plan](WEB_PRESENTATION_HARDENING_PLAN.md) | `docs/WEB_PRESENTATION_HARDENING_PLAN.md` |
| [Web WhatsApp Auth Parity Tasks](WEB_WHATSAPP_AUTH_PARITY_TASKS.md) | `docs/WEB_WHATSAPP_AUTH_PARITY_TASKS.md` |
| [Сравнение страниц `/staff/finance` и `/dashboard/staff/id/finance` (архив)](archive/COMPARISON_STAFF_FINANCE_PAGES.md) | `docs/archive/COMPARISON_STAFF_FINANCE_PAGES.md` |
| [Миграция console.log на безопасное логирование (архив)](archive/CONSOLE_LOG_MIGRATION.md) | `docs/archive/CONSOLE_LOG_MIGRATION.md` |
| [Прогресс миграции console.log (архив)](archive/CONSOLE_LOG_MIGRATION_PROGRESS.md) | `docs/archive/CONSOLE_LOG_MIGRATION_PROGRESS.md` |
| [Kezek — дорожная карта улучшений](archive/IMPROVEMENT_TASKS.md) | `docs/archive/IMPROVEMENT_TASKS.md` |
| [Проблемы на страницах `/staff/finance` и `/dashboard/staff/id/finance` (архив)](archive/ISSUES_STAFF_FINANCE_PAGES.md) | `docs/archive/ISSUES_STAFF_FINANCE_PAGES.md` |
| [Резюме миграции console.log на безопасное логирование (архив)](archive/MIGRATION_SUMMARY.md) | `docs/archive/MIGRATION_SUMMARY.md` |
| [Задачи рефакторинга и упрощения кода](archive/REFACTOR_TASKS.md) | `docs/archive/REFACTOR_TASKS.md` |
| [Задачи по улучшению Kezek](archive/TASKS.md) | `docs/archive/TASKS.md` |

## Учёт проверок и передача кампаний

Документов: 13.

| Документ | Путь |
| --- | --- |
| [SCENARIO_TEST_REGISTRY](../SCENARIO_TEST_REGISTRY.md) | `SCENARIO_TEST_REGISTRY.md` |
| [MANUAL_TESTING_TRACKER](MANUAL_TESTING_TRACKER.md) | `docs/MANUAL_TESTING_TRACKER.md` |
| [MOBILE_BUG_REGISTRY](MOBILE_BUG_REGISTRY.md) | `docs/MOBILE_BUG_REGISTRY.md` |
| [MOBILE_TESTING_AREAS_CATALOG](MOBILE_TESTING_AREAS_CATALOG.md) | `docs/MOBILE_TESTING_AREAS_CATALOG.md` |
| [WEB_AGENT_HANDOFF](WEB_AGENT_HANDOFF.md) | `docs/WEB_AGENT_HANDOFF.md` |
| [WEB_BUG_REGISTRY](WEB_BUG_REGISTRY.md) | `docs/WEB_BUG_REGISTRY.md` |
| [WEB_CLOSURE_PLAN](WEB_CLOSURE_PLAN.md) | `docs/WEB_CLOSURE_PLAN.md` |
| [WEB_EVIDENCE_REVIEW](WEB_EVIDENCE_REVIEW.md) | `docs/WEB_EVIDENCE_REVIEW.md` |
| [WEB_GLOBAL_READINESS_PLAN](WEB_GLOBAL_READINESS_PLAN.md) | `docs/WEB_GLOBAL_READINESS_PLAN.md` |
| [WEB_HISTORICAL_DEFECTS](WEB_HISTORICAL_DEFECTS.md) | `docs/WEB_HISTORICAL_DEFECTS.md` |
| [WEB_LIVE_TESTING_AREAS_CATALOG](WEB_LIVE_TESTING_AREAS_CATALOG.md) | `docs/WEB_LIVE_TESTING_AREAS_CATALOG.md` |
| [WEB_VERIFICATION_METHOD](WEB_VERIFICATION_METHOD.md) | `docs/WEB_VERIFICATION_METHOD.md` |
| [WEB_VERIFICATION_REPORT](WEB_VERIFICATION_REPORT.md) | `docs/WEB_VERIFICATION_REPORT.md` |

## Инструкции работы с репозиторием

Документов: 1.

| Документ | Путь |
| --- | --- |
| [Инструкции агента](../AGENTS.md) | `AGENTS.md` |
