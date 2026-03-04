# Kezek

Платформа онлайн‑записи и управления салонами (барбершопы, салоны красоты и т.п.): бронирования, филиалы, сотрудники, финансы, рейтинги. Монорепозиторий: веб‑приложение (Next.js), мобильное приложение (Expo) и общие пакеты (`apps/web`, `apps/mobile`, `packages/*`).

## Быстрый старт

```bash
pnpm install
pnpm -C apps/web dev
```

Откройте [http://localhost:3000](http://localhost:3000). Подробнее: **[GETTING_STARTED.md](GETTING_STARTED.md)** — установка, env, команды, ключевые ссылки.

## Документация

- **[GETTING_STARTED.md](GETTING_STARTED.md)** — с чего начать новому разработчику.
- **[DOCUMENTS_OVERVIEW.md](DOCUMENTS_OVERVIEW.md)** — карта всех документов (что читать в первую очередь, что считать архивом).

Основные техдоки:

- Архитектура и домены: [PROJECT_DOCUMENTATION.md](PROJECT_DOCUMENTATION.md) (в т.ч. раздел «Роли и кабинеты»)
- Бизнес‑фичи: [SYSTEM_FEATURES_DOCUMENTATION.md](SYSTEM_FEATURES_DOCUMENTATION.md) (в т.ч. таблица «Роль → Доступные кабинеты → Основные функции»)
- API: [API_DOCUMENTATION.md](API_DOCUMENTATION.md) ([/api-docs](http://localhost:3000/api-docs) для Swagger UI)
- Состояние проекта и техдолг: [PROJECT_REVIEW.md](PROJECT_REVIEW.md), [EVOLUTION_TECH_PLAN.md](EVOLUTION_TECH_PLAN.md)