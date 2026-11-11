# Хранение, очистка и анонимизация данных

Актуализировано: 2026-10-30. Владельцы: backend, эксплуатация и владелец политики данных. Статус: параметры и поведение сверены с исходниками; применение миграций, исполнение cron и соответствие требованиям юрисдикции не подтверждены.

Эта таблица описывает текущую реализацию, а не юридически утверждённые сроки. Вход — [OPERATIONS](docs/OPERATIONS.md); расписание и статус исполнения — [CRON_SETUP](CRON_SETUP.md).

## Что вызывает retention cron

Источник параметров — [dataRetentionCronService](apps/web/src/lib/dataRetentionCronService.ts). `GET /api/cron/data-retention` вызывает девять RPC последовательно:

| RPC / данные | Передаваемый параметр | Действие и исключения |
| --- | --- | --- |
| `cleanup_old_api_metrics` / API metrics | 90 дней | Удаляет старые строки со status_code < 400; ошибки этим job не удаляются |
| `cleanup_old_finance_logs` / финансовые логи | 365 дней | Удаляет старые строки с log_level != error; error этим job не удаляется |
| `cleanup_old_funnel_events` / события воронки | 400 дней | Удаляет старые строки |
| `anonymize_old_bookings_pii` / bookings | 2555 дней от start_at | Заменяет непустое client_name на Anonymized, обнуляет client_phone/client_email; остальные данные остаются |
| `anonymize_inactive_profiles_pii` / profiles | 1095 дней | Проверяет возраст аккаунта, последний sign-in и брони; исключает staff, владельцев бизнеса, пользователей с business/global ролями |
| `cleanup_expired_telegram_mobile_auth_attempts` | 1440 минут после expires_at | Удаляет давно истёкшие попытки |
| `finalize_due_account_deletions` | batch_limit = 50 | Завершает due pending заявки с повторной проверкой блокеров; может удалять Auth/profile/reviews и обезличивать связанные bookings |
| `prune_booking_notifications` | p_limit = 100 | Удаляет eligible payloads доставки после 30 дней, сохраняя deduplication tombstones; независимо от enabled flag outbox worker |
| `prune_whatsapp_inbox` | p_limit = 100 | Очищает sender/text/command/reply/provider ID после 30 дней; старые pending/expired leases завершаются без replay. Receiver/message ID/hash/timestamp остаются tombstone; независимо от enabled flag inbox worker |

2555 и 1095 — именно числа дней; это не календарные семь и три года с учётом високосных лет. Default параметров в SQL могут отличаться: cron передаёт значения явно. Например, SQL defaults cleanup metrics/logs — 30/90 дней, тогда как этот job использует 90/365.

Новые lifecycle-источники: [booking outbox](supabase/migrations/20261110090000_booking_notification_outbox.sql), [WhatsApp inbox](supabase/migrations/20261110124000_whatsapp_inbox.sql). Ограничение 100 строк за запуск требует контроля backlog: срок eligibility не гарантирует удаление всех eligible строк в тот же день. Старую `whatsapp_messages` новая inbox migration не очищает. Tombstones остаются для защиты от повторной команды; это не полное удаление всех идентификаторов.

Источники условий: [API metrics cleanup](supabase/migrations/20260215000000_create_api_metrics_table.sql), [finance logs cleanup](supabase/migrations/20260214000000_create_finance_operation_logs.sql), [funnel/bookings cleanup](supabase/migrations/20260222000000_data_retention_cleanup.sql), [актуальная profile activity проверка](supabase/migrations/20260727010000_fix_profile_retention_activity.sql), [Telegram cleanup](supabase/migrations/20260422011000_add_telegram_mobile_auth_attempts_cleanup.sql), [account deletion lifecycle](supabase/migrations/20260706020000_account_deletion_lifecycle.sql).

## Границы текущей политики

- Для `staff_shifts`/`staff_shift_items` этот cron не задаёт срок удаления и не анонимизирует клиентские поля. Прежняя строка «хранение семь лет» не означала реализованную очистку.
- Error metrics/logs не имеют конечного срока в перечисленных cleanup функциях. Это открытый вопрос политики и объёма хранения.
- Очистка перечисленных таблиц не доказывает очистку всех копий PII: audit before/after, metadata, Auth, Storage, сторонние уведомления и backups требуют самостоятельного охвата.
- `funnel_events` содержит session ID и metadata. Называть такие записи безусловно анонимными или гарантированно не содержащими PII нельзя.
- Анонимизация отдельных полей booking/profile не равна полному удалению аккаунта. Для due account deletion есть отдельные блокеры и batch limit; backlog необходимо отслеживать.
- Для других таблиц, включая frontend/analytics telemetry и внешние logs, этот перечень не устанавливает автоматически срок хранения.

## Как оценивать выполнение

В обоих Vercel manifests указан ежедневный запуск в 04:00 UTC / 10:00 Asia/Bishkek; фактическая регистрация неизвестна. Авторизация и ограничения — в [CRON_SETUP](CRON_SETUP.md).

С 10 ноября service сохраняет ошибки отдельных RPC в полях `*_error` и продолжает независимые шаги, но любой такой отказ даёт HTTP 500 с частичным summary в `details`. Отсутствующий, отрицательный или нецелый счётчик не превращается в ноль: результат шага считается неподтверждённым. При транспортном исключении обработка прекращается; уже подтверждённые счётчики сохраняются, неизвестный шаг автоматически не повторяется. Журнал cron фиксирует неуспех, а не успешное обслуживание данных. Эксплуатационная запись должна содержать время, revision, все счётчики и ошибки, backlog due deletions и независимую проверку выбранных строк без публикации PII. Повторно затронутые anonymized строки не следует автоматически считать новыми обезличенными людьми.

Запуск retention — удаление/изменение данных, а не read-only health check. Перед разрешённым изменением политики владелец согласует категории, сроки, исключения, охват копий и восстановление по [BACKUP_AND_RESTORE](supabase/BACKUP_AND_RESTORE.md). Изменение Markdown само по себе не меняет поведение RPC. Документационная задача не запускает очистку, миграции или восстановление.
