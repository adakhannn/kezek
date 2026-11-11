# Mobile Google Auth: конфигурация приложения и среды

Статус: текущий source-справочник, сверка 2026-11-01. Google/Supabase settings, signing credentials и runtime: `NOT_RUN` / не проверены. Владелец: mobile authentication / operations. Старые галочки «credentials существуют» и «env checked» удалены как неподтверждённое состояние среды.

Этот документ описывает потребителей в репозитории, а не текущие шаги Google Cloud Console. Эксплуатационные решения — [rollout runbook](MOBILE_GOOGLE_AUTH_ROLLOUT_RUNBOOK.md), [Operations](OPERATIONS.md); общие правила переменных — [ENV_GUIDE](../ENV_GUIDE.md).

## Идентификаторы и callback

| Значение по исходникам | Источник и граница |
| --- | --- |
| Scheme `kezek` | [app.json](../apps/mobile/app.json); наличие scheme не доказывает обработку ссылки установленной сборкой |
| Native callback `kezek://auth/callback` | [useGoogleSignInFlow](../apps/mobile/src/screens/auth/hooks/useGoogleSignInFlow.ts); единственный redirect текущего Google hook |
| Android package `kg.kezek.app` | app.json; Android intent conversion web callback использует то же package |
| iOS bundle identifier `kg.kezek.app` | app.json; реальный signing/build отдельно |
| Android HTTPS app links | app.json содержит hosts `kezek.kg`, `www.kezek.kg`; provider/domain association runtime не проверялся |
| Legacy redirect | Удалён из Google hook; callback-mobile больше не переносит tokens. Старый клиент требует обновления |

Текущий вход вызывает `supabase.auth.signInWithOAuth({provider:'google', options:{redirectTo,skipBrowserRedirect:true}})`, затем `WebBrowser.openAuthSessionAsync`. Отдельный Google native SDK этой цепочкой не вызывается. После локального исправления 2026-11-10 native callback обязателен. Прежнее утверждение, что native callback — лишь будущая цель, устарело: он уже является кодовым default.

## Переменные и приоритеты

| Имя | Текущий consumer |
| --- | --- |
| `EXPO_PUBLIC_SUPABASE_URL` | [supabase.ts](../apps/mobile/src/lib/supabase.ts): приоритет перед `Constants.expoConfig.extra.supabaseUrl` |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Тот же client: приоритет перед `extra.supabaseAnonKey`; это публичный anon key, не service-role secret |
| `EXPO_PUBLIC_API_URL` | [apiUrl.ts](../apps/mobile/src/lib/apiUrl.ts): приоритет перед `extra.apiUrl`, проверка HTTP(S), удаление завершающих `/` |
| `EXPO_PUBLIC_APP_ENV` | API resolver распознаёт dev/development/stage/staging/test как non-production контекст |
| `EXPO_PUBLIC_MOBILE_GOOGLE_NATIVE_AUTH` | Legacy helper сохранён в [authFeatureFlags.ts](../apps/mobile/src/screens/auth/hooks/authFeatureFlags.ts), но Google flow больше не читает этот flag и не имеет token-bridge fallback |

`extra.*` содержит реальные кодовые fallback текущего app config, включая production API origin. Это не временное обещание «когда-нибудь удалить fallback»: пока значения существуют, отсутствие env может выбрать их. Если API URL не задан ни одним способом, resolver возвращает production URL при `NODE_ENV=test`, требует URL при strict non-production и иначе тоже использует production fallback. Для изолированного сценария нужно явно выбрать согласованный URL и исключить неожиданный network access.

Установка `EXPO_PUBLIC_API_URL` не выбирает Google redirect; текущий Google flow всегда использует native callback. Пустые переменные также не гарантируют изоляцию. Все `EXPO_PUBLIC_*` и `expo.extra` доступны клиенту; Google client secret, service-role key или provider token в них не помещают.

Supabase client использует [secure session storage](../apps/mobile/src/lib/secureSessionStorage.ts), `autoRefreshToken=true`, `persistSession=true`, `detectSessionInUrl=false`, `flowType=pkce`; Expo Crypto обеспечивает secure random и SHA256 в native runtime. Callback разбирается [root navigation session](../apps/mobile/src/navigation/useRootNavigationSession.ts). Эти настройки не подтверждают корректность полного OAuth flow в конкретной сборке.

## Что должно быть установлено отдельно для среды

| Проверка | Что зафиксировать без секретов |
| --- | --- |
| Supabase project | Выбранный проект, согласованность URL/anon key и API backend, даты проверки provider configuration |
| Google OAuth provider | Назначение credentials и связь с тем Supabase callback, который использует выбранный проект. Наличие Android/iOS идентификатора в app.json не доказывает создание OAuth client |
| Allowed redirects | Фактическое разрешение `kezek://auth/callback` в используемом Supabase flow и возврат в нужную установленную сборку |
| Platform build | Android package / iOS bundle ID, схема и способ установки проверяемой сборки |
| Signing fingerprints, если требуются выбранной provider configuration | Какой сертификат использует конкретная debug/release build и откуда получен fingerprint. Не приравнивать debug, локальный release и store app-signing certificate |
| Legacy callback | Не используется новым клиентом; не добавлять token-bridge callback как fallback ради прохождения smoke |

Google Android/iOS OAuth clients и SHA-1 могут относиться к другой provider/native SDK интеграции; текущая Supabase/browser цепочка не читает эти значения из mobile env. Поэтому старое правило «обязательно настроить оба SHA-1 и Android/iOS clients для всех запусков» не является подтверждённым контрактом consumers. Конкретную настройку provider выбирают и проверяют по его актуальной документации для используемого flow; команды чтения keystore и действия в provider console сюда не включены.

## Граница доверия и приёмки

[Google hook](../apps/mobile/src/screens/auth/hooks/useGoogleSignInFlow.ts) сохраняет active-flow marker на 10 минут; это UX marker, не срок OAuth token и не доказательство входа. Глобальный pending recovery удалён. Session требует authorization code и локальный PKCE verifier; raw token callbacks отклоняются. Локальные tests/typecheck пройдены, provider/build runtime — NOT_RUN. [Контракт и границы](api/AUTH_AND_INTEGRATIONS.md).

Готовность среды подтверждается отдельно на разрешённых Android/iOS устройствах: начало входа, callback, сохранение правильной session, cancel/retry и background/foreground. Требования и ограничения rollback — [rollout runbook](MOBILE_GOOGLE_AUTH_ROLLOUT_RUNBOOK.md). Эта документационная сверка не создавала credentials, не проверяла реальные env и не выполняла provider actions.
