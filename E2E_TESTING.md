# E2E-проверки WEB

Статус: `reference`. Сверено с исходниками: **2026-11-25**. Владелец: **Engineering**.

Основной процесс проверок — [TESTING_GUIDE.md](TESTING_GUIDE.md). Точный справочник Playwright scripts, env contract, CI и артефактов находится рядом с тестами: [apps/web/e2e/README.md](apps/web/e2e/README.md). Общий индекс — [docs/README.md](docs/README.md).

E2E-сценарии в репозитории являются исполняемыми спецификациями, а не свидетельством полного PASS. Seeded, auth и visual suites работают против локального Supabase с fixture `scripts/e2e-seed.mjs` (в CI — внутри jobs, без secrets и без production); без этого fixture они пропускаются. Smoke business-apply/sign-in/terms/privacy не подтверждает бронирование, смены, финансы или tenant isolation.

Запуск допустим только в рамках отдельной разрешённой задачи с подготовленной изолированной средой, явными ролями, fixtures и пределами мутаций. Этот документ не разрешает создавать учётные записи, менять рабочие брони/смены/пакеты, отправлять сообщения, сбрасывать БД или проводить очистку данных. Текущая документационная работа не запускала Playwright, build или сервер.

Закрытая ручная WEB-кампания остаётся остановленной. Её правила — в [WEB_AGENT_HANDOFF.md](docs/WEB_AGENT_HANDOFF.md), факты приёмки — в [WEB_VERIFICATION_LEDGER.json](docs/WEB_VERIFICATION_LEDGER.json). Старые разрешения/очереди не становятся действующими из-за открытия этого справочника.

