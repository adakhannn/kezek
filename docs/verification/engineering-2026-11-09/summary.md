# Локальный пакет инженерных исправлений 9–10 ноября 2026

Статус: локальный пакет завершён; общие release gates остаются красными. Аудитория: разработчик и ревьюер следующего этапа. Сопровождение: команда разработки. Это не WEB acceptance, не deployment и не сертификат нагрузочной готовности.

Эта сводка сохраняет результаты первого пакета. Продолжение по новому запросу человека, включая исправление семи test failures и 52 lint errors, описано в [отдельном отчёте 10 ноября](../engineering-2026-11-10-gates/summary.md); счётчики ниже не переписаны задним числом.

## Граница задачи

После документационного этапа человек разрешил продуктовые исправления, затем попросил логически завершить текущий пакет и продолжить позже. Работа ограничена локальным checkout, unit/service tests и отдельными временными PostgreSQL 16 контейнерами с синтетической схемой. Старые WEB-процессы, automation, роли и fixtures не возобновлялись. `.env`, удалённые Supabase и реальные провайдеры не использовались; сообщений и писем не отправляли. Commit, stage, push и deploy не выполнялись.

Основной реестр статусов — [ENGINEERING_FINDINGS](../../ENGINEERING_FINDINGS.md); этот файл хранит проверку итерации. Исходный HEAD: `b424cd396cbeefbe2a4173e0aa4583661e85ba87`. Изменения остаются в рабочем дереве поверх ранее изменённой документации.

## Что изменено

- Session exchange: server-issued code, hash+S256 binding, атомарное погашение в БД, отключён GET/latest-pending и публичный приём tokens. Telegram/WhatsApp web/mobile consumers сохраняют verifier; Google использует native Supabase PKCE. Сессия выпускается через проверенную identity без сброса пароля. Legacy Telegram Widget с прежней схемой пароля не объявлен исправленным.
- Старые WhatsApp auth send/verify/create-session отвечают HTTP 410 без Auth/DB/provider effects. До исправления негативный тест create-session получал HTTP 200 для переданного чужого userId; после — 6 тестов PASS. Это breaking change для старых внешних клиентов, инвентаризация которых вне checkout не выполнена.
- Caller-bound global-super проверки, закрытая диагностика, raw-byte HMAC WhatsApp webhook, ограниченный notify/ping, обязательный одноразовый browser-bound Yandex state.
- Финансовые Save/Close перенесены в новые tenant-aware SQL-команды с блокировкой смены и revision fence; итог проверки приведён ниже. Это не замена полного аудита grants/RLS всех таблиц.
- Четыре update routes используют явный частичный контракт: отсутствующие поля сохраняются; malformed JSON/неверные типы отклоняются. Координаты передаются парой. Проверены 24 HTTP cases и связанные service/schema tests.
- Исправлены дата пакетов на каждом запросе, попадание текущей смены в исторический отчёт, игнорирование resolved RPC.error при пересчёте рейтинга и ложное подтверждение гостевой записи.
- Cache ограничен 256 entries и 4 MiB retained string payload, с TTL<=10min, LRU и очисткой expired при записи;10 000 уникальных ключей не растят его сверх бюджета. Это локальный cache, без single-flight и общего распределённого хранилища.
- Jest больше не передаёт `dir` в nextJest и не загружает application config/локальные `.env` перед synthetic setup. Unmocked fetch запрещён setup-файлом.

## Проверки

Изолированные SQL runners не используют application DB. Они создают уникальный контейнер без network/host ports, запускают `psql -X -v ON_ERROR_STOP=1` и удаляют только собственный контейнер в finally. Предусловие: локально доступный образ `postgres:16`; наборы не доказывают полный bootstrap production-схемы.

| Проверка | Результат |
| --- | --- |
| [Auth/Yandex SQL](../../../scripts/test-mobile-auth-grants-isolated.cjs) | PASS: 12 concurrent grant/OTP/state consume → ровно 1; wrong proof/owner, expiry и anon/authenticated RPC execution denied |
| [Finance SQL](../../../scripts/test-finance-transactions.mjs) | PASS: 5 доказанных overlapping-lock сценариев Save/Save, Save/Close, direct item/Close, Close/Save и tenant-move/package; rollback после мутации и aggregate failure; ACL/DML bypass, duplicate/cancelled, package/promotion retry, needs_review, guarantee/reclose |
| Полный mobile test | **43 suites / 227 tests PASS**; unmocked fetch запрещён setup, native/provider boundaries mocked |
| Web/mobile typecheck | **PASS** финального общего дерева: оба tsc exit 0 |
| Полный web test:coverage, финальный | **540 suites: 537 PASS / 3 FAIL; 2726 tests PASS / 7 FAIL. Exit 1.** Все оставшиеся failed assertion names совпадают с [отчётом 28 октября](../runs/2026-10-28-web-resume/c252-technical-checks.json). Новые изменения не объявляются причиной этих старых failures, но общий gate остаётся красным |
| Полный web lint | **FAIL: 52 errors / 142 warnings.** Все 52 errors находятся вне изменённых production files; в изменённых файлах 0 errors / 14 warnings |
| Документация и diff | Проверка 113 текущих/справочных документов, ссылок, якорей, JSON и каталогов PASS; 17 tests документационных tools PASS; git diff --check PASS |

Машиночитаемые счётчики, имена оставшихся failures и hashes результатов: [verification.json](verification.json). Web coverage: statements 94.60%, branches 86.52%, functions 97.50%, lines 96.38% **только существующего allowlist**, не всех исходников. Порог 60% выполнен, однако failed tests оставляют команду красной.

Остались семь прежних failures в StaffCabinetPages, ProfileLoadFailureBoundary и RoleApplicationsReadState: в том числе проверки, что ошибка загрузки не показывает редактируемый пустой профиль или подтверждённый пустой список заявок. Эти проверки не удалялись и не ослаблялись ради зелёного прогона.

Основные команды выполнены из корня checkout:

```bash
pnpm -C apps/web typecheck
pnpm -C apps/mobile typecheck
pnpm -C apps/web test:coverage --maxWorkers=2 --silent --json
pnpm -C apps/mobile test --runInBand --silent --json
pnpm -C apps/web lint
node scripts/test-mobile-auth-grants-isolated.cjs
node scripts/test-finance-transactions.mjs
node scripts/check-doc-links.mjs
node --test scripts/docs-tools.test.mjs
git diff --check
```

Индекс сохранён: SHA256 staged binary diff до/после — `6c9d8aef67dd392a0948a5ac224d251984deb189066eac45d8a0d5c2af04705a`. Ранее существовавшие изменения документации сохранены.

## Обязательные условия перед выпуском

Новые миграции пока **не применены к рабочей/удалённой БД**:

1. [Bound mobile grants](../../../supabase/migrations/20261109090000_bound_mobile_session_grants.sql).
2. [Tenant finance guards](../../../supabase/migrations/20261109090100_tenant_finance_rpc_guards.sql).
3. [Atomic shift commands](../../../supabase/migrations/20261109091100_atomic_shift_commands.sql).
4. [Yandex OAuth state](../../../supabase/migrations/20261109100000_yandex_oauth_state.sql).

Нужны проверка предпосылок миграций на согласованной среде, согласованный rollout web/mobile, отдельный `WHATSAPP_APP_SECRET`, provider/device E2E и release builds. Старые auth attempts/clients могут не пройти новый протокол. Перед финансовым unique index нужно проверить существующие дубликаты связанной брони; миграция не должна молча очищать пользовательские данные.

Полный bootstrap исходной БД по checkout не подтверждён. Старый Playwright/remote fixture campaign не запускался. Нагрузочный профиль, предел RPS, restore/PITR и многопроцессное поведение всего продукта не измерены.

## Остаток следующего этапа

Помимо общих красных проверок остаются rate limiter/fallback, durable notification outbox, большие выборки и SQL-агрегации, bootstrap и CI, календарь scheduler, telemetry и Swagger. Гостевой hold/confirm остаётся последовательностью двух операций без HTTP идемпотентности; ошибку confirm теперь видно, но вся операция не стала атомарной. Финансовый Save без переданной expectedRevision остаётся last-writer-wins, хотя транзакции сериализованы; UI пока не передаёт revision, автоматической защиты устаревшего snapshot это не обещает. Исторический manual Close с почасовой оплатой может выйти за ограничение hours_worked; этот сценарий, отдельные owner Open/update-hours и общая политика eligibility акций не объявлены полностью проверенными. Cron needs_review остаётся открытой сменой; большое число таких старых смен требует разбора оператором, иначе они занимают очередной bounded batch.

Проект не объявлен готовым на 100%; следующая работа начинается по новому сообщению человека. Старые acceptance факты и paused automation не изменяются этой сводкой.
