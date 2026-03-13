'use client';

// apps/web/src/components/auth/TelegramLoginWidget.tsx

import { useRouter } from 'next/navigation';
import { memo, useEffect, useRef, useState } from 'react';

import {logError} from '@/lib/log';
import type { TelegramAuthData } from '@/lib/telegram/verify';

const TELEGRAM_BOT_USERNAME = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || 'kezek_auth_bot';

type TelegramUser = {
    id: number;
    first_name?: string;
    last_name?: string;
    username?: string;
    photo_url?: string;
    auth_date: number;
    hash: string;
};

interface TelegramLoginWidgetProps {
    redirectTo?: string;
    onSuccess?: () => void;
    onError?: (error: string) => void;
    size?: 'large' | 'medium' | 'small';
    cornerRadius?: number;
    requestAccess?: 'write' | 'read';
}

type TelegramCallback = (user: TelegramUser) => void | Promise<void>;

/**
 * Обёртка над официальным Telegram Login Widget.
 * Документация: https://core.telegram.org/widgets/login
 */
function TelegramLoginWidgetComponent({
    redirectTo = '/',
    onSuccess,
    onError,
    size = 'large',
    cornerRadius,
    requestAccess = 'write',
}: TelegramLoginWidgetProps) {
    const router = useRouter();
    const containerRef = useRef<HTMLDivElement | null>(null);
    const [loading, setLoading] = useState(false);
    const [currentHostname, setCurrentHostname] = useState<string | null>(null);

    useEffect(() => {
        if (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
            setCurrentHostname(window.location.hostname);
        }
    }, []);
    
    // Храним последние версии callback'ов в ref, чтобы не перезапускать useEffect
    const onSuccessRef = useRef(onSuccess);
    const onErrorRef = useRef(onError);
    const redirectToRef = useRef(redirectTo);
    
    useEffect(() => {
        onSuccessRef.current = onSuccess;
        onErrorRef.current = onError;
        redirectToRef.current = redirectTo;
    }, [onSuccess, onError, redirectTo]);

    useEffect(() => {
        if (!containerRef.current) return;

        // Уникальное имя callback'а для этого маунта
        const callbackName = `onTelegramAuth_${Math.random().toString(36).slice(2)}`;

        // Чистим контейнер перед инициализацией
        containerRef.current.innerHTML = '';

        // Регистрируем callback в window с типом
        const w = window as typeof window & Record<string, TelegramCallback>;
        w[callbackName] = async (user: TelegramUser) => {
            setLoading(true);
            try {
                // Отправляем данные Telegram на наш API
                const resp = await fetch('/api/auth/telegram/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(user),
                });

                const data = await resp.json().catch(() => ({}));

                // API-ответы стандартизированы через createSuccessResponse/createErrorResponse:
                // успешный ответ: { ok: true, data: { ...payload }, ...additionalFields }
                // Для этого виджета нам важно корректно вытащить payload:
                type TelegramLoginPayload = TelegramAuthData & {
                    needsSignIn?: boolean;
                    redirect?: string;
                    email?: string;
                    password?: string;
                };

                const payload: TelegramLoginPayload =
                    data && typeof data === 'object' && 'data' in data && data.data
                        ? (data as { data: TelegramLoginPayload }).data
                        : (data as TelegramLoginPayload);

                if (!data?.ok) {
                    const apiMessage = data?.message || 'Ошибка авторизации через Telegram';
                    throw new Error(apiMessage);
                }

                // Отладка: смотрим, что вернул API
                // eslint-disable-next-line no-console
                console.log('[TelegramLoginWidget] API response', data);

                // Если API вернул данные для входа — выполняем вход через Supabase
                if (payload.needsSignIn && payload.email && payload.password) {
                    // eslint-disable-next-line no-console
                    console.log('[TelegramLoginWidget] Starting Supabase signInWithPassword');
                    const { supabase } = await import('@/lib/supabaseClient');
                    const { error: signInError } = await supabase.auth.signInWithPassword({
                        email: payload.email,
                        password: payload.password,
                    });

                    if (signInError) {
                         
                        console.error('[TelegramLoginWidget] Supabase signIn error', signInError);
                        throw new Error(signInError.message);
                    }

                    // eslint-disable-next-line no-console
                    console.log('[TelegramLoginWidget] Supabase signIn success, refreshing router');

                    // Обновляем серверные компоненты и даём кукам установиться
                    router.refresh();
                    await new Promise((resolve) => setTimeout(resolve, 100));
                }

                onSuccessRef.current?.();

                const targetUrl = payload.redirect || redirectToRef.current;

                // Для корректного обновления серверного хедера после входа
                // выполняем полноценную навигацию браузера, чтобы куки и
                // серверные компоненты гарантированно были в актуальном состоянии.
                if (typeof window !== 'undefined') {
                    window.location.assign(targetUrl);
                } else {
                    router.push(targetUrl);
                }
            } catch (e) {
                const msg = e instanceof Error ? e.message : 'Неизвестная ошибка';
                // Ожидаемые сообщения не логируем в консоль как ошибку — пользователь видит их на экране
                const isExpectedUnavailable = /временно недоступен|обратитесь к администратору/i.test(msg);
                const isRateLimit = /лимит запросов|rate limit/i.test(msg);
                if (!isExpectedUnavailable && !isRateLimit) {
                    logError('TelegramLoginWidget', `Error during login: ${msg}`);
                }
                 
                console.error('[TelegramLoginWidget] Error during login', e);
                // «Bot domain invalid» на проде: домен не добавлен в @BotFather → /setdomain
                const displayMessage = /bot domain invalid|domain invalid/i.test(msg)
                    ? 'Домен сайта не привязан к боту Telegram. Администратору нужно в @BotFather выполнить /setdomain и указать домен этого сайта.'
                    : msg;
                onErrorRef.current?.(displayMessage);
            } finally {
                setLoading(false);
            }
        };

        // Вставляем официальный скрипт Telegram
        const script = document.createElement('script');
        script.src = 'https://telegram.org/js/telegram-widget.js?22';
        script.setAttribute('data-telegram-login', TELEGRAM_BOT_USERNAME);
        script.setAttribute('data-size', size);
        script.setAttribute('data-onauth', `${callbackName}(user)`);
        script.setAttribute('data-request-access', requestAccess);
        if (cornerRadius !== undefined) {
            script.setAttribute('data-radius', String(cornerRadius));
        }
        script.async = true;
        
        script.onerror = () => {
            logError('TelegramLoginWidget', 'Failed to load Telegram widget script');
            onErrorRef.current?.('Не удалось загрузить виджет Telegram. Проверьте подключение к интернету.');
        };

        containerRef.current.appendChild(script);

        return () => {
            if (containerRef.current) {
                containerRef.current.innerHTML = '';
            }
            delete w[callbackName];
        };
    }, [size, cornerRadius, requestAccess, router]); // Убрали onSuccess, onError, redirectTo из зависимостей

    const isLocalhost =
        typeof window !== 'undefined' &&
        (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

    return (
        <div className="relative w-full">
            {isLocalhost && (
                <p className="mb-2 text-xs text-amber-600 dark:text-amber-400 text-center">
                    Telegram не поддерживает <code className="bg-black/5 dark:bg-white/10 px-1 rounded">localhost</code> в @BotFather. Чтобы тестировать вход локально: запустите туннель (ngrok, localhost.run), откройте сайт по выданному URL и добавьте этот домен в @BotFather → <code className="bg-black/5 dark:bg-white/10 px-1 rounded">/setdomain</code>. Или проверяйте вход на проде.
                </p>
            )}
            {!isLocalhost && currentHostname && (
                <div className="mb-2 text-xs text-gray-500 dark:text-gray-400 text-center space-y-1">
                    <p>
                        Если видите «Bot domain invalid» — в @BotFather выберите бота <strong>@{TELEGRAM_BOT_USERNAME}</strong>, отправьте <code className="bg-black/5 dark:bg-white/10 px-1 rounded">/setdomain</code> и введите <strong>точно</strong> этот домен (как в адресной строке, без https://):
                    </p>
                    <p className="font-mono font-semibold text-gray-700 dark:text-gray-300 break-all">
                        {currentHostname}
                    </p>
                    <p>
                        Проверьте: домен один на бота; если заходите с www — добавьте www. Если без www — добавьте без www.
                    </p>
                </div>
            )}
            {loading && (
                <div className="absolute inset-0 flex items-center justify-center bg-white/80 dark:bg-gray-900/80 rounded-lg z-10">
                    <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                            <circle
                                className="opacity-25"
                                cx="12"
                                cy="12"
                                r="10"
                                stroke="currentColor"
                                strokeWidth="4"
                            />
                            <path
                                className="opacity-75"
                                fill="currentColor"
                                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                            />
                        </svg>
                        <span>Авторизация...</span>
                    </div>
                </div>
            )}
            <div 
                ref={containerRef} 
                className="flex justify-center min-h-[40px] w-full"
                style={{ minHeight: size === 'large' ? '48px' : size === 'medium' ? '40px' : '32px' }}
            />
        </div>
    );
}

// Мемоизируем компонент, чтобы он не пересоздавался при изменении родительского состояния
export const TelegramLoginWidget = memo(TelegramLoginWidgetComponent);


