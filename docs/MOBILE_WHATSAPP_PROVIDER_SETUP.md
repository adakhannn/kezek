# Mobile WhatsApp: подключение provider-конфигурации

Статус: текущий справочник потребителя конфигурации; статическая сверка 2026-11-01. Provider/runtime checks: `NOT_RUN`. Владелец: authentication / operations. Аккаунт Meta, действующие права token, номер, одобрение шаблона и rollout конкретной среды здесь не подтверждены.

Полный набор сценариев и env fallback — [WhatsApp setup](../WHATSAPP_SETUP.md); HTTP-контракт — [mobile auth flows](api/CLIENT_AND_AUTH_FLOWS.md); эксплуатация — [Operations](OPERATIONS.md). Этот документ уточняет подготовку **mobile OTP**, а не заменяет эти справочники или разрешает действия в production.

## Контракт, который нужно сопоставить с провайдером

| Настройка | Что делает код |
| --- | --- |
| `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID` | [Sender](../apps/web/src/lib/senders/whatsapp.ts) использует token для Graph API и ID отправляющего номера в `/{id}/messages` |
| `WHATSAPP_GRAPH_API_VERSION` | [Resolver](../apps/web/src/lib/whatsAppGraphApi.ts) принимает `vNN.N`, иначе fallback `v21.0`. Это кодовый default, не утверждение о поддержке версии у Meta |
| `WHATSAPP_OTP_TEMPLATE_NAME`, `WHATSAPP_OTP_TEMPLATE_LANG` | Приоритетный template contract; fallback соответственно `WHATSAPP_AUTH_TEMPLATE_NAME`, `WHATSAPP_AUTH_TEMPLATE_LANGUAGE`, затем язык `ru` |
| `WHATSAPP_OTP_TEMPLATE_COMPONENTS_JSON` | Mobile start принимает JSON-массив, рекурсивно заменяет `{{OTP_CODE}}` в строках. Отсутствующее или неверное значение даёт body с одним text-параметром. Кнопки/другие компоненты автоматически по категории не добавляются |
| `WHATSAPP_OTP_TEMPLATE_TYPE` | Парсер допускает `authentication`, иначе `utility`. Mobile start записывает это значение в metadata метрики; оно **не переключает структуру payload или категорию шаблона** |
| `WHATSAPP_OTP_HASH_SECRET` | Используется для hash OTP/телефона. В коде есть фиксированный dev fallback; отдельный server secret нужен в конфигурации целевой среды |
| `MOBILE_WHATSAPP_AUTH` и rollout | Учитываются [featureFlags.ts](../apps/web/src/lib/featureFlags.ts). Mobile default — `true`; rollout percent ограничивает start, общий flag — start/verify. Старые auth routes и общий exchange этим не отключаются |

Реализация payload и срока попытки — [whatsAppMobileStartRouteService.ts](../apps/web/src/lib/whatsAppMobileStartRouteService.ts); имена/fallback — [env.ts](../apps/web/src/lib/env.ts). Mobile OTP живёт 5 минут. Это не 10-минутный код legacy web/profile OTP.

`WHATSAPP_VERIFY_TOKEN` относится к GET handshake входящего webhook; это не подпись POST и не credential исходящей отправки. `WHATSAPP_WABA_ID` может потребоваться оператору в provider tooling, но текущие перечисленные sender/mobile OTP consumers его не читают. Нельзя подставлять WABA ID вместо phone number ID.

Для выбранной среды необходимо отдельно установить имя, язык, полный состав компонентов и их порядок по реально одобренному шаблону. Старое руководство 30 апреля называло `kezek_test` шаблоном с тремя body-параметрами: имя получателя, адрес/детали, контакт. Это **историческое описание без текущего provider evidence**, не готовый OTP default. Отправка одного OTP-параметра в трёхпараметрический контракт не согласуется со схемой; имя `kezek_test` нельзя считать подтверждённо одобренным сегодня.

## Диагностика и ротация

[GET `/api/whatsapp/diagnose`](../apps/web/src/app/api/whatsapp/diagnose/route.ts) не является локальной проверкой наличия env: [service](../apps/web/src/lib/whatsAppDiagnoseService.ts) делает реальные запросы к Graph API с серверным credential. HTTP envelope — `{ok:true,data:...}`; поля `tokenValid`, `hasBusinessAccounts`, `hasPhoneNumbers`, `phoneNumberIdValid` находятся в `data.summary`. Они не доказывают доставку OTP или готовность сессии. Ручная проверка через production URL не является шагом по умолчанию.

Для будущей разрешённой смены credentials оператор фиксирует среду, назначение и владельца нового token, период переключения и способ отката без раскрытия значений. После согласованного переключения проверяют только выбранный тестовый сценарий; старый credential отзывают после подтверждения перехода. Не следует объявлять token бессрочным по названию «permanent»: фактический срок и права устанавливает провайдер. Конкретные действия в интерфейсе Meta здесь не заданы, поскольку документ ограничен consumers репозитория.

Отправка тестового шаблона — реальное сообщение, не dry-run. Нужен согласованный тестовый адресат. Результат фиксируют без raw OTP, token, полного номера или session payload.

## Граница готовности

Проверка конфигурации сама не закрывает открытые дефекты: legacy `create-session` не связан с доказательством OTP, mobile-exchange не привязан к вызывающему браузеру/устройству, WhatsApp POST webhook не проверяет provider signature. Подробности — [auth flows](api/CLIENT_AND_AUTH_FLOWS.md), [integrations](api/AUTH_AND_INTEGRATIONS.md), [Engineering findings](ENGINEERING_FINDINGS.md).

Для отдельной разрешённой замены шаблона используйте [checklist](MOBILE_WHATSAPP_AUTH_TEMPLATE_MIGRATION_CHECKLIST.md). Его пункты являются требованиями проверки, а не уже выполненной приёмкой.
