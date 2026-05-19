# Mobile Bugfix Tasks (2026-05-19)

## Цель
Стабилизировать мобильное приложение `apps/mobile` по итогам deep-аудита: восстановить надежный quality-gate, убрать риски в auth/deeplink/offline и улучшить сетевую устойчивость.

## Принципы выполнения
1. Исправления идут от критичных к средним.
2. Каждый блок закрывается только после проверки командами.
3. Изменения делаем малыми PR/коммитами, чтобы быстро откатывать при риске регрессии.

## P0 (Критично)

### 1) Починить `typecheck` как обязательный quality-gate
Статус: `done` (2026-05-19)

Задачи:
1. Добавить типы для Jest (`@types/jest`) в `apps/mobile`. ✅
2. Обновить `apps/mobile/tsconfig.json`: ✅
   - добавить `compilerOptions.types` c `jest` и `node` для тестового окружения;
   - при необходимости вынести тесты в отдельный `tsconfig.test.json`.
3. Исправить обращения к `Constants.manifest?.extra` на типобезопасный путь для Expo 54: ✅
   - `apps/mobile/src/lib/api.ts`
   - `apps/mobile/src/lib/supabase.ts`
   - `apps/mobile/src/navigation/useRootNavigationSession.ts`
   - `apps/mobile/src/screens/auth/WhatsAppScreen.tsx`
   - `apps/mobile/src/utils/debug.ts`
4. Убедиться, что `pnpm -C apps/mobile typecheck` проходит без ошибок. ✅

Критерии готовности:
1. `typecheck` зеленый локально и в CI. ✅ (локально подтверждено: `corepack pnpm -C apps/mobile typecheck`)
2. Нет TS-игноров, скрывающих реальные ошибки runtime-кода. ✅

### 2) Убрать двойную обработку deep-link auth callback
Статус: `done` (2026-05-19)

Задачи:
1. Выбрать единый источник обработки входящих URL: ✅
   - либо только `linking.subscribe`,
   - либо только listener в `useRootNavigationSession`.
2. Удалить дублирующий путь, не ломая текущие auth-сценарии. ✅
3. Добавить/обновить тесты на единичную обработку callback: ✅
   - исключить повторные `exchangeViaMobileApi`/`setSessionFromTokens` для одного URL.

Критерии готовности:
1. Один callback обрабатывается один раз. ✅
2. `useRootNavigationSession` тесты проходят. ✅

## P1 (Высокий)

### 3) Усилить offline/online определение сети
Статус: `done` (2026-05-19)

Задачи:
1. В `useNetworkStatus` учитывать одновременно: ✅
   - `isConnected`
   - `isInternetReachable`
2. Пересчитать `isOffline` на основе обоих признаков. ✅
3. Добавить тесты/кейсы на `connected=true + internetReachable=false`. ✅

Критерии готовности:
1. UI не показывает ложный online при недоступном интернете. ✅
2. Ошибки сетевых операций в таких кейсах сокращаются. ✅

### 4) Добавить timeout/cancel для критичных auth fetch
Статус: `done` (2026-05-19)

Задачи:
1. Вынести helper для `fetch` с `AbortController` и таймаутом. ✅
2. Подключить его в: ✅
   - mobile exchange check/start/verify;
   - WhatsApp start/verify.
3. Нормализовать пользовательские ошибки по таймауту. ✅

Критерии готовности:
1. Нет зависающих бесконечных загрузок. ✅
2. Пользователь получает понятный timeout message. ✅

### 5) Защитить offline bookings storage от лимитов SecureStore
Статус: `done` (2026-05-19)

Задачи:
1. Внедрить chunking для `offlineBookingsStorage` (по аналогии с auth storage). ✅
2. Добавить безопасный fallback при частичной потере chunk-данных. ✅
3. Добавить тесты на большой payload и восстановление после неполных данных. ✅

Критерии готовности:
1. Большой кэш бронирований сохраняется стабильно. ✅
2. Нет silent-failure при записи/чтении. ✅

## P2 (Средний)

### 6) Убрать жесткие прод-фоллбеки API URL
Статус: `done` (2026-05-20)

Задачи:
1. Вынести единый резолвер API URL в один модуль. ✅
2. Убрать дублирование `https://kezek.kg` из разных файлов. ✅
3. В dev/stage добавить защиту от неявного ухода в production. ✅

Критерии готовности:
1. Окружение определяется предсказуемо. ✅
2. Нет случайных prod-вызовов при локальной ошибке env. ✅

### 7) Нормализовать команды тестирования
Статус: `done` (2026-05-20)

Задачи:
1. Зафиксировать корректный формат запуска в документации и package scripts: ✅
   - `pnpm -C apps/mobile test --runInBand`
2. Добавить в README примечание про некорректный `-- --runInBand`. ✅
3. Проверить, что CI использует корректную форму команды. ✅

Критерии готовности:
1. Нет ложных падений "No tests found" из-за аргументов. ✅

## Порядок реализации (рекомендуемый)
1. P0.1 `typecheck`
2. P0.2 deeplink dedupe
3. P1.3 network status
4. P1.4 auth timeout/cancel
5. P1.5 offline storage hardening
6. P2.6 API URL resolver
7. P2.7 test command cleanup

## Команды проверки после каждого этапа
1. `node scripts/check-mobile-utf8.mjs`
2. `corepack pnpm -C apps/mobile typecheck`
3. `corepack pnpm -C apps/mobile test --runInBand`

## Definition of Done (общий)
1. Все задачи P0 и P1 закрыты.
2. P2 закрыты или явно перенесены в backlog с рисками.
3. Все проверки зеленые локально.
4. Обновлена документация в `apps/mobile/README.md` при изменении dev-flow.
