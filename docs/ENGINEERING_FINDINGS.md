# Инженерные проблемы Kezek

Статус: инженерный реестр с исходными наблюдениями и состоянием локального пакета 11 ноября 2026. Сопровождение: команда разработки.

Этот реестр сохраняет исходные выводы анализа 30 октября / 1 ноября и отдельный статус текущей итерации ниже. После завершения первого пакета отдельный запрос 11 ноября разрешил только ENG-31: блокировку/удаление пользователей, проверки на копии БД и документацию. Данные старой WEB-приёмки не меняются. **LOCAL_FIXED** означает проверку локального изменения, а не применённую миграцию, успешный rollout или готовность production. Исходные описания ниже фиксируют прежний дефект; для текущего состояния приоритет имеет таблица итерации.

P0 — блокер доступа/изоляции до широкого использования; P1 — высокий риск корректности, устойчивости или выпуска; P2 — эксплуатационный риск, требующий устранения или измерения. Приоритет — инженерная оценка. Там, где эффект зависит от развёрнутой схемы или конфигурации, условие указано явно.

## Состояние пакета 11 ноября

Первый пакет — [закрытие 11 ноября](verification/engineering-2026-11-11-closure/summary.md); отдельный текущий результат ENG-31 — [отчёт lifecycle](verification/engineering-2026-11-11-eng31/summary.md). Предыдущие этапы [9–10 ноября](verification/engineering-2026-11-09/summary.md) и [исправление tests/lint](verification/engineering-2026-11-10-gates/summary.md) сохранены с исходными результатами. LOCAL_FIXED относится к локальному коду и указанным проверкам; ни одна новая миграция не применялась к удалённой БД. Нагрузочная ёмкость неизвестна.

| ID | Текущее состояние | Подтверждение и остаток |
| --- | --- | --- |
| ENG-01, ENG-08, ENG-19, ENG-24 | LOCAL_FIXED для нового auth-протокола: привязка к инициатору, durable consume, закрытые legacy WhatsApp routes, обязательный OAuth state | Unit/SQL concurrency и ACL; нужны совместимый rollout и provider/device E2E. Legacy Telegram Widget не входит в подтверждённый новый протокол |
| ENG-02–ENG-06 | LOCAL_FIXED для Save/Close: обязательные identity/revision, tenant/booking guards, атомарность, пакетная запись, сохранение конфликтного черновика web/mobile | Проверены конкурирующие операции, повторные списания и откат; это не полный аудит всей SQL-поверхности |
| ENG-07 | LOCAL_FIXED: общий Redis, атомарный TTL, отдельные route/principal/tenant budgets, без production fallback | Реальный изолированный Redis, параллельные writers и отказ зависимости. Настройка trusted ingress и ресурсы deployment отдельно |
| ENG-09, ENG-22, ENG-26 | LOCAL_FIXED для атомарной записи/повтора брони, transactional outbox и подписанного durable WhatsApp inbox | SQL receipt/rollback/lease/ACL, worker deadlines и неоднозначные отправки. Реальная доставка и пропускная способность провайдеров не измерены |
| ENG-10 | OPEN | Map/nearby режут выборку до географического фильтра; geo-реализация в этот пакет не включалась |
| ENG-11 | LOCAL_FIXED: overdue backlog, ограниченные claims/leases, честные ошибки и остаток | SQL concurrency/fairness, business-local day и DST; реальные Vercel-запуски не подтверждены |
| ENG-12 | LOCAL_FIXED для изменённых финансовых/аналитических readers | Скалярные SQL snapshots/aggregates, проверки более 1000 строк. Полнота всех остальных endpoints не утверждается |
| ENG-13 | LOCAL_FIXED: фильтр выбранного staff до resolver, ограниченные страницы, защита от устаревших ответов web/mobile | SQL ACL/курсор и синтетический benchmark; это не production RPS |
| ENG-14 | PARTIAL | Фактический baseline сохранён частно, восстановлен, 22 новые миграции применены к копии. Чистый bootstrap всего Supabase из checkout и reconciliation истории остаются открытыми |
| ENG-15 | PARTIAL | Обязательные full web/SQL CI gates, fail-fast runner и реальные SQL-команды. Полный seeded E2E и execution CI на remote не подтверждены |
| ENG-16 | LOCAL_FIXED для общего bounded Redis collector и честных исходов | Изолированные writers/retention, разделение browser/server metrics; внешний monitoring/нагрузочная ёмкость отдельно |
| ENG-17 | LOCAL_FIXED для ограниченного локального cache | TTL/LRU, 256 entries/4 MiB; distributed cache/single-flight и heap profile не сделаны |
| ENG-18 | LOCAL_FIXED конфигурация/наблюдаемость | Единые восемь расписаний, fail-closed secret, durable last-success и queue health; регистрация Vercel cron и внешний монитор отдельно |
| ENG-20–ENG-21, ENG-23, ENG-25 | LOCAL_FIXED в описанных границах | Caller-bound admin RPC, закрытая диагностика, ограниченный ping, строгие PATCH-контракты. Блокировка/удаление пользователей отдельно проверены в ENG-31 |
| ENG-27 | PARTIAL | Основные команды/отчёты используют business-local calendar и сохранённые условия смены; legacy today reader сохраняет app-TZ/default-rate поведение, общий аудит всех дат не завершён |
| ENG-28 | LOCAL_FIXED для публикации/генерации | Валидный корневой OpenAPI, полный inventory HTTP exports, 4 подробно типизированных SDK-контракта. Inventory остальных операций не равен подробному SDK-покрытию |
| ENG-29 / P0 | LOCAL_FIXED: confirm/cancel проверяют actor/tenant под lock; прямой DML и старые create RPC закрыты | Исходная фактическая схема допускала anonymous cancel/confirm. Поведение новой границы проверено в SQL; удалённая схема пока прежняя |
| ENG-30 / P0 | LOCAL_FIXED для перечисленных maintenance/role/log границ | [132000](../supabase/migrations/20261110132000_privileged_maintenance_acl.sql): 17 служебных RPC, table/column/view DML, branch grant/revoke, retired dev shortcut. Это не заявление о полном аудите всех RPC |
| ENG-31 / P1 | LOCAL_FIXED: transactional user lifecycle, безопасные повторы, защита global admins/owners и отзыв сессий | [Отчёт](verification/engineering-2026-11-11-eng31/summary.md): реальный изолированный Auth/PostgREST, native DB copy, FK/session fault rollback, старые JWT/refresh и stale commands. Нужен согласованный remote rollout; Storage/Realtime runtime отдельно не проверялись |

## Исходные условия находок

Ниже сохранены первоначальные наблюдения 30 октября / 1 ноября; их OPEN и формулировки описывают исходное состояние. Для текущего состояния приоритет имеет таблица выше. У фактической таблицы bookings подтверждено exclusion-ограничение no_overlap: отсутствие защиты от пересечений не установлено. Изменения исходной схемы, чужие данные или состоявшаяся атака локальными проверками не утверждаются.

## ENG-01 Мобильная сессия без привязки к инициатору

**P0 · OPEN · дефект цепочки в исходниках.** `runMobileExchangeGet` возвращает последний незабранный код процесса, затем обменивает код на access/refresh tokens без привязки к устройству/попытке входа. GET route не добавляет auth. Mobile вызывает этот механизм при восстановлении сессии.

Источники: [route service](../apps/web/src/lib/mobileExchangeRouteService.ts), [GET route](../apps/web/src/app/api/auth/mobile-exchange/route.ts), [mobile consumer](../apps/mobile/src/navigation/useRootNavigationSession.ts).

Условие: в обслуживающем процессе есть незабранная попытка другого пользователя. TTL и одноразовость не устраняют раскрытие самого кода. Уже произошедшая утечка или доступность этой версии в production не установлены.

Выход: убрать глобальный latest-pending; обмен привязать к инициатору через verifier/PKCE, погашать атомарно. Проверить изоляцию двух независимых попыток и повторное погашение в разрешённом тестовом окружении.

## ENG-02 Привилегированные RPC без проверки бизнеса

**P0 · OPEN · определения и grants подтверждены в миграциях; deployed ACL неизвестны.** `update_booking_status_no_check`, `save_shift_items_atomic`, `get_business_finance_stats` используют SECURITY DEFINER, доступны authenticated и не проверяют право вызывающего на переданный объект/бизнес. Проверенные триггеры не восполняют actor/tenant check. Поздний отзыв этих grants в просмотренных миграциях не найден.

Источники: [статус брони](../supabase/migrations/20250102000000_update_booking_status_without_check.sql), [позиции смены](../supabase/migrations/20260213000001_add_save_shift_items_function.sql), [grant позиций](../supabase/migrations/20260213000002_grant_save_shift_items_permissions.sql), [финансовая статистика](../supabase/migrations/20260128000000_fix_nested_aggregate_error.sql).

Если эти определения действуют с владельцем, обходящим RLS, прямой RPC обходит проверку Next.js API. Выход: сверить владельцев/ACL через отдельно разрешённый процесс, ограничить внешнее выполнение служебных функций и проверять пользователя/бизнес внутри доверенной операции. Негативные межбизнесовые проверки обязательны; массовые grants/revokes вслепую не применять.

## ENG-03 Вложенные booking ID не проверяются при сохранении смены

**P0 · OPEN · дефект источника.** `runStaffShiftItemsRoute` проверяет целевого сотрудника. `runSaveStaffShiftItems` собирает booking ID из тела и через service client передаёт их в `updateBookingStatusesToPaid`, где нет проверки biz/staff/date принадлежности брони.

Источники: [route service](../apps/web/src/lib/staffShiftItemsRouteService.ts), [сохранение и статусы](../apps/web/src/lib/staffShiftItemsService.ts), [валидация UUID](../apps/web/src/lib/validation/schemas.ts).

Условие: известен ID подходящей прошедшей чужой брони и доступен service client. Возможны изменение статуса и связанные списания. Выход: проверить все вложенные связи до мутаций в одной транзакции; чужой ID должен отклоняться без частичных эффектов.

## ENG-04 Пакет визитов не ограничен бизнесом брони

**P1 · OPEN · дефект определения SQL.** `get_applicable_visit_package_for_booking` проверяет клиента, срок, остаток, услугу и филиалы, но не `plan.biz_id = booking.biz_id`. Универсальный пакет бизнеса A может подходить к посещению B.

Источник: [подбор и списание пакета](../supabase/migrations/20260306000000_visit_package_apply_functions.sql).

Выход: определить и обеспечить бизнесовую границу универсального плана; проверить одного клиента с пакетами двух независимых бизнесов. Применённая версия функции в удалённой БД не проверялась.

## ENG-05 Финансовое сохранение и закрытие не защищают всю операцию

**P1 · OPEN · неатомарная последовательность и окно гонки в исходниках.** Статусы броней меняются до записи позиций; обновления/удаления/итоги выполняются отдельными запросами. Часть ошибок только логируется, возможен финальный `ok:true`. При перечитывании сумм ошибка явно не обрабатывается. Функция `save_shift_items_atomic` текущей цепочкой не вызывается.

Закрытие сначала читает позиции и рассчитывает суммы в приложении, затем RPC блокирует смену и сохраняет готовые значения. Между чтением и RPC другой запрос может изменить позиции; проверка состава до RPC не закрывает это окно.

Источники: [staffShiftItemsService](../apps/web/src/lib/staffShiftItemsService.ts), [staffShiftCloseService](../apps/web/src/lib/staffShiftCloseService.ts), [close_staff_shift_safe](../supabase/migrations/20260312001000_fix_close_staff_shift_safe_v_shift_record.sql).

Выход: общая транзакция либо revision protocol для сохранения/закрытия; атомарные статусы, списания, позиции и суммы; безопасный повтор. Проверить конкурентное изменение, отказ посередине и согласованность итогов с независимым ожидаемым расчётом.

## Остальные открытые проблемы

| ID | Приоритет | Наблюдение и условие | Источник | Проверяемый выход |
| --- | --- | --- | --- | --- |
| ENG-06 | P1 | До 1000 позиций разрешены одним Save; существующие строки и статусы обновляются отдельными запросами через Promise.allSettled без ограничения параллелизма. Возможны две фазы примерно по 1000 обращений | [schema](../apps/web/src/lib/validation/schemas.ts), [service](../apps/web/src/lib/staffShiftItemsService.ts) | Пакетная команда и ограниченный размер; измеренное число запросов и нагрузка на одном большом Save |
| ENG-07 | P1 | Маршруты без keyPrefix делят IP-счётчик, включая telemetry и critical 5/min; Redis INCR/EXPIRE раздельны, отказ Redis ведёт к локальному fallback | [limiter](../apps/web/src/lib/rateLimit.ts), [shift open](../apps/web/src/app/api/staff/shift/open/route.ts), [telemetry](../apps/web/src/app/api/metrics/frontend/route.ts) | Независимые budgets action/user/business/IP, атомарный TTL, проверка общего NAT и отказа Redis |
| ENG-08 | P1 | Обмен сессии хранится в Map процесса: POST на A и GET на B теряют доступ к коду. Часть abuse/idempotency state также локальна | [exchange](../apps/web/src/lib/mobileExchangeService.ts), [WhatsApp idempotency](../apps/web/src/lib/whatsAppMobileAuthIdempotency.ts) | Общий атомарный TTL/consume; проверка двух инстансов и restart |
| ENG-09 | P1 | Booking ждёт уведомления. Email добавляет 600 ms между получателями, fetch без собственного deadline; retry 429 внутри запроса. В этой цепочке нет durable outbox | [use case](../packages/core-domain/src/booking/useCases.ts), [dispatch](../apps/web/src/lib/bookingNotificationDispatch.ts), [email](../apps/web/src/lib/notifications/EmailNotificationService.ts) | Outbox вместе с бизнес-командой, worker, dedup/retry/deadline/provider budget; запись не зависит от доступности провайдера |
| ENG-10 | P1 | Карта ограничена 500 бизнесами/500 филиалами; nearby — 500/2000 до фильтра расстояния. Город/категория применяются до лимита. API не сигнализирует о неполноте | [map](../apps/web/src/lib/branchesMapService.ts), [nearby](../apps/web/src/lib/branchesNearbyService.ts) | Географический запрос в БД, пагинация/граница viewport, проверка филиала за предварительным лимитом |
| ENG-11 | P1 | Cron закрытия выбирает только вчера без страниц, обрабатывает последовательно, partial errors возвращает с ok:true. Пропущенные дни не наверстываются | [close shifts](../apps/web/src/lib/closeShiftsCronService.ts) | Все overdue задачи, batches/checkpoint/retry, контроль остатка и ошибок |
| ENG-12 | P1 | Analytics и часть финансовых выборок агрегируют ответ без обхода страниц. При max_rows=1000 из local config 1001-я подходящая строка не учитывается; remote limit неизвестен | [daily](../apps/web/src/lib/analyticsDailyCronService.ts), [hourly](../apps/web/src/lib/analyticsHourlyLoadCronService.ts), [finance](../apps/web/src/lib/financeAllDashboardService.ts), [config](../supabase/config.toml) | SQL-агрегация или полный обход с проверкой полноты; сверка на данных выше лимита |
| ENG-13 | P1 | Single-service slots RPC перебирает активных сотрудников бизнеса, хотя выбран один; web/mobile фильтруют после. В web ignore=false и cleanup не исключает устаревший in-flight ответ | [SQL](../supabase/migrations/20260918131000_explicit_schedule_booking_consumers.sql), [hook](../apps/web/src/app/b/[slug]/hooks/useSlotsLoader.ts) | Серверный фильтр, измеренный SQL-план; устаревший ответ не меняет текущие слоты/ошибки |
| ENG-14 | P1 | Нет подтверждённого полного исходного bootstrap БД. Ранние миграции уже требуют основные таблицы и enum, создание которых не найдено в доступных SQL исходниках | [ранняя миграция](../supabase/migrations/20250102000000_update_booking_status_without_check.sql), [ALTER staff](../supabase/migrations/20250103000000_add_staff_avatar_url.sql), [Supabase guide](../supabase/README.md) | Версионированный baseline, воспроизводимая сборка чистой изолированной БД и сверка схемы |
| ENG-15 | P1 | Full seeded E2E non-blocking; обязательные env не все переданы; SQL gate без ON_ERROR_STOP и может быть пропущен. SQL test закрытия сам записывает ожидаемые суммы | [CI](../.github/workflows/ci.yml), [SQL test](../supabase/tests_critical_scenarios.sql), [testing guide](../TESTING_GUIDE.md) | Обязательные checks, fail-fast fixtures, ошибки SQL краснят job, тест настоящей операции с независимым oracle |
| ENG-16 | P2 | Performance Map локален; resolved Supabase error может считаться success; browser timings не входят в серверный экземпляр панели | [performance](../apps/web/src/lib/performance.ts), [stats](../apps/web/src/lib/performanceStatsService.ts) | Общие метрики/трассы, корректный business outcome, проверка намеренного отказа RPC |
| ENG-17 | P2 | simpleCache удаляет expired entry только при чтении того же ключа; size/eviction не ограничены, ключи включают разные диапазоны дат | [cache](../apps/web/src/lib/simpleCache.ts), [consumer](../apps/web/src/lib/dashboardAnalyticsOverviewService.ts) | Ограниченный TTL/LRU и single-flight либо общий cache; измерение памяти |
| ENG-18 | P1 | Analytics schedules отсутствуют в обоих Vercel manifests; health-check-alerts только в app manifest. Реальный deployment root/внешний scheduler неизвестны | [cron guide](../CRON_SETUP.md), [root manifest](../vercel.json), [app manifest](../apps/web/vercel.json) | Единый проверенный manifest и наблюдаемый last-success; документы уже исправлены, конфигурация продукта не менялась |

## Условные риски, которые ещё нужно подтвердить

- **Legacy booking concurrency:** [trigger](../supabase/migrations/20260918130000_explicit_staff_schedules.sql) берёт staff lock, но повторный overlap check выполняется при наличии новой schedule version. [hold_slot](../supabase/migrations/20261009103000_simple_booking_effective_schedule.sql) делает precheck до insert/lock. Возможность двойной записи зависит от неизвестных исходных constraints; live double-booking не доказан.
- **Cron без конфигурации секрета:** [closeShiftsCronHttpService](../apps/web/src/lib/closeShiftsCronHttpService.ts) не отклоняет отсутствующий secret до сравнения заголовка. Наличие такого состояния в deployment не установлено.
- **Ёмкость и восстановление:** ресурсный предел RPS, production topology, PITR и фактический restore time не измерены. Условия подтверждения описаны в [эксплуатации](OPERATIONS.md).

## Дополнения при полной сверке HTTP-контрактов 1 ноября

Это исходные наблюдения при чтении кода 1 ноября; текущие исправления и ограничения перечислены в таблице итерации выше. Состояние deployment и фактическое злоупотребление не установлены; таблица не разрешает исполнять описанные операции в рабочей среде.

| ID | Приоритет | Установлено по исходникам | Источник и проверяемый выход |
| --- | --- | --- | --- |
| ENG-19 | P0 | `/api/auth/whatsapp/create-session` принимает phone либо userId без caller/OTP proof; service выбирает Auth user, меняет пароль и возвращает email/password/needsSignIn. Middleware пропускает /api | [HTTP](../apps/web/src/lib/whatsAppCreateSessionHttpService.ts), [заменивший его ответ 410](../apps/web/src/lib/retiredWhatsAppAuth.ts), [контракт](api/CLIENT_AND_AUTH_FLOWS.md). Связать операцию с доказанным владением и одноразовой попыткой; не отдавать reusable password. Проверить невозможность изменения чужой identity |
| ENG-20 | P0, условно | Ряд admin routes проверяет наличие global super_admin в `user_roles_with_user` без явного `user_id = caller`. Доступ зависит от неизвестного определения view/RLS; наличие чужого super_admin не должно разрешать операцию | [initialize](../apps/web/src/lib/initializeRatingsRouteService.ts), [toggle-super](../apps/web/src/app/admin/api/users/[id]/toggle-super/route.ts), [карта VIEW-проверок](api/ADMIN_API.md). Сверить view/ACL, затем обеспечить проверку конкретного вызывающего и отрицательные role cases |
| ENG-21 | P1 | Metrics, metrics/stats, metrics/auth-flow и finance-logs читают service client без handler auth. Несколько WhatsApp diagnostics также не проверяют роль, используют серверные настройки и возвращают сведения провайдера | [admin contracts](api/ADMIN_API.md), [diagnostics](api/OPERATIONS_AND_TELEMETRY.md), [middleware](../apps/web/src/middleware.ts). Установить требуемый доступ и закрыть привилегированные данные от неподходящей identity; внешний ingress отдельно неизвестен |
| ENG-22 | P1 | POST WhatsApp webhook не проверяет подпись запроса; verify token используется только GET. Payload.from участвует в поиске клиента, команды могут менять booking и отправлять сообщения | [HTTP](../apps/web/src/lib/whatsAppWebhookHttpService.ts), [service](../apps/web/src/lib/whatsAppWebhookService.ts), [контракт](api/AUTH_AND_INTEGRATIONS.md). Проверить происхождение до обработки, отделить ack от обработки/повторов; неподписанный payload не должен давать побочных эффектов |
| ENG-23 | P1 | POST notify/ping не проверяет caller и отправляет настоящее письмо на переданный to через серверный Resend key; provider failure может оставаться внутри HTTP 200 | [HTTP](../apps/web/src/lib/notifyPingHttpService.ts), [service](../apps/web/src/lib/notifyPingService.ts). Ограничить диагностическую отправку и получателей, проверять итог; не использовать маршрут как read-only health |
| ENG-24 | P1 | Yandex callback выполняет проверку state только при наличии query state. Отсутствующий state не останавливает code-flow | [источники callback и контракт](api/CLIENT_AND_AUTH_FLOWS.md). Обязательная привязка к инициированной попытке; проверить отсутствующий, чужой, просроченный и повторный state |
| ENG-25 | P1 | В нескольких update-цепочках отсутствующие поля очищаются; contact-settings превращает невалидный JSON в пустой объект и продолжает очистку контактов. Строгий PATCH-контракт не обеспечен | [business workflows](api/BUSINESS_WORKFLOWS.md), [branch update](api/OPERATIONS_AND_TELEMETRY.md), [admin update](api/ADMIN_API.md). Согласовать replace/patch, отклонять невалидный JSON до записи, проверить сохранность неприсланных полей |
| ENG-26 | P1 | Manual ratings recalculation не проверяет resolved RPC.error перед success; quick-book-guest может вернуть confirmed:true после ошибки confirm. HTTP успех не соответствует итоговому состоянию | [ratings service](../apps/web/src/lib/ratingsManualRecalculateService.ts), [guest booking](api/BOOKING_AND_CATALOG.md). Возвращать результат реальной операции; проверить отказ зависимости и независимое состояние записи |
| ENG-27 | P1 | В финансовых сценариях есть расхождения дат: cron строит границу закрытия от даты запуска, а не выбранной смены; stats может добавить текущую открытую смену к прошлому периоду; список пакетов использует TODAY, вычисленный при загрузке модуля | [финансовые контракты](api/STAFF_AND_FINANCE.md), [пакеты](api/BUSINESS_WORKFLOWS.md), [cron source](../apps/web/src/lib/closeShiftsCronService.ts). Проверить границы суток, исторический период и длительно живущий процесс по независимому расчёту |
| ENG-28 | P2 | swagger.json возвращает ok/data envelope, а UI и команда SDK читают его как корневую спецификацию. Glob также не охватывает все HTTP routes | [Swagger guide](../SWAGGER_SETUP.md), [route](../apps/web/src/app/api/swagger.json/route.ts), [UI](../apps/web/src/app/api-docs/page.tsx). Согласовать форму и полноту спецификации, затем проверить выбранную генерацию; документация сама этот код не исправляет |

Другие существенные особенности (побочные эффекты GET, удаления зависимых данных, ограничения выдачи, предпочтения уведомлений) описаны при конкретном методе в [API guide](../API_DOCUMENTATION.md). При выборе следующего исправления сначала установить требуемый продуктовый контракт; описание текущего поведения не делает его желаемым.

## Как закрывать запись

После новой прямой задачи выбрать ID и разрешённую среду. Сохранить исходное условие, изменение и независимую проверку ожидаемого результата; отдельно указать, где выполнено (unit/изолированная БД/live). Если удалённая схема отличается, зафиксировать расхождение, а не объявлять весь риск закрытым по одному файлу. Только затем менять статус этой записи. WEB acceptance обновляется отдельно по правилам ledger.

Чистка документации устраняет путаницу источников, но не закрывает ни одну продуктовую проблему этого реестра.
