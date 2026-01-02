# Как получить API ключи для уже подключенного WhatsApp Business Account

## Шаг 1: Получение Access Token (Long-lived token)

### Вариант A: Через Meta Developers (рекомендуется)

1. Перейди в [Meta Developers](https://developers.facebook.com/apps/)
2. Выбери приложение, связанное с WhatsApp Business Account
   - Если приложения нет, создай новое:
     - Нажми **"Создать приложение"**
     - Выбери тип **"Бизнес"**
     - Назови приложение (например, "Kezek WhatsApp")
3. В левом меню выбери **WhatsApp** → **API Setup**
4. Убедись, что подключен правильный WhatsApp Business Account (ID: `829309533409879`)
5. Перейди в **Настройки** → **Пользователи системы** (System Users)
6. Создай нового пользователя системы:
   - Нажми **"Добавить"** или **"Создать пользователя системы"**
   - Введи имя (например, "Kezek WhatsApp Bot")
   - Выбери роль: **"Разработчик"** или **"Администратор"**
7. Выдай пользователю разрешения:
   - `whatsapp_business_messaging` - для отправки сообщений
   - `whatsapp_business_management` - для управления аккаунтом
8. Сгенерируй **Long-lived token** (постоянный токен):
   - Нажми на пользователя системы
   - Нажми **"Создать токен"** или **"Generate Token"**
   - Выбери приложение (если несколько)
   - Выбери разрешения:
     - ✅ `whatsapp_business_messaging`
     - ✅ `whatsapp_business_management`
   - Нажми **"Создать токен"**
   - **ВАЖНО:** Скопируй токен сразу! Он показывается только один раз
   - Токен будет выглядеть примерно так: `EAAVWZCgp2rgQBQdFX7pl22Rvd6asRTfISYMEdd9qZCmVOjgX2n8l6gvnvTDhHRTvwZAXxdWZBHUn5T2AVGsvoJgvn0BMaBD6ZCGonLwcn5zLRJEZBiV6SF8B9ZCDtLeIZCkW6M9ZBZBa4TVRYd1RJdlhNXkhW4YrbYVg8r7MbshtSlhW7W3jxQAFLqeWw2BQQZDZD`

### Вариант B: Через Graph API Explorer (временно, для тестирования)

1. Перейди в [Graph API Explorer](https://developers.facebook.com/tools/explorer/)
2. Выбери приложение
3. Выбери разрешения: `whatsapp_business_messaging`, `whatsapp_business_management`
4. Нажми **"Generate Access Token"**
5. Скопируй токен (это временный токен, действует ~1-2 часа)

## Шаг 2: Получение Phone Number ID

### Способ 1: Через Meta Developers (вручную)

1. В Meta Developers перейди в **WhatsApp** → **API Setup**
2. Найди раздел **"Phone number ID"** или **"Номер телефона"**
3. Должен быть виден номер **+996 224 701 717**
4. Рядом с номером будет **Phone Number ID** (числовой ID, например `910313308837894`)
5. Скопируй этот ID

### Способ 2: Через API (автоматически)

Используй созданный endpoint с полученным Access Token:

```bash
# Вариант A: Автоматическое получение всех аккаунтов и номеров
GET https://kezek.kg/api/whatsapp/get-business-account
Authorization: Bearer YOUR_ACCESS_TOKEN
```

Или если знаешь Business Account ID (`829309533409879`):

```bash
# Вариант B: Получение номеров для конкретного аккаунта
GET https://kezek.kg/api/whatsapp/get-phone-numbers?account_id=829309533409879
Authorization: Bearer YOUR_ACCESS_TOKEN
```

**В ответе найди:**
```json
{
  "phone_numbers": [
    {
      "id": "910313308837894",  // ← Это WHATSAPP_PHONE_NUMBER_ID
      "display_phone_number": "+996 224 701 717",
      "verified_name": "Kezek",
      "status": "CONNECTED"
    }
  ]
}
```

### Способ 3: Через Graph API напрямую

```bash
# Получить список номеров для Business Account
GET https://graph.facebook.com/v21.0/829309533409879/phone_numbers?access_token=YOUR_ACCESS_TOKEN
```

**Ответ:**
```json
{
  "data": [
    {
      "id": "910313308837894",  // ← Это WHATSAPP_PHONE_NUMBER_ID
      "display_phone_number": "+996 224 701 717",
      "verified_name": "Kezek"
    }
  ]
}
```

## Шаг 3: Обновление переменных окружения

После получения токена и Phone Number ID, обнови переменные:

### Локально (`.env.local`):

```env
# WhatsApp Cloud API
WHATSAPP_ACCESS_TOKEN=твой_long_lived_token_здесь
WHATSAPP_PHONE_NUMBER_ID=910313308837894
WHATSAPP_VERIFY_TOKEN=kezek_whatsapp_verify
```

### В продакшене (Vercel/другой хостинг):

1. Перейди в настройки проекта
2. Найди раздел **Environment Variables** или **Переменные окружения**
3. Добавь или обнови:
   - `WHATSAPP_ACCESS_TOKEN` = твой токен
   - `WHATSAPP_PHONE_NUMBER_ID` = `910313308837894` (или тот, который получил)
   - `WHATSAPP_VERIFY_TOKEN` = `kezek_whatsapp_verify`

## Шаг 4: Проверка конфигурации

После обновления переменных, проверь через диагностический endpoint:

```bash
GET https://kezek.kg/api/whatsapp/diagnose
```

Или через тестовый endpoint:

```bash
GET https://kezek.kg/api/whatsapp/test
```

Оба endpoint покажут:
- ✅ Есть ли Access Token
- ✅ Есть ли Phone Number ID
- ✅ Соответствует ли Phone Number ID реальному номеру
- ✅ Статус номера (должен быть "CONNECTED")

## Шаг 5: Настройка Webhook (если еще не настроен)

1. В Meta Developers перейди в **WhatsApp** → **Настройка** → **Подписаться на Webhooks**
2. В поле **URL обратного вызова** укажи:
   ```
   https://kezek.kg/api/webhooks/whatsapp
   ```
3. В поле **Подтверждение маркера** укажи:
   ```
   kezek_whatsapp_verify
   ```
4. Нажми **Проверить и сохранить**
5. Выбери события:
   - ✅ `messages` - входящие сообщения
   - ✅ `message_status` - статусы доставки

## Важные моменты

1. **Access Token:**
   - Long-lived token действует ~60 дней
   - После истечения нужно сгенерировать новый
   - Или настроить автоматическое обновление через API

2. **Phone Number ID:**
   - Это **НЕ** Business Account ID (`829309533409879`)
   - Это ID конкретного номера телефона (например, `910313308837894`)
   - Один Business Account может иметь несколько номеров, у каждого свой Phone Number ID

3. **Права доступа:**
   - Убедись, что у тебя есть права администратора на WhatsApp Business Account
   - System User должен иметь разрешения `whatsapp_business_messaging` и `whatsapp_business_management`

## Если что-то не работает

1. Проверь логи сервера
2. Используй `/api/whatsapp/diagnose` для диагностики
3. Убедись, что:
   - Access Token актуален и не истек
   - Phone Number ID правильный (не Business Account ID)
   - Номер имеет статус "Подключено" (CONNECTED)
   - Webhook настроен и верифицирован

---

**Последнее обновление:** 2025-01-06

