# Staging-окружение

Актуализировано: 2026-10-30. Владелец: эксплуатация. Статус: требования к изоляции; существование и параметры реального staging не подтверждены.

Связанные документы: [OPERATIONS](docs/OPERATIONS.md), [ENV_GUIDE](ENV_GUIDE.md), [миграции](supabase/APPLY_MIGRATIONS.md), [тестирование](TESTING_GUIDE.md).

## Граница окружения

Staging должен иметь собственные Supabase project reference, БД, Auth, Storage, ключи, API origin и настройки внешних провайдеров. Preview deployment, подключённый к production Supabase, не является изолированным staging. Использование копии production-данных требует отдельного решения о минимизации персональных данных.

Тестовые аккаунты, роли, бизнесы, cron и исходящие email/Telegram/WhatsApp должны иметь явно определённые владельцем границы. Наличие seed-файла не разрешает его запуск и не доказывает наличие нужных fixtures.

## Что необходимо зафиксировать

| Параметр | Подтверждённое состояние на дату документа |
| --- | --- |
| Staging URL и hosting project ID | `UNKNOWN` |
| Supabase project reference и applied migration revision | `UNKNOWN` |
| Регион приложения/БД, ресурсы и connection limits | `UNKNOWN` |
| Способ выбора web deployment root и cron manifest | `UNKNOWN`; в репозитории два разных manifest |
| Изолированные auth redirect URLs и callback origins | `UNKNOWN` |
| Тестовые получатели уведомлений и режимы провайдеров | `UNKNOWN` |
| Владелец fixtures, разрешённые тесты и cleanup | `UNKNOWN` |
| Замеренная ёмкость и результат восстановления backup | `NOT_MEASURED` / `NOT_VERIFIED` |

Владелец эксплуатации заменяет неизвестное фактом только со ссылкой на запись конфигурации или результат проверки с датой. Не сохранять секреты, session tokens и персональные данные в этой таблице.

## Переменные и запуск

Web использует настройки Supabase, origin и провайдеров из [ENV_GUIDE](ENV_GUIDE.md). Mobile требует собственные `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` и `EXPO_PUBLIC_API_URL`, соответствующие тому же staging.

Произвольный файл `apps/web/.env.staging.local` сам по себе не подключает окружение: в [web scripts](apps/web/package.json) нет команды, загружающей его. Способ передачи staging env должен быть указан в deployment/launch configuration. Не менять `NODE_ENV` на нестандартное значение ради выбора среды.

В [.github/workflows/ci.yml](.github/workflows/ci.yml) E2E base URL берётся из `E2E_TEST_BASE_URL` с fallback на localhost. Его наличие не доказывает, что CI подключён к staging. В workflow нет отдельного web deployment job, подтверждающего схему `main → production` или `staging → staging`; такие правила хостинга остаются внешней конфигурацией. Условие mobile job по тегу также не доказывает запуск по тегам: проверять нужно и верхнеуровневые triggers.

## Приёмка окружения

Для отдельной разрешённой проверки сохраняют source/deployment revision, applied migrations, настройки ресурсов без секретов, разрешённые fixtures и результаты критичных сценариев. Нагрузочный отчёт дополнительно содержит объём данных, mix запросов, concurrency/RPS, p95/p99, ошибки, DB/CPU/память и внешние квоты. Успешная сборка не заменяет эти результаты.

Восстановление проверяется в отдельной целевой среде по [BACKUP_AND_RESTORE](supabase/BACKUP_AND_RESTORE.md), с измеренными RPO/RTO. Перечень проверок здесь — контракт будущего окружения, а не разрешение возобновить закрытую WEB-кампанию, запустить E2E, создать роли или применить миграции. Текущие ограничения — в [WEB_AGENT_HANDOFF](docs/WEB_AGENT_HANDOFF.md).

