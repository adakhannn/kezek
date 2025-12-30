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
EAAeAsutyBQIBQWFfjlBNwSY7J8QkuD2rrZBDhe6QeRugqu3brxeTIqaGKBt6qQDWKZBbbLp1LmYZAjt6X8AvZBoE5vZBL4BpyZC2MX0IDZATRTTWuTIbueq6yOS6dZA2XY3VcUQgOcX9l3UIrDboppncinZC0cfJB27ANc1KZAGMvcjaR7GY3sqbEykphtujZAgJPLBfhvVcg0g9HXbzt3nLH1hMIZAs1uwtYQAqlXaVTZBgZA
```

## Шаг 2: Получение Phone Number ID

1. В Meta Developers перейди в **WhatsApp** → **API Setup**
2. Создай или выбери **WhatsApp Business Account**
3. Добавь номер телефона (если еще не добавлен)
4. После регистрации номера найди **Phone number ID** (это числовой ID, например `123456789012345`)
5. Скопируй Phone Number ID

## Шаг 3: Настройка переменных окружения

Добавь в `.env.local` или `.env`:

```env
# WhatsApp Cloud API
WHATSAPP_ACCESS_TOKEN=EAAeAsutyBQIBQWFfjlBNwSY7J8QkuD2rrZBDhe6QeRugqu3brxeTIqaGKBt6qQDWKZBbbLp1LmYZAjt6X8AvZBoE5vZBL4BpyZC2MX0IDZATRTTWuTIbueq6yOS6dZA2XY3VcUQgOcX9l3UIrDboppncinZC0cfJB27ANc1KZAGMvcjaR7GY3sqbEykphtujZAgJPLBfhvVcg0g9HXbzt3nLH1hMIZAs1uwtYQAqlXaVTZBgZA
WHATSAPP_PHONE_NUMBER_ID=YOUR_PHONE_NUMBER_ID_HERE
WHATSAPP_VERIFY_TOKEN=kezek_whatsapp_verify
```

**Важно:** Замени `YOUR_PHONE_NUMBER_ID_HERE` на реальный Phone Number ID из шага 2.

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

