# WEB: проверяемый прогресс

Срез учёта: 2026-10-28T15:00:31.755Z. База WEB-ACCEPTANCE-1. Импорт истории сохранён отдельно от новых случаев текущего кандидата. Этот генератор ничего не тестирует и не изменяет.

## Текущая приёмка

Принято **28/316 (8.9%)**, осталось **288**. Это приёмка исходных требований, не процент написанного продукта. Текущие caseIds, шаги, среда, evidence и ограничения находятся в реестре. Процент исполнения атомарной матрицы: **не определён: матрица ещё не завершена**.

Новые находки текущего реестра: **22**, открыты **3**, исправление и повторная проверка подтверждены **19**. Они не смешиваются с импортом старых WB.

- S1-F001: Business with no active branches claims online booking is available — verified; требования B2-03; evidence S1-EV-5.
- S1-F002: No explicit waiting indicator during delayed home transition — verified; требования B1-04; evidence S1-EV-37.
- S1-F003: Stale inactive branch URL skips required branch step — verified; требования B2-03; evidence S1-EV-76.
- S1-F004: Retry cannot recover after restored Next chunk due cached rejected load — verified; требования A3-04; evidence S1-EV-119, S1-EV-125, S1-EV-126.
- S1-F005: Admin role-applications read failure falsely claims empty list — fixed_pending_verification; требования M1-03; evidence S1-EV-165.
- S1-F006: Authorized performance page read chain fails across caller/role/response contracts — verified; требования M1-03; evidence S1-EV-186.
- S1-F007: Ratings debug action cells stringify React controls as object text — verified; требования M1-03; evidence S1-EV-186.
- S1-F008: Promotions debug page denies the current authorized global superadmin — verified; требования M1-03; evidence S1-EV-186.
- S1-F009: Health Check server self-request loses caller session and reads wrong response shape — verified; требования M1-03; evidence S1-EV-210.
- S1-F010: Ratings status SSR self-HTTP fails despite authorized caller — verified; требования M1-03; evidence S1-EV-220.
- S1-F011: Global administrative overview fails via selected-business context — verified; требования M1-03; evidence S1-EV-228.
- S1-F012: Authenticated sign-in entry does not resume an explicit safe return path — verified; требования P4-02, C1-03, C1-04; evidence S1-EV-264, S1-EV-265.
- S1-F013: Known staff history reload unexpectedly shows authorization-required page — open; требования J1-01; evidence S1-EV-336, S1-EV-337.
- S1-F014: Business editor shows raw English name-required error in Russian UI — verified; требования O3-03; evidence S1-EV-395, S1-EV-396.
- S1-F015: Manual branch address cannot be entered despite explicit fallback instruction — verified; требования M2-02; evidence S1-EV-435, S1-EV-436, S1-EV-437.
- S1-F016: Opening category editor changes saved custom slug before any input — verified; требования M5-01; evidence S1-EV-465, S1-EV-466, S1-EV-467.
- S1-F017: Admin Today ignores canonical cancelled status in counter and row label — verified; требования M1-03; evidence S1-EV-499, S1-EV-500, S1-EV-501, S1-EV-502, S1-EV-503.
- S1-F018: Admin Today booking status labels stay Russian after English or Kyrgyz selection — verified; требования O3-03, O3-04; evidence S1-EV-519, S1-EV-520, S1-EV-521.
- S1-F019: English admin Today heading exposes an escape backslash before apostrophe — verified; требования O3-03; evidence S1-EV-529, S1-EV-530.
- S1-F020: Nonempty no-digit public phone and WhatsApp text silently accepted and discarded — verified; требования I1-02, M2-02; evidence S1-EV-578, S1-EV-579, S1-EV-580.
- S1-F021: Own admin basic-name Save fails with missing user id on promised route params — verified; требования M3-01; evidence S1-EV-664, S1-EV-665, S1-EV-666.
- S1-F022: Overlong service name is rejected with misleading minimum-only guidance — fixed_pending_verification; требования I2-03, P1-02; evidence S1-EV-783, S1-EV-787, S1-EV-790.

## Результат разбора

- **2477/2477 файлов** доступного архива внесены в опись с SHA-256; 291 stage/final/progress JSON-записей проиндексированы, включая проверки без исправлений, FAIL и служебные стадии. Это не число тестов.
- **316/316 применимых обязательств классифицированы — 100% разбора**. 5 пунктов C2 исключены существующим social-only решением. Ни один блокер не удалён из знаменателя.
- **204 записей дефектов**, 203 исходных WB-номера: две разные WB-045 получили уточняющие суффиксы, пример WB-001 исключён; WB-165/166 разделены.
- **109 точных ссылок на файлы июня/июля не разрешаются** в рабочем архиве. Старые утверждения сохранены, но первичные доказательства не выдуманы.

## Что исправлено

| Состояние исторической записи | Количество |
| --- | ---: |
| Исторический узкий SAME-LIVE | 121 |
| Заявлено verified; первичный файл не найден | 32 |
| Исправлено; проверка не завершена | 42 |
| Исторически open/reopened | 8 |
| Историческое; вне social-only scope | 1 |

121 — подтверждённые **узкие исторические исправления**, а не столько полностью готовых функций. В карточках сохранены исходные шаги, ожидание/факт, retest, ограничения и IDs. Включён WB-082: последующий G005 явно подтвердил clear→30→persist, хотя старый баг-реестр остался в fixed locally. Это уточнение истории, не новый фикс. 32 старых verified без первичных файлов в это число не включены. Исторически открытое не объявляется свежевоспроизведённым. По дефектам остаются **50 незавершённых цепочек** (42 ретестов/границ и 8 open/reopened), плюс 32 вопросов восстановления доказательств.

## Что осталось проверить

| Сопоставление обязательств | Количество | Доля от 316 |
| --- | ---: | ---: |
| Узкое историческое свидетельство | 228 | 72.2% |
| Только документ; первичный файл не найден | 20 | 6.3% |
| Техническая проверка / блокер, не live PASS | 29 | 9.2% |
| Целевое свидетельство не найдено | 39 | 12.3% |

Эти группы не являются PASS/FAIL тестами: даже у пункта с доказательствами могут оставаться непроверенные варианты. **288/316 обязательств ещё не имеют полной приёмки текущего кандидата**; это не «100% приложения нужно написать заново». Для каждого пункта указан собственный остаток в [подробном разборе](./WEB_EVIDENCE_REVIEW.md). Общий процент оставшейся разработки и часов из этой истории вывести нельзя.

Ближайшая измеримая работа — принимать конечные наборы случаев по одному требованию. Исторические успешные случаи сохраняются; повторять их без изменения зависимости/среды не требуется. Точный процент исполнения атомарных тестов появляется после утверждения их конечной матрицы, а не из количества стадий или найденных багов.

## Что препятствует выпуску

- SECURITY: Прямые API/RPC, межролевые и межбизнесовые границы; закрыть серьёзные риски — open.
- LIFECYCLES: Запись, смена, пакет: полные переходы и однократные побочные эффекты — open.
- FINANCE: Независимые ожидаемые расчёты, сверка поверхностей и аудит — open.
- DEVICES: Реальные CSS viewport и изображения телефона/планшета/desktop, клавиатура — open.
- BASELINE: Полные обязательные проверки кандидата, сохранённые FAIL не скрывать — open.
- RELEASE: Состав кандидата, production smoke, восстановление и решение о выпуске — open.

Отдельно: G141 и G145 содержат суммарно 6 красных UNIT assertions, не 6 подтверждённых live-багов. Матрица устройств и screen reader не закрыта. Прежние baseline/coverage/lint FAIL сохранены; scoped PASS их не отменяет. Никакого нового GO: **NOT_READY**.

Источник: [единый реестр](./WEB_VERIFICATION_LEDGER.json), [проверки и остаток по каждому требованию](./WEB_EVIDENCE_REVIEW.md), [204 карточки дефектов](./WEB_HISTORICAL_DEFECTS.md), [метод](./WEB_VERIFICATION_METHOD.md). Первичные файлы не перемещались и не изменялись. Старые изображения инвентаризированы, но не выдаются за заново просмотренные visual/device PASS.

Проверка целостности и учёта: **PASS** — не проверка приложения. Автоматизация этим отчётом не возобновляется.
