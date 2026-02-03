# Настройка Rate Limiting с Upstash Redis

## Проблема

In-memory хранилище для rate limiting не работает в serverless окружении (Vercel), так как каждый запрос может обрабатываться на разных инстансах без общего состояния.

## Решение

Используется **Upstash Redis** для продакшена с автоматическим fallback на in-memory хранилище для dev окружения.

## Настройка

### 1. Создание Upstash Redis базы данных

1. Перейдите на https://upstash.com
2. Создайте аккаунт (если еще нет)
3. Создайте новую Redis database:
   - Выберите регион (ближайший к вашему Vercel deployment)
   - Выберите план (Free tier достаточно для начала)
4. После создания вы получите:
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`

### 2. Установка зависимости

```bash
cd apps/web
pnpm add @upstash/redis
```

### 3. Настройка переменных окружения

Добавьте в `.env.local` (для локальной разработки):

```env
UPSTASH_REDIS_REST_URL=https://your-redis-url.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-redis-token
```

### 4. Настройка в Vercel

#### Вариант A: Через Vercel Integration (рекомендуется)

1. Перейдите в Vercel Dashboard → ваш проект → Settings → Integrations
2. Найдите "Upstash" и подключите
3. Выберите вашу Redis database
4. Переменные окружения добавятся автоматически

#### Вариант B: Вручную

1. Перейдите в Vercel Dashboard → ваш проект → Settings → Environment Variables
2. Добавьте:
   - `UPSTASH_REDIS_REST_URL` = ваш URL
   - `UPSTASH_REDIS_REST_TOKEN` = ваш токен
3. Выберите окружения (Production, Preview, Development)
4. Сохраните и передеплойте

## Как это работает

### Автоматический выбор хранилища

1. **Если Redis доступен** (есть env переменные и установлен `@upstash/redis`):
   - Используется Redis для rate limiting
   - Работает в serverless окружении
   - Общее состояние между всеми инстансами

2. **Если Redis недоступен** (dev окружение или не настроен):
   - Автоматический fallback на in-memory хранилище
   - Работает локально для разработки
   - Не требует дополнительной настройки

### Пример использования

```typescript
import { withRateLimit, RateLimitConfigs } from '@/lib/rateLimit';

export async function POST(req: Request) {
    return withRateLimit(
        req,
        RateLimitConfigs.public, // 10 запросов в минуту
        async () => {
            // Ваш код здесь
            return NextResponse.json({ ok: true });
        }
    );
}
```

## Мониторинг

### Upstash Dashboard

1. Перейдите на https://console.upstash.com
2. Выберите вашу Redis database
3. В разделе "Commands" вы можете видеть:
   - Количество операций
   - Использование памяти
   - Latency

### Проверка работы

Rate limiting добавляет заголовки к ответам:

```
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 5
X-RateLimit-Reset: 1234567890
Retry-After: 30 (если лимит превышен)
```

## Стоимость

### Upstash Free Tier

- 10,000 команд в день
- 256 MB памяти
- Достаточно для большинства проектов

### Если нужно больше

- Pay-as-you-go план
- $0.20 за 100K команд
- Автоматическое масштабирование

## Troubleshooting

### Rate limiting не работает

1. Проверьте, что переменные окружения установлены:
   ```bash
   echo $UPSTASH_REDIS_REST_URL
   echo $UPSTASH_REDIS_REST_TOKEN
   ```

2. Проверьте логи Vercel на наличие ошибок Redis

3. Убедитесь, что `@upstash/redis` установлен:
   ```bash
   pnpm list @upstash/redis
   ```

### Fallback на in-memory

Если Redis недоступен, система автоматически использует in-memory хранилище. Это нормально для:
- Локальной разработки
- Тестирования
- Временных проблем с Redis

В продакшене убедитесь, что Redis настроен правильно.

## Альтернативы

Если Upstash не подходит, можно использовать:

1. **Vercel KV** (если доступен в вашем регионе)
2. **Redis Cloud** (другой провайдер)
3. **Собственный Redis сервер** (не рекомендуется для serverless)

Для смены провайдера нужно обновить функцию `getRedisClient()` в `apps/web/src/lib/rateLimit.ts`.

