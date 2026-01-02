# Исправление ошибки: "Tried accessing nonexisting field (phone_numbers) on node type (User)"

## Проблема

При попытке получить phone_numbers через Graph API Explorer возникает ошибка:
```json
{
  "error": {
    "message": "(#100) Tried accessing nonexisting field (phone_numbers) on node type (User)",
    "type": "OAuthException",
    "code": 100
  }
}
```

## Причина

Используется **App ID** (`873844638834621`) вместо **WhatsApp Business Account ID** (`829309533409879`).

- **App ID** (`873844638834621`) - это ID приложения Meta
- **Business Account ID** (`829309533409879`) - это ID WhatsApp Business Account
- **Phone Number ID** (`910313308837894`) - это ID конкретного номера телефона

## Решение

### Шаг 1: Получи WhatsApp Business Account ID

1. В [Graph API Explorer](https://developers.facebook.com/tools/explorer/) запроси:
   ```
   /me/businesses
   ```

2. В ответе найди объект с WhatsApp Business Account:
   ```json
   {
     "data": [
       {
         "id": "829309533409879",  // ← Это Business Account ID
         "name": "Kezek",
         "whatsapp_accounts": {
           "data": [...]
         }
       }
     ]
   }
   ```

3. Скопируй `id` из ответа (например, `829309533409879`)

### Шаг 2: Используй Business Account ID для получения phone_numbers

1. В Graph API Explorer запроси:
   ```
   /829309533409879/phone_numbers
   ```
   (замени `829309533409879` на твой Business Account ID)

2. В ответе найди Phone Number ID:
   ```json
   {
     "data": [
       {
         "id": "910313308837894",  // ← Это Phone Number ID
         "display_phone_number": "+996 224 701 717",
         "verified_name": "Kezek",
         "status": "CONNECTED"
       }
     ]
   }
   ```

3. Скопируй `id` из phone_numbers (например, `910313308837894`)

## Альтернативный способ (через WhatsApp Manager)

Если Graph API Explorer не работает:

1. Перейди в [WhatsApp Manager](https://business.facebook.com/latest/settings/whatsapp_account)
2. Выбери WhatsApp Business Account "Kezek"
3. Перейди на вкладку **"Phone Numbers"**
4. Найди номер **+996 224 701 717**
5. В URL страницы или в консоли браузера найди Phone Number ID

## Итоговые значения для переменных окружения

После получения правильных ID, установи:

```env
# WhatsApp Cloud API
WHATSAPP_ACCESS_TOKEN=твой_long_lived_token
WHATSAPP_PHONE_NUMBER_ID=910313308837894  # ← Phone Number ID (НЕ Business Account ID!)
WHATSAPP_VERIFY_TOKEN=kezek_whatsapp_verify
```

## Проверка

После установки переменных, проверь через:

```bash
GET https://kezek.kg/api/whatsapp/diagnose
```

Или отправь тестовое сообщение через профиль пользователя.

---

**Важно помнить:**
- ❌ App ID (`873844638834621`) - для приложения Meta
- ✅ Business Account ID (`829309533409879`) - для WhatsApp Business Account
- ✅ Phone Number ID (`910313308837894`) - для конкретного номера (это нужно для `WHATSAPP_PHONE_NUMBER_ID`)

