# WEB: доказательства и точный остаток

Все 321 исходное обязательство сохранены; 316 применимы. Ни одна строка ниже не является полной текущей приёмкой. «Не найдено» означает результат аудита доступных файлов, а не утверждение, что никто никогда этого не проверял. Ссылки G/L/N ведут к неизменённым исходным stage; before/after и failed-прототипы не удалены.

## A1

Найденная граница: Записаны прямые загрузки, исправления hydration и возвраты календаря/истории.

Остаток: **Не единый smoke всех четырёх маршрутов и всех Back/Forward состояний; июньские первичные файлы не найдены, старый WB-048 открыт.**

| ID и исходное обязательство | Результат разбора | Источники |
| --- | --- | --- |
| A1-01: cold-load `/`, `/auth/sign-in`, `/terms`, and `/privacy`; | Только документ; первичный файл не найден | [WB-001](./WEB_HISTORICAL_DEFECTS.md#wb-001); [WB-003](./WEB_HISTORICAL_DEFECTS.md#wb-003) |
| A1-02: verify server-rendered content appears without a blank shell; | Узкое историческое свидетельство | [WB-001](./WEB_HISTORICAL_DEFECTS.md#wb-001); [G123](../apps/web/test-results/global-2026-10-17/stage-G123-profile-initial-loading-after.json) |
| A1-03: reload each route directly instead of entering only through client navigation; | Узкое историческое свидетельство | [WB-001](./WEB_HISTORICAL_DEFECTS.md#wb-001); [G093](../apps/web/test-results/global-2026-10-16/stage-G093-missing-business-recovery.json) |
| A1-04: inspect browser console for hydration or Server Component errors; | Только документ; первичный файл не найден | [WB-001](./WEB_HISTORICAL_DEFECTS.md#wb-001); [WB-014](./WEB_HISTORICAL_DEFECTS.md#wb-014); [WB-048](./WEB_HISTORICAL_DEFECTS.md#wb-048) |
| A1-05: verify browser Back/Forward does not break rendered state. | Узкое историческое свидетельство | [G106](../apps/web/test-results/global-2026-10-17/stage-G106-calendar-context-after.json); [G114](../apps/web/test-results/global-2026-10-17/stage-G114-staff-history-context-after.json) |

## A2

Найденная граница: Есть исторические конфигурационные ошибки и изолированная dummy-env сборка.

Остаток: **Реальные production origins, callback/webhook, CORS/TLS и секреты окружения не сертифицированы dummy-сборкой.**

| ID и исходное обязательство | Результат разбора | Источники |
| --- | --- | --- |
| A2-01: verify expected Supabase, API, auth callback, webhook, and public origin behavior; | Только документ; первичный файл не найден | [WB-005](./WEB_HISTORICAL_DEFECTS.md#wb-005); [WB-024](./WEB_HISTORICAL_DEFECTS.md#wb-024); [WB-027](./WEB_HISTORICAL_DEFECTS.md#wb-027) |
| A2-02: check missing/invalid runtime configuration on a controlled local or staging build; | Техническая проверка / блокер, не live PASS | [G048](../apps/web/test-results/global-2026-10-15/stage-G048-full-build-probe.json); [G052](../apps/web/test-results/global-2026-10-15/stage-G052-cold-canary-build.json) |
| A2-03: verify production pages do not depend on localhost resources; | Только документ; первичный файл не найден | [WB-047](./WEB_HISTORICAL_DEFECTS.md#wb-047); [WB-070](./WEB_HISTORICAL_DEFECTS.md#wb-070) |
| A2-04: inspect failed network requests for wrong hosts, mixed content, CORS, and certificate errors. | Только документ; первичный файл не найден | [WB-006](./WEB_HISTORICAL_DEFECTS.md#wb-006); [WB-049](./WEB_HISTORICAL_DEFECTS.md#wb-049) |

## A3

Найденная граница: Изолированная сборка/Ready и отдельные reload; не deployed production smoke.

Остаток: **Холодный cache/assets и смена chunk-версии после deployment не доказаны; WB-070 остаётся исторически открыт.**

| ID и исходное обязательство | Результат разбора | Источники |
| --- | --- | --- |
| A3-01: test `next build` output or deployed production build, not only `next dev`; | Техническая проверка / блокер, не live PASS | [G043](../apps/web/test-results/global-2026-10-15/stage-G043-current-baseline.json); [G047](../apps/web/test-results/global-2026-10-15/stage-G047-compile-after-ipc.json); [G048](../apps/web/test-results/global-2026-10-15/stage-G048-full-build-probe.json); [G049](../apps/web/test-results/global-2026-10-15/stage-G049-production-boot-probe.json) |
| A3-02: verify static assets, fonts, chunks, and images load after a fresh cache; | Целевое свидетельство не найдено | — |
| A3-03: test a hard refresh on nested dynamic routes; | Узкое историческое свидетельство | [G093](../apps/web/test-results/global-2026-10-16/stage-G093-missing-business-recovery.json); [L036](../apps/web/test-results/live-2026-10-13/stage-036-initial-locale.json) |
| A3-04: verify old chunks do not produce a broken page after deployment. | Целевое свидетельство не найдено | — |

## A4

Найденная граница: Адресные not-found/retry, safe-message исправления; G141/G145 — только моковые отказы.

Остаток: **Все семейства private/public ошибок и отсутствие секретов во всех error surfaces; unit-only не закрывает live.**

| ID и исходное обязательство | Результат разбора | Источники |
| --- | --- | --- |
| A4-01: open unknown public, cabinet, dashboard, staff, and admin routes; | Узкое историческое свидетельство | [WB-007](./WEB_HISTORICAL_DEFECTS.md#wb-007); [G026](../apps/web/test-results/global-2026-10-14/stage-G026-public-receipt-negative.json); [G093](../apps/web/test-results/global-2026-10-16/stage-G093-missing-business-recovery.json) |
| A4-02: trigger controlled Server Component and client request failures where safe; | Узкое историческое свидетельство | [L023](../apps/web/test-results/live-2026-10-11/stage-023-business-retry.json); [G141](../apps/web/test-results/global-2026-10-18/stage-G141-profile-load-unit-boundary.json); [G145](../apps/web/test-results/global-2026-10-18/stage-G145-role-applications-client-read-state.json) |
| A4-03: verify retry/home actions; | Узкое историческое свидетельство | [L023](../apps/web/test-results/live-2026-10-11/stage-023-business-retry.json); [G093](../apps/web/test-results/global-2026-10-16/stage-G093-missing-business-recovery.json) |
| A4-04: verify error surfaces do not expose stack traces or secrets. | Техническая проверка / блокер, не live PASS | [WB-019](./WEB_HISTORICAL_DEFECTS.md#wb-019); [WB-077](./WEB_HISTORICAL_DEFECTS.md#wb-077); [G053](../apps/web/test-results/global-2026-10-15/stage-G053-callback-log-contracts.json) |

## B1

Найденная граница: Карточки/счётчики, auth header и поиск; отдельные исправления пустого/error состояния.

Остаток: **Полный hero/footer/CTA и загрузка/отказ каждой секции на одном кандидате не оформлены.**

| ID и исходное обязательство | Результат разбора | Источники |
| --- | --- | --- |
| B1-01: verify hero, navigation, search/discovery entry points, footer, and auth state; | Узкое историческое свидетельство | [G067](../apps/web/test-results/global-2026-10-15/stage-G067-home-counts-after.json); [G076/1](../apps/web/test-results/global-2026-10-15/stage-G076-existing-session-after.json), [G076/2](../apps/web/test-results/global-2026-10-15/stage-G076-existing-session-before.json) |
| B1-02: test cards and primary CTAs; | Узкое историческое свидетельство | [WB-009](./WEB_HISTORICAL_DEFECTS.md#wb-009); [G024](../apps/web/test-results/global-2026-10-14/stage-G024-catalog-search.json) |
| B1-03: verify authenticated and unauthenticated header variants; | Узкое историческое свидетельство | [G076/1](../apps/web/test-results/global-2026-10-15/stage-G076-existing-session-after.json), [G076/2](../apps/web/test-results/global-2026-10-15/stage-G076-existing-session-before.json) |
| B1-04: verify empty/error/loading states. | Узкое историческое свидетельство | [WB-018](./WEB_HISTORICAL_DEFECTS.md#wb-018); [G004/1](../apps/web/test-results/global-2026-10-14/stage-G004-empty-search-after.json), [G004/2](../apps/web/test-results/global-2026-10-14/stage-G004-empty-search-before.json) |

## B2

Найденная граница: Валидный бизнес, 2 филиала/3 service rows, скрытая услуга отсутствует; неизвестный slug восстанавливается.

Остаток: **Удалённый/некорректный slug, все inactive-сочетания и внешние контакты не покрыты неизвестным slug.**

| ID и исходное обязательство | Результат разбора | Источники |
| --- | --- | --- |
| B2-01: open a valid `/b/[slug]` directly; | Узкое историческое свидетельство | [G092](../apps/web/test-results/global-2026-10-16/stage-G092-public-business-entry.json) |
| B2-02: verify business identity, branches, services, contacts, promotions, and booking CTA; | Узкое историческое свидетельство | [G092](../apps/web/test-results/global-2026-10-16/stage-G092-public-business-entry.json); [G133](../apps/web/test-results/global-2026-10-17/stage-G133-owner-service-public-consistency.json) |
| B2-03: verify inactive or unavailable entities are not shown as bookable; | Узкое историческое свидетельство | [G005/1](../apps/web/test-results/global-2026-10-14/stage-G005-service-lifecycle-after.json), [G005/2](../apps/web/test-results/global-2026-10-14/stage-G005-service-lifecycle-before.json); [G133](../apps/web/test-results/global-2026-10-17/stage-G133-owner-service-public-consistency.json) |
| B2-04: open invalid, deleted, and malformed slugs. | Узкое историческое свидетельство | [G093](../apps/web/test-results/global-2026-10-16/stage-G093-missing-business-recovery.json) |

## B3

Найденная граница: Поиск имени/адреса, категория/reset и запятая; service query — отдельный нерешённый контракт.

Остаток: **Не доказаны сохранение query по reload/navigation и полный live debounce/error набор; DEC-CATALOG-SEARCH требует решения.**

| ID и исходное обязательство | Результат разбора | Источники |
| --- | --- | --- |
| B3-01: test search input responsiveness and debounce; | Узкое историческое свидетельство | [WB-017](./WEB_HISTORICAL_DEFECTS.md#wb-017); [G024](../apps/web/test-results/global-2026-10-14/stage-G024-catalog-search.json); [G027/1](../apps/web/test-results/global-2026-10-14/stage-G027-catalog-punctuation-after.json), [G027/2](../apps/web/test-results/global-2026-10-14/stage-G027-catalog-punctuation-before.json) |
| B3-02: test categories and clear/reset behavior; | Узкое историческое свидетельство | [G024](../apps/web/test-results/global-2026-10-14/stage-G024-catalog-search.json) |
| B3-03: test empty results and network failure; | Узкое историческое свидетельство | [WB-018](./WEB_HISTORICAL_DEFECTS.md#wb-018); [G027/1](../apps/web/test-results/global-2026-10-14/stage-G027-catalog-punctuation-after.json), [G027/2](../apps/web/test-results/global-2026-10-14/stage-G027-catalog-punctuation-before.json) |
| B3-04: verify query state across navigation and reload where expected. | Целевое свидетельство не найдено | — |

## B4

Найденная граница: Категории, выбор филиала и keyboard→правильный booking URL; исторические provider ошибки.

Остаток: **Grant/deny/revoke geolocation, missing coordinates и рабочее восстановление провайдера; name_ru-only — контракт, не готовая мультиязычность.**

| ID и исходное обязательство | Результат разбора | Источники |
| --- | --- | --- |
| B4-01: open `/map` directly and through public navigation; | Узкое историческое свидетельство | [G023](../apps/web/test-results/global-2026-10-14/stage-G023-public-map-context.json); [G087](../apps/web/test-results/global-2026-10-16/stage-G087-map-keyboard.json) |
| B4-02: grant, deny, and revoke location permission; | Целевое свидетельство не найдено | — |
| B4-03: verify markers, branch list, category filter, and nearest action; | Узкое историческое свидетельство | [WB-094](./WEB_HISTORICAL_DEFECTS.md#wb-094); [G086](../apps/web/test-results/global-2026-10-16/stage-G086-category-contract.json) |
| B4-04: verify branch selection opens the correct business/booking path; | Узкое историческое свидетельство | [WB-095](./WEB_HISTORICAL_DEFECTS.md#wb-095); [G023](../apps/web/test-results/global-2026-10-14/stage-G023-public-map-context.json); [G087](../apps/web/test-results/global-2026-10-16/stage-G087-map-keyboard.json) |
| B4-05: verify missing coordinates and map provider errors. | Только документ; первичный файл не найден | [WB-008](./WEB_HISTORICAL_DEFECTS.md#wb-008); [WB-019](./WEB_HISTORICAL_DEFECTS.md#wb-019); [WB-049](./WEB_HISTORICAL_DEFECTS.md#wb-049); [WB-079](./WEB_HISTORICAL_DEFECTS.md#wb-079) |

## C1

Найденная граница: Social-only entry и реальные входы, исправлен stale signed-out header.

Остаток: **Все next/role permutations и настоящий mobile/desktop viewport не сертифицированы; старые security декларации не fresh API proof.**

| ID и исходное обязательство | Результат разбора | Источники |
| --- | --- | --- |
| C1-01: open `/auth/sign-in` as guest and authenticated users; | Узкое историческое свидетельство | [G058](../apps/web/test-results/global-2026-10-15/stage-G058-known-google-page-boundaries.json); [G076/1](../apps/web/test-results/global-2026-10-15/stage-G076-existing-session-after.json), [G076/2](../apps/web/test-results/global-2026-10-15/stage-G076-existing-session-before.json) |
| C1-02: verify provider hierarchy and field validation; | Только документ; первичный файл не найден | [WB-022](./WEB_HISTORICAL_DEFECTS.md#wb-022) |
| C1-03: verify `next`/return URL handling; | Только документ; первичный файл не найден | [WB-020](./WEB_HISTORICAL_DEFECTS.md#wb-020); [WB-023](./WEB_HISTORICAL_DEFECTS.md#wb-023) |
| C1-04: verify existing sessions redirect to the correct role destination; | Узкое историческое свидетельство | [G058](../apps/web/test-results/global-2026-10-15/stage-G058-known-google-page-boundaries.json); [G059](../apps/web/test-results/global-2026-10-15/stage-G059-staff-page-object-checks.json); [G060](../apps/web/test-results/global-2026-10-15/stage-G060-owner-recovery-page-boundaries.json); [G076/1](../apps/web/test-results/global-2026-10-15/stage-G076-existing-session-after.json), [G076/2](../apps/web/test-results/global-2026-10-15/stage-G076-existing-session-before.json) |
| C1-05: test mobile and desktop viewport behavior. | Техническая проверка / блокер, не live PASS | [G064](../apps/web/test-results/global-2026-10-15/stage-G064-viewport-diagnostic.json) |

## C2

Найденная граница: Исключено существующим social-only решением.

Остаток: **Не входит в 316 применимых; история WB-021 сохранена без повторного включения в scope.**

| ID и исходное обязательство | Результат разбора | Источники |
| --- | --- | --- |
| C2-01: request sign-in code or link where enabled; | Исключено: social-only | [WB-021](./WEB_HISTORICAL_DEFECTS.md#wb-021) |
| C2-02: verify invalid, expired, reused, and valid codes; | Исключено: social-only | [WB-021](./WEB_HISTORICAL_DEFECTS.md#wb-021) |
| C2-03: run reset-password and update-password flows; | Исключено: social-only | [WB-021](./WEB_HISTORICAL_DEFECTS.md#wb-021) |
| C2-04: verify email verification and post-signup paths; | Исключено: social-only | [WB-021](./WEB_HISTORICAL_DEFECTS.md#wb-021) |
| C2-05: verify rate-limit and resend feedback. | Исключено: social-only | [WB-021](./WEB_HISTORICAL_DEFECTS.md#wb-021) |

## C3

Найденная граница: Четыре разрешённые Google-идентичности наблюдались в разные моменты, не одновременно.

Остаток: **Yandex end-to-end и callback replay/back/expiry; G053 synthetic logging не реальный OAuth.**

| ID и исходное обязательство | Результат разбора | Источники |
| --- | --- | --- |
| C3-01: complete real Google login; | Узкое историческое свидетельство | [G058](../apps/web/test-results/global-2026-10-15/stage-G058-known-google-page-boundaries.json); [G059](../apps/web/test-results/global-2026-10-15/stage-G059-staff-page-object-checks.json); [G060](../apps/web/test-results/global-2026-10-15/stage-G060-owner-recovery-page-boundaries.json); [G108](../apps/web/test-results/global-2026-10-17/stage-G108-google-client-session.json); [G111](../apps/web/test-results/global-2026-10-17/stage-G111-google-staff-session.json); [G124](../apps/web/test-results/global-2026-10-17/stage-G124-owner-legacy-finance-regression.json) |
| C3-02: complete Yandex login if enabled for release; | Только документ; первичный файл не найден | [WB-024](./WEB_HISTORICAL_DEFECTS.md#wb-024); [WB-025](./WEB_HISTORICAL_DEFECTS.md#wb-025) |
| C3-03: test provider cancellation; | Только документ; первичный файл не найден | [WB-026](./WEB_HISTORICAL_DEFECTS.md#wb-026) |
| C3-04: verify callback route, final role destination, and session persistence; | Узкое историческое свидетельство | [G058](../apps/web/test-results/global-2026-10-15/stage-G058-known-google-page-boundaries.json); [G108](../apps/web/test-results/global-2026-10-17/stage-G108-google-client-session.json); [G111](../apps/web/test-results/global-2026-10-17/stage-G111-google-staff-session.json); [G124](../apps/web/test-results/global-2026-10-17/stage-G124-owner-legacy-finance-regression.json) |
| C3-05: replay/back-refresh callback and verify idempotency. | Техническая проверка / блокер, не live PASS | [WB-023](./WEB_HISTORICAL_DEFECTS.md#wb-023); [WB-025](./WEB_HISTORICAL_DEFECTS.md#wb-025); [G053](../apps/web/test-results/global-2026-10-15/stage-G053-callback-log-contracts.json) |

## C4

Найденная граница: Сохранены история Telegram linking/reminders и относящиеся записи ночного окна.

Остаток: **Полный login/link/denied/expired/replay payload контракт не доказан; внешняя доставка требует разрешённого получателя.**

| ID и исходное обязательство | Результат разбора | Источники |
| --- | --- | --- |
| C4-01: complete web Telegram login; | Узкое историческое свидетельство | [N:profile-stage](../apps/web/test-results/night-2026-10-09/profile-stage.json) |
| C4-02: test account linking for an already authenticated user; | Узкое историческое свидетельство | [WB-028](./WEB_HISTORICAL_DEFECTS.md#wb-028); [WB-029](./WEB_HISTORICAL_DEFECTS.md#wb-029); [N:profile-stage](../apps/web/test-results/night-2026-10-09/profile-stage.json) |
| C4-03: test denied, expired, and replayed payloads; | Целевое свидетельство не найдено | — |
| C4-04: verify return URL and role destination; | Узкое историческое свидетельство | [N:profile-stage](../apps/web/test-results/night-2026-10-09/profile-stage.json) |
| C4-05: verify Telegram reminder/banner behavior. | Узкое историческое свидетельство | [N:notifications-stage](../apps/web/test-results/night-2026-10-09/notifications-stage.json) |

## C5

Найденная граница: Сохранён отдельный WhatsApp stage и старые локальные OTP/identity исправления.

Остаток: **Не объявляется вся OTP матрица PASS: доставка, cooldown, expiry/reuse, duplicate ownership и provider failure имеют отдельные ограничения исходного stage.**

| ID и исходное обязательство | Результат разбора | Источники |
| --- | --- | --- |
| C5-01: submit valid and invalid phone numbers; | Узкое историческое свидетельство | [N:whatsapp-stage](../apps/web/test-results/night-2026-10-09/whatsapp-stage.json) |
| C5-02: send OTP and verify cooldown; | Узкое историческое свидетельство | [N:whatsapp-stage](../apps/web/test-results/night-2026-10-09/whatsapp-stage.json) |
| C5-03: enter invalid, expired, reused, and valid OTPs; | Узкое историческое свидетельство | [N:whatsapp-stage](../apps/web/test-results/night-2026-10-09/whatsapp-stage.json) |
| C5-04: verify session establishment, redirects, retry, and idempotency; | Узкое историческое свидетельство | [N:whatsapp-stage](../apps/web/test-results/night-2026-10-09/whatsapp-stage.json); [WB-032](./WEB_HISTORICAL_DEFECTS.md#wb-032) |
| C5-05: test provider/service failure messaging. | Только документ; первичный файл не найден | [WB-011](./WEB_HISTORICAL_DEFECTS.md#wb-011); [WB-035](./WEB_HISTORICAL_DEFECTS.md#wb-035) |

## C6

Найденная граница: Реальные смены сессий, reload и multi-tab sign-out; headers обновлялись отдельно.

Остаток: **Close/reopen browser, все роли/срок истечения/восстановление private data не равны одному logout сценарию.**

| ID и исходное обязательство | Результат разбора | Источники |
| --- | --- | --- |
| C6-01: reload, close/reopen browser, and open a protected link in a new tab; | Узкое историческое свидетельство | [G108](../apps/web/test-results/global-2026-10-17/stage-G108-google-client-session.json); [G111](../apps/web/test-results/global-2026-10-17/stage-G111-google-staff-session.json); [G124](../apps/web/test-results/global-2026-10-17/stage-G124-owner-legacy-finance-regression.json) |
| C6-02: verify cookie/session restoration; | Узкое историческое свидетельство | [G108](../apps/web/test-results/global-2026-10-17/stage-G108-google-client-session.json); [G111](../apps/web/test-results/global-2026-10-17/stage-G111-google-staff-session.json); [G124](../apps/web/test-results/global-2026-10-17/stage-G124-owner-legacy-finance-regression.json) |
| C6-03: sign out from each role; | Узкое историческое свидетельство | [L001](../apps/web/test-results/live-2026-10-11/stage-001-multitab-signout.json); [G058](../apps/web/test-results/global-2026-10-15/stage-G058-known-google-page-boundaries.json); [G059](../apps/web/test-results/global-2026-10-15/stage-G059-staff-page-object-checks.json); [G060](../apps/web/test-results/global-2026-10-15/stage-G060-owner-recovery-page-boundaries.json) |
| C6-04: verify browser Back cannot reopen protected content; | Узкое историческое свидетельство | [L001](../apps/web/test-results/live-2026-10-11/stage-001-multitab-signout.json) |
| C6-05: verify multi-tab logout propagation and stale-session cleanup. | Узкое историческое свидетельство | [L001](../apps/web/test-results/live-2026-10-11/stage-001-multitab-signout.json); [WB-075](./WEB_HISTORICAL_DEFECTS.md#wb-075); [G076/1](../apps/web/test-results/global-2026-10-15/stage-G076-existing-session-after.json), [G076/2](../apps/web/test-results/global-2026-10-15/stage-G076-existing-session-before.json) |

## D1

Найденная граница: Вход из public/map и staff schedule projection, off-day состояния.

Остаток: **Полная матрица inactive business/branch/service, загрузки/сбоев и каждого entry point.**

| ID и исходное обязательство | Результат разбора | Источники |
| --- | --- | --- |
| D1-01: open `/b/[slug]/booking` directly and from business, map, and search; | Узкое историческое свидетельство | [G023](../apps/web/test-results/global-2026-10-14/stage-G023-public-map-context.json); [G092](../apps/web/test-results/global-2026-10-16/stage-G092-public-business-entry.json) |
| D1-02: verify branch, service, staff, schedule, and viewer metadata; | Узкое историческое свидетельство | [G062](../apps/web/test-results/global-2026-10-15/stage-G062-staff-day-availability-after.json); [G092](../apps/web/test-results/global-2026-10-16/stage-G092-public-business-entry.json); [G133](../apps/web/test-results/global-2026-10-17/stage-G133-owner-service-public-consistency.json) |
| D1-03: test empty/error/loading states; | Узкое историческое свидетельство | [G039](../apps/web/test-results/global-2026-10-15/stage-G039-date-availability.json); [G062](../apps/web/test-results/global-2026-10-15/stage-G062-staff-day-availability-after.json) |
| D1-04: verify inactive business/branch/service behavior. | Узкое историческое свидетельство | [G005/1](../apps/web/test-results/global-2026-10-14/stage-G005-service-lifecycle-after.json), [G005/2](../apps/web/test-results/global-2026-10-14/stage-G005-service-lifecycle-before.json); [G062](../apps/web/test-results/global-2026-10-15/stage-G062-staff-day-availability-after.json) |

## D2

Найденная граница: Single-service, обязательный выбор, past/max-date и summary; 12 unselected slots не 12 бронирований.

Остаток: **Нет multi-service fixture; deep past date был смешан с off-day; midnight/timezone и все summary combinations не доказаны.**

| ID и исходное обязательство | Результат разбора | Источники |
| --- | --- | --- |
| D2-01: select branch, one or multiple services, staff, date, and slot; | Узкое историческое свидетельство | [G090](../apps/web/test-results/global-2026-10-16/stage-G090-service-selection-navigation.json); [L038](../apps/web/test-results/live-2026-10-13/stage-038-repeat-slots.json) |
| D2-02: verify disabled states before required choices; | Узкое историческое свидетельство | [G088](../apps/web/test-results/global-2026-10-16/stage-G088-day-range-after.json); [G089](../apps/web/test-results/global-2026-10-16/stage-G089-upper-date-range.json); [G090](../apps/web/test-results/global-2026-10-16/stage-G090-service-selection-navigation.json) |
| D2-03: move Back/Forward between steps; | Узкое историческое свидетельство | [G090](../apps/web/test-results/global-2026-10-16/stage-G090-service-selection-navigation.json); [L040](../apps/web/test-results/live-2026-10-13/stage-040-reload-selection.json) |
| D2-04: verify selections and summary remain consistent; | Узкое историческое свидетельство | [L038](../apps/web/test-results/live-2026-10-13/stage-038-repeat-slots.json); [L039](../apps/web/test-results/live-2026-10-13/stage-039-slot-copy.json); [L041](../apps/web/test-results/live-2026-10-13/stage-041-selector-copy.json); [G110](../apps/web/test-results/global-2026-10-17/stage-G110-step5-auth-guidance-after.json) |
| D2-05: verify timezone and past-date restrictions. | Узкое историческое свидетельство | [G088](../apps/web/test-results/global-2026-10-16/stage-G088-day-range-after.json); [G089](../apps/web/test-results/global-2026-10-16/stage-G089-upper-date-range.json); [G091](../apps/web/test-results/global-2026-10-16/stage-G091-deep-date-recovery.json) |

## D3

Найденная граница: Реальное сохранение repeat booking, кабинет и отказ конфликта; точные IDs в исходных stages.

Остаток: **Двойной быстрый submit, независимые конкурирующие контексты и idempotency не выводятся из одного stale-slot отказа.**

| ID и исходное обязательство | Результат разбора | Источники |
| --- | --- | --- |
| D3-01: complete booking as an authenticated client; | Узкое историческое свидетельство | [L038](../apps/web/test-results/live-2026-10-13/stage-038-repeat-slots.json); [N:complex-stage](../apps/web/test-results/night-2026-10-09/complex-stage.json) |
| D3-02: verify double-submit protection; | Целевое свидетельство не найдено | — |
| D3-03: verify success details and client cabinet entry; | Узкое историческое свидетельство | [L038](../apps/web/test-results/live-2026-10-13/stage-038-repeat-slots.json) |
| D3-04: reload and confirm persistence; | Узкое историческое свидетельство | [L038](../apps/web/test-results/live-2026-10-13/stage-038-repeat-slots.json); [L040](../apps/web/test-results/live-2026-10-13/stage-040-reload-selection.json) |
| D3-05: verify server-side conflict after a slot becomes unavailable. | Узкое историческое свидетельство | [L042](../apps/web/test-results/live-2026-10-13/stage-042-stale-slot-conflict.json) |

## D4

Найденная граница: Ночные guest выбор/форма/команды и page-guard записи сохранены.

Остаток: **Все invalid/duplicate phone ветви и API изоляция гостя; page redirect не подтверждает отсутствие утечки в API.**

| ID и исходное обязательство | Результат разбора | Источники |
| --- | --- | --- |
| D4-01: choose booking without registration; | Узкое историческое свидетельство | [N:guest-choice-stage](../apps/web/test-results/night-2026-10-09/guest-choice-stage.json); [N:guest-stage](../apps/web/test-results/night-2026-10-09/guest-stage.json) |
| D4-02: validate guest name and phone; | Узкое историческое свидетельство | [N:guest-form-language-stage](../apps/web/test-results/night-2026-10-09/guest-form-language-stage.json); [N:guest-stage](../apps/web/test-results/night-2026-10-09/guest-stage.json) |
| D4-03: submit valid guest booking; | Узкое историческое свидетельство | [N:complex-stage](../apps/web/test-results/night-2026-10-09/complex-stage.json); [N:guest-stage](../apps/web/test-results/night-2026-10-09/guest-stage.json) |
| D4-04: verify duplicate and invalid phone handling; | Узкое историческое свидетельство | [N:guest-stage](../apps/web/test-results/night-2026-10-09/guest-stage.json) |
| D4-05: verify guest cannot access protected client data. | Узкое историческое свидетельство | [N:guest-dashboard-guard-stage](../apps/web/test-results/night-2026-10-09/guest-dashboard-guard-stage.json) |

## D5

Найденная граница: Пакетная paid attendance 2→1 и контроль 200; промо ошибки/отдельные пути.

Остаток: **Весь promotion type/expiry/limit/minimum набор, повтор attendance и полное согласование finance не закрыты.**

| ID и исходное обязательство | Результат разбора | Источники |
| --- | --- | --- |
| D5-01: apply percentage, fixed/free, expired, limited, and minimum-order promotions; | Узкое историческое свидетельство | [N:promotions-stage](../apps/web/test-results/night-2026-10-09/promotions-stage.json); [L004](../apps/web/test-results/live-2026-10-11/stage-004-promotion-errors.json) |
| D5-02: verify package-paid booking and remaining visits; | Узкое историческое свидетельство | [L028](../apps/web/test-results/live-2026-10-13/stage-028-package-attendance.json); [L030](../apps/web/test-results/live-2026-10-13/stage-030-client-package-review.json) |
| D5-03: verify summary, confirmation, cabinet, and finance show the same amount; | Узкое историческое свидетельство | [L028](../apps/web/test-results/live-2026-10-13/stage-028-package-attendance.json); [L030](../apps/web/test-results/live-2026-10-13/stage-030-client-package-review.json); [L046](../apps/web/test-results/live-2026-10-13/stage-046-hourly-finance.json); [G125](../apps/web/test-results/global-2026-10-17/stage-G125-owner-closed-snapshot-regression.json) |
| D5-04: verify repeated attendance does not consume a package twice. | Целевое свидетельство не найдено | — |

## D6

Найденная граница: Cancel/repeat, no-show и paid package; release slot и представления same-ID.

Остаток: **Все ролевые переходы и аналитические/финансовые эффекты каждого статуса; f821 не отменять без отдельного разрешения.**

| ID и исходное обязательство | Результат разбора | Источники |
| --- | --- | --- |
| D6-01: cancel from client and workspace flows; | Узкое историческое свидетельство | [L002](../apps/web/test-results/live-2026-10-11/stage-002-booking-cancel.json); [L022](../apps/web/test-results/live-2026-10-11/stage-022-client-cancellation-history.json) |
| D6-02: mark confirmed/paid/no-show where role permits; | Узкое историческое свидетельство | [L014](../apps/web/test-results/live-2026-10-11/stage-014-booking-status.json); [L024](../apps/web/test-results/live-2026-10-11/stage-024-real-time-no-show.json); [L028](../apps/web/test-results/live-2026-10-13/stage-028-package-attendance.json) |
| D6-03: verify repeat booking; | Узкое историческое свидетельство | [L015](../apps/web/test-results/live-2026-10-11/stage-015-repeat-booking.json); [L038](../apps/web/test-results/live-2026-10-13/stage-038-repeat-slots.json) |
| D6-04: verify status changes across QuickDesk, Cabinet, and analytics. | Узкое историческое свидетельство | [L022](../apps/web/test-results/live-2026-10-11/stage-022-client-cancellation-history.json); [L027](../apps/web/test-results/live-2026-10-11/stage-027-no-show-presentation.json); [L028](../apps/web/test-results/live-2026-10-13/stage-028-package-attendance.json) |

## E1

Найденная граница: Upcoming/history, receipt, loaded-list filters и сохранение Past22.

Остаток: **Полная pagination и error/loading матрица; поиск только загруженной страницы не глобальный поиск.**

| ID и исходное обязательство | Результат разбора | Источники |
| --- | --- | --- |
| E1-01: verify upcoming, history, empty, loading, and error states; | Узкое историческое свидетельство | [G080](../apps/web/test-results/global-2026-10-15/stage-G080-cabinet-tabs-keyboard.json); [G112](../apps/web/test-results/global-2026-10-17/stage-G112-staff-booking-lists.json); [G114](../apps/web/test-results/global-2026-10-17/stage-G114-staff-history-context-after.json) |
| E1-02: open booking details; | Узкое историческое свидетельство | [G113](../apps/web/test-results/global-2026-10-17/stage-G113-staff-receipt-entry.json); [L030](../apps/web/test-results/live-2026-10-13/stage-030-client-package-review.json) |
| E1-03: verify pagination/filtering if present; | Узкое историческое свидетельство | [L003](../apps/web/test-results/live-2026-10-11/stage-003-history-search.json); [G100](../apps/web/test-results/global-2026-10-16/stage-G100-owner-history-filters.json); [G112](../apps/web/test-results/global-2026-10-17/stage-G112-staff-booking-lists.json) |
| E1-04: verify data after booking create/cancel. | Узкое историческое свидетельство | [L022](../apps/web/test-results/live-2026-10-11/stage-022-client-cancellation-history.json); [L038](../apps/web/test-results/live-2026-10-13/stage-038-repeat-slots.json) |

## E2

Найденная граница: Имя/search, unsaved draft и initial loading; 3 UNIT FAIL на profile-read/auth/no-user сохранены.

Остаток: **Ошибка загрузки требует live подтверждения; phone/link/unlink/delete preview не исполнение lifecycle. Полная validation/server-error/persistence матрица открыта.**

| ID и исходное обязательство | Результат разбора | Источники |
| --- | --- | --- |
| E2-01: load and edit profile fields; | Узкое историческое свидетельство | [L031](../apps/web/test-results/live-2026-10-13/stage-031-profile-name-search.json); [G071/1](../apps/web/test-results/global-2026-10-15/stage-G071-profile-draft-after.json), [G071/2](../apps/web/test-results/global-2026-10-15/stage-G071-profile-draft-before.json); [G123](../apps/web/test-results/global-2026-10-17/stage-G123-profile-initial-loading-after.json); [G127](../apps/web/test-results/global-2026-10-17/stage-G127-owner-profile-loading-regression.json) |
| E2-02: test validation and server errors; | Техническая проверка / блокер, не live PASS | [G141](../apps/web/test-results/global-2026-10-18/stage-G141-profile-load-unit-boundary.json); [G151](../apps/web/test-results/global-2026-10-18-extension-1/stage-G151-profile-server-auth-contract.json); [G152](../apps/web/test-results/global-2026-10-18-extension-1/stage-G152-dashboard-parent-access-contract.json) |
| E2-03: reload and verify persistence; | Узкое историческое свидетельство | [L031](../apps/web/test-results/live-2026-10-13/stage-031-profile-name-search.json); [G071/1](../apps/web/test-results/global-2026-10-15/stage-G071-profile-draft-after.json), [G071/2](../apps/web/test-results/global-2026-10-15/stage-G071-profile-draft-before.json) |
| E2-04: test phone update and identity constraints. | Узкое историческое свидетельство | [WB-034](./WEB_HISTORICAL_DEFECTS.md#wb-034); [WB-037](./WEB_HISTORICAL_DEFECTS.md#wb-037); [WB-038](./WEB_HISTORICAL_DEFECTS.md#wb-038); [WB-042](./WEB_HISTORICAL_DEFECTS.md#wb-042); [G072](../apps/web/test-results/global-2026-10-15/stage-G072-unlink-preview.json); [G084](../apps/web/test-results/global-2026-10-16/stage-G084-deletion-guard.json) |

## E3

Найденная граница: Retained sold package 1/2 и owner/client сравнение; пустой expired filter не lifecycle истечения.

Остаток: **Реальное expiry/depletion, другой клиент и двойная attendance не доказаны.**

| ID и исходное обязательство | Результат разбора | Источники |
| --- | --- | --- |
| E3-01: verify active, expired, depleted, and absent packages; | Узкое историческое свидетельство | [L030](../apps/web/test-results/live-2026-10-13/stage-030-client-package-review.json); [G134](../apps/web/test-results/global-2026-10-17/stage-G134-owner-package-projection.json) |
| E3-02: verify remaining visit counts after attendance; | Узкое историческое свидетельство | [L028](../apps/web/test-results/live-2026-10-13/stage-028-package-attendance.json); [L030](../apps/web/test-results/live-2026-10-13/stage-030-client-package-review.json) |
| E3-03: compare package state with dashboard records; | Узкое историческое свидетельство | [L048](../apps/web/test-results/live-2026-10-13/stage-048-package-plan-sale-status.json); [G134](../apps/web/test-results/global-2026-10-17/stage-G134-owner-package-projection.json) |
| E3-04: verify inaccessible packages do not leak between clients. | Целевое свидетельство не найдено | — |

## E4

Найденная граница: Создание/обновление своего review и unique-review staff detail.

Остаток: **Все invalid ratings, duplicate concurrency, чужой update и все aggregate surfaces.**

| ID и исходное обязательство | Результат разбора | Источники |
| --- | --- | --- |
| E4-01: create and update an allowed review; | Узкое историческое свидетельство | [L030](../apps/web/test-results/live-2026-10-13/stage-030-client-package-review.json) |
| E4-02: test duplicate, invalid rating, and unauthorized update; | Узкое историческое свидетельство | [L030](../apps/web/test-results/live-2026-10-13/stage-030-client-package-review.json) |
| E4-03: verify rating surfaces update consistently. | Узкое историческое свидетельство | [L043](../apps/web/test-results/live-2026-10-13/stage-043-staff-details-review.json) |

## E5

Найденная граница: Ночные reminder записи и последующие read-only профильные проверки.

Остаток: **Каждый reminder completion/dismiss/persistence/locale нужно принимать отдельно от provider linking.**

| ID и исходное обязательство | Результат разбора | Источники |
| --- | --- | --- |
| E5-01: verify name, Telegram, and WhatsApp reminder banners; | Узкое историческое свидетельство | [N:notifications-stage](../apps/web/test-results/night-2026-10-09/notifications-stage.json); [N:profile-stage](../apps/web/test-results/night-2026-10-09/profile-stage.json) |
| E5-02: dismiss/complete each reminder; | Узкое историческое свидетельство | [N:notifications-stage](../apps/web/test-results/night-2026-10-09/notifications-stage.json) |
| E5-03: reload and verify persistence; | Узкое историческое свидетельство | [N:notifications-stage](../apps/web/test-results/night-2026-10-09/notifications-stage.json) |
| E5-04: test locale-specific copy and links. | Узкое историческое свидетельство | [N:notifications-stage](../apps/web/test-results/night-2026-10-09/notifications-stage.json); [G072](../apps/web/test-results/global-2026-10-15/stage-G072-unlink-preview.json) |

## F1

Найденная граница: Client/staff/owner/admin реальные входы и рабочие destination; manager/foreign owner fixtures нет.

Остаток: **Независимый manager/multi-role priority и все direct select-cabinet переходы.**

| ID и исходное обязательство | Результат разбора | Источники |
| --- | --- | --- |
| F1-01: login as client, staff, owner, manager, multi-role, and super-admin; | Узкое историческое свидетельство | [G058](../apps/web/test-results/global-2026-10-15/stage-G058-known-google-page-boundaries.json); [G059](../apps/web/test-results/global-2026-10-15/stage-G059-staff-page-object-checks.json); [G060](../apps/web/test-results/global-2026-10-15/stage-G060-owner-recovery-page-boundaries.json); [G108](../apps/web/test-results/global-2026-10-17/stage-G108-google-client-session.json); [G111](../apps/web/test-results/global-2026-10-17/stage-G111-google-staff-session.json); [G124](../apps/web/test-results/global-2026-10-17/stage-G124-owner-legacy-finance-regression.json) |
| F1-02: verify default destination priority; | Узкое историческое свидетельство | [G058](../apps/web/test-results/global-2026-10-15/stage-G058-known-google-page-boundaries.json); [G059](../apps/web/test-results/global-2026-10-15/stage-G059-staff-page-object-checks.json); [G060](../apps/web/test-results/global-2026-10-15/stage-G060-owner-recovery-page-boundaries.json) |
| F1-03: verify direct `/select-cabinet` behavior; | Узкое историческое свидетельство | [N:cabinet-stage](../apps/web/test-results/night-2026-10-09/cabinet-stage.json) |
| F1-04: verify no redirect loops. | Узкое историческое свидетельство | [G058](../apps/web/test-results/global-2026-10-15/stage-G058-known-google-page-boundaries.json); [G059](../apps/web/test-results/global-2026-10-15/stage-G059-staff-page-object-checks.json); [G060](../apps/web/test-results/global-2026-10-15/stage-G060-owner-recovery-page-boundaries.json) |

## F2

Найденная граница: Два бизнеса одного owner, persisted selection и scoped UI.

Остаток: **Отзыв доступа, foreign owner и API tenant boundary не доказаны same-owner переключением.**

| ID и исходное обязательство | Результат разбора | Источники |
| --- | --- | --- |
| F2-01: open `/select-business`; | Узкое историческое свидетельство | [L033](../apps/web/test-results/live-2026-10-13/stage-033-business-selection.json) |
| F2-02: choose between multiple businesses; | Узкое историческое свидетельство | [L033](../apps/web/test-results/live-2026-10-13/stage-033-business-selection.json); [G107](../apps/web/test-results/global-2026-10-17/stage-G107-owned-business-calendar-context.json) |
| F2-03: verify current business in dashboard/API calls; | Узкое историческое свидетельство | [L033](../apps/web/test-results/live-2026-10-13/stage-033-business-selection.json); [G018](../apps/web/test-results/global-2026-10-14/stage-G018-owned-business-context.json) |
| F2-04: reload and verify persistence; | Узкое историческое свидетельство | [L033](../apps/web/test-results/live-2026-10-13/stage-033-business-selection.json); [G107](../apps/web/test-results/global-2026-10-17/stage-G107-owned-business-calendar-context.json) |
| F2-05: revoke access and verify stale selection recovery. | Целевое свидетельство не найдено | — |

## F3

Найденная граница: Исправлен stale role menu и Escape focus; server denial уже существовал.

Остаток: **Все переходы/данные нескольких ролей и server/API boundaries отдельно.**

| ID и исходное обязательство | Результат разбора | Источники |
| --- | --- | --- |
| F3-01: switch among client, staff, dashboard, and admin destinations where allowed; | Узкое историческое свидетельство | [G016/1](../apps/web/test-results/global-2026-10-14/stage-G016-role-menu-after.json), [G016/2](../apps/web/test-results/global-2026-10-14/stage-G016-role-menu-before.json); [G058](../apps/web/test-results/global-2026-10-15/stage-G058-known-google-page-boundaries.json); [G059](../apps/web/test-results/global-2026-10-15/stage-G059-staff-page-object-checks.json); [G060](../apps/web/test-results/global-2026-10-15/stage-G060-owner-recovery-page-boundaries.json) |
| F3-02: verify labels, current state, and Back behavior; | Узкое историческое свидетельство | [G078/1](../apps/web/test-results/global-2026-10-15/stage-G078-role-menu-after.json), [G078/2](../apps/web/test-results/global-2026-10-15/stage-G078-role-menu-before.json) |
| F3-03: verify no stale data from the previous role remains. | Узкое историческое свидетельство | [G016/1](../apps/web/test-results/global-2026-10-14/stage-G016-role-menu-after.json), [G016/2](../apps/web/test-results/global-2026-10-14/stage-G016-role-menu-before.json) |

## F4

Найденная граница: Реальные page denials; прямой admin API опыт остановлен инструментом; isolated caller tests FAIL.

Остаток: **SEC01 — caller boundary и API/RLS права не закрыты. Page redirect и loading UI не API-security PASS.**

| ID и исходное обязательство | Результат разбора | Источники |
| --- | --- | --- |
| F4-01: open protected dashboard, staff, cabinet, and admin routes under wrong roles; | Узкое историческое свидетельство | [L020](../apps/web/test-results/live-2026-10-11/stage-020-pure-client.json); [L034](../apps/web/test-results/live-2026-10-13/stage-034-client-boundaries.json); [G058](../apps/web/test-results/global-2026-10-15/stage-G058-known-google-page-boundaries.json); [G059](../apps/web/test-results/global-2026-10-15/stage-G059-staff-page-object-checks.json); [G060](../apps/web/test-results/global-2026-10-15/stage-G060-owner-recovery-page-boundaries.json); [G066](../apps/web/test-results/global-2026-10-15/stage-G066-client-workspace-page-boundaries.json) |
| F4-02: test direct URL, new tab, reload, and copied links; | Узкое историческое свидетельство | [L034](../apps/web/test-results/live-2026-10-13/stage-034-client-boundaries.json); [G066](../apps/web/test-results/global-2026-10-15/stage-G066-client-workspace-page-boundaries.json) |
| F4-03: verify API actions reject unauthorized requests; | Узкое историческое свидетельство | [G050](../apps/web/test-results/global-2026-10-15/stage-G050-admin-caller-harness.json); [G051](../apps/web/test-results/global-2026-10-15/stage-G051-middleware-caller-calibration.json); [L051](../apps/web/test-results/live-2026-10-13/stage-051-admin-api-boundary.json) |
| F4-04: verify no sensitive page content flashes before redirect. | Узкое историческое свидетельство | [L034](../apps/web/test-results/live-2026-10-13/stage-034-client-boundaries.json); [G123](../apps/web/test-results/global-2026-10-17/stage-G123-profile-initial-loading-after.json) |

## G1

Найденная граница: Owner widgets и same-owner context, исправления ложных счётчиков.

Остаток: **Все роли и widget empty/error/stale состояния, независимые данные других businesses.**

| ID и исходное обязательство | Результат разбора | Источники |
| --- | --- | --- |
| G1-01: verify business identity and role-specific widgets; | Узкое историческое свидетельство | [G060](../apps/web/test-results/global-2026-10-15/stage-G060-owner-recovery-page-boundaries.json); [N:owner-stage](../apps/web/test-results/night-2026-10-09/owner-stage.json) |
| G1-02: test loading, empty, error, and stale data; | Узкое историческое свидетельство | [N:owner-stage](../apps/web/test-results/night-2026-10-09/owner-stage.json); [G004/1](../apps/web/test-results/global-2026-10-14/stage-G004-empty-search-after.json), [G004/2](../apps/web/test-results/global-2026-10-14/stage-G004-empty-search-before.json) |
| G1-03: verify date/business filters. | Узкое историческое свидетельство | [G107](../apps/web/test-results/global-2026-10-17/stage-G107-owned-business-calendar-context.json) |

## G2

Найденная граница: Navigation surfaces и календарь receipt→Back/reload; settings locale без Save.

Остаток: **Все breadcrumbs, routes и Back/Forward от каждой секции; SSR initial defaults не flash-free доказательство.**

| ID и исходное обязательство | Результат разбора | Источники |
| --- | --- | --- |
| G2-01: traverse bookings, staff, services, branches, finance, analytics, and packages; | Узкое историческое свидетельство | [G107](../apps/web/test-results/global-2026-10-17/stage-G107-owned-business-calendar-context.json); [G124](../apps/web/test-results/global-2026-10-17/stage-G124-owner-legacy-finance-regression.json); [G129](../apps/web/test-results/global-2026-10-17/stage-G129-business-contact-settings-locale-after.json); [G133](../apps/web/test-results/global-2026-10-17/stage-G133-owner-service-public-consistency.json); [G134](../apps/web/test-results/global-2026-10-17/stage-G134-owner-package-projection.json) |
| G2-02: verify active navigation and breadcrumbs; | Узкое историческое свидетельство | [G107](../apps/web/test-results/global-2026-10-17/stage-G107-owned-business-calendar-context.json); [G129](../apps/web/test-results/global-2026-10-17/stage-G129-business-contact-settings-locale-after.json) |
| G2-03: test browser Back/Forward and direct reload. | Узкое историческое свидетельство | [G106](../apps/web/test-results/global-2026-10-17/stage-G106-calendar-context-after.json); [G107](../apps/web/test-results/global-2026-10-17/stage-G107-owned-business-calendar-context.json) |

## G3

Найденная граница: Исправления false-zero аналитики и доступные read-only сравнения.

Остаток: **Полное согласование с booking/shift и timezone/refresh/empty-period matrix.**

| ID и исходное обязательство | Результат разбора | Источники |
| --- | --- | --- |
| G3-01: verify overview and load analytics; | Узкое историческое свидетельство | [N:analytics-stage](../apps/web/test-results/night-2026-10-09/analytics-stage.json); [L018](../apps/web/test-results/live-2026-10-11/stage-018-analytics-empty.json) |
| G3-02: test filters, empty periods, timezone boundaries, and refresh; | Узкое историческое свидетельство | [N:analytics-stage](../apps/web/test-results/night-2026-10-09/analytics-stage.json); [L018](../apps/web/test-results/live-2026-10-11/stage-018-analytics-empty.json) |
| G3-03: compare visible totals with underlying bookings/shifts. | Узкое историческое свидетельство | [L018](../apps/web/test-results/live-2026-10-11/stage-018-analytics-empty.json) |

## G4

Найденная граница: Исправлен локально platform-health как якобы business integration status; production retest не заявлен.

Остаток: **Live unavailable/partial/healthy и recovery links; внешние provider настройки остаются отдельными блокерами.**

| ID и исходное обязательство | Результат разбора | Источники |
| --- | --- | --- |
| G4-01: verify provider/integration status cards; | Только документ; первичный файл не найден | [WB-067](./WEB_HISTORICAL_DEFECTS.md#wb-067) |
| G4-02: test unavailable, partial, and healthy states; | Только документ; первичный файл не найден | [WB-067](./WEB_HISTORICAL_DEFECTS.md#wb-067) |
| G4-03: verify recovery links and refresh. | Только документ; первичный файл не найден | [WB-067](./WEB_HISTORICAL_DEFECTS.md#wb-067) |

## H1

Найденная граница: Owner calendar, loaded history и date/branch context.

Остаток: **Полная list/calendar/loading/error матрица, пагинация и не-свой бизнес.**

| ID и исходное обязательство | Результат разбора | Источники |
| --- | --- | --- |
| H1-01: load current bookings and filters; | Узкое историческое свидетельство | [G100](../apps/web/test-results/global-2026-10-16/stage-G100-owner-history-filters.json); [G106](../apps/web/test-results/global-2026-10-17/stage-G106-calendar-context-after.json) |
| H1-02: verify list/calendar switching where available; | Узкое историческое свидетельство | [N:operations-stage](../apps/web/test-results/night-2026-10-09/operations-stage.json); [G106](../apps/web/test-results/global-2026-10-17/stage-G106-calendar-context-after.json) |
| H1-03: test empty/error/loading states; | Узкое историческое свидетельство | [N:operations-stage](../apps/web/test-results/night-2026-10-09/operations-stage.json) |
| H1-04: verify business/branch/date context. | Узкое историческое свидетельство | [G106](../apps/web/test-results/global-2026-10-17/stage-G106-calendar-context-after.json); [G107](../apps/web/test-results/global-2026-10-17/stage-G107-owned-business-calendar-context.json) |

## H2

Найденная граница: QuickDesk real create и подтверждение; staff internal booking отдельный stage.

Остаток: **Quick hold expiry, rapid duplicate submit и все отрицательные выборы не покрыты успешным create.**

| ID и исходное обязательство | Результат разбора | Источники |
| --- | --- | --- |
| H2-01: create booking for existing and guest clients; | Узкое историческое свидетельство | [N:operations-stage](../apps/web/test-results/night-2026-10-09/operations-stage.json); [L013](../apps/web/test-results/live-2026-10-11/stage-013-staff-booking.json) |
| H2-02: test quick hold and expiration behavior; | Целевое свидетельство не найдено | — |
| H2-03: test missing staff/service/date validation; | Узкое историческое свидетельство | [N:operations-stage](../apps/web/test-results/night-2026-10-09/operations-stage.json) |
| H2-04: test duplicate rapid submission. | Целевое свидетельство не найдено | — |

## H3

Найденная граница: Отдельные status/attendance/cancel и сохранение package результата.

Остаток: **Edit всех полей, hold lifecycle и вся таблица запрещённых переходов/ролей и cross-surface effects.**

| ID и исходное обязательство | Результат разбора | Источники |
| --- | --- | --- |
| H3-01: edit booking data; | Узкое историческое свидетельство | [N:operations-stage](../apps/web/test-results/night-2026-10-09/operations-stage.json) |
| H3-02: transition hold → confirmed → paid/no-show; | Узкое историческое свидетельство | [L014](../apps/web/test-results/live-2026-10-11/stage-014-booking-status.json); [L024](../apps/web/test-results/live-2026-10-11/stage-024-real-time-no-show.json); [L028](../apps/web/test-results/live-2026-10-13/stage-028-package-attendance.json) |
| H3-03: cancel booking; | Узкое историческое свидетельство | [L002](../apps/web/test-results/live-2026-10-11/stage-002-booking-cancel.json); [L022](../apps/web/test-results/live-2026-10-11/stage-022-client-cancellation-history.json) |
| H3-04: verify invalid transitions and permissions; | Узкое историческое свидетельство | [L014](../apps/web/test-results/live-2026-10-11/stage-014-booking-status.json); [L024](../apps/web/test-results/live-2026-10-11/stage-024-real-time-no-show.json) |
| H3-05: verify updates in Cabinet, analytics, packages, and finance. | Узкое историческое свидетельство | [L027](../apps/web/test-results/live-2026-10-11/stage-027-no-show-presentation.json); [L028](../apps/web/test-results/live-2026-10-13/stage-028-package-attendance.json); [L030](../apps/web/test-results/live-2026-10-13/stage-030-client-package-review.json) |

## H4

Найденная граница: Client identity/name-search и сброс невидимого выбранного клиента.

Остаток: **Все identifier/debounce/create-client/duplicate identity ветви и реальное attachment для каждого режима.**

| ID и исходное обязательство | Результат разбора | Источники |
| --- | --- | --- |
| H4-01: search by name, phone, and other supported identifiers; | Узкое историческое свидетельство | [N:quickdesk-clients-stage](../apps/web/test-results/night-2026-10-09/quickdesk-clients-stage.json); [L029](../apps/web/test-results/live-2026-10-13/stage-029-client-identity.json); [L031](../apps/web/test-results/live-2026-10-13/stage-031-profile-name-search.json) |
| H4-02: test debounce, empty result, duplicate identity, and create-client paths; | Узкое историческое свидетельство | [N:quickdesk-clients-stage](../apps/web/test-results/night-2026-10-09/quickdesk-clients-stage.json) |
| H4-03: verify selected client remains attached through booking submission. | Узкое историческое свидетельство | [N:operations-stage](../apps/web/test-results/night-2026-10-09/operations-stage.json); [L029](../apps/web/test-results/live-2026-10-13/stage-029-client-identity.json) |

## H5

Найденная граница: Stale slot conflict и own-bookings count refresh; не два параллельных клиента.

Остаток: **Два независимых контекста, одновременные команды и stale edit/idempotent retry.**

| ID и исходное обязательство | Результат разбора | Источники |
| --- | --- | --- |
| H5-01: open the same slot in two browser contexts; | Целевое свидетельство не найдено | — |
| H5-02: submit conflicting operations; | Узкое историческое свидетельство | [L042](../apps/web/test-results/live-2026-10-13/stage-042-stale-slot-conflict.json); [N:booking-conflict-stage](../apps/web/test-results/night-2026-10-09/booking-conflict-stage.json) |
| H5-03: edit stale booking data; | Узкое историческое свидетельство | [L042](../apps/web/test-results/live-2026-10-13/stage-042-stale-slot-conflict.json) |
| H5-04: verify conflict messaging and safe retry. | Узкое историческое свидетельство | [L042](../apps/web/test-results/live-2026-10-13/stage-042-stale-slot-conflict.json) |

## I1

Найденная граница: Локальные branch-form исправления и публичное чтение существующих филиалов.

Остаток: **Полный create/edit/schedule/delete lifecycle, propagation, validation и карты после Save не закрыты.**

| ID и исходное обязательство | Результат разбора | Источники |
| --- | --- | --- |
| I1-01: create, edit, schedule, and safely delete a test branch; | Только документ; первичный файл не найден | [WB-030](./WEB_HISTORICAL_DEFECTS.md#wb-030); [WB-080](./WEB_HISTORICAL_DEFECTS.md#wb-080) |
| I1-02: verify address, coordinates, contacts, timezone, and active state; | Только документ; первичный файл не найден | [WB-074](./WEB_HISTORICAL_DEFECTS.md#wb-074); [WB-078](./WEB_HISTORICAL_DEFECTS.md#wb-078); [WB-080](./WEB_HISTORICAL_DEFECTS.md#wb-080) |
| I1-03: verify changes on public business and map. | Узкое историческое свидетельство | [G023](../apps/web/test-results/global-2026-10-14/stage-G023-public-map-context.json); [G092](../apps/web/test-results/global-2026-10-16/stage-G092-public-business-entry.json) |

## I2

Найденная граница: Скрытый service branch2 и публичная видимость, duration input follow-up.

Остаток: **Удаление, duplicates, полный staff linking/price/duration/active lifecycle и dependent bookings.**

| ID и исходное обязательство | Результат разбора | Источники |
| --- | --- | --- |
| I2-01: create, edit, disable, and delete test services; | Узкое историческое свидетельство | [G005/1](../apps/web/test-results/global-2026-10-14/stage-G005-service-lifecycle-after.json), [G005/2](../apps/web/test-results/global-2026-10-14/stage-G005-service-lifecycle-before.json) |
| I2-02: verify duration, price, category, staff links, and booking availability; | Узкое историческое свидетельство | [G005/1](../apps/web/test-results/global-2026-10-14/stage-G005-service-lifecycle-after.json), [G005/2](../apps/web/test-results/global-2026-10-14/stage-G005-service-lifecycle-before.json); [G133](../apps/web/test-results/global-2026-10-17/stage-G133-owner-service-public-consistency.json) |
| I2-03: test validation and duplicate names. | Узкое историческое свидетельство | [WB-082](./WEB_HISTORICAL_DEFECTS.md#wb-082); [G005/1](../apps/web/test-results/global-2026-10-14/stage-G005-service-lifecycle-after.json), [G005/2](../apps/web/test-results/global-2026-10-14/stage-G005-service-lifecycle-before.json) |

## I3

Найденная граница: Ночные staff transfer/операции и исторический application→staff фикс.

Остаток: **Create/link/dismiss/restore/delete полный цикл и avatar; нет multijob/secondstaff fixtures.**

| ID и исходное обязательство | Результат разбора | Источники |
| --- | --- | --- |
| I3-01: create/link staff, edit profile, transfer, dismiss, restore, and delete where safe; | Узкое историческое свидетельство | [N:transfer-stage](../apps/web/test-results/night-2026-10-09/transfer-stage.json) |
| I3-02: test avatar upload/remove; | Целевое свидетельство не найдено | — |
| I3-03: verify role sync and booking availability. | Узкое историческое свидетельство | [N:transfer-stage](../apps/web/test-results/night-2026-10-09/transfer-stage.json); [WB-053](./WEB_HISTORICAL_DEFECTS.md#wb-053) |

## I4

Найденная граница: Draft load/preview, absence conflict и рабочие/off-day slots.

Остаток: **Preview не публикация; overnight/breaks/reverse range и полный schedule regeneration набор.**

| ID и исходное обязательство | Результат разбора | Источники |
| --- | --- | --- |
| I4-01: edit branch and staff schedules; | Узкое историческое свидетельство | [G019/1](../apps/web/test-results/global-2026-10-14/stage-G019-schedule-weekdays-after.json), [G019/2](../apps/web/test-results/global-2026-10-14/stage-G019-schedule-weekdays-before.json); [G020/1](../apps/web/test-results/global-2026-10-14/stage-G020-schedule-notice-after.json), [G020/2](../apps/web/test-results/global-2026-10-14/stage-G020-schedule-notice-before.json); [N:absence-stage](../apps/web/test-results/night-2026-10-09/absence-stage.json) |
| I4-02: test breaks, day off, overnight/edge times, and invalid ranges; | Узкое историческое свидетельство | [G021](../apps/web/test-results/global-2026-10-14/stage-G021-draft-negative.json); [L044](../apps/web/test-results/live-2026-10-13/stage-044-absence-conflicts.json) |
| I4-03: verify generated booking slots. | Узкое историческое свидетельство | [G062](../apps/web/test-results/global-2026-10-15/stage-G062-staff-day-availability-after.json); [G077/1](../apps/web/test-results/global-2026-10-15/stage-G077-repeat-offday-after.json), [G077/2](../apps/web/test-results/global-2026-10-15/stage-G077-repeat-offday-before.json) |

## I5

Найденная граница: Сохранены ограниченные membership/admin наблюдения; текущих grant/revoke операций не было.

Остаток: **Полный member lifecycle и immediate UI/API revoke, owner protection; запрещены новые role fixtures без разрешения.**

| ID и исходное обязательство | Результат разбора | Источники |
| --- | --- | --- |
| I5-01: invite/add member; | Узкое историческое свидетельство | [N:admin-stage](../apps/web/test-results/night-2026-10-09/admin-stage.json) |
| I5-02: grant, demote, revoke, and restore roles; | Узкое историческое свидетельство | [N:admin-stage](../apps/web/test-results/night-2026-10-09/admin-stage.json) |
| I5-03: verify immediate UI/API access changes; | Узкое историческое свидетельство | [N:admin-stage](../apps/web/test-results/night-2026-10-09/admin-stage.json); [G050](../apps/web/test-results/global-2026-10-15/stage-G050-admin-caller-harness.json) |
| I5-04: verify owner protections. | Узкое историческое свидетельство | [N:admin-stage](../apps/web/test-results/night-2026-10-09/admin-stage.json) |

## I6

Найденная граница: Settings исторические сохранения и отдельный contact locale fix без нового Save.

Остаток: **Все поля/media/slug-collision/SEO после изменения; no-Save перевод не lifecycle приёмка.**

| ID и исходное обязательство | Результат разбора | Источники |
| --- | --- | --- |
| I6-01: edit name, slug, description, contacts, media, and categories; | Узкое историческое свидетельство | [N:settings-stage](../apps/web/test-results/night-2026-10-09/settings-stage.json); [G129](../apps/web/test-results/global-2026-10-17/stage-G129-business-contact-settings-locale-after.json) |
| I6-02: verify slug collision and invalid values; | Узкое историческое свидетельство | [N:settings-stage](../apps/web/test-results/night-2026-10-09/settings-stage.json) |
| I6-03: verify public card and SEO metadata after update. | Узкое историческое свидетельство | [N:settings-stage](../apps/web/test-results/night-2026-10-09/settings-stage.json) |

## J1

Найденная граница: Actual staff own workspace, read-only schedule/finance/history и page gates.

Остаток: **Другой сотрудник/private-data API, все error/empty состояния; WB-054 multijob остаётся открыт.**

| ID и исходное обязательство | Результат разбора | Источники |
| --- | --- | --- |
| J1-01: verify schedule, bookings, finance, profile, and navigation; | Узкое историческое свидетельство | [G111](../apps/web/test-results/global-2026-10-17/stage-G111-google-staff-session.json); [G112](../apps/web/test-results/global-2026-10-17/stage-G112-staff-booking-lists.json); [G115](../apps/web/test-results/global-2026-10-17/stage-G115-staff-schedule-read.json); [G117](../apps/web/test-results/global-2026-10-17/stage-G117-finance-view-context-after.json); [G121](../apps/web/test-results/global-2026-10-17/stage-G121-staff-personal-workspace-boundary.json) |
| J1-02: test loading/empty/error states; | Узкое историческое свидетельство | [G112](../apps/web/test-results/global-2026-10-17/stage-G112-staff-booking-lists.json); [G123](../apps/web/test-results/global-2026-10-17/stage-G123-profile-initial-loading-after.json) |
| J1-03: verify staff cannot see another employee's private data. | Узкое историческое свидетельство | [G059](../apps/web/test-results/global-2026-10-15/stage-G059-staff-page-object-checks.json); [L045](../apps/web/test-results/live-2026-10-13/stage-045-current-business-staff-guard.json) |

## J2

Найденная граница: Marked shift open/add/close и сохранение item ID; simple closed history.

Остаток: **Полная duplicate/concurrency matrix и роли; closed shifts не переоткрывать ради импорта.**

| ID и исходное обязательство | Результат разбора | Источники |
| --- | --- | --- |
| J2-01: open shift; | Узкое историческое свидетельство | [N:staff-stage](../apps/web/test-results/night-2026-10-09/staff-stage.json); [N:owner-shift-stage](../apps/web/test-results/night-2026-10-09/owner-shift-stage.json) |
| J2-02: prevent duplicate open; | Узкое историческое свидетельство | [N:staff-stage](../apps/web/test-results/night-2026-10-09/staff-stage.json) |
| J2-03: add clients/items; | Узкое историческое свидетельство | [N:staff-stage](../apps/web/test-results/night-2026-10-09/staff-stage.json) |
| J2-04: close shift; | Узкое историческое свидетельство | [N:staff-stage](../apps/web/test-results/night-2026-10-09/staff-stage.json); [WB-083](./WEB_HISTORICAL_DEFECTS.md#wb-083) |
| J2-05: verify read-only closed state and history. | Узкое историческое свидетельство | [N:staff-stage](../apps/web/test-results/night-2026-10-09/staff-stage.json); [G095](../apps/web/test-results/global-2026-10-16/stage-G095-closed-shift-snapshot.json) |

## J3

Найденная граница: Manual item edit/save identity и закрытие без замены записей.

Остаток: **Все supported item types, remove, real interrupted request/retry и полное согласование каждого mutation.**

| ID и исходное обязательство | Результат разбора | Источники |
| --- | --- | --- |
| J3-01: add, edit, and remove supported manual items; | Узкое историческое свидетельство | [N:staff-stage](../apps/web/test-results/night-2026-10-09/staff-stage.json); [L010](../apps/web/test-results/live-2026-10-11/stage-010-finance-save-duplicate.json) |
| J3-02: force request failure and retry; | Узкое историческое свидетельство | [L010](../apps/web/test-results/live-2026-10-11/stage-010-finance-save-duplicate.json) |
| J3-03: verify idempotency and preserved item IDs; | Узкое историческое свидетельство | [L010](../apps/web/test-results/live-2026-10-11/stage-010-finance-save-duplicate.json); [WB-083](./WEB_HISTORICAL_DEFECTS.md#wb-083) |
| J3-04: verify totals after every mutation. | Узкое историческое свидетельство | [N:staff-stage](../apps/web/test-results/night-2026-10-09/staff-stage.json); [L010](../apps/web/test-results/live-2026-10-11/stage-010-finance-save-duplicate.json) |

## J4

Найденная граница: Own weekly/day schedule, staff booking receipt и return context.

Остаток: **Все разрешённые действия, недоступный source/error и другого staff ограничения.**

| ID и исходное обязательство | Результат разбора | Источники |
| --- | --- | --- |
| J4-01: verify daily/weekly schedule and date navigation; | Узкое историческое свидетельство | [G115](../apps/web/test-results/global-2026-10-17/stage-G115-staff-schedule-read.json); [G121](../apps/web/test-results/global-2026-10-17/stage-G121-staff-personal-workspace-boundary.json) |
| J4-02: verify booking details and allowed actions; | Узкое историческое свидетельство | [G112](../apps/web/test-results/global-2026-10-17/stage-G112-staff-booking-lists.json); [G113](../apps/web/test-results/global-2026-10-17/stage-G113-staff-receipt-entry.json) |
| J4-03: test empty day and unavailable data. | Узкое историческое свидетельство | [G115](../apps/web/test-results/global-2026-10-17/stage-G115-staff-schedule-read.json) |

## J5

Найденная граница: Исторический профиль и successful loading; не fresh profile Save.

Остаток: **Avatar limits/upload/remove и профильная validation/persistence; без новой identity fixture.**

| ID и исходное обязательство | Результат разбора | Источники |
| --- | --- | --- |
| J5-01: edit allowed profile data; | Узкое историческое свидетельство | [N:profile-stage](../apps/web/test-results/night-2026-10-09/profile-stage.json) |
| J5-02: upload/remove avatar; | Целевое свидетельство не найдено | — |
| J5-03: verify validation, file limits, persistence, and fallback. | Узкое историческое свидетельство | [G123](../apps/web/test-results/global-2026-10-17/stage-G123-profile-initial-loading-after.json) |

## K1

Найденная граница: Контроли 2h/rate300/services600/materials50/payout600/business50 и double-topup fix.

Остаток: **Все rate/share/rounding/guarantee варианты; manager не independent fixture, полный финансовый движок не принят.**

| ID и исходное обязательство | Результат разбора | Источники |
| --- | --- | --- |
| K1-01: verify turnover, consumables, master share, salon share, guarantee, and top-up; | Узкое историческое свидетельство | [L046](../apps/web/test-results/live-2026-10-13/stage-046-hourly-finance.json); [G095](../apps/web/test-results/global-2026-10-16/stage-G095-closed-shift-snapshot.json); [G116](../apps/web/test-results/global-2026-10-17/stage-G116-closed-stats-topup-after.json); [G125](../apps/web/test-results/global-2026-10-17/stage-G125-owner-closed-snapshot-regression.json) |
| K1-02: test percentage/rate variants and rounding; | Узкое историческое свидетельство | [L046](../apps/web/test-results/live-2026-10-13/stage-046-hourly-finance.json) |
| K1-03: compare staff and manager surfaces. | Узкое историческое свидетельство | [L046](../apps/web/test-results/live-2026-10-13/stage-046-hourly-finance.json); [G125](../apps/web/test-results/global-2026-10-17/stage-G125-owner-closed-snapshot-regression.json) |

## K2

Найденная граница: Marked closed-shift hours correction и audit/recalculation.

Остаток: **Все negative/excess/open-shift/rounding границы и concurrent correction, не только одна смена.**

| ID и исходное обязательство | Результат разбора | Источники |
| --- | --- | --- |
| K2-01: edit closed-shift hours; | Узкое историческое свидетельство | [L046](../apps/web/test-results/live-2026-10-13/stage-046-hourly-finance.json) |
| K2-02: verify validation for negative, excessive, and open-shift values; | Узкое историческое свидетельство | [L005](../apps/web/test-results/live-2026-10-11/stage-005-finance-hours.json); [L046](../apps/web/test-results/live-2026-10-13/stage-046-hourly-finance.json) |
| K2-03: verify automatic recalculation and audit entry. | Узкое историческое свидетельство | [L046](../apps/web/test-results/live-2026-10-13/stage-046-hourly-finance.json) |

## K3

Найденная граница: Branch/day/month/year, card sums и staff view context; owner reload-today требует решения.

Остаток: **Pagination/export если существуют, timezone cutoffs и DEC-OWNER-STATS-RELOAD-CONTEXT.**

| ID и исходное обязательство | Результат разбора | Источники |
| --- | --- | --- |
| K3-01: verify all-staff and individual staff finance; | Узкое историческое свидетельство | [G094](../apps/web/test-results/global-2026-10-16/stage-G094-owner-finance-filters.json); [G095](../apps/web/test-results/global-2026-10-16/stage-G095-closed-shift-snapshot.json); [G097](../apps/web/test-results/global-2026-10-16/stage-G097-finance-period-controls.json); [G125](../apps/web/test-results/global-2026-10-17/stage-G125-owner-closed-snapshot-regression.json) |
| K3-02: test date ranges, empty periods, pagination, exports if present, and reload; | Узкое историческое свидетельство | [G097](../apps/web/test-results/global-2026-10-16/stage-G097-finance-period-controls.json); [G117](../apps/web/test-results/global-2026-10-17/stage-G117-finance-view-context-after.json); [G118](../apps/web/test-results/global-2026-10-17/stage-G118-finance-period-context.json); [G126](../apps/web/test-results/global-2026-10-17/stage-G126-owner-stats-reload-contract.json) |
| K3-03: compare summary with detail rows. | Узкое историческое свидетельство | [G097](../apps/web/test-results/global-2026-10-16/stage-G097-finance-period-controls.json); [G125](../apps/web/test-results/global-2026-10-17/stage-G125-owner-closed-snapshot-regression.json) |

## K4

Найденная граница: История часов/rate и сохранение item ID; isolated finance-log caller boundary FAIL.

Остаток: **Участник/время/before-after/reason каждого action и реальная unauthorized защита журналов.**

| ID и исходное обязательство | Результат разбора | Источники |
| --- | --- | --- |
| K4-01: verify operation history after item edits and hour corrections; | Узкое историческое свидетельство | [WB-083](./WEB_HISTORICAL_DEFECTS.md#wb-083); [L046](../apps/web/test-results/live-2026-10-13/stage-046-hourly-finance.json) |
| K4-02: inspect actor, timestamp, before/after values, and reason; | Узкое историческое свидетельство | [L046](../apps/web/test-results/live-2026-10-13/stage-046-hourly-finance.json); [G095](../apps/web/test-results/global-2026-10-16/stage-G095-closed-shift-snapshot.json) |
| K4-03: verify unauthorized users cannot access logs. | Техническая проверка / блокер, не live PASS | [G050](../apps/web/test-results/global-2026-10-15/stage-G050-admin-caller-harness.json); [G051](../apps/web/test-results/global-2026-10-15/stage-G051-middleware-caller-calibration.json) |

## K5

Найденная граница: Частичные same-ID closed shift/package/no-show comparisons.

Остаток: **Единая модель всех шести поверхностей, всех статусов/promotions и границ суток/таймзоны.**

| ID и исходное обязательство | Результат разбора | Источники |
| --- | --- | --- |
| K5-01: compare QuickDesk, shift, staff finance, dashboard finance, packages, and analytics; | Узкое историческое свидетельство | [L019](../apps/web/test-results/live-2026-10-11/stage-019-closed-ledger-after-attendance.json); [L046](../apps/web/test-results/live-2026-10-13/stage-046-hourly-finance.json); [G125](../apps/web/test-results/global-2026-10-17/stage-G125-owner-closed-snapshot-regression.json) |
| K5-02: test cancelled/no-show/package-paid/promotion bookings; | Узкое историческое свидетельство | [L022](../apps/web/test-results/live-2026-10-11/stage-022-client-cancellation-history.json); [L027](../apps/web/test-results/live-2026-10-11/stage-027-no-show-presentation.json); [L028](../apps/web/test-results/live-2026-10-13/stage-028-package-attendance.json) |
| K5-03: verify timezone/date cutoffs. | Целевое свидетельство не найдено | — |

## L1

Найденная граница: Ночные promotion операции и fixes ошибок/валидации.

Остаток: **Все date/usage/minimum/stacking комбинации и полный public→booking→finance эффект.**

| ID и исходное обязательство | Результат разбора | Источники |
| --- | --- | --- |
| L1-01: create, edit, activate/deactivate, and delete test promotion; | Узкое историческое свидетельство | [N:promotions-stage](../apps/web/test-results/night-2026-10-09/promotions-stage.json); [L004](../apps/web/test-results/live-2026-10-11/stage-004-promotion-errors.json) |
| L1-02: test date, usage, branch, service, minimum amount, and stacking rules; | Узкое историческое свидетельство | [N:promotions-stage](../apps/web/test-results/night-2026-10-09/promotions-stage.json) |
| L1-03: verify public presentation and booking calculation. | Узкое историческое свидетельство | [N:promotions-stage](../apps/web/test-results/night-2026-10-09/promotions-stage.json) |

## L2

Найденная граница: Plan/sale и consumed visit 2→1, active-plan vs retained sold package.

Остаток: **Expiration/depletion/duplicate attendance не подтверждены пустым expired filter или одним расходованием.**

| ID и исходное обязательство | Результат разбора | Источники |
| --- | --- | --- |
| L2-01: create/edit package plan; | Узкое историческое свидетельство | [N:packages-stage](../apps/web/test-results/night-2026-10-09/packages-stage.json); [L025](../apps/web/test-results/live-2026-10-11/stage-025-package-lifecycle.json) |
| L2-02: sell package to client; | Узкое историческое свидетельство | [N:packages-stage](../apps/web/test-results/night-2026-10-09/packages-stage.json); [L025](../apps/web/test-results/live-2026-10-11/stage-025-package-lifecycle.json) |
| L2-03: consume visit through attendance; | Узкое историческое свидетельство | [L028](../apps/web/test-results/live-2026-10-13/stage-028-package-attendance.json) |
| L2-04: verify remaining balance, expiration, and duplicate attendance protection. | Узкое историческое свидетельство | [L028](../apps/web/test-results/live-2026-10-13/stage-028-package-attendance.json); [L048](../apps/web/test-results/live-2026-10-13/stage-048-package-plan-sale-status.json); [G134](../apps/web/test-results/global-2026-10-17/stage-G134-owner-package-projection.json) |

## L3

Найденная граница: Review create/update и unique count; config/admin чтение.

Остаток: **Все агрегаты/recalculation и защита debug API; admin page access не caller boundary.**

| ID и исходное обязательство | Результат разбора | Источники |
| --- | --- | --- |
| L3-01: verify rating configuration; | Узкое историческое свидетельство | [N:admin-stage](../apps/web/test-results/night-2026-10-09/admin-stage.json) |
| L3-02: create/update review and recalculate; | Узкое историческое свидетельство | [L030](../apps/web/test-results/live-2026-10-13/stage-030-client-package-review.json) |
| L3-03: verify business/branch/staff aggregates; | Узкое историческое свидетельство | [L043](../apps/web/test-results/live-2026-10-13/stage-043-staff-details-review.json); [N:admin-stage](../apps/web/test-results/night-2026-10-09/admin-stage.json) |
| L3-04: verify debug/status surfaces only for authorized roles. | Узкое историческое свидетельство | [L050](../apps/web/test-results/live-2026-10-13/stage-050-admin-readonly.json); [G050](../apps/web/test-results/global-2026-10-15/stage-G050-admin-caller-harness.json) |

## L4

Найденная граница: Проверена disabled plan sale availability и сохранность ранее проданного пакета.

Остаток: **Реальное expiry, zero visits, overlaps, deleted refs и partial-failure retry — нет достаточного исполнения.**

| ID и исходное обязательство | Результат разбора | Источники |
| --- | --- | --- |
| L4-01: expired/disabled promotions and packages; | Узкое историческое свидетельство | [L048](../apps/web/test-results/live-2026-10-13/stage-048-package-plan-sale-status.json); [G134](../apps/web/test-results/global-2026-10-17/stage-G134-owner-package-projection.json) |
| L4-02: zero remaining visits; | Целевое свидетельство не найдено | — |
| L4-03: overlapping promotions; | Целевое свидетельство не найдено | — |
| L4-04: deleted service/staff references; | Целевое свидетельство не найдено | — |
| L4-05: recalculation retry and partial failure. | Целевое свидетельство не найдено | — |

## M1

Найденная граница: Реальный admin и non-admin page gates, readonly traversal; monitoring SQL failure открыт.

Остаток: **Все nested reload и API boundaries, monitoring error; запрещённый endpoint не повторять.**

| ID и исходное обязательство | Результат разбора | Источники |
| --- | --- | --- |
| M1-01: login as super-admin and open `/admin` directly; | Узкое историческое свидетельство | [L050](../apps/web/test-results/live-2026-10-13/stage-050-admin-readonly.json); [G058](../apps/web/test-results/global-2026-10-15/stage-G058-known-google-page-boundaries.json) |
| M1-02: verify non-admin rejection; | Узкое историческое свидетельство | [L034](../apps/web/test-results/live-2026-10-13/stage-034-client-boundaries.json); [G058](../apps/web/test-results/global-2026-10-15/stage-G058-known-google-page-boundaries.json); [G066](../apps/web/test-results/global-2026-10-15/stage-G066-client-workspace-page-boundaries.json) |
| M1-03: traverse admin navigation and reload nested pages; | Узкое историческое свидетельство | [L050](../apps/web/test-results/live-2026-10-13/stage-050-admin-readonly.json) |
| M1-04: verify no production Server Component error. | Узкое историческое свидетельство | [L050](../apps/web/test-results/live-2026-10-13/stage-050-admin-readonly.json); [WB-177](./WEB_HISTORICAL_DEFECTS.md#wb-177) |

## M2

Найденная граница: Историческое approval→business/owner/public-links; часть первичных файлов отсутствует.

Остаток: **Полный business/branch lifecycle и destructive dependency confirmations, независимые owners.**

| ID и исходное обязательство | Результат разбора | Источники |
| --- | --- | --- |
| M2-01: create/edit a test business; | Узкое историческое свидетельство | [WB-046](./WEB_HISTORICAL_DEFECTS.md#wb-046); [N:admin-stage](../apps/web/test-results/night-2026-10-09/admin-stage.json) |
| M2-02: create/edit/delete a test branch; | Только документ; первичный файл не найден | [WB-030](./WEB_HISTORICAL_DEFECTS.md#wb-030); [WB-080](./WEB_HISTORICAL_DEFECTS.md#wb-080) |
| M2-03: assign/change owner; | Только документ; первичный файл не найден | [WB-046](./WEB_HISTORICAL_DEFECTS.md#wb-046) |
| M2-04: verify members and public visibility; | Только документ; первичный файл не найден | [WB-045@public-links](./WEB_HISTORICAL_DEFECTS.md#wb-045public-links); [WB-046](./WEB_HISTORICAL_DEFECTS.md#wb-046) |
| M2-05: verify destructive confirmations and dependencies. | Целевое свидетельство не найдено | — |

## M3

Найденная граница: Поиск пользователей/summary и пустой search; рискованные account команды не выполнялись.

Остаток: **Suspend/password/link/admin-toggle, last-admin/current-user protections и action audit требуют отдельных разрешений/кейсов.**

| ID и исходное обязательство | Результат разбора | Источники |
| --- | --- | --- |
| M3-01: search/create/update test user; | Узкое историческое свидетельство | [G004/1](../apps/web/test-results/global-2026-10-14/stage-G004-empty-search-after.json), [G004/2](../apps/web/test-results/global-2026-10-14/stage-G004-empty-search-before.json); [N:admin-stage](../apps/web/test-results/night-2026-10-09/admin-stage.json) |
| M3-02: suspend/restore, set password, send link, toggle super-admin where safe; | Целевое свидетельство не найдено | — |
| M3-03: verify current-user and last-admin protections; | Целевое свидетельство не найдено | — |
| M3-04: verify auditability and error feedback. | Узкое историческое свидетельство | [G004/1](../apps/web/test-results/global-2026-10-14/stage-G004-empty-search-after.json), [G004/2](../apps/web/test-results/global-2026-10-14/stage-G004-empty-search-before.json); [N:admin-stage](../apps/web/test-results/night-2026-10-09/admin-stage.json) |

## M4

Найденная граница: Сохранены ограниченные admin/role сведения, same-owner scope и caller negative FAIL.

Остаток: **Полный role CRUD/grants, multirole/foreign business и immediate API revoke не закрыты.**

| ID и исходное обязательство | Результат разбора | Источники |
| --- | --- | --- |
| M4-01: create/edit/delete test role; | Узкое историческое свидетельство | [N:admin-stage](../apps/web/test-results/night-2026-10-09/admin-stage.json) |
| M4-02: assign and revoke roles; | Узкое историческое свидетельство | [N:admin-stage](../apps/web/test-results/night-2026-10-09/admin-stage.json) |
| M4-03: test multi-role user and business scope; | Узкое историческое свидетельство | [G018](../apps/web/test-results/global-2026-10-14/stage-G018-owned-business-context.json); [G050](../apps/web/test-results/global-2026-10-15/stage-G050-admin-caller-harness.json) |
| M4-04: verify API and UI permissions immediately. | Техническая проверка / блокер, не live PASS | [G050](../apps/web/test-results/global-2026-10-15/stage-G050-admin-caller-harness.json); [G051](../apps/web/test-results/global-2026-10-15/stage-G051-middleware-caller-calibration.json) |

## M5

Найденная граница: Marked category edit, public labels и rating config наблюдения.

Остаток: **Delete/dependencies/system settings и locale taxonomy контракт остаются отдельно.**

| ID и исходное обязательство | Результат разбора | Источники |
| --- | --- | --- |
| M5-01: create/edit/delete test category; | Узкое историческое свидетельство | [N:admin-stage](../apps/web/test-results/night-2026-10-09/admin-stage.json) |
| M5-02: verify use by services/businesses; | Узкое историческое свидетельство | [WB-094](./WEB_HISTORICAL_DEFECTS.md#wb-094); [G086](../apps/web/test-results/global-2026-10-16/stage-G086-category-contract.json) |
| M5-03: test rating configuration and system settings; | Узкое историческое свидетельство | [N:admin-stage](../apps/web/test-results/night-2026-10-09/admin-stage.json) |
| M5-04: verify validation and dependency handling. | Узкое историческое свидетельство | [N:admin-stage](../apps/web/test-results/night-2026-10-09/admin-stage.json) |

## M6

Найденная граница: Readonly admin metrics pages; nested aggregate error и caller-check gaps сохранены.

Остаток: **Исправление caller boundary раньше nested SQL; real filters/partialfailure/retry и sensitive payload controls.**

| ID и исходное обязательство | Результат разбора | Источники |
| --- | --- | --- |
| M6-01: verify monitoring, performance, health, funnel, load, promotion, and system analytics; | Узкое историческое свидетельство | [L050](../apps/web/test-results/live-2026-10-13/stage-050-admin-readonly.json); [WB-177](./WEB_HISTORICAL_DEFECTS.md#wb-177) |
| M6-02: test empty periods, filters, refresh, partial API failure, and retry; | Узкое историческое свидетельство | [L050](../apps/web/test-results/live-2026-10-13/stage-050-admin-readonly.json); [WB-177](./WEB_HISTORICAL_DEFECTS.md#wb-177) |
| M6-03: verify metrics do not expose sensitive payloads. | Техническая проверка / блокер, не live PASS | [G050](../apps/web/test-results/global-2026-10-15/stage-G050-admin-caller-harness.json); [G051](../apps/web/test-results/global-2026-10-15/stage-G051-middleware-caller-calibration.json) |

## N1

Найденная граница: Один разрешённый Telegram recipient: create/cancel и dedup; delivery не равна успешной booking команде.

Остаток: **Все recipients/locales/channels/status events, outages и честное UI сообщение о доставке.**

| ID и исходное обязательство | Результат разбора | Источники |
| --- | --- | --- |
| N1-01: trigger allowed booking/status notifications; | Узкое историческое свидетельство | [N:notifications-stage](../apps/web/test-results/night-2026-10-09/notifications-stage.json); [WB-099](./WEB_HISTORICAL_DEFECTS.md#wb-099); [WB-100](./WEB_HISTORICAL_DEFECTS.md#wb-100) |
| N1-02: verify recipient, locale, content, duplicate suppression, and failure handling; | Узкое историческое свидетельство | [N:notifications-stage](../apps/web/test-results/night-2026-10-09/notifications-stage.json); [WB-100](./WEB_HISTORICAL_DEFECTS.md#wb-100) |
| N1-03: verify UI does not claim success when delivery fails. | Узкое историческое свидетельство | [WB-099](./WEB_HISTORICAL_DEFECTS.md#wb-099) |

## N2

Найденная граница: Link flow история и synthetic log checks; не webhook authenticity live test.

Остаток: **Signature, replay/malformed/unrelated updates и реальные logs без секретов — полного evidence нет.**

| ID и исходное обязательство | Результат разбора | Источники |
| --- | --- | --- |
| N2-01: verify webhook signature/authenticity controls; | Целевое свидетельство не найдено | — |
| N2-02: test valid, replayed, malformed, and unrelated updates; | Целевое свидетельство не найдено | — |
| N2-03: verify login/link confirmation behavior; | Узкое историческое свидетельство | [N:profile-stage](../apps/web/test-results/night-2026-10-09/profile-stage.json); [WB-028](./WEB_HISTORICAL_DEFECTS.md#wb-028); [WB-029](./WEB_HISTORICAL_DEFECTS.md#wb-029) |
| N2-04: inspect logs for secret leakage. | Техническая проверка / блокер, не live PASS | [G053](../apps/web/test-results/global-2026-10-15/stage-G053-callback-log-contracts.json) |

## N3

Найденная граница: Отдельный WhatsApp OTP stage и общий admin caller риск, не webhook gate PASS.

Остаток: **Webhook verification/inbound, duplicate/reordered events и соответствующая конкретному endpoint авторизация.**

| ID и исходное обязательство | Результат разбора | Источники |
| --- | --- | --- |
| N3-01: verify webhook verification and inbound event handling; | Целевое свидетельство не найдено | — |
| N3-02: test duplicate/reordered status events; | Целевое свидетельство не найдено | — |
| N3-03: test OTP send/verify provider failures; | Узкое историческое свидетельство | [N:whatsapp-stage](../apps/web/test-results/night-2026-10-09/whatsapp-stage.json); [WB-035](./WEB_HISTORICAL_DEFECTS.md#wb-035) |
| N3-04: verify diagnostics endpoints are appropriately guarded. | Техническая проверка / блокер, не live PASS | [G050](../apps/web/test-results/global-2026-10-15/stage-G050-admin-caller-harness.json); [G051](../apps/web/test-results/global-2026-10-15/stage-G051-middleware-caller-calibration.json) |

## N4

Найденная граница: Достаточных целевых job-run свидетельств в доступном архиве не сопоставлено.

Остаток: **Jobs/auth/idempotency/partialfailure/effects требуют разрешённого controlled environment; новые jobs/fixtures не создавать сейчас.**

| ID и исходное обязательство | Результат разбора | Источники |
| --- | --- | --- |
| N4-01: verify shift close, analytics, retention, health alert, and rating jobs in a controlled environment; | Целевое свидетельство не найдено | — |
| N4-02: test authorization, duplicate execution, partial failure, and retry; | Целевое свидетельство не найдено | — |
| N4-03: verify job effects and logs. | Целевое свидетельство не найдено | — |

## O1

Найденная граница: Viewport измерения обнаружили несоответствие; старые изображения сохранены как контекст, не device PASS.

Остаток: **Реальные 1280/1440/wide CSS размеры + fresh image, overflow и sticky/table/modal проверка.**

| ID и исходное обязательство | Результат разбора | Источники |
| --- | --- | --- |
| O1-01: test 1280, 1440, and wide desktop layouts; | Техническая проверка / блокер, не live PASS | [G002](../apps/web/test-results/global-2026-10-14/stage-G002-preparation.json); [G064](../apps/web/test-results/global-2026-10-15/stage-G064-viewport-diagnostic.json) |
| O1-02: verify headers, sidebars, tables, modals, and sticky actions; | Техническая проверка / блокер, не live PASS | [G002](../apps/web/test-results/global-2026-10-14/stage-G002-preparation.json); [G064](../apps/web/test-results/global-2026-10-15/stage-G064-viewport-diagnostic.json) |
| O1-03: inspect horizontal overflow and clipped controls. | Техническая проверка / блокер, не live PASS | [G002](../apps/web/test-results/global-2026-10-14/stage-G002-preparation.json); [G064](../apps/web/test-results/global-2026-10-15/stage-G064-viewport-diagnostic.json) |

## O2

Найденная граница: Старые mobile declarations и задокументированный failure эмуляции; 390→1560 не 390 CSS PASS.

Остаток: **320/360/390/412/768/1024 actual CSS + images, все surfaces и touch/keyboard.**

| ID и исходное обязательство | Результат разбора | Источники |
| --- | --- | --- |
| O2-01: test 320, 360, 390, 412, 768, and 1024 CSS-pixel widths; | Узкое историческое свидетельство | [G002](../apps/web/test-results/global-2026-10-14/stage-G002-preparation.json); [L037](../apps/web/test-results/live-2026-10-13/stage-037-responsive-viewport.json); [G064](../apps/web/test-results/global-2026-10-15/stage-G064-viewport-diagnostic.json) |
| O2-02: verify mobile menu, forms, booking steps, cards, tables, and dialogs; | Техническая проверка / блокер, не live PASS | [WB-003](./WEB_HISTORICAL_DEFECTS.md#wb-003); [WB-081](./WEB_HISTORICAL_DEFECTS.md#wb-081); [G064](../apps/web/test-results/global-2026-10-15/stage-G064-viewport-diagnostic.json) |
| O2-03: test touch targets and virtual keyboard where possible. | Целевое свидетельство не найдено | — |

## O3

Найденная граница: Много адресных RU/KY/EN фиксов, dates/money/plurals и initial SSR locale.

Остаток: **Не весь словарь/route/state matrix; authored content и canonical category не переводятся автоматически; header transient lag сохранён.**

| ID и исходное обязательство | Результат разбора | Источники |
| --- | --- | --- |
| O3-01: switch among supported languages; | Узкое историческое свидетельство | [G123](../apps/web/test-results/global-2026-10-17/stage-G123-profile-initial-loading-after.json); [G129](../apps/web/test-results/global-2026-10-17/stage-G129-business-contact-settings-locale-after.json); [G130](../apps/web/test-results/global-2026-10-17/stage-G130-branch-weekdays-after.json); [G131](../apps/web/test-results/global-2026-10-17/stage-G131-branch-business-context-after.json) |
| O3-02: verify persistence and URL behavior; | Узкое историческое свидетельство | [L035](../apps/web/test-results/live-2026-10-13/stage-035-profile-language.json); [L036](../apps/web/test-results/live-2026-10-13/stage-036-initial-locale.json); [G106](../apps/web/test-results/global-2026-10-17/stage-G106-calendar-context-after.json); [G117](../apps/web/test-results/global-2026-10-17/stage-G117-finance-view-context-after.json) |
| O3-03: inspect missing keys, mixed languages, overflow, dates, money, and plurals; | Узкое историческое свидетельство | [G032/1](../apps/web/test-results/global-2026-10-15/stage-G032-counts-after.json), [G032/2](../apps/web/test-results/global-2026-10-15/stage-G032-counts-before.json); [G038/1](../apps/web/test-results/global-2026-10-15/stage-G038-calendar-ky-after.json), [G038/2](../apps/web/test-results/global-2026-10-15/stage-G038-calendar-ky-before.json); [G079](../apps/web/test-results/global-2026-10-15/stage-G079-final-amount-after.json); [G085](../apps/web/test-results/global-2026-10-16/stage-G085-map-count-after.json); [G098](../apps/web/test-results/global-2026-10-16/stage-G098-finance-status-counts-after.json); [G099](../apps/web/test-results/global-2026-10-16/stage-G099-finance-static-labels-after.json); [G101](../apps/web/test-results/global-2026-10-16/stage-G101-owner-calendar-labels-after.json); [G102](../apps/web/test-results/global-2026-10-16/stage-G102-calendar-tooltip-after.json); [G129](../apps/web/test-results/global-2026-10-17/stage-G129-business-contact-settings-locale-after.json); [G130](../apps/web/test-results/global-2026-10-17/stage-G130-branch-weekdays-after.json); [G131](../apps/web/test-results/global-2026-10-17/stage-G131-branch-business-context-after.json) |
| O3-04: verify server and client content use the same locale. | Узкое историческое свидетельство | [L036](../apps/web/test-results/live-2026-10-13/stage-036-initial-locale.json); [G123](../apps/web/test-results/global-2026-10-17/stage-G123-profile-initial-loading-after.json); [G129](../apps/web/test-results/global-2026-10-17/stage-G129-business-contact-settings-locale-after.json) |

## O4

Найденная граница: Native keyboard menu/tabs/map/dialog точечные цепочки и ARIA семантика.

Остаток: **Все core paths, реальный screen reader и live/error announcements; AX сам по себе не screenreader PASS.**

| ID и исходное обязательство | Результат разбора | Источники |
| --- | --- | --- |
| O4-01: navigate core public, booking, cabinet, dashboard, staff, and admin paths by keyboard; | Узкое историческое свидетельство | [G065](../apps/web/test-results/global-2026-10-15/stage-G065-keyboard-booking-smoke.json); [G078/1](../apps/web/test-results/global-2026-10-15/stage-G078-role-menu-after.json), [G078/2](../apps/web/test-results/global-2026-10-15/stage-G078-role-menu-before.json); [G080](../apps/web/test-results/global-2026-10-15/stage-G080-cabinet-tabs-keyboard.json); [G087](../apps/web/test-results/global-2026-10-16/stage-G087-map-keyboard.json) |
| O4-02: inspect focus order, skip/navigation landmarks, dialog focus trap, and focus restoration; | Узкое историческое свидетельство | [G013/1](../apps/web/test-results/global-2026-10-14/stage-G013-tabs-after.json), [G013/2](../apps/web/test-results/global-2026-10-14/stage-G013-tabs-before.json); [G070/1](../apps/web/test-results/global-2026-10-15/stage-G070-map-dialog-after.json), [G070/2](../apps/web/test-results/global-2026-10-15/stage-G070-map-dialog-before.json); [G074/1](../apps/web/test-results/global-2026-10-15/stage-G074-review-dialog-after.json), [G074/2](../apps/web/test-results/global-2026-10-15/stage-G074-review-dialog-before.json); [G078/1](../apps/web/test-results/global-2026-10-15/stage-G078-role-menu-after.json), [G078/2](../apps/web/test-results/global-2026-10-15/stage-G078-role-menu-before.json) |
| O4-03: run a screen reader smoke where environment supports it; | Целевое свидетельство не найдено | — |
| O4-04: verify live/error announcements. | Узкое историческое свидетельство | [G013/1](../apps/web/test-results/global-2026-10-14/stage-G013-tabs-after.json), [G013/2](../apps/web/test-results/global-2026-10-14/stage-G013-tabs-before.json); [G070/1](../apps/web/test-results/global-2026-10-15/stage-G070-map-dialog-after.json), [G070/2](../apps/web/test-results/global-2026-10-15/stage-G070-map-dialog-before.json) |

## O5

Найденная граница: Некоторые состояния зафиксированы AX/oddscale image, установленной visual baseline нет.

Остаток: **Настоящий baseline comparison/hover/focus/overflow и согласованность workspaces на валидных viewport.**

| ID и исходное обязательство | Результат разбора | Источники |
| --- | --- | --- |
| O5-01: compare key pages with established visual baselines; | Целевое свидетельство не найдено | — |
| O5-02: test hover, focus, disabled, loading, empty, and error states; | Узкое историческое свидетельство | [G123](../apps/web/test-results/global-2026-10-17/stage-G123-profile-initial-loading-after.json); [G129](../apps/web/test-results/global-2026-10-17/stage-G129-business-contact-settings-locale-after.json) |
| O5-03: verify no accidental design divergence between related workspaces. | Только документ; первичный файл не найден | [WB-081](./WEB_HISTORICAL_DEFECTS.md#wb-081) |

## P1

Найденная граница: Реальные conflict/retry и отдельные unit-failure границы; 6 красных assertions — не 6 live bugs.

Остаток: **Полная 400/401/403/404/409/429/500/offline/timeout матрица и real mutation retry без дубликатов.**

| ID и исходное обязательство | Результат разбора | Источники |
| --- | --- | --- |
| P1-01: intercept or reproduce 400, 401, 403, 404, 409, 429, 500, timeout, and offline states; | Узкое историческое свидетельство | [L042](../apps/web/test-results/live-2026-10-13/stage-042-stale-slot-conflict.json); [L023](../apps/web/test-results/live-2026-10-11/stage-023-business-retry.json); [G141](../apps/web/test-results/global-2026-10-18/stage-G141-profile-load-unit-boundary.json); [G145](../apps/web/test-results/global-2026-10-18/stage-G145-role-applications-client-read-state.json) |
| P1-02: verify readable errors and safe retries; | Узкое историческое свидетельство | [L023](../apps/web/test-results/live-2026-10-11/stage-023-business-retry.json); [G141](../apps/web/test-results/global-2026-10-18/stage-G141-profile-load-unit-boundary.json); [G145](../apps/web/test-results/global-2026-10-18/stage-G145-role-applications-client-read-state.json) |
| P1-03: verify critical actions do not fail silently; | Узкое историческое свидетельство | [WB-087](./WEB_HISTORICAL_DEFECTS.md#wb-087); [WB-099](./WEB_HISTORICAL_DEFECTS.md#wb-099); [G141](../apps/web/test-results/global-2026-10-18/stage-G141-profile-load-unit-boundary.json); [G145](../apps/web/test-results/global-2026-10-18/stage-G145-role-applications-client-read-state.json) |
| P1-04: verify mutation retries are idempotent. | Узкое историческое свидетельство | [L010](../apps/web/test-results/live-2026-10-11/stage-010-finance-save-duplicate.json) |

## P2

Найденная граница: Selected reload/history/draft/context и stale role/header fixes.

Остаток: **Duplicate/background/restore closed tab, interrupted commands и все формы, не только booking/profile.**

| ID и исходное обязательство | Результат разбора | Источники |
| --- | --- | --- |
| P2-01: reload mid-form, duplicate tab, background tab, navigate away/back, and restore closed tab; | Узкое историческое свидетельство | [L040](../apps/web/test-results/live-2026-10-13/stage-040-reload-selection.json); [G071/1](../apps/web/test-results/global-2026-10-15/stage-G071-profile-draft-after.json), [G071/2](../apps/web/test-results/global-2026-10-15/stage-G071-profile-draft-before.json); [G106](../apps/web/test-results/global-2026-10-17/stage-G106-calendar-context-after.json); [G114](../apps/web/test-results/global-2026-10-17/stage-G114-staff-history-context-after.json); [G117](../apps/web/test-results/global-2026-10-17/stage-G117-finance-view-context-after.json) |
| P2-02: test interrupted auth, booking, QuickDesk, and admin edits; | Узкое историческое свидетельство | [G071/1](../apps/web/test-results/global-2026-10-15/stage-G071-profile-draft-after.json), [G071/2](../apps/web/test-results/global-2026-10-15/stage-G071-profile-draft-before.json) |
| P2-03: verify stale form/session handling. | Узкое историческое свидетельство | [G016/1](../apps/web/test-results/global-2026-10-14/stage-G016-role-menu-after.json), [G016/2](../apps/web/test-results/global-2026-10-14/stage-G016-role-menu-before.json); [G076/1](../apps/web/test-results/global-2026-10-15/stage-G076-existing-session-after.json), [G076/2](../apps/web/test-results/global-2026-10-15/stage-G076-existing-session-before.json) |

## P3

Найденная граница: Нет достаточного целевого performance benchmark; быстрый единичный UI read не измерение.

Остаток: **First-load/navigation timing, большие списки, waterfall/memory/long tasks и repeated navigation degradation.**

| ID и исходное обязательство | Результат разбора | Источники |
| --- | --- | --- |
| P3-01: measure public first load and critical workspace navigation; | Целевое свидетельство не найдено | — |
| P3-02: test large bookings, staff, users, businesses, and finance lists; | Целевое свидетельство не найдено | — |
| P3-03: inspect pagination/virtualization, long tasks, request waterfalls, and memory; | Целевое свидетельство не найдено | — |
| P3-04: verify repeated navigation does not degrade. | Целевое свидетельство не найдено | — |

## P4

Найденная граница: Статический/synthetic scan, deployed RPC metadata и отрицательные caller tests.

Остаток: **Real HTTP caller/IDOR/CSRF/redirect boundaries, legacy SECURITY DEFINER RPC. Не извлекать токены; metadata не exploit доказательство.**

| ID и исходное обязательство | Результат разбора | Источники |
| --- | --- | --- |
| P4-01: inspect console, network, HTML, error pages, and browser storage for secrets; | Техническая проверка / блокер, не live PASS | [G052](../apps/web/test-results/global-2026-10-15/stage-G052-cold-canary-build.json); [G053](../apps/web/test-results/global-2026-10-15/stage-G053-callback-log-contracts.json) |
| P4-02: test open redirect, unsafe `next`, IDOR, role bypass, CSRF-sensitive mutations, and unguarded admin/debug endpoints; | Техническая проверка / блокер, не live PASS | [G003](../apps/web/test-results/global-2026-10-14/stage-G003-rpc-boundaries.json); [G033](../apps/web/test-results/global-2026-10-15/stage-G033-booking-boundary-inventory.json); [G034](../apps/web/test-results/global-2026-10-15/stage-G034-guard-callgraph.json); [G050](../apps/web/test-results/global-2026-10-15/stage-G050-admin-caller-harness.json); [G051](../apps/web/test-results/global-2026-10-15/stage-G051-middleware-caller-calibration.json) |
| P4-03: verify cookies and auth state behavior; | Узкое историческое свидетельство | [L001](../apps/web/test-results/live-2026-10-11/stage-001-multitab-signout.json); [G076/1](../apps/web/test-results/global-2026-10-15/stage-G076-existing-session-after.json), [G076/2](../apps/web/test-results/global-2026-10-15/stage-G076-existing-session-before.json) |
| P4-04: verify sensitive values are masked in logs and UI. | Техническая проверка / блокер, не live PASS | [G053](../apps/web/test-results/global-2026-10-15/stage-G053-callback-log-contracts.json) |

## P5

Найденная граница: Задокументированы ограничения одного IAB/viewport; cross-engine gate отсутствует.

Остаток: **Chrome/Firefox/WebKit и настоящие desktop/mobile cases в поддерживаемой среде.**

| ID и исходное обязательство | Результат разбора | Источники |
| --- | --- | --- |
| P5-01: run critical smoke on current Chrome/Chromium, Firefox, and WebKit where available; | Целевое свидетельство не найдено | — |
| P5-02: test desktop and mobile emulation; | Узкое историческое свидетельство | [G002](../apps/web/test-results/global-2026-10-14/stage-G002-preparation.json); [L037](../apps/web/test-results/live-2026-10-13/stage-037-responsive-viewport.json); [G064](../apps/web/test-results/global-2026-10-15/stage-G064-viewport-diagnostic.json) |
| P5-03: record browser-specific unsupported behavior. | Техническая проверка / блокер, не live PASS | [G064](../apps/web/test-results/global-2026-10-15/stage-G064-viewport-diagnostic.json) |

## Q1

Найденная граница: Полный исторический Jest/lint не green; новые scoped unit PASS и 6 FAIL сохранены отдельно.

Остаток: **Кандидатный configured baseline, skipped specs, authenticated/visual groups; не суммировать пересекающиеся test counts.**

| ID и исходное обязательство | Результат разбора | Источники |
| --- | --- | --- |
| Q1-01: run web typecheck; | Техническая проверка / блокер, не live PASS | [G043](../apps/web/test-results/global-2026-10-15/stage-G043-current-baseline.json); [G140](../apps/web/test-results/global-2026-10-18/stage-G140-finance-read-unit-coverage.json); [G141](../apps/web/test-results/global-2026-10-18/stage-G141-profile-load-unit-boundary.json); [G144](../apps/web/test-results/global-2026-10-18/stage-G144-role-applications-read-unit.json); [G145](../apps/web/test-results/global-2026-10-18/stage-G145-role-applications-client-read-state.json); [G151](../apps/web/test-results/global-2026-10-18-extension-1/stage-G151-profile-server-auth-contract.json); [G152](../apps/web/test-results/global-2026-10-18-extension-1/stage-G152-dashboard-parent-access-contract.json) |
| Q1-02: run core and extended Jest suites; | Техническая проверка / блокер, не live PASS | [G043](../apps/web/test-results/global-2026-10-15/stage-G043-current-baseline.json); [G140](../apps/web/test-results/global-2026-10-18/stage-G140-finance-read-unit-coverage.json); [G141](../apps/web/test-results/global-2026-10-18/stage-G141-profile-load-unit-boundary.json); [G144](../apps/web/test-results/global-2026-10-18/stage-G144-role-applications-read-unit.json); [G145](../apps/web/test-results/global-2026-10-18/stage-G145-role-applications-client-read-state.json); [G151](../apps/web/test-results/global-2026-10-18-extension-1/stage-G151-profile-server-auth-contract.json); [G152](../apps/web/test-results/global-2026-10-18-extension-1/stage-G152-dashboard-parent-access-contract.json) |
| Q1-03: run public Playwright smoke; | Целевое свидетельство не найдено | — |
| Q1-04: run authenticated and seeded groups when environment is prepared; | Целевое свидетельство не найдено | — |
| Q1-05: run visual regression gate; | Техническая проверка / блокер, не live PASS | [G064](../apps/web/test-results/global-2026-10-15/stage-G064-viewport-diagnostic.json) |
| Q1-06: record skipped specs and why. | Техническая проверка / блокер, не live PASS | [G043](../apps/web/test-results/global-2026-10-15/stage-G043-current-baseline.json); [G044](../apps/web/test-results/global-2026-10-15/stage-G044-slot-loader-const.json); [G048](../apps/web/test-results/global-2026-10-15/stage-G048-full-build-probe.json) |

## Q2

Найденная граница: Все перечисленные поверхности имеют отдельные исторические smoke наблюдения, не один release прогон.

Остаток: **Согласованный финальный smoke конкретного deployed кандидата и зависимостей; история не новая приёмка.**

| ID и исходное обязательство | Результат разбора | Источники |
| --- | --- | --- |
| Q2-01: public home/business/map; | Узкое историческое свидетельство | [G023](../apps/web/test-results/global-2026-10-14/stage-G023-public-map-context.json); [G067](../apps/web/test-results/global-2026-10-15/stage-G067-home-counts-after.json); [G092](../apps/web/test-results/global-2026-10-16/stage-G092-public-business-entry.json) |
| Q2-02: one real auth provider and logout; | Узкое историческое свидетельство | [G058](../apps/web/test-results/global-2026-10-15/stage-G058-known-google-page-boundaries.json); [G059](../apps/web/test-results/global-2026-10-15/stage-G059-staff-page-object-checks.json); [G060](../apps/web/test-results/global-2026-10-15/stage-G060-owner-recovery-page-boundaries.json) |
| Q2-03: complete booking and cancellation; | Узкое историческое свидетельство | [L002](../apps/web/test-results/live-2026-10-11/stage-002-booking-cancel.json); [L038](../apps/web/test-results/live-2026-10-13/stage-038-repeat-slots.json) |
| Q2-04: QuickDesk status transition; | Узкое историческое свидетельство | [L024](../apps/web/test-results/live-2026-10-11/stage-024-real-time-no-show.json); [L028](../apps/web/test-results/live-2026-10-13/stage-028-package-attendance.json) |
| Q2-05: staff shift open/add/close; | Узкое историческое свидетельство | [N:staff-stage](../apps/web/test-results/night-2026-10-09/staff-stage.json) |
| Q2-06: owner dashboard entry; | Узкое историческое свидетельство | [G060](../apps/web/test-results/global-2026-10-15/stage-G060-owner-recovery-page-boundaries.json); [G124](../apps/web/test-results/global-2026-10-17/stage-G124-owner-legacy-finance-regression.json) |
| Q2-07: super-admin entry; | Узкое историческое свидетельство | [G058](../apps/web/test-results/global-2026-10-15/stage-G058-known-google-page-boundaries.json) |
| Q2-08: network failure and recovery. | Узкое историческое свидетельство | [L023](../apps/web/test-results/live-2026-10-11/stage-023-business-retry.json) |

## Q3

Найденная граница: IDs/effects/retained fixtures и запреты восстановлены по финалам; no autonomous cleanup.

Остаток: **Полный audit всех эффектов нельзя заменить утверждением zero TOTAL writes; telemetry IDs не перечислены. Удаление требует отдельного разрешения.**

| ID и исходное обязательство | Результат разбора | Источники |
| --- | --- | --- |
| Q3-01: identify every test entity created during live QA; | Узкое историческое свидетельство | [G030](../apps/web/test-results/global-2026-10-14/stage-G030-retained-data-audit.json); [G137](../apps/web/test-results/global-2026-10-17/stage-G137-finalization-paused.json); [G149](../apps/web/test-results/global-2026-10-18/stage-G149-final-closure.json); [G155](../apps/web/test-results/global-2026-10-18-extension-1/stage-G155-final-closure.json) |
| Q3-02: remove or archive approved test data; | Техническая проверка / блокер, не live PASS | [G137](../apps/web/test-results/global-2026-10-17/stage-G137-finalization-paused.json); [G149](../apps/web/test-results/global-2026-10-18/stage-G149-final-closure.json); [G155](../apps/web/test-results/global-2026-10-18-extension-1/stage-G155-final-closure.json) |
| Q3-03: verify no real user or business was modified; | Узкое историческое свидетельство | [G030](../apps/web/test-results/global-2026-10-14/stage-G030-retained-data-audit.json); [G155](../apps/web/test-results/global-2026-10-18-extension-1/stage-G155-final-closure.json) |
| Q3-04: record data intentionally retained for future tests. | Техническая проверка / блокер, не live PASS | [G137](../apps/web/test-results/global-2026-10-17/stage-G137-finalization-paused.json); [G149](../apps/web/test-results/global-2026-10-18/stage-G149-final-closure.json); [G155](../apps/web/test-results/global-2026-10-18-extension-1/stage-G155-final-closure.json) |

## Q4

Найденная граница: Сохранены NOT_READY и deadline/pause истории; новый реестр разделяет open/fixed/pending.

Остаток: **Rollback/monitoring реального release и конечное решение по кандидатным gates; новый аудит не даёт GO.**

| ID и исходное обязательство | Результат разбора | Источники |
| --- | --- | --- |
| Q4-01: list open `WB-*` defects by severity; | Техническая проверка / блокер, не live PASS | [G137](../apps/web/test-results/global-2026-10-17/stage-G137-finalization-paused.json); [G149](../apps/web/test-results/global-2026-10-18/stage-G149-final-closure.json); [G155](../apps/web/test-results/global-2026-10-18-extension-1/stage-G155-final-closure.json) |
| Q4-02: list blocked or untested live areas; | Техническая проверка / блокер, не live PASS | [G137](../apps/web/test-results/global-2026-10-17/stage-G137-finalization-paused.json); [G149](../apps/web/test-results/global-2026-10-18/stage-G149-final-closure.json); [G155](../apps/web/test-results/global-2026-10-18-extension-1/stage-G155-final-closure.json) |
| Q4-03: confirm rollback and monitoring readiness; | Техническая проверка / блокер, не live PASS | [G048](../apps/web/test-results/global-2026-10-15/stage-G048-full-build-probe.json); [G049](../apps/web/test-results/global-2026-10-15/stage-G049-production-boot-probe.json); [G052](../apps/web/test-results/global-2026-10-15/stage-G052-cold-canary-build.json); [G053](../apps/web/test-results/global-2026-10-15/stage-G053-callback-log-contracts.json) |
| Q4-04: decide `GO`, `NO-GO`, or `GO WITH ACCEPTED RISKS`. | Техническая проверка / блокер, не live PASS | [G137](../apps/web/test-results/global-2026-10-17/stage-G137-finalization-paused.json); [G149](../apps/web/test-results/global-2026-10-18/stage-G149-final-closure.json); [G155](../apps/web/test-results/global-2026-10-18-extension-1/stage-G155-final-closure.json) |
