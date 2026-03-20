## ADR: Telegram Login и линковка аккаунта

Дата: 2026‑03‑03  
Статус: принят  
Область: веб‑приложение (`apps/web`)

---

## 1. Задача

Обеспечить безопасную интеграцию с **Telegram Login Widget** и привязку Telegram‑аккаунта к профилю пользователя в системе, с учётом:

- корректной проверки подписи (`hash`) и свежести `auth_date`;
- понятного потока «логин через Telegram» и «линковка Telegram к существующему аккаунту»;
- минимизации рисков подделки данных и повторного использования устаревших payload’ов.

---

## 2. Потоки (фронт → бэкенд → БД)

### 2.1. Логин через Telegram (`/api/auth/telegram/login`)

1. **Фронт** (`TelegramLoginWidget.tsx`):
   - подключает Telegram Login Widget с нашим bot token;
   - по callback’у Telegram получает объект `TelegramAuthData` (id, username, auth_date, hash и т.п.);
   - отправляет его `POST /api/auth/telegram/login` в JSON.

2. **Бэкенд** (`apps/web/src/app/api/auth/telegram/login/route.ts`):
   - принимает `TelegramAuthData`;
   - валидирует, что есть `id`, `hash`, `auth_date`;
   - вызывает `verifyTelegramAuth(data)`:
     - собирает `data-check-string` по правилам Telegram (см. ниже);
     - проверяет `auth_date` (не старше 24ч);
     - проверяет подпись HMAC‑SHA256.
   - при успешной проверке:
     - ищет профиль по `profiles.telegram_id`;
     - если профиль есть → обновляет Telegram‑поля профиля;
     - если профиля нет → создаёт пользователя в Supabase Auth + запись в `profiles`.
   - генерирует временный пароль и, при необходимости, временный email для входа;
   - возвращает клиенту `{ email, password, redirect }`, которые клиент использует для фактического логина.

3. **БД**:
   - таблица `profiles` расширена полями `telegram_id`, `telegram_username`, `telegram_photo_url`, `telegram_verified`;
   - Supabase Auth хранит технический email/пароль, Telegram‑идентификаторы идут в `user_metadata` и `profiles`.

### 2.2. Линковка Telegram к текущему пользователю (`/api/auth/telegram/link`)

1. **Фронт** (`TelegramLinkWidget.tsx` / компоненты кабинета):
   - пользователь уже аутентифицирован в Kezek;
   - Telegram Login Widget отдаёт `TelegramAuthData`;
   - фронт отправляет его `POST /api/auth/telegram/link`.

2. **Бэкенд** (`apps/web/src/app/api/auth/telegram/link/route.ts`):
   - получает текущего пользователя через `supabase.auth.getUser()` (cookie‑сессия web);
   - валидирует payload по `telegramAuthDataSchema`;
   - проверяет подпись через `verifyTelegramAuth`;
   - проверяет, не привязан ли этот `telegram_id` к другому `profiles.id`;
   - если всё корректно:
     - обновляет `profiles` для текущего `user.id` (telegram_id, username, фото, verified);
     - обновляет `user_metadata` в Supabase Auth (telegram_id, telegram_username);
   - возвращает `ok`/сообщение об успехе.

3. **БД**:
   - запрещаем привязку одного и того же `telegram_id` к разным пользователям логикой в API;
   - в дальнейшем можно добавить уникальный индекс на `profiles.telegram_id` (если он ещё не добавлен).

---

## 3. Проверка подписи и `auth_date`

### 3.1. Алгоритм (официальная схема Telegram)

Реализация в `apps/web/src/lib/telegram/verify.ts` (`verifyTelegramAuth`):

1. **Проверка bot token:**
   - если `TELEGRAM_BOT_TOKEN` не задан, логируем ошибку и возвращаем `false`.

2. **Проверка свежести данных:**
   - считаем `nowSec = floor(Date.now() / 1000)`;
   - если `nowSec - auth_date > 86400` (24 часа) → логируем `Auth data expired`, возвращаем `false`.

3. **Формирование `data-check-string`:**
   - берём все пары `key=value` из объекта `TelegramAuthData`, **кроме** `hash`;
   - приводим значения к строке;
   - сортируем по `key` в алфавитном порядке;
   - склеиваем через `'\n'`, как в примере Telegram:
     - `auth_date=<auth_date>\nfirst_name=<first_name>\nid=<id>\nusername=<username>` и т.п.

4. **Секретный ключ и HMAC:**
   - `secretKey = SHA256(TELEGRAM_BOT_TOKEN)` (байтовый digest);
   - `hmac = HMAC_SHA256(checkString, secretKey)` в hex;
   - сравниваем `hmac === data.hash`.

5. **Результат:**
   - при несовпадении логируем `Invalid hash` (без утечки сенситивных данных) и возвращаем `false`;
   - при успехе — `true`.

### 3.2. Использование в API

- В `telegram/login` и `telegram/link` перед любой работой с БД:
  - проверяем, что `verifyTelegramAuth(payload) === true`;
  - при `false` возвращаем `createErrorResponse('validation', 'Неверная подпись данных Telegram', { code: 'invalid_signature' }, 400)`.

Так мы отделяем:

- низкоуровневую криптографию (в одном модуле `verifyTelegramAuth`);
- обработку HTTP‑ошибок (в роутерах).

---

## 4. Угрозы и то, как они закрываются

### 4.1. Подделка данных от клиента

**Угроза:** злоумышленник подставляет произвольные `id/username` и отправляет их на наш backend.

**Митигируется:**

- HMAC‑подпись с секретом, производным от `TELEGRAM_BOT_TOKEN`, известным только серверу и Telegram.
- Любой payload без корректной подписи отклоняется до обращения к БД.

### 4.2. Повторное использование старых payload’ов

**Угроза:** перехваченный payload используется повторно спустя долгое время.

**Митигируется:**

- проверка `auth_date` с окном 24ч;
- при необходимости окно можно сузить (напр., до 5–10 минут) без изменения протокола.

### 4.3. Привязка одного Telegram к нескольким аккаунтам

**Угроза:** один и тот же `telegram_id` оказывается привязан к разным пользователям.

**Митигируется:**

- в `/api/auth/telegram/link` проверяем `profiles` на наличие другого `id` с этим `telegram_id` и возвращаем `conflict`;
- при необходимости можно усилить уникальным индексом на `profiles.telegram_id`.

### 4.4. Утечка bot token

**Угроза:** если `TELEGRAM_BOT_TOKEN` уйдёт наружу, злоумышленник сможет генерировать валидные подписи.

**Митигируется:**

- bot token хранится только в переменных окружения backend;
- в логах не выводятся значения token/секретов/HMAC, только общие сообщения об ошибках.

---

## 5. Итоги и дальнейшие шаги

1. **Текущий статус:**
   - реализация проверки подписи и `auth_date` полностью соответствует официальной документации Telegram Login Widget;
   - потоки логина и линковки разделены и используют общий модуль `verifyTelegramAuth`;
   - базовые угрозы (подделка payload’а, reuse старых данных, дублирующая привязка) закрыты логикой в API и БД.

2. **Возможные улучшения:**
   - добавить уникальный индекс на `profiles.telegram_id`;
   - сузить допустимое окно по `auth_date`, если появятся требования;
   - при необходимости вести audit‑лог привязок/отвязок Telegram в отдельной таблице.

