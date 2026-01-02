# Подключение уже настроенного WhatsApp Business Account

Если у тебя есть доступ к уже настроенному WhatsApp Business Account, можно использовать его вместо ожидания рассмотрения нового номера.

## Шаг 1: Получение доступа к существующему аккаунту

### Вариант A: Если у тебя есть доступ к Meta Business Account

1. Перейди в [Meta Business Suite](https://business.facebook.com/)
2. Выбери нужный бизнес-аккаунт
3. Перейди в **WhatsApp Manager** → **Phone Numbers**
4. Найди номер, который хочешь использовать
5. Убедись, что у тебя есть права администратора на этот аккаунт

### Вариант B: Если тебе предоставили доступ

1. Попроси владельца аккаунта добавить тебя как администратора
2. Владелец должен:
   - Перейти в [Meta Business Suite](https://business.facebook.com/)
   - Выбрать бизнес-аккаунт
   - Перейти в **Настройки** → **Пользователи**
   - Добавить тебя с правами администратора

## Шаг 2: Получение Access Token

1. Перейди в [Meta Developers](https://developers.facebook.com/apps/)
2. Выбери приложение, связанное с WhatsApp Business Account
   - Если приложения нет, создай новое:
     - Нажми **"Создать приложение"**
     - Выбери тип **"Бизнес"**
     - Назови приложение (например, "Kezek WhatsApp")
3. В левом меню выбери **WhatsApp** → **API Setup**
4. Подключи существующий **WhatsApp Business Account**:
   - Нажми **"Подключить номер телефона"** или **"Использовать существующий номер"**
   - Выбери номер из списка
5. Создай или выбери **System User** (Пользователь системы):
   - Перейди в **Настройки** → **Пользователи системы**
   - Создай нового пользователя или выбери существующего
   - Выдай ему разрешения:
     - `whatsapp_business_messaging`
     - `whatsapp_business_management`
6. Сгенерируй **Long-lived token** (постоянный токен):
   - Нажми **"Создать токен"**
   - Выбери пользователя системы
   - Выбери разрешения: `whatsapp_business_messaging`, `whatsapp_business_management`
   - Скопируй токен (он показывается только один раз!)

## Шаг 3: Получение Phone Number ID

### Способ 1: Через Meta Developers (вручную)

1. В Meta Developers перейди в **WhatsApp** → **API Setup**
2. Найди раздел **"Phone number ID"** или **"Номер телефона"**
3. Скопируй **Phone Number ID** (это числовой ID, например `123456789012345`)

### Способ 2: Через API (автоматически)

Используй созданный endpoint:

```bash
GET https://kezek.kg/api/whatsapp/get-business-account
```

Или если знаешь Business Account ID:

```bash
GET https://kezek.kg/api/whatsapp/get-phone-numbers?account_id=YOUR_BUSINESS_ACCOUNT_ID
```

**В ответе найди:**
- `phone_numbers[].id` - это и есть **WHATSAPP_PHONE_NUMBER_ID**
- `phone_numbers[].display_phone_number` - это номер телефона

## Шаг 4: Настройка переменных окружения

Обнови переменные в `.env.local` (локально) и в настройках деплоя (Vercel/другой хостинг):

```env
# WhatsApp Cloud API
WHATSAPP_ACCESS_TOKEN=YOUR_LONG_LIVED_TOKEN_HERE
WHATSAPP_PHONE_NUMBER_ID=YOUR_PHONE_NUMBER_ID_HERE
WHATSAPP_VERIFY_TOKEN=kezek_whatsapp_verify
```

**Важно:**
- `WHATSAPP_ACCESS_TOKEN` - это Long-lived token, который ты получил в Шаге 2
- `WHATSAPP_PHONE_NUMBER_ID` - это ID конкретного номера телефона (не Business Account ID!)
- `WHATSAPP_VERIFY_TOKEN` - любой секретный токен для верификации webhook (можешь оставить `kezek_whatsapp_verify`)

## Шаг 5: Настройка Webhook

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
5. Выбери события для подписки:
   - `messages` - входящие сообщения
   - `message_status` - статусы доставки сообщений

## Шаг 6: Проверка конфигурации

Используй диагностический endpoint:

```bash
GET https://kezek.kg/api/whatsapp/diagnose
```

Он покажет:
- ✅ Валидность токена
- ✅ Список доступных номеров
- ✅ Соответствие Phone Number ID реальному номеру
- ✅ Статус регистрации номеров

## Шаг 7: Тестирование

1. Отправь тестовое сообщение через систему (создай бронирование)
2. Или используй API endpoint:
   ```bash
   GET https://kezek.kg/api/whatsapp/test
   ```

## Важные моменты

1. **Права доступа:** Убедись, что у тебя есть права администратора на WhatsApp Business Account
2. **Номер телефона:** Номер должен быть полностью зарегистрирован и иметь статус "Подключено"
3. **24-часовое окно:** Для отправки обычных сообщений нужно, чтобы клиент ответил в течение 24 часов. Для отправки вне окна используй шаблоны сообщений
4. **Тестовые получатели:** Если используешь тестовый номер, добавь получателей в список тестовых получателей в Meta Developers

## Если что-то не работает

1. Проверь логи сервера на наличие ошибок
2. Используй `/api/whatsapp/diagnose` для диагностики
3. Убедись, что:
   - Access Token актуален и не истек
   - Phone Number ID правильный (не Business Account ID)
   - Webhook настроен и верифицирован
   - Номер телефона имеет статус "Подключено"

---

**Последнее обновление:** 2025-01-06

