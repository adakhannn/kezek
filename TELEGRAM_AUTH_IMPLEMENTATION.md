# 📋 Пошаговая инструкция: Реализация входа через Telegram

## 🎯 Цель
Добавить возможность входа через Telegram Login Widget (аналогично Google OAuth, но для Telegram).

---

## 📝 ПОДГОТОВКА

### Шаг 1: Создание Telegram Bot

1. Откройте Telegram и найдите бота **@BotFather**
2. Отправьте команду `/newbot`
3. Следуйте инструкциям:
   - Введите имя бота (например: "Kezek Auth Bot")
   - Введите username бота (например: `kezek_auth_bot`)
4. **Сохраните Bot Token** — он понадобится позже (формат: `123456789:ABCdefGHIjklMNOpqrsTUVwxyz`)
5. Настройте домен для виджета:
   ```
   /setdomain
   ```
   - Выберите вашего бота
   - Введите домен: `kezek.kg` (или ваш домен)

### Шаг 2: Получение Bot Token

Bot Token будет выглядеть примерно так:
```
1234567890:ABCdefGHIjklMNOpqrsTUVwxyz1234567890
```

**Важно:** Этот токен нужно будет добавить в переменные окружения.

---

## 🔧 РЕАЛИЗАЦИЯ

### Шаг 3: Добавление переменных окружения

Добавьте в `.env.local` (или в настройки вашего хостинга):

```env
# Telegram Bot для авторизации
TELEGRAM_BOT_TOKEN=ваш_bot_token_от_BotFather
```

**Где добавить:**
- Локально: `apps/web/.env.local`
- На хостинге: настройки окружения (Vercel, Railway, etc.)

---

### Шаг 4: Создание утилиты для проверки подписи Telegram

**Файл:** `apps/web/src/lib/telegram/verify.ts`

```typescript
import crypto from 'crypto';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

/**
 * Проверяет подпись данных от Telegram Login Widget
 * Документация: https://core.telegram.org/widgets/login#checking-authorization
 */
export function verifyTelegramAuth(data: {
    id: number;
    first_name?: string;
    last_name?: string;
    username?: string;
    photo_url?: string;
    auth_date: number;
    hash: string;
}): boolean {
    if (!TELEGRAM_BOT_TOKEN) {
        console.error('[Telegram] TELEGRAM_BOT_TOKEN not configured');
        return false;
    }

    // Проверяем, что данные не старше 24 часов
    const authDate = data.auth_date;
    const now = Math.floor(Date.now() / 1000);
    if (now - authDate > 86400) {
        console.warn('[Telegram] Auth data expired');
        return false;
    }

    // Создаем строку для проверки
    const checkString = Object.keys(data)
        .filter(key => key !== 'hash')
        .sort()
        .map(key => `${key}=${data[key as keyof typeof data]}`)
        .join('\n');

    // Создаем секретный ключ из Bot Token
    const secretKey = crypto
        .createHash('sha256')
        .update(TELEGRAM_BOT_TOKEN)
        .digest();

    // Вычисляем HMAC
    const hmac = crypto
        .createHmac('sha256', secretKey)
        .update(checkString)
        .digest('hex');

    // Сравниваем с переданным hash
    return hmac === data.hash;
}

/**
 * Нормализует данные от Telegram для сохранения в БД
 */
export function normalizeTelegramData(data: {
    id: number;
    first_name?: string;
    last_name?: string;
    username?: string;
    photo_url?: string;
}): {
    telegram_id: number;
    full_name: string | null;
    telegram_username: string | null;
    telegram_photo_url: string | null;
} {
    const fullName = [data.first_name, data.last_name]
        .filter(Boolean)
        .join(' ')
        .trim() || null;

    return {
        telegram_id: data.id,
        full_name: fullName,
        telegram_username: data.username || null,
        telegram_photo_url: data.photo_url || null,
    };
}
```

---

### Шаг 5: Создание API endpoint для обработки Telegram авторизации

**Файл:** `apps/web/src/app/api/auth/telegram/login/route.ts`

```typescript
import crypto from 'crypto';

import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

import { verifyTelegramAuth, normalizeTelegramData } from '@/lib/telegram/verify';

export const dynamic = 'force-dynamic';

type TelegramAuthData = {
    id: number;
    first_name?: string;
    last_name?: string;
    username?: string;
    photo_url?: string;
    auth_date: number;
    hash: string;
};

/**
 * POST /api/auth/telegram/login
 * Обрабатывает данные от Telegram Login Widget
 */
export async function POST(req: Request) {
    try {
        const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;

        const body = await req.json();
        const telegramData = body as TelegramAuthData;

        // Проверяем наличие обязательных полей
        if (!telegramData.id || !telegramData.hash || !telegramData.auth_date) {
            return NextResponse.json(
                { ok: false, error: 'missing_data', message: 'Недостаточно данных от Telegram' },
                { status: 400 }
            );
        }

        // Проверяем подпись
        if (!verifyTelegramAuth(telegramData)) {
            return NextResponse.json(
                { ok: false, error: 'invalid_signature', message: 'Неверная подпись данных' },
                { status: 400 }
            );
        }

        const admin = createClient(URL, SERVICE);
        const normalized = normalizeTelegramData(telegramData);

        // Ищем существующего пользователя по telegram_id
        const { data: profiles } = await admin
            .from('profiles')
            .select('id, telegram_id')
            .eq('telegram_id', normalized.telegram_id)
            .limit(1);

        let userId: string;

        if (profiles && profiles.length > 0) {
            // Пользователь существует - обновляем данные
            userId = profiles[0].id;
            await admin
                .from('profiles')
                .update({
                    full_name: normalized.full_name,
                    telegram_username: normalized.telegram_username,
                    telegram_photo_url: normalized.telegram_photo_url,
                    telegram_verified: true,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', userId);
        } else {
            // Создаем нового пользователя
            // Используем telegram_id как основу для email (временный)
            const tempEmail = `telegram_${normalized.telegram_id}@telegram.local`;
            const tempPassword = crypto.randomBytes(32).toString('hex');

            // Создаем пользователя в Supabase Auth
            const { data: authUser, error: authError } = await admin.auth.admin.createUser({
                email: tempEmail,
                password: tempPassword,
                email_confirm: true,
                user_metadata: {
                    telegram_id: normalized.telegram_id,
                    telegram_username: normalized.telegram_username,
                    auth_provider: 'telegram',
                },
            });

            if (authError || !authUser.user) {
                console.error('[telegram/login] Auth error:', authError);
                return NextResponse.json(
                    { ok: false, error: 'auth_error', message: authError?.message || 'Ошибка создания пользователя' },
                    { status: 500 }
                );
            }

            userId = authUser.user.id;

            // Создаем профиль
            const { error: profileError } = await admin
                .from('profiles')
                .insert({
                    id: userId,
                    full_name: normalized.full_name,
                    telegram_id: normalized.telegram_id,
                    telegram_username: normalized.telegram_username,
                    telegram_photo_url: normalized.telegram_photo_url,
                    telegram_verified: true,
                });

            if (profileError) {
                console.error('[telegram/login] Profile error:', profileError);
                // Не критично, профиль может быть создан позже
            }
        }

        // Создаем сессию для пользователя
        // Используем подход с временным паролем (аналогично WhatsApp)
        const tempPassword = crypto.randomBytes(16).toString('hex');
        const tempEmail = `telegram_${normalized.telegram_id}@telegram.local`;

        // Убеждаемся, что у пользователя есть email
        const { data: currentUser } = await admin.auth.admin.getUserById(userId);
        if (!currentUser?.user?.email) {
            await admin.auth.admin.updateUserById(userId, {
                email: tempEmail,
                email_confirm: true,
            });
        }

        // Устанавливаем временный пароль
        const { error: passwordError } = await admin.auth.admin.updateUserById(userId, {
            password: tempPassword,
        });

        if (passwordError) {
            console.error('[telegram/login] Password error:', passwordError);
            return NextResponse.json(
                { ok: false, error: 'session_error', message: 'Не удалось создать сессию' },
                { status: 500 }
            );
        }

        return NextResponse.json({
            ok: true,
            userId,
            email: currentUser?.user?.email || tempEmail,
            password: tempPassword,
            needsSignIn: true,
            redirect: '/',
        });
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error('[telegram/login] error:', e);
        return NextResponse.json(
            { ok: false, error: 'internal', message: msg },
            { status: 500 }
        );
    }
}
```

**Важно:** Добавьте импорт `crypto` в начало файла:
```typescript
import crypto from 'crypto';
```

---

### Шаг 6: Создание миграции для добавления полей Telegram в таблицу profiles

**Файл:** `supabase/migrations/XXXXXX_add_telegram_fields.sql`

```sql
-- Добавляем поля для Telegram авторизации
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS telegram_id BIGINT UNIQUE,
ADD COLUMN IF NOT EXISTS telegram_username TEXT,
ADD COLUMN IF NOT EXISTS telegram_photo_url TEXT,
ADD COLUMN IF NOT EXISTS telegram_verified BOOLEAN DEFAULT FALSE;

-- Создаем индекс для быстрого поиска по telegram_id
CREATE INDEX IF NOT EXISTS idx_profiles_telegram_id ON profiles(telegram_id);

-- Комментарии
COMMENT ON COLUMN profiles.telegram_id IS 'Telegram User ID';
COMMENT ON COLUMN profiles.telegram_username IS 'Telegram username (без @)';
COMMENT ON COLUMN profiles.telegram_photo_url IS 'URL аватара из Telegram';
COMMENT ON COLUMN profiles.telegram_verified IS 'Подтвержден ли Telegram аккаунт';
```

**Применить миграцию:**
```bash
# Через Supabase CLI
supabase db push

# Или через Supabase Dashboard
# SQL Editor → выполнить SQL запрос
```

---

### Шаг 7: Создание компонента Telegram Login Widget

**Файл:** `apps/web/src/components/auth/TelegramLoginWidget.tsx`

```typescript
'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

// ⚠️ ВАЖНО: Замените на username вашего бота (без @)
// Например, если бот @kezek_auth_bot, то используйте 'kezek_auth_bot'
const TELEGRAM_BOT_USERNAME = 'kezek_auth_bot';

interface TelegramLoginWidgetProps {
    redirectTo?: string;
    onSuccess?: () => void;
    onError?: (error: string) => void;
    size?: 'large' | 'medium' | 'small';
    cornerRadius?: number;
    requestAccess?: 'write' | 'read';
}

/**
 * Компонент Telegram Login Widget
 * Использует официальный виджет от Telegram
 * Документация: https://core.telegram.org/widgets/login
 */
export function TelegramLoginWidget({ 
    redirectTo = '/', 
    onSuccess,
    onError,
    size = 'large',
    cornerRadius,
    requestAccess = 'write',
}: TelegramLoginWidgetProps) {
    const router = useRouter();
    const containerRef = useRef<HTMLDivElement>(null);
    const [loading, setLoading] = useState(false);
    const callbackName = `onTelegramAuth_${Math.random().toString(36).substring(7)}`;

    useEffect(() => {
        if (!containerRef.current) return;

        // Очищаем контейнер перед добавлением виджета
        containerRef.current.innerHTML = '';

        // Создаем уникальную callback функцию для этого экземпляра виджета
        (window as any)[callbackName] = async (user: {
            id: number;
            first_name?: string;
            last_name?: string;
            username?: string;
            photo_url?: string;
            auth_date: number;
            hash: string;
        }) => {
            setLoading(true);
            try {
                console.log('[TelegramLoginWidget] Received auth data:', { 
                    id: user.id, 
                    username: user.username,
                    hasHash: !!user.hash 
                });

                // Отправляем данные на сервер
                const response = await fetch('/api/auth/telegram/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(user),
                });

                const data = await response.json();

                if (!data.ok) {
                    throw new Error(data.message || 'Ошибка авторизации');
                }

                console.log('[TelegramLoginWidget] Server response:', { 
                    ok: data.ok, 
                    userId: data.userId,
                    needsSignIn: data.needsSignIn 
                });

                // Если нужно войти с email и паролем
                if (data.needsSignIn && data.email && data.password) {
                    const { supabase } = await import('@/lib/supabaseClient');
                    const { error: signInError } = await supabase.auth.signInWithPassword({
                        email: data.email,
                        password: data.password,
                    });

                    if (signInError) {
                        throw new Error(signInError.message);
                    }

                    console.log('[TelegramLoginWidget] Signed in successfully');
                    
                    // Обновляем страницу для установки cookies
                    router.refresh();
                    await new Promise(resolve => setTimeout(resolve, 100));
                }

                onSuccess?.();
                router.push(redirectTo);
            } catch (error) {
                const errorMsg = error instanceof Error ? error.message : 'Неизвестная ошибка';
                console.error('[TelegramLoginWidget] Error:', errorMsg);
                onError?.(errorMsg);
            } finally {
                setLoading(false);
            }
        };

        // Загружаем Telegram Widget скрипт
        const script = document.createElement('script');
        script.src = 'https://telegram.org/js/telegram-widget.js?22';
        script.setAttribute('data-telegram-login', TELEGRAM_BOT_USERNAME);
        script.setAttribute('data-size', size);
        script.setAttribute('data-onauth', `${callbackName}(user)`);
        script.setAttribute('data-request-access', requestAccess);
        
        if (cornerRadius !== undefined) {
            script.setAttribute('data-radius', cornerRadius.toString());
        }
        
        script.async = true;

        containerRef.current.appendChild(script);

        // Очистка при размонтировании
        return () => {
            if (containerRef.current) {
                containerRef.current.innerHTML = '';
            }
            // Удаляем callback из window
            delete (window as any)[callbackName];
        };
    }, [redirectTo, onSuccess, onError, size, cornerRadius, requestAccess, callbackName, router]);

    return (
        <div className="relative">
            {loading && (
                <div className="absolute inset-0 flex items-center justify-center bg-white/80 dark:bg-gray-900/80 rounded-lg z-10">
                    <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                        <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Авторизация...
                    </div>
                </div>
            )}
            <div ref={containerRef} className="flex justify-center" />
        </div>
    );
}
```

**Как это работает:**
- Виджет автоматически создает кнопку Telegram (официальный стиль)
- При клике открывается окно авторизации Telegram
- После авторизации вызывается callback с данными пользователя
- Данные проверяются на сервере и создается сессия

---

### Шаг 8: Добавление кнопки Telegram на страницу входа

**Файл:** `apps/web/src/app/auth/sign-in/SignInPage.tsx`

Найдите место, где находится кнопка "Войти через Google" и добавьте после неё:

```typescript
import { TelegramLoginWidget } from '@/components/auth/TelegramLoginWidget';

// В функции компонента, после кнопки Google:
<TelegramLoginWidget
    redirectTo={redirectParam || '/'}
    onSuccess={() => {
        console.log('Telegram auth successful');
    }}
    onError={(error) => {
        setError(error);
    }}
    size="large"
/>
```

**Пример полного блока кнопок:**

```typescript
<div className="space-y-3">
    {/* Email вход */}
    <form onSubmit={sendOtp} className="space-y-4">
        {/* ... форма email ... */}
    </form>

    <div className="relative">
        <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-300 dark:border-gray-700"></div>
        </div>
        <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-white dark:bg-gray-900 text-gray-500 dark:text-gray-400">
                или
            </span>
        </div>
    </div>

    {/* OAuth кнопки */}
    <div className="space-y-3">
        <button
            type="button"
            onClick={signInWithGoogle}
            disabled={sending}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
        >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
                {/* SVG иконка Google */}
            </svg>
            Продолжить с Google
        </button>

        <TelegramLoginWidget
            redirectTo={redirectParam || '/'}
            onError={(error) => setError(error)}
            size="large"
        />

        <Link
            href="/auth/whatsapp"
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                {/* SVG иконка WhatsApp */}
            </svg>
            Войти через WhatsApp
        </Link>
    </div>
</div>
```

---

### Шаг 9: Добавление кнопки Telegram на страницу регистрации

**Файл:** `apps/web/src/app/auth/sign-up/page.tsx`

Аналогично добавьте кнопку Telegram после кнопки Google.

---

### Шаг 10: Обновление типов TypeScript (опционально)

**Файл:** `apps/web/src/types/profile.ts` (если есть)

Добавьте поля Telegram:

```typescript
export interface Profile {
    // ... существующие поля
    telegram_id?: number | null;
    telegram_username?: string | null;
    telegram_photo_url?: string | null;
    telegram_verified?: boolean | null;
}
```

---

## 🧪 ТЕСТИРОВАНИЕ

### Шаг 11: Локальное тестирование

1. **Запустите dev сервер:**
   ```bash
   cd apps/web
   npm run dev
   ```

2. **Откройте страницу входа:**
   ```
   http://localhost:3000/auth/sign-in
   ```

3. **Нажмите "Войти через Telegram"**

4. **Проверьте:**
   - Открывается виджет Telegram
   - После авторизации происходит редирект
   - Пользователь создается/обновляется в БД
   - Сессия устанавливается корректно

### Шаг 12: Проверка в продакшене

1. **Убедитесь, что:**
   - `TELEGRAM_BOT_TOKEN` добавлен в переменные окружения
   - Домен настроен в BotFather (`/setdomain`)
   - Миграция применена к БД

2. **Протестируйте на продакшене:**
   - Откройте `https://kezek.kg/auth/sign-in`
   - Попробуйте войти через Telegram

---

## 🔍 ОТЛАДКА

### Проблемы и решения

**1. "Invalid signature"**
- Проверьте, что `TELEGRAM_BOT_TOKEN` правильный
- Убедитесь, что токен соответствует боту, для которого настроен домен

**2. "Auth data expired"**
- Данные от Telegram действительны 24 часа
- Попробуйте авторизоваться заново

**3. Виджет не загружается**
- Проверьте, что домен настроен в BotFather
- Убедитесь, что используете правильный username бота

**4. Пользователь не создается**
- Проверьте логи сервера
- Убедитесь, что миграция применена
- Проверьте права доступа к таблице `profiles`

---

## 📚 ДОПОЛНИТЕЛЬНЫЕ РЕСУРСЫ

- [Telegram Login Widget документация](https://core.telegram.org/widgets/login)
- [Telegram Bot API](https://core.telegram.org/bots/api)
- [Проверка авторизации](https://core.telegram.org/widgets/login#checking-authorization)

---

## ✅ ЧЕКЛИСТ

- [ ] Создан Telegram Bot через @BotFather
- [ ] Настроен домен для виджета
- [ ] Добавлен `TELEGRAM_BOT_TOKEN` в переменные окружения
- [ ] Создан файл `lib/telegram/verify.ts`
- [ ] Создан API endpoint `/api/auth/telegram/login`
- [ ] Применена миграция для полей Telegram
- [ ] Создан компонент `TelegramLoginWidget`
- [ ] Добавлена кнопка на страницу входа
- [ ] Добавлена кнопка на страницу регистрации
- [ ] Протестировано локально
- [ ] Протестировано в продакшене

---

**Готово!** Теперь пользователи могут входить через Telegram. 🎉

