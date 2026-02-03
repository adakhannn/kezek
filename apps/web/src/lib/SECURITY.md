# Безопасность: Service Role Key

## ⚠️ КРИТИЧЕСКИ ВАЖНО

`SUPABASE_SERVICE_ROLE_KEY` - это ключ с **полным доступом** к базе данных, который **обходит все RLS политики**.

## Правила использования

### ✅ МОЖНО использовать в:
- **Server Components** (по умолчанию в Next.js App Router)
- **API Routes** (`route.ts` файлы)
- **Server Actions**
- **Middleware** (с осторожностью)

### ❌ НИКОГДА не используйте в:
- **Client Components** (`'use client'` директивы)
- **Браузерном коде**
- **Публичных API endpoints** без дополнительной авторизации
- **Любом коде, который попадает в клиентский bundle**

## Защита

Функция `getSupabaseServiceRoleKey()` автоматически проверяет, что она не вызывается в клиентском коде:

```typescript
if (typeof window !== 'undefined') {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY cannot be used in client-side code');
}
```

## Как использовать правильно

### ✅ Правильно: API Route
```typescript
// apps/web/src/app/api/admin/users/route.ts
import { getSupabaseServiceRoleKey } from '@/lib/env';

export async function GET() {
    const serviceKey = getSupabaseServiceRoleKey(); // ✅ OK - это API route
    // ...
}
```

### ✅ Правильно: Server Component
```typescript
// apps/web/src/app/admin/users/page.tsx
import { getSupabaseServiceRoleKey } from '@/lib/env';

export default async function UsersPage() {
    const serviceKey = getSupabaseServiceRoleKey(); // ✅ OK - это server component
    // ...
}
```

### ❌ НЕПРАВИЛЬНО: Client Component
```typescript
// apps/web/src/app/admin/users/UsersClient.tsx
'use client';

import { getSupabaseServiceRoleKey } from '@/lib/env';

export function UsersClient() {
    const serviceKey = getSupabaseServiceRoleKey(); // ❌ ОШИБКА! Выбросит исключение
    // ...
}
```

## Альтернативы для клиентского кода

Если вам нужен доступ к данным из клиентского компонента:

1. **Используйте API Routes** - создайте API endpoint, который использует service key на сервере
2. **Используйте обычный Supabase клиент** - с анонимным ключом и RLS политиками
3. **Используйте Server Components** - передавайте данные через props

## Проверка безопасности

Перед каждым коммитом убедитесь:
1. ✅ Нет `getSupabaseServiceRoleKey()` в файлах с `'use client'`
2. ✅ Нет прямого использования `process.env.SUPABASE_SERVICE_ROLE_KEY` в клиентском коде
3. ✅ Все использования service key только в server-side коде

## Автоматическая проверка

Можно добавить в CI/CD:

```bash
# Проверка, что service key не используется в client components
grep -r "getSupabaseServiceRoleKey\|SUPABASE_SERVICE_ROLE_KEY" apps/web/src --include="*.tsx" --include="*.ts" | grep -E "'use client'|use client" && echo "ERROR: Service key used in client code!" && exit 1
```

