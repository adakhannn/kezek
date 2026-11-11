# Kezek Mobile

Статус: справочник приложения. Обновлено 30 октября 2026.

Expo / React Native клиент содержит вход и восстановление сессии, запись, кабинет клиента, рабочие сценарии сотрудника и доступные мобильные сценарии бизнеса. Версии и команды: [package.json](package.json).

## Подготовка и запуск

Общие зависимости и выбор согласованного web/Supabase окружения: [GETTING_STARTED.md](../../GETTING_STARTED.md). Имена переменных mobile: [ENV_GUIDE.md](../../ENV_GUIDE.md). `EXPO_PUBLIC_API_URL` должен указывать на выбранный тестовый API, доступный с устройства; адрес production не является безопасным значением для локального эксперимента.

После подготовки среды из корня репозитория:

```bash
pnpm -C apps/mobile start
```

Команды `android`, `ios`, `web` и требования платформ описываются в контексте соответствующего окружения. Само чтение руководства не разрешает запуск, вход в реальные аккаунты или изменения удалённых данных.

## Структура

- `src/screens`, `src/components`: экраны и UI.
- `src/navigation`: навигация, deep links и восстановление сессии.
- `src/hooks`, `src/contexts`: состояние и композиция.
- `src/lib`, `src/utils`: API/Supabase, хранилище, инфраструктура.
- `src/__tests__`: проверки приложения.

Mobile использует и web API, и прямые Supabase-запросы. Открытый риск обмена сессией сохранён как ENG-01 в [реестре](../../docs/ENGINEERING_FINDINGS.md); прежние планы hardening не являются подтверждением его закрытия.

## Проверки и сопровождение

Основной набор и границы доказательств: [TESTING_GUIDE.md](../../TESTING_GUIDE.md).

```bash
pnpm check:mobile-utf8
pnpm -C apps/mobile typecheck
pnpm -C apps/mobile test:runInBand
```

Исходники сохранять в UTF-8. Для прямого вызова Jest допустимо `pnpm -C apps/mobile test --runInBand`; дополнительный `--` может превратить флаг в test pattern.

Предметные руководства: [диагностика](TROUBLESHOOTING.md), [инструменты отладки](HOW_TO_DEBUG.md), [проверки mobile](TESTING.md), [сценарии smoke](SMOKE_TESTS.md). Общая карта: [docs/README.md](../../docs/README.md).
