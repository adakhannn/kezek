# Telegram Mobile Deep-Link + One-Time Code: Task List

## Цель
Реализовать вход в мобильное приложение через Telegram Bot deep-link и одноразовый код без обязательного прохождения через веб-виджет Telegram Login Widget.

## Целевой UX (MVP)
1. Пользователь нажимает `Войти через Telegram` в мобильном приложении.
2. Открывается Telegram-бот с командой `/login <nonce>` (или кнопкой `Подтвердить вход`).
3. Пользователь подтверждает вход в боте.
4. Бэкенд связывает Telegram-подтверждение с `nonce` и выпускает одноразовый `exchange_code`.
5. Мобильное приложение получает статус по `nonce`, обменивает `exchange_code` на сессию и авторизует пользователя.

---

## Эпик 1. Backend: session exchange через nonce

- [x] Добавить новый endpoint `POST /api/auth/telegram/mobile/start`
  - генерирует `nonce` (короткоживущий, одноразовый, криптостойкий);
  - сохраняет `nonce` в хранилище auth-attempts (TTL, статус `pending`);
  - возвращает payload для клиента: `nonce`, `botDeepLink`, `expiresAt`.
- [x] Добавить endpoint `GET /api/auth/telegram/mobile/status?nonce=...`
  - `pending` / `approved` / `expired` / `failed`;
  - при `approved` возвращает `exchange_code` (одноразовый, короткий TTL).
- [x] Добавить endpoint для бота `POST /api/auth/telegram/mobile/confirm`
  - валидация подписи/секрета между ботом и сервером;
  - подтверждение конкретного `nonce` от конкретного `telegram_id`;
  - создание/поиск пользователя и подготовка mobile exchange.
- [x] Интегрировать с текущим `mobile-exchange` сервисом:
  - использовать существующую модель выдачи `access/refresh` по коду;
  - не дублировать логику сессий.
- [x] Добавить rate limiting и anti-bruteforce:
  - лимиты на `start`, `status`, `confirm`;
  - защита от перебора `nonce`.

## Эпик 2. Telegram Bot flow

- [x] Определить формат deep-link payload для бота (`/start <token>`).
  - Формат v1: `km1_<nonce>`
  - Допустимые символы payload: `A-Za-z0-9_-` (Telegram-safe)
  - Пример deep-link: `https://t.me/<bot_username>?start=km1_<nonce>`
- [x] Реализовать в боте сценарий подтверждения входа:
  - показать источник входа (app name, время, регион/устройство при наличии);
  - кнопка `Подтвердить вход` / `Отменить`.
- [x] Реализовать callback в backend на подтверждение:
  - передача `telegram_id`, `nonce`, `decision`.
- [x] Добавить проверку привязки Telegram аккаунта:
  - если пользователь существует — использовать его;
  - если нет — создать новый профиль по текущим правилам проекта.
- [x] Добавить audit-лог событий авторизации через бота.

## Эпик 3. Mobile app flow (Expo / RN)

- [x] Добавить новый flow в `SignInScreen`:
  - `startTelegramMobileLogin()` вызывает `/mobile/start`;
  - открывает `botDeepLink` через `Linking.openURL(...)`.
- [x] Добавить polling `status` по `nonce` с таймаутом:
  - интервал 2-3 сек, общий timeout 2-3 мин;
  - статусы UI: `Ожидаем подтверждение`, `Подтверждено`, `Истекло`.
- [x] При `approved` выполнить exchange и установить сессию Supabase.
- [x] Добавить кнопку `Открыть Telegram снова` и `Отменить вход`.
- [x] Добавить recovery после возврата из фона:
  - продолжать polling по активному `nonce`;
  - корректно завершать flow после рестарта экрана.

## Эпик 4. Безопасность и инварианты

- [x] `nonce` одноразовый, с TTL (например 5 минут), после use -> `consumed`.
- [x] `exchange_code` одноразовый, с TTL (например 1-2 минуты).
- [x] Подпись/секрет между ботом и API, защита от replay.
- [x] Идемпотентность подтверждения (`confirm`) и обмена сессии.
- [x] Маскирование чувствительных полей в логах.

## Эпик 5. Данные и миграции

- [x] Создать таблицу `telegram_mobile_auth_attempts` (или эквивалент):
  - `nonce`, `status`, `telegram_id`, `user_id`, `exchange_code`, `expires_at`, `consumed_at`, `created_at`.
- [x] Индексы:
  - unique РїРѕ `nonce`;
  - индекс по `status` + `expires_at` для фоновой очистки.
- [x] Добавить cron/cleanup просроченных попыток.

## Эпик 6. Тесты

- [x] Unit тесты:
  - генерация/валидация `nonce`, TTL, consume-once.
- [x] API тесты:
  - `start`, `status`, `confirm`, invalid/expired/consumed сценарии.
- [x] Интеграционные тесты:
  - полный happy-path Telegram -> mobile session;
  - повторный клик confirm;
  - race conditions и сетевые повторы.
- [x] Mobile smoke:
  - успешный вход;
  - cancel timeout;
  - возврат из фона.

## Эпик 7. Наблюдаемость и операционка

- [x] Метрики:
  - `telegram_mobile_login_started`, `approved`, `expired`, `failed`.
- [x] Алерты:
  - рост `failed`/`expired`, падение `approved rate`.
- [x] Дашборд в мониторинге auth-потока.

## Эпик 8. Rollout

- [x] Feature flag `mobile_telegram_deeplink_auth`.
- [x] Поэтапный rollout:
  - internal -> staging -> % production -> 100%.
  - Реализовано через env:
    - `MOBILE_TELEGRAM_DEEPLINK_AUTH=true` для включения;
    - `MOBILE_TELEGRAM_DEEPLINK_AUTH_ROLLOUT_PERCENT=0..100` для % раскатки в production;
    - `100` (или unset) = полный rollout.
- [x] План отката:
  - быстрый возврат на текущий web-widget flow.
  - Активация отката (без релиза mobile):
    - backend: `MOBILE_TELEGRAM_DEEPLINK_AUTH=false` (или `MOBILE_TELEGRAM_DEEPLINK_AUTH_ROLLOUT_PERCENT=0`);
    - mobile fallback: при `503` на `/api/auth/telegram/mobile/start` приложение открывает `https://<domain>/auth/sign-in?redirect=/auth/callback-mobile?redirect=kezek://auth/callback`.
  - Возврат после инцидента:
    - включить обратно `MOBILE_TELEGRAM_DEEPLINK_AUTH=true`;
    - раскатить процент через `MOBILE_TELEGRAM_DEEPLINK_AUTH_ROLLOUT_PERCENT` (например 10 -> 25 -> 50 -> 100).

---

## Приоритеты (предложение)

### P0 (MVP, обязательно)
- [x] Эпики 1-4 (минимальная безопасная реализация).
- [x] Базовые интеграционные тесты happy-path + expired nonce.

### P1 (после запуска)
- [x] Полная observability, расширенные тесты гонок/идемпотентности.
- [ ] UX улучшения (прогресс, локализация сообщений, troubleshooting hints).

---

## Definition of Done

- [x] Пользователь может войти через Telegram без обязательного web-widget flow.
- [x] Сессия в мобильном приложении создается только через одноразовый код обмена.
- [x] Нет повторного использования `nonce`/`exchange_code`.
- [x] Покрыты основные негативные сценарии (timeout, replay, network retry).
- [x] Включены метрики и безопасные логи.

### Текущий блокер в CI/локально

- [x] Починить запуск mobile unit/smoke тестов и повторно прогнать `SignInScreen` smoke.
  - Выполнено: тест `apps/mobile/src/__tests__/screens/auth/SignInScreen.test.tsx` проходит (`5 passed`).

---

## Staging Drill (2026-04-24)

### Автоматизированная часть (локально/CI parity)

- [x] Mobile unit/smoke suite:
  - `npm --prefix apps/mobile test -- --runInBand`
  - Результат: `16 passed, 16 total` / `43 passed`.
- [x] Web Telegram mobile auth API/integration:
  - `npm --prefix apps/web test -- --runInBand src/__tests__/api/auth/telegram-mobile-start.test.ts src/__tests__/api/auth/telegram-mobile-status.test.ts src/__tests__/api/auth/telegram-mobile-confirm.test.ts src/__tests__/api/auth/telegram-mobile-callback.test.ts src/__tests__/api/auth/telegram-mobile-integration.test.ts`
  - Результат: `5 passed, 5 total` / `30 passed`.

### Ручной staging drill (обязателен перед 100% rollout)

- [ ] Happy-path:
  - `MOBILE_TELEGRAM_DEEPLINK_AUTH=true`;
  - `MOBILE_TELEGRAM_DEEPLINK_AUTH_ROLLOUT_PERCENT=100`;
  - вход в mobile через Telegram deep-link завершается созданием сессии.
- [ ] Expired nonce:
  - начать login, дождаться TTL;
  - `status=expired`, UI показывает истечение, повторный вход доступен.
- [ ] Rollback drill:
  - выставить `MOBILE_TELEGRAM_DEEPLINK_AUTH=false` (или rollout `0`);
  - убедиться, что `POST /api/auth/telegram/mobile/start` возвращает `503`;
  - mobile автоматически уходит в web-widget fallback (`/auth/sign-in?redirect=/auth/callback-mobile?...`).
- [ ] Recovery after rollback:
  - вернуть `MOBILE_TELEGRAM_DEEPLINK_AUTH=true`;
  - включить rollout обратно по шагам `10 -> 25 -> 50 -> 100`;
  - подтвердить стабильный `approved rate` и отсутствие всплеска `failed/expired`.








