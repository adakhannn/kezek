# ENG-31: блокировка и удаление пользователей

Дата: 11 ноября 2026. Статус: **LOCAL_FIXED**, без remote rollout. Это отдельный пакет после [предыдущего закрытия](../engineering-2026-11-11-closure/summary.md), разрешённый прямым запросом человека. WEB-кампания и её ledger не возобновлялись.

## Результат

[HTTP service](../../../apps/web/src/lib/userLifecycleHttpService.ts) заменяет непроверяемые предварительные удаления и ошибочный signOut(UUID) на durable lifecycle-команду и штатный Auth admin API. [Миграция](../../../supabase/migrations/20261111090000_user_lifecycle.sql) завершает suspension/receipt и очистку связей внутри транзакции Auth. Если Auth или FK отказывает, предварительной потери профиля/ролей/staff/booking references больше нет.

Блокировка сохраняет роли и staff-link, отзывает сессии/refresh tokens и запрещает новые сессии; миграция отзывает также сессии старых user_suspensions. Unblock требует нового входа. Ограничения PostgREST/RLS закрывают доступ старым JWT после block/delete, включая проверенный security-definer RPC. Поздний Auth ban старой команды отклоняется. Повтор текущего действия использует тот же receipt; неизвестный исход возвращает 503, противоположное действие при pending — 409.

Самоблокировка/самоудаление и изменение защищённого global admin запрещены; проверяются все три role stores. Владельца бизнеса нельзя удалить до передачи владения. При удалении сохраняется строка сотрудника (inactive), снимается branch-admin связь и обнуляется client reference бронирований. Остальные зависимые записи следуют существующим FK CASCADE/SET NULL; это не универсальная политика хранения всех пользовательских данных. Due self-deletion сохраняет отдельный контракт обезличивания, с повторной проверкой blockers на фактическом Auth DELETE.

## Проверки

| Проверка | Результат |
| --- | --- |
| Полный web test:coverage | **602 suites / 3535 tests PASS**, 0 failed/skipped/todo; существующий coverage gate не изменён |
| Web lint | **0 errors / 124 warnings**; правила и исключения не ослаблены |
| Web TypeScript | PASS, `tsc --noEmit --incremental false` |
| Release build | PASS в изолированной копии с синтетической конфигурацией и запретом внешней сети; TypeScript/prerender включены |
| Auth/PostgREST E2E | PASS: реальные локальные GoTrue v2.180.0 + PostgREST v13.0.7 + PostgreSQL 16; internal network, без host ports и внешних сообщений |
| SQL регрессии | PASS: platform-admin commands и privileged-maintenance ACL |
| Фактическая копия БД | Native public/auth schema + public data baseline восстановлены; **22 миграции** применены по порядку под ролью `postgres`, включая ENG-31 |
| Docs/контракты | PASS: 29 tooling tests, 113 current/reference documents, 2759 local links; OpenAPI и 8 cron manifests согласованы; diff whitespace check чистый |
| Native-copy lifecycle | PASS: block/unblock, FK rollback, сохранение booking fields, staff/branch ACL cleanup, repeated delete и существующий due-self-deletion command; все fixture mutations откатились |

Интеграционный [runner](../../../scripts/test-user-lifecycle-isolated.cjs) включён в обязательную CI-матрицу и canonical registry. Он дополнительно проверяет параллельные одинаковые Auth-команды, запоздавший ban после unblock, ошибку удаления session внутри ban-транзакции, старые access/refresh tokens, новый вход, direct RLS и service-only ACL. Это узкий E2E пакета; штатный браузерный WEB-прогон и remote CI здесь не исполнялись.

Первый полный прогон обнаружил шесть ошибок в новом UI-тесте: отсутствующие DOM matchers. Они заменены эквивалентными проверками свойства disabled; ни одна проверка поведения не удалена. Финальный полный прогон зелёный. При проверке копии отдельно исправлено ожидание окончательного старта PostgreSQL и выровнен migration executor (`postgres` для всего набора), чтобы новые таблицы не получали искусственно другого владельца. Ошибочные промежуточные запуски не считаются PASS.

Машиночитаемые результаты и fingerprints: [verification.json](verification.json), [source-hashes.json](source-hashes.json). Private DB dumps, пользовательские строки и токены в репозиторий не включены.

## Ограничения и оставшиеся проблемы

- Миграции не применялись к удалённой БД; commit, stage, push и deploy не выполнялись. Перед rollout нужна сверка истории и пауза старых административных handlers до обновления обеих сторон. [Порядок и recovery](../../OPERATIONS.md#user-lifecycle-eng-31).
- Managed Auth schema/transaction order и PostgREST pre-request config — реальные зависимости. Другой существующий SQL hook нельзя молча заменить; миграция прерывается. Environment/config overrides и фактическая remote версия должны быть проверены при rollout.
- Storage/Realtime runtime, уже открытые соединения, device E2E и remote deployment этим прогоном не подтверждены. RLS guard не отзывает ранее скачанные данные/публичные URLs и не останавливает запрос, авторизованный до commit. Будущие RLS-таблицы требуют такого же restrictive guard.
- Потерянные прежней реализацией роли/связи не восстанавливаются из предположений. При постоянном FK/Auth отказе pending-команду нужно повторить после устранения причины; автоматического небезопасного удаления receipt/истечения lease нет.
- 124 предупреждения lint сохранены. Нагрузочный предел и production RPS не измерены. ENG-10, rollout, provider/device проверки и прочий остаток предыдущего пакета не расширяли задачу ENG-31 и остаются отдельно.

Это завершение локального пакета ENG-31, а не утверждение о стопроцентной готовности всего проекта.
