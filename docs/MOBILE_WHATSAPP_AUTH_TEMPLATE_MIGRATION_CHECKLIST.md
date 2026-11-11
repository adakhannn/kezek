# Mobile WhatsApp: проверка замены OTP-шаблона

Статус: checklist для будущего отдельно разрешённого изменения конфигурации. Статическая сверка: 2026-11-01; provider/runtime verification: `NOT_RUN`. Владелец: authentication / operations. Прежние `[x]` от 1 мая не сопровождались ссылками на evidence и не считаются текущей приёмкой; ниже нет выполненных runtime gates.

Назначение — согласовать существующий mobile sender с новым provider template. Настройки: [provider setup](MOBILE_WHATSAPP_PROVIDER_SETUP.md), [WhatsApp reference](../WHATSAPP_SETUP.md). HTTP: [CLIENT_AND_AUTH_FLOWS](api/CLIENT_AND_AUTH_FLOWS.md). Изменение переменных не меняет код и не исправляет открытые auth defects из [Engineering findings](ENGINEERING_FINDINGS.md).

## Перед изменением

- [ ] Указаны целевая тестовая среда, ответственный за переключение и согласованный получатель; production не используется как default для smoke.
- [ ] Сохранено обезличенное подтверждение доступности нового шаблона именно отправляющему номеру/аккаунту: имя, точный язык, категория, состав body/button/header и порядок параметров, дата проверки. Реальные tokens/OTP не прикладываются.
- [ ] Зафиксированы прежние **все связанные настройки**, включая components JSON, flags и rollout, чтобы откат не смешал старое имя с новой схемой. Сами секретные значения остаются в разрешённом хранилище.

## Сопоставление с кодом

- [ ] Имя и язык заданы через `WHATSAPP_OTP_TEMPLATE_NAME` и `WHATSAPP_OTP_TEMPLATE_LANG`. Проверено, не сработают ли legacy fallback `WHATSAPP_AUTH_TEMPLATE_NAME` / `WHATSAPP_AUTH_TEMPLATE_LANGUAGE`.
- [ ] Полная схема нового шаблона сопоставлена с [mobile start builder](../apps/web/src/lib/whatsAppMobileStartRouteService.ts). Без custom JSON он посылает один body/text-параметр. Если контракт требует других компонентов, они должны быть представлены полностью; одного совпадения числа body-параметров недостаточно.
- [ ] `WHATSAPP_OTP_TEMPLATE_COMPONENTS_JSON`, если нужен, — валидный JSON-массив с `{{OTP_CODE}}` в нужных строковых значениях. Неверный JSON не останавливает настройку: код использует default payload, поэтому такой fallback нельзя принять за успешную миграцию.
- [ ] `WHATSAPP_OTP_TEMPLATE_TYPE=authentication` используется только как метка в metadata метрики. Оно не создаёт/одобряет шаблон и не добавляет authentication button payload.
- [ ] `WHATSAPP_OTP_HASH_SECRET`, отправляющий phone number ID и Graph API version согласованы с выбранной средой; их наличие не заменяет provider verification.

## Разрешённая проверка в тестовой среде

- [ ] `POST /api/auth/whatsapp/mobile/start` возвращает `{ok:true,data:{attemptId,maskedDestination,expiresAt}}`; attempt TTL по исходникам — 5 минут.
- [ ] Согласованный адресат получил реальное сообщение с ожидаемым шаблоном. Ответ provider API и доставка адресату отмечены отдельно; термин «dry-run сообщение» не используется.
- [ ] `POST /api/auth/whatsapp/mobile/verify` возвращает approved/exchangeCode для этой attempt, а отрицательные сценарии проверены отдельно: неверный код, истечение срока, повтор использования и блокировка попыток.
- [ ] Проверены retry/idempotency в нужном topology: [cache](../apps/web/src/lib/whatsAppMobileAuthIdempotency.ts) хранится в памяти процесса 5 минут, а не в общей durable storage.
- [ ] Результат session exchange оценён отдельно. Известный OPEN risk `/api/auth/mobile-exchange` не закрывается успешным happy path — [integration contract](api/AUTH_AND_INTEGRATIONS.md).

## Решение о rollout и откат

- [ ] До rollout определены допустимые значения send errors, verify failure rate и доли завершённых входов, источник метрик и наблюдаемое окно. Наличие счётчиков не доказывает полноту телеметрии — [Operations](OPERATIONS.md).
- [ ] Рассмотрены все OPEN auth risks, явно определены условия запрета/остановки rollout. Этот checklist не выдаёт разрешение на production.
- [ ] При отдельно разрешённом переключении сохранены фактическое время, версия deployment и набор изменённых **имён** конфигурации без секретов.
- [ ] При откате восстанавливается согласованный прежний набор name/language/components/type и flags/rollout; прежний provider template должен ещё быть пригоден. Одного возврата имени недостаточно.
- [ ] Перезапуск/deploy и повторный smoke выполняются по разрешённой задаче и [Operations](OPERATIONS.md). В incident notes сохраняются обезличенные статусы и provider error ID, а не OTP или credentials.

Checklist остаётся `NOT_RUN`, пока для конкретной среды нет датированного evidence. Наличие старого чекбокса, переменной или файла миграции не является таким evidence.
