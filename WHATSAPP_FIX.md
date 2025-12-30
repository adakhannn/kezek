# Исправление WhatsApp Phone Number ID

## Проблема
В переменной окружения установлен **WhatsApp Business Account ID** вместо **Phone Number ID**:
```
WHATSAPP_PHONE_NUMBER_ID=1185726307058446  ❌ (это Business Account ID)
```

## Решение

### Шаг 1: Получить правильный Phone Number ID

Открой в браузере (после деплоя):
```
https://kezek.kg/api/whatsapp/get-business-account
```

Или используй curl:
```bash
curl "https://kezek.kg/api/whatsapp/get-business-account"
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

