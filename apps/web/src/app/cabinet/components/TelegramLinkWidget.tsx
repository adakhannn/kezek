'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

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

interface TelegramLinkWidgetProps {
    onSuccess?: () => void;
    onError?: (error: string) => void;
    size?: 'large' | 'medium' | 'small';
}

type TelegramCallback = (user: TelegramUser) => void | Promise<void>;

/**
 * Компонент для связывания Telegram аккаунта с текущим пользователем
 * Использует Telegram Login Widget, но вызывает /api/auth/telegram/link вместо /api/auth/telegram/login
 */
export function TelegramLinkWidget({
    onSuccess,
    onError,
    size = 'medium',
}: TelegramLinkWidgetProps) {
    const router = useRouter();
    const containerRef = useRef<HTMLDivElement | null>(null);
    const [loading, setLoading] = useState(false);
    
    // Храним последние версии callback'ов в ref, чтобы не перезапускать useEffect
    const onSuccessRef = useRef(onSuccess);
    const onErrorRef = useRef(onError);
    
    useEffect(() => {
        onSuccessRef.current = onSuccess;
        onErrorRef.current = onError;
    }, [onSuccess, onError]);

    useEffect(() => {
        if (!containerRef.current) return;

        // Уникальное имя callback'а для этого маунта
        const callbackName = `onTelegramLink_${Math.random().toString(36).slice(2)}`;

        // Чистим контейнер перед инициализацией
        containerRef.current.innerHTML = '';

        // Регистрируем callback в window
        const w = window as typeof window & Record<string, TelegramCallback>;
        w[callbackName] = async (user: TelegramUser) => {
            setLoading(true);
            try {
                // Отправляем данные Telegram на API для связывания
                const resp = await fetch('/api/auth/telegram/link', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(user),
                });

                const data = await resp.json();

                if (!data?.ok) {
                    throw new Error(data?.message || 'Ошибка привязки Telegram');
                }

                // Обновляем страницу, чтобы показать обновленный профиль
                router.refresh();
                await new Promise((resolve) => setTimeout(resolve, 100));

                onSuccessRef.current?.();
            } catch (e) {
                const msg = e instanceof Error ? e.message : 'Неизвестная ошибка';
                console.error('[TelegramLinkWidget] error:', e);
                onErrorRef.current?.(msg);
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
        script.setAttribute('data-request-access', 'write');
        script.async = true;

        containerRef.current.appendChild(script);

        return () => {
            if (containerRef.current) {
                containerRef.current.innerHTML = '';
            }
            delete w[callbackName];
        };
    }, [size, router]); // Убрали onSuccess и onError из зависимостей

    return (
        <div className="relative">
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
                        <span>Привязка...</span>
                    </div>
                </div>
            )}
            <div ref={containerRef} className="flex justify-center" />
        </div>
    );
}

