# Rate Limiting для API Endpoints

## Обзор

Реализован rate limiting для защиты критичных и публичных API endpoints от злоупотреблений и DDoS атак.

## Реализация

Rate limiting реализован через утилиту `apps/web/src/lib/rateLimit.ts`, которая:

- **В продакшене:** Использует **Upstash Redis** для распределенного rate limiting (работает в serverless окружении)
- **В dev окружении:** Автоматически fallback на in-memory хранилище (не требует настройки)

**Настройка:** См. `RATE_LIMITING_SETUP.md` для инструкций по настройке Upstash Redis.

## Конфигурации

### Публичные endpoints (`RateLimitConfigs.public`)
- **Лимит:** 10 запросов в минуту
- **Применяется к:**
  - `/api/quick-book-guest` - гостевые бронирования без авторизации
  - `/api/quick-hold` - быстрое бронирование слотов

### Критичные операции (`RateLimitConfigs.critical`)
- **Лимит:** 5 запросов в минуту
- **Применяется к:**
  - `/api/staff/shift/open` - открытие смены
  - `/api/staff/shift/close` - закрытие смены

### Обычные операции (`RateLimitConfigs.normal`)
- **Лимит:** 30 запросов в минуту
- **Применяется к:**
  - `/api/staff/shift/items` - добавление клиентов в смену
  - `/api/bookings/[id]/mark-attendance` - отметка посещения

### Аутентификация (`RateLimitConfigs.auth`)
- **Лимит:** 5 запросов в 15 минут
- **Применяется к:**
  - `/api/whatsapp/send-otp` - отправка OTP кода
  - `/api/whatsapp/verify-otp` - проверка OTP кода
  - `/api/auth/telegram/login` - вход через Telegram
  - `/api/auth/telegram/link` - привязка Telegram аккаунта

## Ответ при превышении лимита

При превышении лимита запросов API возвращает ответ с кодом `429 Too Many Requests`:

```json
{
  "ok": false,
  "error": "rate_limit_exceeded",
  "message": "Превышен лимит запросов. Попробуйте через X секунд.",
  "retryAfter": 60
}
```

Заголовки ответа:
- `X-RateLimit-Limit` - максимальное количество запросов
- `X-RateLimit-Remaining` - оставшееся количество запросов
- `X-RateLimit-Reset` - timestamp когда лимит сбросится
- `Retry-After` - секунды до следующего запроса

## Идентификация клиентов

Rate limiting использует IP адрес клиента, определяемый из заголовков:
1. `x-forwarded-for` (первый IP в списке)
2. `x-real-ip`
3. `cf-connecting-ip` (Cloudflare)
4. `unknown` (если IP не определен)

## Автоматический выбор хранилища

Система автоматически выбирает хранилище:

1. **Если Redis доступен** (настроены `UPSTASH_REDIS_REST_URL` и `UPSTASH_REDIS_REST_TOKEN`):
   - Используется Upstash Redis
   - Работает в serverless окружении (Vercel)
   - Общее состояние между всеми инстансами

2. **Если Redis недоступен**:
   - Автоматический fallback на in-memory хранилище
   - Работает локально для разработки
   - Автоматическая очистка устаревших записей каждые 5 минут

## Настройка для продакшена

См. подробные инструкции в `RATE_LIMITING_SETUP.md`.

Кратко:
1. Создайте Redis database на https://upstash.com
2. Добавьте переменные окружения в Vercel:
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`
3. Установите зависимость: `pnpm add @upstash/redis`

## Будущие улучшения

- Добавить идентификацию по `user_id` для аутентифицированных пользователей (более справедливый лимит)
- Использовать Vercel Edge Middleware для rate limiting на уровне CDN

## Тестирование

Для тестирования rate limiting можно использовать `curl`:

```bash
# Отправляем 11 запросов подряд (лимит 10)
for i in {1..11}; do
  curl -X POST http://localhost:3000/api/quick-book-guest \
    -H "Content-Type: application/json" \
    -d '{"biz_id":"...","service_id":"...","staff_id":"...","start_at":"...","client_name":"Test","client_phone":"+996555123456"}'
  echo ""
done
```

11-й запрос должен вернуть `429 Too Many Requests`.

