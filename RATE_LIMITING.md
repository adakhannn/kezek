# Rate Limiting для API Endpoints

## Как работает

### Обзор

Реализован rate limiting для защиты критичных и публичных API endpoints от злоупотреблений и DDoS атак через утилиту `apps/web/src/lib/rateLimit.ts`.

- **В продакшене:** используется **Upstash Redis** для распределённого rate limiting (serverless).
- **В dev:** автоматический fallback на in-memory хранилище (настройка не требуется).

### Конфигурации (пресеты)

| Пресет | Лимит | Endpoints |
|--------|-------|-----------|
| **public** | 10 запросов/мин | `/api/quick-book-guest`, `/api/quick-hold` |
| **critical** | 5 запросов/мин | `/api/staff/shift/open`, `/api/staff/shift/close` |
| **normal** | 30 запросов/мин | `/api/staff/shift/items`, `/api/bookings/[id]/mark-attendance` |
| **auth** | 5 запросов / 15 мин | `/api/whatsapp/send-otp`, `/api/whatsapp/verify-otp`, `/api/auth/telegram/login`, `/api/auth/telegram/link` |

### Использование в API

```typescript
import { withRateLimit, RateLimitConfigs } from '@/lib/rateLimit';

export async function POST(req: Request) {
  return withRateLimit(
    req,
    RateLimitConfigs.public, // или .auth, .normal, .critical
    async () => {
      // ваш код
      return NextResponse.json({ ok: true });
    }
  );
}
```

### Ответ при превышении лимита

Код `429 Too Many Requests`, тело:

```json
{
  "ok": false,
  "error": "rate_limit_exceeded",
  "message": "Превышен лимит запросов. Попробуйте через X секунд.",
  "retryAfter": 60
}
```

Заголовки: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`, `Retry-After`.

### Идентификация клиентов

IP берётся из заголовков (по порядку): `x-forwarded-for`, `x-real-ip`, `cf-connecting-ip`; иначе `unknown`.

### Выбор хранилища

1. **Redis доступен** (`UPSTASH_REDIS_REST_URL` и `UPSTASH_REDIS_REST_TOKEN` заданы) — Upstash Redis, общее состояние между инстансами.
2. **Redis недоступен** — in-memory, автоочистка каждые 5 минут (удобно для разработки).

---

## Настройка

### Зачем нужен Redis в продакшене

In-memory не подходит для serverless (Vercel): у каждого инстанса своё состояние. Upstash Redis даёт общий счётчик для всех запросов.

### 1. Создание Upstash Redis

1. Зайти на https://upstash.com, создать аккаунт при необходимости.
2. Создать Redis database, выбрать регион (ближе к деплою Vercel), план (Free tier достаточно для старта).
3. Скопировать `UPSTASH_REDIS_REST_URL` и `UPSTASH_REDIS_REST_TOKEN`.

### 2. Установка зависимости

```bash
cd apps/web
pnpm add @upstash/redis
```

### 3. Переменные окружения

**Локально** (`.env.local`):

```env
UPSTASH_REDIS_REST_URL=https://your-redis-url.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-redis-token
```

**Vercel:**

- **Вариант A:** Vercel Dashboard → проект → Settings → Integrations → Upstash → подключить базу (переменные подставятся сами).
- **Вариант B:** Settings → Environment Variables → добавить `UPSTASH_REDIS_REST_URL` и `UPSTASH_REDIS_REST_TOKEN` для Production/Preview/Development → сохранить и передеплоить.

### 4. Проверка

В ответах API должны быть заголовки `X-RateLimit-Limit`, `X-RateLimit-Remaining`. При превышении лимита — `429` и `Retry-After`.

**Тест через curl:**

```bash
# например, 11 запросов подряд к лимитированному endpoint (лимит 10)
for i in {1..11}; do
  curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3000/api/quick-book-guest \
    -H "Content-Type: application/json" \
    -d '{"biz_id":"...","service_id":"...","staff_id":"...","start_at":"...","client_name":"Test","client_phone":"+996555123456"}'
done
```

Ожидается один ответ `429`.

### Мониторинг (Upstash)

https://console.upstash.com → ваша база → Commands: количество операций, память, latency.

### Стоимость

- Free tier: 10 000 команд/день, 256 MB — обычно достаточно.
- Pay-as-you-go: $0.20 за 100K команд.

### Troubleshooting

- **Rate limiting не срабатывает в проде:** проверить наличие `UPSTASH_REDIS_REST_URL` и `UPSTASH_REDIS_REST_TOKEN` в Vercel, логи на ошибки Redis, `pnpm list @upstash/redis` в apps/web.
- **Fallback на in-memory:** если Redis недоступен, используется память процесса. Для локальной разработки и тестов это нормально; в продакшене нужно убедиться, что Redis настроен.

### Альтернативы

При необходимости можно заменить Upstash на Vercel KV, Redis Cloud или свой Redis, обновив `getRedisClient()` в `apps/web/src/lib/rateLimit.ts`.

---

## Дальнейшие улучшения

- Идентификация по `user_id` для авторизованных пользователей.
- Rate limiting на уровне CDN (например, Vercel Edge Middleware).
