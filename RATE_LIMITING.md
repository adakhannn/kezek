# Ограничение частоты API-запросов

Статус: reference. Сверено 2026-11-10. Владелец: Engineering / эксплуатация. Источник реализации — [rateLimit.ts](apps/web/src/lib/rateLimit.ts); вход — [OPERATIONS](docs/OPERATIONS.md). Фактические Redis и ingress deployment здесь не подтверждены.

Этот limiter применяется к выбранным handlers. Он не задаёт предел нагрузки приложения и не доказывает защиту от DDoS.

## Идентичность маршрута и квоты

Каждый `withRateLimit(req, config, handler, routeId)` требует явный стабильный шаблон пути. Ключ включает HTTP method, routeId, optional bounded sub-action `keyPrefix` и hash идентификатора. Query string и конкретный UUID вместо `[id]` не создают новую квоту. [AST inventory test](apps/web/src/__tests__/lib/rateLimitRouteInventory.test.ts) проверяет route callsites, включая `.tsx`. Новый маршрут должен передавать собственный шаблон, например:

```typescript
withRateLimit(req, RateLimitConfigs.normal, handler, '/api/example/[id]');
```

`routeRateLimit(subAction, base, overrides)` сохраняет возможность отдельного счётчика для ограниченного набора действий внутри одного endpoint. Нельзя строить subAction из произвольного query/body. `identifier` допустим для уже проверенной сервером личности; decoded JWT без проверки и пользовательские headers не являются verified identity.

| Пресет | Запросов | Окно | Применение |
| --- | ---: | ---: | --- |
| `public` | 10 | 60 секунд | Некоторые публичные endpoints |
| `critical` | 5 | 60 секунд | Критичные действия; scope определяется callsite |
| `normal` | 30 | 60 секунд | Обычные действия и отдельные telemetry routes |
| `auth` | 5 | 15 минут | Выбранные auth actions |
| `authenticatedIngress` | 600 | 60 секунд | Предварительный IP budget четырёх финансовых mutations ниже |

Методы и маршруты изолированы: telemetry не расходует budget auth или finance. Это не означает, что каждый endpoint проекта уже имеет limiter.

После verified staff/manager context четыре mutations — staff Open, Save, Close и manager Close — проверяют отдельные principal и tenant budgets. Principal key содержит verified user + business, tenant key — verified business. User quota: 5/min для Open/Close, 30/min для Save; tenant quota — user quota × 60. Обе квоты проверяются одной атомарной операцией. Отказ по одной не расходует другую: исчерпавший свою квоту пользователь не может повторными отказами потратить остаток коллег.

Предварительный ingress budget 600/min выше пользовательского: допускает до 120 полных critical user budgets либо 20 Save budgets за общим NAT на одном маршруте. Это начальная настройка защиты от частоты запросов, а не измеренная ёмкость или гарантия для любого офиса. Для большего NAT/бизнеса требуется согласованная настройка с наблюдением 429 и latency. Остальные authenticated endpoints могут пока иметь только ingress или существующий per-user limiter; не переносить указанные четыре post-auth guarantees на весь API.

## Доверенный ingress обязателен для IP limits в production

`RATE_LIMIT_TRUSTED_IP_HEADER` должен явно выбирать один из: `x-forwarded-for`, `x-real-ip`, `cf-connecting-ip`, `x-vercel-forwarded-for`. Принимается только один валидный IPv4/IPv6; произвольная цепочка адресов не разбирается по первому элементу. При отсутствующей/неизвестной policy или некорректном адресе production IP-limit возвращает 503 до Redis и handler.

**Имя переменной не делает заголовок доверенным.** Оператор должен подтвердить, что единственный допустимый ingress удаляет/перезаписывает клиентское значение, и прямой доступ к приложению в обход него закрыт. До этой проверки production readiness лимитера остаётся открытой. Значения секретов и ingress policy кодовые изменения не устанавливают.

В non-production без policy используется общий `development-local` identifier; поддельные forwarding headers также не считаются trusted IP. Для точных synthetic tests задаётся явная test policy.

`getRateLimitIdentifier` сохранён отдельно как compatibility helper для mobile auth attempt fingerprints (старый порядок forwarded/real/cloudflare/unknown). Он больше не выбирает идентификатор limiter. Его результат не доказывает принадлежность IP; смена схемы fingerprint требует отдельного согласованного auth protocol изменения.

## Redis, атомарность и отказ

Для общего хранилища нужны `UPSTASH_REDIS_REST_URL` и `UPSTASH_REDIS_REST_TOKEN`. Установленный SDK указан в [web package.json](apps/web/package.json). Один `EVAL` выполняет проверку budgets, `INCR`, `PEXPIRE`, `PTTL`; orphan counter без expiry получает TTL, действующее окно не продлевается. Counters разных scopes используют разные namespaces.

SDK retries и auto-pipelining отключены, telemetry SDK отключена; deadline — 1000 ms с AbortController и отдельным ограничением ожидания. Ошибка конфигурации/SDK/Redis, timeout или некорректный ответ дают 503 до handler. **Production никогда не переключается на process-local memory.** Настроенный, но неработающий Redis также не подменяется памятью в development.

Только non-production без обеих Redis variables использует Map. Она ограничена 10 000 ключей; при заполнении удаляются истёкшие записи, активные не вытесняются ради нового ключа. Если места нет — 503. Состояние локально процессу и не предназначено для production, многопроцессной ёмкости или сохранения лимитов после restart.

Контракт SDK сверялся по установленным types и первичным источникам: [EVAL](https://upstash.com/docs/redis/sdks/ts/commands/scripts/eval), [timeout](https://upstash.com/docs/redis/sdks/ts/advanced), [retries](https://upstash.com/docs/redis/sdks/ts/retries). Это проверка API SDK, а не запрос к живому Upstash.

## Ответы и проверка

Превышение budget — 429, `error: rate_limit_exceeded`; недоступность проверки — 503, `error: service_unavailable`. Ответ содержит `retryAfter`, `Retry-After`, `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`. Более узкие headers внутреннего authenticated guard сохраняются внешней обёрткой. Наличие headers само по себе не доказывает использование Redis.

[Unit tests](apps/web/src/__tests__/lib/rateLimit.test.ts) проверяют timeout, failures, memory cap, trusted header policy, NAT scopes и wire invocation. [Finance guard tests](apps/web/src/__tests__/lib/financeRateLimitGuards.test.ts) проверяют проверенную identity и отказ до financial command. [Auth isolation tests](apps/web/src/__tests__/api/authRateLimitIsolation.test.ts) проверяют раздельные actions. [Disposable Redis runner](scripts/test-rate-limit-isolated.mjs) выполняет настоящий Lua с конкурентными запросами, orphan TTL и shared-tenant случаями в Redis 7: `--network none`, без host ports/credentials, cleanup контейнера. Команда для отдельно разрешённой локальной проверки:

```bash
node scripts/test-rate-limit-isolated.mjs
```

При неожиданном 429 проверяют route/method/scope, общий NAT, размер окна и фактические quotas. При 503 — наличие shared Redis, deadline и подтверждённый ingress. Секреты, raw IP и полные пользовательские identifiers в diagnostic report не включать. Burst реальных booking/OTP/finance handlers не является разрешённой проверкой по умолчанию; deployment/provider и нагрузочные проверки требуют своей среды и явного scope.
