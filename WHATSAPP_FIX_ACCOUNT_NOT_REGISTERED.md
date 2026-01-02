# Исправление ошибки: (#133010) Account not registered

## Проблема

После изменения `WHATSAPP_PHONE_NUMBER_ID` возникает ошибка:
```
WhatsApp API error: HTTP 400 — (#133010) Account not registered
```

## Причины

1. **Номер не зарегистрирован в WhatsApp Business Account**
2. **Phone Number ID не соответствует зарегистрированному номеру**
3. **Номер еще не прошел полную регистрацию/верификацию**
4. **Токен не имеет доступа к этому номеру**

## Решение

### Шаг 1: Проверь статус номера в WhatsApp Manager

1. Перейди в [WhatsApp Manager](https://business.facebook.com/latest/settings/whatsapp_account)
2. Выбери WhatsApp Business Account "Kezek"
3. Перейди на вкладку **"Phone Numbers"**
4. Найди номер `+996 224 701 717`
5. Проверь статус:
   - ✅ **"Подключено" (CONNECTED)** - номер готов к использованию
   - ⚠️ **"На рассмотрении" (PENDING)** - номер еще не готов
   - ❌ **"Не подключено" (NOT_CONNECTED)** - номер не подключен

### Шаг 2: Проверь Phone Number ID

1. В WhatsApp Manager нажми на номер `+996 224 701 717`
2. В консоли браузера (F12) или в URL найди Phone Number ID
3. Или используй Graph API Explorer:
   ```
   /829309533409879/phone_numbers
   ```
   (замени `829309533409879` на твой Business Account ID)

4. Убедись, что `id` из ответа совпадает с `WHATSAPP_PHONE_NUMBER_ID`

### Шаг 3: Проверь правильность Phone Number ID

**Важно:** Phone Number ID должен быть из поля `"id"` в ответе от `/phone_numbers`, а НЕ из:
- ❌ `webhook_configuration.id` (это ID конфигурации webhook)
- ❌ Business Account ID
- ❌ App ID

**Правильный ответ должен выглядеть так:**
```json
{
  "data": [
    {
      "id": "862538650287008",  // ← Это Phone Number ID
      "display_phone_number": "+996 224 701 717",
      "verified_name": "Kezek",
      "code_verification_status": "NOT_VERIFIED",
      "webhook_configuration": {
        "id": "862538650287008",  // ← Может совпадать, но используй "id" из корня объекта
        "application": "https://kezek.kg/api/webhooks/whatsapp"
      }
    }
  ]
}
```

### Шаг 4: Проверь доступ токена

1. В Graph API Explorer запроси:
   ```
   /862538650287008?fields=id,display_phone_number,verified_name,code_verification_status
   ```
   (замени `862538650287008` на твой Phone Number ID)

2. Если получаешь ошибку доступа - токен не имеет прав на этот номер

3. Решение:
   - Сгенерируй новый Long-lived token
   - Убедись, что System User имеет разрешения:
     - `whatsapp_business_messaging`
     - `whatsapp_business_management`
     - `business_management`

### Шаг 5: Проверь через диагностический endpoint

После установки переменных, проверь:

```
GET https://kezek.kg/api/whatsapp/diagnose
```

Endpoint покажет:
- ✅ Правильность токена
- ✅ Наличие Phone Number ID
- ✅ Статус номера
- ✅ Список доступных номеров

## Частые ошибки

### Ошибка 1: Использован неправильный ID

❌ **Неправильно:**
```env
WHATSAPP_PHONE_NUMBER_ID=829309533409879  # Это Business Account ID
```

✅ **Правильно:**
```env
WHATSAPP_PHONE_NUMBER_ID=862538650287008  # Это Phone Number ID
```

### Ошибка 2: Номер еще не готов

Если статус "На рассмотрении" или "NOT_VERIFIED":
- Дождись завершения регистрации (может занять несколько дней)
- Или используй тестовый номер для разработки

### Ошибка 3: Токен не имеет доступа

Если токен не может получить доступ к номеру:
- Проверь, что System User имеет правильные разрешения
- Убедись, что токен сгенерирован для правильного приложения
- Проверь, что номер принадлежит этому Business Account

## Проверка через Graph API Explorer

1. Открой [Graph API Explorer](https://developers.facebook.com/tools/explorer/)
2. Выбери приложение и разрешения
3. Запроси:
   ```
   /me/businesses
   ```
4. Найди Business Account ID (например, `829309533409879`)
5. Запроси номера:
   ```
   /829309533409879/phone_numbers
   ```
6. Скопируй `id` из ответа (это Phone Number ID)
7. Проверь доступ к номеру:
   ```
   /862538650287008?fields=id,display_phone_number,verified_name
   ```
   (замени на твой Phone Number ID)

## Итоговые значения

После проверки, установи правильные значения:

```env
WHATSAPP_ACCESS_TOKEN=твой_long_lived_token
WHATSAPP_PHONE_NUMBER_ID=862538650287008  # Phone Number ID (НЕ Business Account ID!)
WHATSAPP_VERIFY_TOKEN=kezek_whatsapp_verify
```

## Если ничего не помогает

1. **Используй тестовый номер:**
   - В Meta Developers → WhatsApp → Быстрый старт
   - Используй тестовый номер для разработки
   - Phone Number ID для тестового номера: `943058622222058`

2. **Проверь логи сервера:**
   - Посмотри логи в Vercel/другом хостинге
   - Ищи ошибки с кодом `133010`

3. **Обратись в поддержку Meta:**
   - Если номер долго "На рассмотрении"
   - Если не можешь получить доступ к номеру

---

**Важно:** Phone Number ID должен быть из поля `"id"` объекта в массиве `data` ответа от `/phone_numbers`, а не из других полей!

