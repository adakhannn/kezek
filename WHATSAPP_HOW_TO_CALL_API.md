# Как вызвать API endpoint для получения WhatsApp данных

## Способ 1: Через браузер (самый простой)

Просто открой в браузере:

```
https://kezek.kg/api/whatsapp/get-business-account
```

**Важно:** Сначала нужно установить `WHATSAPP_ACCESS_TOKEN` в переменных окружения на сервере (Vercel/другой хостинг), иначе endpoint вернет ошибку.

## Способ 2: Через терминал (curl)

### Windows (PowerShell):

```powershell
curl https://kezek.kg/api/whatsapp/get-business-account
```

### Linux/Mac:

```bash
curl https://kezek.kg/api/whatsapp/get-business-account
```

### С красивым выводом (JSON):

```bash
curl https://kezek.kg/api/whatsapp/get-business-account | python -m json.tool
```

## Способ 3: Через Graph API Explorer (прямой доступ к Meta API)

Если хочешь получить данные напрямую от Meta (без нашего endpoint):

1. Перейди в [Graph API Explorer](https://developers.facebook.com/tools/explorer/)
2. Выбери приложение
3. Выбери разрешения: `whatsapp_business_messaging`, `whatsapp_business_management`, `business_management`
4. Нажми **"Generate Access Token"**
5. В поле запроса введи:

```
/me/businesses
```

6. Нажми **"Submit"**
7. В ответе найди Business Account ID (например, `829309533409879`)
8. Затем запроси номера:

```
/829309533409879/phone_numbers
```

9. В ответе найди Phone Number ID для номера `+996 224 701 717`

## Способ 4: Через Postman или Insomnia

1. Создай новый GET запрос
2. URL: `https://kezek.kg/api/whatsapp/get-business-account`
3. Нажми **Send**

## Способ 5: Через JavaScript в консоли браузера

Открой консоль браузера (F12) на сайте kezek.kg и выполни:

```javascript
fetch('https://kezek.kg/api/whatsapp/get-business-account')
  .then(res => res.json())
  .then(data => console.log(data));
```

## Что нужно сделать ПЕРЕД вызовом endpoint

**Важно:** Endpoint использует `WHATSAPP_ACCESS_TOKEN` из переменных окружения сервера. Поэтому:

1. **Сначала получи Access Token:**
   - Meta Developers → Приложение → Настройки → Пользователи системы
   - Создай System User
   - Сгенерируй Long-lived token
   - Скопируй токен

2. **Установи токен в переменные окружения:**
   - **Локально:** Добавь в `.env.local`:
     ```env
     WHATSAPP_ACCESS_TOKEN=твой_токен_здесь
     ```
   - **В продакшене (Vercel):**
     - Перейди в настройки проекта
     - Environment Variables
     - Добавь `WHATSAPP_ACCESS_TOKEN` = твой токен
     - Сохрани и перезапусти деплой

3. **После установки токена** вызови endpoint

## Альтернатива: Получить Phone Number ID вручную

Если endpoint не работает, можно получить Phone Number ID напрямую:

1. Перейди в [Meta Developers](https://developers.facebook.com/apps/)
2. Выбери приложение
3. Перейди в **WhatsApp** → **API Setup**
4. Найди номер **+996 224 701 717**
5. Рядом с номером будет **Phone Number ID** (например, `910313308837894`)
6. Скопируй этот ID

## Пример ответа от endpoint

Если все настроено правильно, endpoint вернет:

```json
{
  "ok": true,
  "business_accounts": [
    {
      "id": "829309533409879",
      "name": "Kezek"
    }
  ],
  "selected_account": {
    "id": "829309533409879",
    "name": "Kezek"
  },
  "phone_numbers": [
    {
      "id": "910313308837894",  // ← Это WHATSAPP_PHONE_NUMBER_ID
      "display_phone_number": "+996 224 701 717",
      "verified_name": "Kezek",
      "status": "CONNECTED"
    }
  ],
  "instructions": {
    "step1": "Используйте 'id' из selected_account как WhatsApp Business Account ID",
    "step2": "Используйте 'id' из phone_numbers как WHATSAPP_PHONE_NUMBER_ID",
    "step3": "Установите эти значения в переменные окружения"
  }
}
```

## Если endpoint возвращает ошибку

1. **"WHATSAPP_ACCESS_TOKEN не установлен":**
   - Установи токен в переменные окружения
   - Перезапусти сервер/деплой

2. **"Graph API error: HTTP 401":**
   - Токен неверный или истек
   - Сгенерируй новый токен

3. **"Graph API error: HTTP 403":**
   - Недостаточно разрешений
   - Убедись, что System User имеет разрешения: `whatsapp_business_messaging`, `whatsapp_business_management`, `business_management`

---

**Рекомендация:** Самый простой способ - открыть URL в браузере после установки токена в переменные окружения.

