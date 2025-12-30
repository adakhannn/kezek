# Исправление WhatsApp Phone Number ID

## Проблема
В переменной окружения установлен **WhatsApp Business Account ID** вместо **Phone Number ID**:
```
WHATSAPP_PHONE_NUMBER_ID=1185726307058446  ❌ (это Business Account ID)
```

## Решение (выбери один способ)

### Способ 1: Через Meta Developers Dashboard (САМЫЙ ПРОСТОЙ) ⭐

1. Зайди в [Meta Developers](https://developers.facebook.com/apps/)
2. Выбери свое приложение
3. Перейди в **WhatsApp** → **API Setup**
4. В разделе **"From"** найди свой номер телефона
5. Рядом с номером будет показан **Phone number ID** (это числовой ID, например: `123456789012345`)
6. Скопируй этот ID
7. Обнови `WHATSAPP_PHONE_NUMBER_ID` в Vercel этим значением

**Важно:** Это НЕ то же самое, что "WhatsApp Business Account ID"!

### Способ 2: Через Graph API Explorer

1. Зайди в [Graph API Explorer](https://developers.facebook.com/tools/explorer/)
2. Выбери свое приложение
3. В поле "Access Token" вставь свой `WHATSAPP_ACCESS_TOKEN`
4. В поле "GET" введи: `/1185726307058446/phone_numbers`
5. Нажми "Submit"
6. В ответе найди массив `data` и скопируй значение `id` из первого элемента
7. Обнови `WHATSAPP_PHONE_NUMBER_ID` в Vercel этим значением

### Способ 3: Через наш API endpoint (требует разрешения business_management)

Если у токена есть разрешение `business_management`:

1. Открой: `https://kezek.kg/api/whatsapp/get-business-account`
2. В ответе найди `phone_numbers[].id`
3. Скопируй это значение
4. Обнови `WHATSAPP_PHONE_NUMBER_ID` в Vercel

**Если получаешь ошибку "Missing Permission":**
- Нужно добавить разрешение `business_management` к токену
- Или используй Способ 1 (самый простой)

## Проверка

После обновления открой:
```
https://kezek.kg/api/whatsapp/test
```

Должно показать:
- ✅ `WHATSAPP_PHONE_NUMBER_ID_VALID: true`
- ✅ `configured: true`

## Тестирование

1. Зайди в `/cabinet/profile`
2. Включи WhatsApp уведомления
3. Нажми "Отправить код"
4. Должен прийти OTP код на WhatsApp

## Разница между ID

- **WhatsApp Business Account ID** (`1185726307058446`) - ID аккаунта
- **Phone Number ID** (другое число) - ID конкретного номера телефона

Для отправки сообщений нужен именно **Phone Number ID**!
