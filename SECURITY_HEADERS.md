# HTTP security headers

Статус: справочник локальной конфигурации, сверено 1 ноября 2026. Фактические ответы deployed-сервера в этой задаче не читались.

Источник — [next.config.ts](apps/web/next.config.ts), функция headers с matcher /:path*. Прокси, CDN, окружение и версия deployment могут изменить наблюдаемый ответ; наличие массива в исходниках не является измерением production.

## Заданные значения

| Header | Значение в конфигурации |
| --- | --- |
| X-DNS-Prefetch-Control | on |
| Strict-Transport-Security | max-age=63072000; includeSubDomains; preload |
| X-Frame-Options | SAMEORIGIN |
| X-Content-Type-Options | nosniff |
| X-XSS-Protection | 1; mode=block |
| Referrer-Policy | origin-when-cross-origin |
| Permissions-Policy | camera=(), microphone=(), geolocation=(self) |
| Content-Security-Policy | Состав директив в исходнике; ключевые ограничения ниже |

CSP явно содержит unsafe-inline и unsafe-eval для scripts, unsafe-inline для styles, разрешённые домены карт, Telegram, Google, Supabase и Sentry. Поэтому описание «строгая политика без inline/eval» было бы неверно. Наличие HSTS preload в строке не является подтверждением регистрации домена в preload list.

## Изменение и подтверждение

Для изменения назвать ресурс/интеграцию и требуемую директиву, проверить фактические ответы и нужный пользовательский сценарий в разрешённой среде. Не добавлять широкий wildcard только для скрытия ошибки загрузки. Headers не заменяют auth, tenant checks, RLS или безопасный вывод данных.

В отчёте нужны версия приложения, выбранная среда, URL/метод, наблюдённые заголовки и результат сценария. Обработка чувствительных данных — [правила безопасности](apps/web/src/lib/SECURITY.md); известные прикладные риски — [реестр](docs/ENGINEERING_FINDINGS.md).
