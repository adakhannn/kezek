# Исправление WhatsApp Phone Number ID

## Проблема
В переменной окружения установлен **WhatsApp Business Account ID** вместо **Phone Number ID**:
```
WHATSAPP_PHONE_NUMBER_ID=1185726307058446  ❌ (это Business Account ID)
```

## Решение

### Шаг 1: Проверить разрешения Access Token

Если получаешь ошибку "Missing Permission", нужно обновить разрешения токена:

1. Зайди в [Meta Developers](https://developers.facebook.com/apps/)
2. Выбери приложение → **Настройки компании** → **Пользователи системы**
3. Выбери пользователя системы, который используется для генерации токена
4. Убедись, что у него есть разрешения:
   - ✅ `whatsapp_business_messaging`
   - ✅ `whatsapp_business_management`
   - ✅ `business_management` (важно для доступа к Business Accounts)
5. Если разрешений нет - добавь их
6. Сгенерируй **новый Long-lived token** с этими разрешениями
7. Обнови `WHATSAPP_ACCESS_TOKEN` в переменных окружения

## Шаг 2: Получить правильный Phone Number ID

После обновления токена открой в браузере:
```
https://kezek.kg/api/whatsapp/get-business-account
```

**Результат будет содержать:**
- `phone_numbers[].id` - это и есть правильный **WHATSAPP_PHONE_NUMBER_ID**
- Скопируй значение `id` из массива `phone_numbers`

### Шаг 2: Обновить переменные окружения

В Vercel (или где развернут проект) обнови:
```
WHATSAPP_PHONE_NUMBER_ID=<скопированное_значение_из_phone_numbers[].id>
```

**Важно:** Это должно быть другое число, не `1185726307058446`

### Шаг 3: Проверить конфигурацию

Открой:
```
https://kezek.kg/api/whatsapp/test
```

Должно показать:
- ✅ `WHATSAPP_PHONE_NUMBER_ID_VALID: true`
- ✅ `configured: true`

### Шаг 4: Протестировать отправку

1. Зайди в `/cabinet/profile`
2. Включи WhatsApp уведомления
3. Нажми "Отправить код"
4. Должен прийти OTP код на WhatsApp

## Альтернативный способ (через Meta Developers)

1. Зайди в [Meta Developers](https://developers.facebook.com/apps/)
2. Выбери приложение → **WhatsApp** → **API Setup**
3. В разделе **"From"** найди свой номер телефона
4. Скопируй **Phone number ID** (это число рядом с номером)
5. Обнови `WHATSAPP_PHONE_NUMBER_ID` этим значением

## Разница между ID

- **WhatsApp Business Account ID** (`1185726307058446`) - ID аккаунта
- **Phone Number ID** (другое число) - ID конкретного номера телефона

Для отправки сообщений нужен именно **Phone Number ID**!

