# Повторный глубокий анализ проекта — 17 ноября 2026

Пять независимых ревью (только чтение кода и миграций): архитектура web, безопасность и корректность API, схема БД и RLS, качество фронтенда, mobile/тесты/CI. Находки, уже закрытые в ENG-01…ENG-61, сюда не входят. Каждая находка проверяется по коду перед исправлением; статус меняется здесь и в [ENGINEERING_FINDINGS](ENGINEERING_FINDINGS.md).

Статусы: **TODO**, **READY** (исправлено в ветке и проверено тестами; миграция ещё не применена в проде, код не в `main`), **FIXED** (код и миграции в `main`, применено в проде), **OWNER** (решение владельца), **WONTFIX** (с причиной).

## Главное

- **Безопасность по умолчанию «открыто».** Supabase выдаёт `anon` и `authenticated` все права на каждую новую таблицу и функцию; защита держится на 161 разрешающей RLS-политике, которые складываются через OR. Одна неосторожная политика (`USING` без `WITH CHECK`, политика на `public` вместо роли) открывает таблицу целиком. Отсюда большинство критичных находок ниже и ENG-35/37/56–60.
- **Арендатор (бизнес) не закреплён в схеме.** `biz_id` копируется в дочерние таблицы без составных внешних ключей, поэтому согласованность «филиал/сотрудник/услуга одного бизнеса» держится только на проверках в отдельных RPC.
- **Авторизация раздроблена.** Три хранилища ролей, четыре разные проверки суперадмина, разные наборы ролей на разных таблицах; иерархия ролей (ENG-32) есть только в TypeScript и обходится прямыми вызовами PostgREST/RPC.
- **Фронтенд в основном клиентский** (260 из 363 `.tsx` с `'use client'`), 37 клиентских файлов ходят в Supabase напрямую, ошибки запросов часто превращаются в «пустые» состояния.

## База данных и RLS

| ID | P | Находка | Где | Статус |
| --- | --- | --- | --- | --- |
| DB-01 | P0 | Любой, включая `anon`, может «заблокировать» любого пользователя: политика `user_suspensions_srv_all` FOR ALL TO public c `WITH CHECK (true)` пропускает INSERT; блокировка рушит все запросы пользователя и вход | baseline `user_suspensions_srv_all` | FIXED |
| DB-02 | P0 | `auth_users_view` (поверх `auth.users`) выдана `anon`/`authenticated` на INSERT/UPDATE/DELETE и автообновляема: запись в `auth.users` мимо GoTrue | baseline GRANT на `auth_users_view` | FIXED |
| DB-03 | P0 | Сотрудник переписывает свою строку `staff`: ставки (`percent_*`, `hourly_rate`) перед закрытием смены, `is_active` после увольнения, `biz_id` (вход в чужой бизнес) | политика «Staff can update own profile» | FIXED |
| DB-04 | P0/P1 | Менеджер/админ меняет любые колонки `businesses` (`owner_id`, `is_approved`, `branch_limit`, `rating_score`) и удаляет бизнес каскадом | политики «manage/update businesses by role» | FIXED |
| DB-05 | P0/P1 | `grant_role_rpc`/`revoke_role_rpc` (доступны всем) дают менеджеру выдать себе `owner`/`super_admin` бизнеса и снять роль владельца | baseline `grant_role_rpc` | FIXED |
| DB-06 | P1 | Брони читаются по непроверенному `profiles.phone`: подставив чужой номер в профиль, видишь чужие записи во всех бизнесах | «Clients can view own bookings» | FIXED |
| DB-07 | P1 | Любая строка `user_roles` (включая `client` у уволенных) даёт чтение всех броней бизнеса | «read bookings by biz or client» | FIXED |
| DB-08 | P1 | Нет составных FK (`branch_id`,`biz_id`) и т. п.; односторонние политики позволяют вставлять строки чужого бизнеса (`staff_branch_assignments`, `service_staff`) | схема | FIXED |
| DB-09 | P2 | 161 политика, 92 вызова `auth.uid()` без `(select …)`, ~20 мёртвых write-политик; часть политик `branches` без фильтра `is_active` | все таблицы | TODO (на `bookings` 17 лишних политик удалены в ENG-65) |
| DB-10 | P2 | Три хранилища ролей и четыре проверки суперадмина расходятся | `is_super_admin`, `has_role` | TODO |
| DB-11 | P2 | Права по умолчанию для новых объектов — ALL для клиентских ролей (включая TRUNCATE) | baseline default privileges | TODO (TRUNCATE, REFERENCES, TRIGGER и MAINTAIN сняты в ENG-62) |
| DB-12 | P2 | `purge_expired_holds` каждую минуту сканирует всю `bookings` без индекса | `bookings(expires_at) where status='hold'` | TODO |
| DB-13 | P2 | Политики отзывов обходят `can_review`: отзыв до визита, бессрочное редактирование, перенос на другую бронь | политики `reviews` | FIXED |
| DB-14 | P2 | `ON DELETE CASCADE` уничтожает смены, финансовые и аудит-логи при удалении сотрудника/филиала/бизнеса | FK | TODO |
| DB-15 | P2 | Baseline не содержит триггер `auth.users` → `sync_auth_user_notification_email`: свежие и CI-базы отличаются от прода | baseline | TODO |
| DB-16 | P3 | Нет CHECK для процентов (0–100), цен, длительностей, скидок, `tz` | схема | TODO |
| DB-17 | P3 | Дубли индексов и триггеров (`staff_shifts`, `bookings`, `user_roles`) | индексы | FIXED |
| DB-18 | P3 | Мёртвые/сломанные объекты вне plpgsql-линта: `has_role(uuid,text[])` (несуществующая колонка), неиспользуемые функции и таблицы | см. отчёт | TODO |

## HTTP API и бизнес-логика

| ID | P | Находка | Где | Статус |
| --- | --- | --- | --- | --- |
| API-01 | P0 | `POST /api/users/search` отдаёт любому менеджеру весь каталог пользователей платформы (email, телефон) | `usersSearchService.ts` | FIXED |
| API-02 | P0 | `/admin/api/roles/assign` доступен любому вошедшему и вызывает `grant_role_rpc`; `promotions/debug` пускает «суперадмина бизнеса» к данным всех арендаторов | `roles/assign/route.ts`, `promotionsDebugRouteService.ts` | FIXED |
| API-03 | P1 | Вход через WhatsApp можно перехватить заранее: владелец номера ищется по непроверенному `auth.users.phone`/`user_metadata.phone` | `whatsAppIdentityOwnershipService.ts` | FIXED |
| API-04 | P1 | Сложная запись (`services[]`) доверяет `duration_min` клиента, не проверяет график и прошлое время: блокировка мастера на год | `_hold_complex_slot_for_actor` | FIXED |
| API-05 | P1 | Удаление сотрудника жёстко удаляет его прошлые брони (каскадом отзывы и использования пакетов), не в транзакции | `staffDeleteService.ts` | FIXED |
| API-06 | P1 | Привязка сотрудника к чужому аккаунту без согласия (по UUID/email/телефону); поиск ограничен 200 пользователями | `staffCreateFromUserService.ts` и др. | TODO |
| API-07 | P1 | Шаблоны уведомлений не экранируют `client_name` (HTML в письмах, Telegram `parse_mode: HTML`) | `messageBuilders.ts`, `utils.ts` | FIXED |
| API-08 | P2 | Защита «подтверждённых» email уведомлений обходится через редактируемый `user_metadata.yandex_email` | `userNotificationEmailService.ts` | FIXED |
| API-09 | P2 | Приём аналитики без лимитов и привязки к сессии (`/api/funnel-events`, `/admin/api/analytics/track`) | `funnelEventsService.ts` | TODO |
| API-10 | P2 | Отвязка WhatsApp оставляет номер в `auth.users.phone`/metadata | `socialIdentityUnlinkService` | TODO |
| API-11 | P2 | Продажа пакетов визитов без идемпотентности; даты по UTC вместо времени бизнеса | `visitPackagesService.ts` | TODO |
| API-12 | P3 | POST на несуществующий путь отвечает 200 со страницей «не найдено» (GET — 404): клиент API получает HTML вместо JSON-ошибки | not-found Next.js | TODO |

## Фронтенд

| ID | P | Находка | Где | Статус |
| --- | --- | --- | --- | --- |
| FE-01 | P0 | Общий `Dialog` возвращает фокус на «✕» при каждом ререндере родителя: в форме гостевой записи нельзя печатать, на телефоне закрывается клавиатура | `components/ui/Dialog.tsx` | FIXED |
| FE-02 | P1 | Старый редактор расписания пишет 14 дней правил при простом просмотре (закрытые дни — 09:00–21:00), ошибки записи игнорируются | `useStaffScheduleRules.ts` | FIXED |
| FE-03 | P1 | Поиск броней в кабинете — только по текущей странице из 30; гонки при смене фильтров | `useDashboardBookingsListController.ts` | TODO |
| FE-04 | P2 | Остатки «кракозябр» (`вЂ“` и др.); проверка кодировки ловит только кириллицу | `slots/Client.tsx`, `check-encoding.mjs` | FIXED |
| FE-05 | P2 | CSV-экспорт финансов уязвим к формульной инъекции через имя гостя | `staff/finance/utils/export.ts` | TODO |
| FE-06 | P2 | Каждая страница грузит словари всех трёх языков (~783 КБ исходников) | `LanguageProvider.tsx` | TODO |
| FE-07 | P2 | Оболочка повторяет одни и те же запросы личности при каждой загрузке; мёртвый realtime-канал | `ReminderBanners.tsx` и др. | TODO |
| FE-08 | P2 | Ошибки загрузки показываются как пустые состояния («нет слотов», «выходной») | несколько экранов | TODO |
| FE-09 | P2 | Один корневой error boundary на всё приложение | `layout.tsx` | TODO |
| FE-10 | P2 | ~770 строк русского текста вне `t()` (из них ~600 в админке) | разные | TODO |
| FE-11 | P2 | Поиск на главной теряет введённые символы | `HomeClientComponents.tsx` | FIXED |
| FE-12 | P2 | Один клик по свободному слоту создаёт анонимную бронь без подтверждения | `staff/[id]/slots/Client.tsx` | TODO |
| FE-13 | P2 | Предупреждение «уже есть запись в этот день» считает окно ±12 ч от UTC | `useBookingData.ts` | FIXED |
| FE-14 | P2 | Финансы сотрудника «замораживают» текущее время при открытии | `ClientsList.tsx` | FIXED |
| FE-15…22 | P3 | Подписи полей без связи с контролом, CSP с `unsafe-inline/eval`, гонки карты, крупные компоненты, дубли UI, лишний запрос броней, «обновлено сегодня» в юридических страницах, мелочи | см. отчёт | TODO |

## Архитектура web

| ID | P | Находка | Где | Статус |
| --- | --- | --- | --- | --- |
| ARCH-01 | P1 | Личность определяется по неподтверждённым телефону/email: `auth.users.phone` меняется без OTP, `user_metadata` редактируется пользователем; по ним идут WhatsApp-вход, привязка сотрудника, добавление участника | `userUpdatePhoneService.ts`, `whatsAppIdentityOwnershipService.ts`, `staffCreateService.ts` | FIXED |
| ARCH-02 | P1 | Сотрудник нескольких бизнесов теряет кабинет: `.maybeSingle()` по `staff.user_id` без бизнеса (web и mobile) | `staffRoleSync.ts`, `userRoleProfile.ts`, `useUserRole.ts` | TODO |
| ARCH-03 | P1 | Поиск аккаунтов перебирает `listUsers` с жёсткими лимитами (первые 200 пользователей) | `staffCreateFromUserService.ts` и др. | FIXED |
| ARCH-04 | P1 | Ошибки в проде не видны: логгер выбрасывает детали и warn, обработчик API не шлёт в Sentry, клиентский Sentry не грузится под Turbopack | `shared-client/log.ts`, `apiErrorHandler.ts` | TODO |
| ARCH-05 | P2 | HTTP-статус выбирается по тексту ошибки (`NO_BIZ_ACCESS` → 500) | `apiErrorHandler.ts` | TODO |
| ARCH-06 | P2 | Выбор текущего бизнеса по разным правилам в сеттере и резолвере; молчаливое переключение бизнеса при ошибке чтения | `currentBusinessService.ts`, `bizContextResolutionStrategies.ts` | TODO |
| ARCH-07 | P2 | Сопоставление по имени (`name_ru`, `full_name`) и неатомарные многошаговые записи (перевод сотрудника, услуги) | `serviceUpdateRouteService.ts`, `staffTransferService.ts` | TODO |
| ARCH-08 | P2 | Две реализации удаления филиала; одна падает на `staff_schedule_rules` | `branchDeleteService.ts` | TODO |
| ARCH-09 | P2 | Типизация БД теряется на границах сервисов (46 «ClientLike», `as never`) | `lib/` | TODO |
| ARCH-10 | P2 | Контекст авторизации пересчитывается на каждый запрос; синхронизация ролей пишет на GET | `authBiz`, `staffRoleSync.ts` | TODO |
| ARCH-11 | P3 | Пять способов создать сервисный клиент, мёртвый код, `TZ` в 27 модулях, запасной секрет OTP в репозитории | см. отчёт | TODO |

## Mobile, тесты, CI

| ID | P | Находка | Где | Статус |
| --- | --- | --- | --- | --- |
| MOB-01 | P1 | Слоты и удержание не проверяют `service_staff`: через mobile/API можно записать к мастеру, который не делает услугу | `get_free_slots_service_day_v2`, `_hold_slot_for_actor`, `useBookingStep3Staff.ts` | FIXED |
| MOB-02 | P2 | Выход удаляет неотправленные операции смены без предупреждения | `signOut.ts` | FIXED |
| MOB-03 | P2 | Запросы API без таймаута | `shared-client/api.ts` | FIXED |
| MOB-04 | P2 | Списки броней устаревают до 5 минут после создания/отмены | `useBookingStep6Confirm.ts` | FIXED |
| MOB-05 | P2 | Deep links/App Links настроены неверно (`/booking/<id>` открывает экран бизнеса, нет assetlinks) | `linking.ts`, `app.json` | TODO |
| MOB-06 | P2 | Любая сборка смотрит в прод (URL и ключ зашиты в `app.json`) | `app.json`, `eas.json` | TODO |
| MOB-07 | P2 | Нет crash reporting в mobile | — | TODO |
| CI-01 | P1 | SQL-наборы тестируют устаревшие версии функций (миграции загружаются не до конца), PG16 вместо 17 | `scripts/test-*.mjs` | TODO |
| CI-02 | P2 | Линт почти ничего не проверяет (корневой конфиг без правил, у mobile нет lint) | `eslint.config.mjs` | TODO |
| CI-03 | P2 | Тесты `packages/core-domain` и 10 SQL-скриптов не запускаются | CI | TODO (legacy SQL scenarios: сценарий 2 обращается к удалённой `public.clients`) |
| CI-04 | P2 | Моки Supabase не проверяют фильтры `biz_id`; `setupApiTestMocks` мокает после импорта | `__tests__/api/testHelpers.ts` | TODO |
| CI-05 | P2 | E2E-спеки в основном ничего не проверяют; visual-тест без эталонов не может пройти (джобы `e2e_tests` и `e2e_visual_regressions` красные) | `e2e/` | TODO |
| CI-06 | P2 | `pnpm test` пишет в ту БД, на которую указывает (`tests_critical_scenarios.sql`) | `package.json` | FIXED |
| CI-07 | P2 | В репозитории лежит скрипт очистки прода `manual_reset_test_data_keep_superadmin.sql` | `scripts/` | FIXED |
| CI-08 | P2 | `mobile_build` никогда не запускается; дубли джоб | `ci.yml` | TODO |
| CI-09 | P3 | Аналитика mobile принимается как анонимная (только cookie) | `admin/api/analytics/track` | TODO |

## Выкладка 18 ноября

DB-01…05, API-01, API-02 и FE-01 закрыты как ENG-62…64 в [реестре](ENGINEERING_FINDINGS.md): миграция `20261117200000_close_client_write_paths.sql` применена в проде 18 ноября и проверена от ролей в откатываемой транзакции, код в `main`. DB-11 закрыт частично: TRUNCATE, REFERENCES, TRIGGER и MAINTAIN у клиентских ролей сняты на всех таблицах проекта и в правах по умолчанию; остались только объекты PostGIS, принадлежащие `supabase_admin`.

DB-06 и DB-07 закрыты как ENG-65: миграция `20261118090000_bookings_read_scope.sql` применена в проде 18 ноября; настоящие аккаунты видят столько же броней, сколько до неё.

MOB-01 и API-04 закрыты как ENG-66: миграция `20261118100000_booking_service_staff_checks.sql` применена в проде 18 ноября, шаг выбора мастера в mobile фильтрует по услуге.

DB-08 закрыт как ENG-67: миграция `20261118110000_tenant_reference_guards.sql` применена в проде 18 ноября.

API-07 закрыт как ENG-68 (код в `main`).

API-05 закрыт как ENG-69: миграция `20261118120000_staff_delete_without_history.sql` применена в проде 18 ноября.

API-03 закрыт как ENG-70: миграция `20261118130000_release_unconfirmed_phone.sql` применена в проде 18 ноября.

MOB-03, FE-04, CI-06 и CI-07 закрыты как ENG-71…74 (код в `main`).

FE-11, FE-13 и FE-14 закрыты как ENG-75…77 (код в `main`).

MOB-02 и MOB-04 закрыты как ENG-78, ENG-79 (код в `main`).

DB-17 закрыт как ENG-80: миграция `20261118140000_drop_duplicate_indexes.sql` применена в проде 18 ноября.

API-08 закрыт как ENG-81: код в `main`, миграция `20261118150000_notification_email_proven_sources.sql` применена в проде 18 ноября после выкладки кода.

DB-13 закрыт как ENG-82: миграция `20261118160000_review_write_rules.sql` применена в проде 18 ноября, код создания отзыва проверяет то же правило.

FE-02 закрыт как ENG-83: старый редактор расписания больше не пишет при просмотре, миграция `20261118170000_one_active_date_rule.sql` применена в проде после выкладки кода. В проде `SCHEDULE_V2_ENABLED` выключен, поэтому график сотрудника с опубликованными версиями там не редактируется, пока владелец не включит новую модель.

ARCH-01 закрыт и ARCH-03 закрыт частично как ENG-84 (только код, без миграций): вход Yandex, привязка сотрудника, создание сотрудника из аккаунта и добавление участника ищут аккаунт точно и только по подтверждённым контактам; подтверждённый телефон нельзя заменить без кода. Каталог пользователей супер-админа (`/admin/api/users/list`, статистика) ещё листает Auth-пользователей — следующий шаг ARCH-03.

ARCH-03 закрыт полностью как ENG-85: каталог пользователей супер-админа ищет и считает на сервере, миграция `20261118180000_admin_user_directory.sql` применена в проде раньше выкладки кода.

Дальше по порядку: P1 — API-06, FE-03, ARCH-01…04, CI-01.
