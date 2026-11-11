# Mobile Google Auth: rollout и разбор отказов

Статус: runbook для отдельно разрешённого изменения; статическая сверка 2026-11-01. Runtime/provider verification: `NOT_RUN`. Владелец: mobile authentication / operations. Измеренные показатели и безопасный rollback target этим документом не установлены.

Конфигурация и различия callback — [EPIC2_CONFIG](MOBILE_GOOGLE_AUTH_EPIC2_CONFIG.md); границы эксплуатации — [Operations](OPERATIONS.md); открытые дефекты — [Engineering findings](ENGINEERING_FINDINGS.md).

## Текущий протокол (локальное исправление 2026-11-10)

[Google hook](../apps/mobile/src/screens/auth/hooks/useGoogleSignInFlow.ts) всегда использует kezek://auth/callback через Supabase OAuth и WebBrowser. [Client](../apps/mobile/src/lib/supabase.ts) работает с flowType: pkce, secure session storage и [native crypto](../apps/mobile/src/lib/authCrypto.ts). Старый EXPO_PUBLIC_MOBILE_GOOGLE_NATIVE_AUTH больше не выбирает redirect: helper остаётся для совместимости исходников, у этого flow consumer удалён.

[Root callback](../apps/mobile/src/navigation/useRootNavigationSession.ts) принимает только точный native URL с authorization code; SDK проверяет локальный verifier. Raw tokens, legacy exchange_code и глобальный pending recovery удалены. /auth/callback-mobile больше не переносит session. Возврат к старой сборке не является проверенным безопасным rollback. [Новый exchange contract](api/AUTH_AND_INTEGRATIONS.md) нужен Telegram/WhatsApp flows, а Google использует Supabase PKCE напрямую.

Локальные regressions/typecheck пройдены; provider configuration, physical-device callback, release build и deployment — **NOT_RUN**. Ни один flag не заменяет эту проверку.

## Перед отдельным rollout

1. Определить тестовую среду, проверяемую mobile build, конфигурацию Supabase/provider и допустимые аккаунты. Старые `[x]` настройки в других документах не являются evidence текущей среды.
2. Проверить согласованность новой миграции/клиентов и оставшиеся auth findings, включая legacy Widget. Не подменять это успешным happy-path smoke или уменьшением rollout cohort.
3. Сверить фактический callback/return URL и auth result на Android/iOS, отдельно cancel, retry, background/foreground, cold start, повтор callback и истечение сохранённого active-flow marker. В коде marker хранится 10 минут; это не срок session или OAuth code.
4. Проверить полноту телеметрии до оценки success rate. Установить baseline, допустимое отклонение и объём наблюдений для выбранного cohort. Прежнее окно «24 часа» — предлагаемая политика наблюдения, не доказанная достаточность выборки.
5. Назначить решение о распространении и остановке, указать проверенный rollback target. Если такого target нет, описать остановку/отложенный выпуск в используемом release-процессе; не объявлять `flag=false` универсальным исправлением.

Это требования для будущей проверки, не выполненная rollout-процедура и не разрешение публиковать сборку.

## Что действительно считает health-check

[healthCheckAlertsCronService.ts](../apps/web/src/lib/healthCheckAlertsCronService.ts) формирует `googleMobileAuth` из двух окон по 24 часа:

- warning при `currentFailed >= previousFailed × 1.5` и приросте не менее 5;
- error, если `success / (success + failed)` меньше 60% и упал минимум на 15 процентных пунктов относительно предыдущего окна;
- при нулевом числе success+failed success rate равен `null`. Started/cancelled не входят в знаменатель.

Это **константы реализации**, не измеренный SLO. Helper считает по event_type без фильтра source; ошибка count-запроса может превратиться в 0. Фактическое расписание cron и доставку alerts надо устанавливать отдельно — [CRON_SETUP](../CRON_SETUP.md).

Google hook отправляет события через [mobile analytics](../apps/mobile/src/lib/analytics.ts). HTTP ошибки записи подавляются. [Analytics endpoint](../apps/web/src/app/admin/api/analytics/track/route.ts) разрешает анонимно только небольшой набор публичных событий без Google auth types и получает пользователя через cookie client; поэтому наличие mobile emitters не доказывает сбор полной login funnel. Отсутствие alerts не означает отсутствие отказов.

При incident фиксируют build/platform/время, какой redirect реально выбран, stage сбоя и наличие данных в обоих окнах. Проверка конфигурации Google/Supabase должна быть привязана к целевой среде. Не публикуйте callback URL с token/code, session или credentials. Автоматическое переключение на legacy fallback из этого runbook исключено до устранения его рисков.

## Проверки кода для будущей разрешённой задачи

Команды соответствуют текущим [mobile](../apps/mobile/package.json) и [web](../apps/web/package.json) Jest scripts и запускаются из корня через pnpm. Они здесь **не выполнялись**, не заменяют provider/device smoke и не тождественны полному CI:

```powershell
pnpm --filter mobile test --runInBand --watchAll=false src/__tests__/screens/auth/SignInScreen.test.tsx
pnpm --filter mobile test --runInBand --watchAll=false src/__tests__/navigation/useRootNavigationSession.test.ts
pnpm --filter web test --runInBand --watchAll=false src/__tests__/lib/healthCheckAlertsCronService.test.ts
```

Выбор проверок и изоляция сети следуют [CONTRIBUTING](../CONTRIBUTING.md) и новой задаче. В API resolver есть production fallback даже для `NODE_ENV=test`; mocks и выбранный API origin должны быть проверены перед разрешённым запуском.
