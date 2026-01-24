# Rate Limiting для API Endpoints

## Обзор

Реализован rate limiting для защиты критичных и публичных API endpoints от злоупотреблений и DDoS атак.

## Реализация

Rate limiting реализован через утилиту `apps/web/src/lib/rateLimit.ts`, которая использует in-memory хранилище для отслеживания количества запросов по IP адресу.

**Примечание:** В продакшене рекомендуется использовать Redis или Upstash для распределенного rate limiting между несколькими инстансами сервера.

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

## Очистка кэша

Автоматическая очистка устаревших записей происходит каждые 5 минут.

## Расширение для продакшена

Для продакшена рекомендуется:

1. **Использовать Redis/Upstash:**
   ```typescript
   import { Ratelimit } from "@upstash/ratelimit";
   import { Redis } from "@upstash/redis";
   
   const redis = new Redis({
     url: process.env.UPSTASH_REDIS_REST_URL!,
     token: process.env.UPSTASH_REDIS_REST_TOKEN!,
   });
   
   const ratelimit = new Ratelimit({
     redis,
     limiter: Ratelimit.slidingWindow(10, "1 m"),
   });
   ```

2. **Или использовать Vercel Edge Middleware** для rate limiting на уровне CDN.

3. **Добавить идентификацию по user_id** для аутентифицированных пользователей (более справедливый лимит).

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

