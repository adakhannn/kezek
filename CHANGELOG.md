# CHANGELOG.md — история значимых изменений Kezek

Формат основан на [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).  
Даты указаны в формате `YYYY-MM-DD`. Добавляйте записи при релизах или крупных изменений в проде.

## [Unreleased]

- Добавляйте сюда заметки о новых фичах, исправлениях и миграциях, пока они не войдут в релиз.

## [2026-03-05] — Документация и инфраструктура

### Added

- CHANGELOG.md с базовой структурой для фиксации значимых изменений.
- `docs/GLOSSARY.md` — единый глоссарий терминов (бизнес, филиал, смена, бронь, промо, метрики, тесты).
- `apps/web/src/lib/SECURITY.md` расширен разделами про PII, маскирование в логах и связь с `DATA_RETENTION.md`.
- `.github/dependabot.yml` — автообновления npm/pnpm‑зависимостей и GitHub Actions.
- job `security_audit` в `.github/workflows/ci.yml` (запуск `pnpm audit --audit-level=high` в CI).

### Changed

- Обновлён корневой `README.md`: краткое описание продукта, стек, быстрый старт, навигация по документации.
- Уточнены статусы и описания документов в `DOCUMENTS_OVERVIEW.md` (API/E2E testing, monitoring, alerts).

### Fixed

- `FUTURE_IMPROVEMENTS_TASKS.md` синхронизирован с фактическим состоянием проекта: отмечены выполненные задачи по тестам, мониторингу, документации, индексации и CI.

