# Настройка WhatsApp Cloud API для Kezek

## Шаг 1: Получение Access Token

1. Перейди в [Meta Developers](https://developers.facebook.com/apps/)
2. Выбери свое приложение
3. Перейди в **Настройки компании** → **Пользователи системы**
4. Создай или выбери пользователя системы
5. Выдай ему разрешения:
   - `whatsapp_business_messaging`
   - `whatsapp_business_management`
6. Сгенерируй **постоянный маркер доступа** (Long-lived token)
7. Скопируй токен и сохрани его

**Токен уже получен:**
```
EAAVWZCgp2rgQBQdFX7pl22Rvd6asRTfISYMEdd9qZCmVOjgX2n8l6gvnvTDhHRTvwZAXxdWZBHUn5T2AVGsvoJgvn0BMaBD6ZCGonLwcn5zLRJEZBiV6SF8B9ZCDtLeIZCkW6lWrwqZC6M9ZBZBa4TVRYd1RJdlhNXkhW4YrbYVg8r7MbshtSlhW7W3jxQAFLqeWw2BQQZDZD
```

## Шаг 2: Получение Phone Number ID

**Важно:** Есть два разных ID:
- **WhatsApp Business Account ID** - ID аккаунта (например: `1185726307058446`)
- **Phone Number ID** - ID конкретного номера телефона (другое число)

### Способ 1: Через Meta Developers (вручную)

1. В Meta Developers перейди в **WhatsApp** → **API Setup**
2. Создай или выбери **WhatsApp Business Account**
3. Добавь номер телефона (если еще не добавлен)
4. После регистрации номера найди **Phone number ID** (это числовой ID, например `123456789012345`)
5. Скопируй Phone Number ID

### Способ 2: Через API (автоматически)

Используй созданный endpoint для получения правильного Phone Number ID:

**Вариант A: Если у тебя есть Business Account ID:**
```
GET https://kezek.kg/api/whatsapp/get-phone-numbers?account_id=1185726307058446
```

**Вариант B: Автоматическое получение (рекомендуется):**
```
GET https://kezek.kg/api/whatsapp/get-business-account
```

Этот endpoint автоматически:
1. Получит список Business Accounts
2. Найдет номера телефонов для первого аккаунта
3. Покажет правильный Phone Number ID

**Результат будет содержать:**
- `phone_numbers[].id` - это и есть **WHATSAPP_PHONE_NUMBER_ID**
- `selected_account.id` - это **WHATSAPP_BUSINESS_ACCOUNT_ID** (если понадобится)

## Шаг 3: Настройка переменных окружения

Добавь в `.env.local` или `.env`:

```env
# WhatsApp Cloud API
WHATSAPP_ACCESS_TOKEN=EAAVWZCgp2rgQBQdFX7pl22Rvd6asRTfISYMEdd9qZCmVOjgX2n8l6gvnvTDhHRTvwZAXxdWZBHUn5T2AVGsvoJgvn0BMaBD6ZCGonLwcn5zLRJEZBiV6SF8B9ZCDtLeIZCkW6lWrwqZC6M9ZBZBa4TVRYd1RJdlhNXkhW4YrbYVg8r7MbshtSlhW7W3jxQAFLqeWw2BQQZDZD
WHATSAPP_PHONE_NUMBER_ID=910313308837894
WHATSAPP_VERIFY_TOKEN=kezek_whatsapp_verify
```

**Важно:** 
- `WHATSAPP_PHONE_NUMBER_ID` - это **НЕ** Business Account ID!
- Используй endpoint `/api/whatsapp/get-business-account` чтобы получить правильный Phone Number ID
- Phone Number ID - это ID конкретного номера телефона, а не аккаунта

**Пример:**
- ❌ Неправильно: `WHATSAPP_PHONE_NUMBER_ID=1185726307058446` (это Business Account ID)
- ✅ Правильно: `WHATSAPP_PHONE_NUMBER_ID=910313308837894` (это Phone Number ID из списка номеров)

**Текущие значения:**
- Access Token: `EAAVWZCgp2rgQBQdFX7pl22Rvd6asRTfISYMEdd9qZCmVOjgX2n8l6gvnvTDhHRTvwZAXxdWZBHUn5T2AVGsvoJgvn0BMaBD6ZCGonLwcn5zLRJEZBiV6SF8B9ZCDtLeIZCkW6lWrwqZC6M9ZBZBa4TVRYd1RJdlhNXkhW4YrbYVg8r7MbshtSlhW7W3jxQAFLqeWw2BQQZDZD`
- Phone Number ID: `910313308837894`
- Verify Token: `kezek_whatsapp_verify`

## Шаг 4: Настройка Webhook в Meta

1. В Meta Developers перейди в **WhatsApp** → **Настройка** → **Подписаться на Webhooks**
2. В поле **URL обратного вызова** укажи:
   ```
   https://kezek.kg/api/webhooks/whatsapp
   ```
   (или `https://your-domain.com/api/webhooks/whatsapp` для production)
3. В поле **Подтверждение маркера** укажи:
   ```
   kezek_whatsapp_verify
   ```
4. Нажми **Проверить и сохранить**
5. Meta отправит GET запрос на твой webhook для верификации
6. После успешной верификации выбери события для подписки:
   - `messages` - входящие сообщения
   - `message_template_status_update` - статусы шаблонов
   - `message_status` - статусы доставки сообщений

## Шаг 5: Тестирование

1. Отправь тестовое сообщение через **API Testing** в Meta Developers
2. Или создай бронирование в системе - уведомления должны отправляться через WhatsApp

## Структура проекта

- **`apps/web/src/lib/senders/whatsapp.ts`** - функция отправки сообщений через WhatsApp Cloud API
- **`apps/web/src/app/api/webhooks/whatsapp/route.ts`** - endpoint для обработки webhooks от Meta
- **`apps/web/src/app/api/notify/route.ts`** - интеграция WhatsApp в систему уведомлений

## Формат номеров телефонов

WhatsApp Cloud API требует номера в формате без `+`:
- Вход: `+996770574029`
- Отправка: `996770574029`

Функция `normalizePhoneToE164` уже обрабатывает это автоматически.

## Документация

- [WhatsApp Cloud API](https://developers.facebook.com/docs/whatsapp/cloud-api)
- [Webhooks Guide](https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks)

