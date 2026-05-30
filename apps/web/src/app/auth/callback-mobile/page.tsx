// apps/web/src/app/auth/callback-mobile/page.tsx
'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, Suspense } from 'react';

import {logDebug, logError, logWarn} from '@/lib/log';
import { supabase } from '@/lib/supabaseClient';

function isAndroidDevice() {
    if (typeof navigator === 'undefined') {
        return false;
    }
    return /Android/i.test(navigator.userAgent);
}

function toAndroidIntentUrl(deepLink: string) {
    try {
        const parsed = new URL(deepLink);
        if (parsed.protocol !== 'kezek:') {
            return null;
        }

        const path = `${parsed.host}${parsed.pathname}`;
        const query = parsed.search || '';
        const hash = parsed.hash || '';
        return `intent://${path}${query}${hash}#Intent;scheme=kezek;package=kg.kezek.app;end`;
    } catch {
        return null;
    }
}

/**
 * Промежуточная страница для редиректа с веб-сайта на мобильное приложение
 * Извлекает токены из URL и редиректит на deep link
 */
function CallbackMobileContent() {
    const searchParams = useSearchParams();

    useEffect(() => {
        const redirect = searchParams.get('redirect') || 'kezek://auth/callback';
        
        // Логирование для отладки
        logDebug('CallbackMobile', 'Starting redirect', { redirect, url: window.location.href });
        
        // Извлекаем токены из hash или query параметров
        const hash = window.location.hash.substring(1);
        const hashParams = new URLSearchParams(hash);
        const queryParams = new URLSearchParams(window.location.search);

        const accessToken = hashParams.get('access_token') || queryParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token') || queryParams.get('refresh_token');
        const code = queryParams.get('code');

        // Логирование для отладки
        logDebug('CallbackMobile', 'Extracted tokens', { 
            hasAccessToken: !!accessToken, 
            hasRefreshToken: !!refreshToken, 
            hasCode: !!code 
        });

        // Формируем deep link заранее (будет обновлен после получения exchange code)
        let deepLink = redirect;
        
        // Асинхронная функция для обработки токенов
        const processTokens = async () => {
            let exchangeCode: string | null = null;
            
            if (accessToken && refreshToken) {
                try {
                    const response = await fetch('/api/auth/mobile-exchange', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            accessToken,
                            refreshToken,
                        }),
                    });
                    
                    if (response.ok) {
                        const data = await response.json();
                        exchangeCode = data.code;
                    } else {
                        const errorText = await response.text();
                        logError('CallbackMobile', 'Failed to store tokens', { error: errorText });
                    }
                } catch (error) {
                    logError('CallbackMobile', 'Error storing tokens', error);
                }
            }

            // Fallback для flow'ов (например, Telegram), где токены не приходят в URL,
            // но веб-сессия уже установлена в браузере.
            if (!exchangeCode && !code && (!accessToken || !refreshToken)) {
                try {
                    const {
                        data: { session },
                    } = await supabase.auth.getSession();

                    const sessionAccessToken = session?.access_token;
                    const sessionRefreshToken = session?.refresh_token;

                    if (sessionAccessToken && sessionRefreshToken) {
                        const response = await fetch('/api/auth/mobile-exchange', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({
                                accessToken: sessionAccessToken,
                                refreshToken: sessionRefreshToken,
                            }),
                        });

                        if (response.ok) {
                            const data = await response.json();
                            exchangeCode =
                                data && typeof data === 'object' && 'data' in data
                                    ? data.data?.code
                                    : data?.code;
                        } else {
                            const errorText = await response.text();
                            logError('CallbackMobile', 'Failed to store session tokens', {
                                error: errorText,
                            });
                        }
                    } else {
                        logWarn('CallbackMobile', 'No URL tokens and no browser session tokens');
                    }
                } catch (error) {
                    logError('CallbackMobile', 'Error storing browser session tokens', error);
                }
            }

            // Обновляем deep link с кодом обмена
            if (exchangeCode) {
                // Используем код обмена вместо прямых токенов (более безопасно)
                deepLink = `${redirect}?exchange_code=${encodeURIComponent(exchangeCode)}`;
            } else if (code) {
                // Используем query параметр для code (OAuth code от Supabase)
                deepLink = `${redirect}?code=${encodeURIComponent(code)}`;
            } else if (accessToken && refreshToken) {
                // Fallback: используем hash для передачи токенов напрямую
                deepLink = `${redirect}#access_token=${encodeURIComponent(accessToken)}&refresh_token=${encodeURIComponent(refreshToken)}&type=recovery`;
            }

            // Пытаемся открыть deep link несколькими способами
            let redirectAttempted = false;
            const intentUrl = toAndroidIntentUrl(deepLink);
            
            // Функция для попытки редиректа
            const attemptRedirect = (method: string, fn: () => void) => {
                try {
                    fn();
                    redirectAttempted = true;
                    logDebug('CallbackMobile', `Redirect attempted via ${method}`);
                } catch (e) {
                    logWarn('CallbackMobile', `${method} failed`, e);
                }
            };

            // Способ 1: Создаем скрытую ссылку и кликаем по ней (более надежно для мобильных)
            attemptRedirect('link.click', () => {
                const link = document.createElement('a');
                link.href = deepLink;
                link.style.display = 'none';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            });

            // Способ 1.1: Для Android Chrome пробуем intent://, который лучше возвращает в приложение
            if (isAndroidDevice() && intentUrl) {
                setTimeout(() => {
                    attemptRedirect('android.intent', () => {
                        window.location.href = intentUrl;
                    });
                }, 50);
            }

            // Способ 2: Пробуем через window.location.replace
            setTimeout(() => {
                if (!redirectAttempted) {
                    attemptRedirect('window.location.replace', () => {
                        window.location.replace(deepLink);
                    });
                }
            }, 100);

            // Способ 3: Пробуем через window.location.href
            setTimeout(() => {
                if (!redirectAttempted) {
                    attemptRedirect('window.location.href', () => {
                        window.location.href = deepLink;
                    });
                }
            }, 200);

            // Способ 4: Пробуем через window.open
            setTimeout(() => {
                if (!redirectAttempted) {
                    attemptRedirect('window.open', () => {
                        window.open(deepLink, '_self');
                    });
                }
            }, 300);
            
            // Способ 5: Если это Universal Link (https://), пробуем открыть напрямую
            if (deepLink.startsWith('https://')) {
                setTimeout(() => {
                    if (!redirectAttempted) {
                        attemptRedirect('direct navigation', () => {
                            window.location.href = deepLink;
                        });
                    }
                }, 400);
            }
        };

        // Запускаем обработку токенов
        processTokens();

            // Fallback: если через 1.5 секунды не произошел редирект, показываем блокирующий экран
            const fallbackTimer = setTimeout(() => {
                // Проверяем, остались ли мы на этой странице
                if (window.location.pathname.includes('callback-mobile')) {
                    // Скрываем весь контент страницы
                    const originalContent = document.body.innerHTML;
                    document.body.style.overflow = 'hidden';
                    
                    // Показываем блокирующий экран БЕЗ кнопки закрыть
                    const instructionDiv = document.createElement('div');
                    instructionDiv.id = 'callback-mobile-blocker';
                    instructionDiv.style.cssText = `
                        position: fixed;
                        top: 0;
                        left: 0;
                        right: 0;
                        bottom: 0;
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                        display: flex;
                        flex-direction: column;
                        justify-content: center;
                        align-items: center;
                        padding: 30px;
                        z-index: 99999;
                        color: white;
                        text-align: center;
                    `;
                    instructionDiv.innerHTML = `
                        <div style="
                            background: rgba(255, 255, 255, 0.1);
                            backdrop-filter: blur(10px);
                            border-radius: 20px;
                            padding: 40px 30px;
                            max-width: 400px;
                            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
                        ">
                            <div style="
                                width: 80px;
                                height: 80px;
                                border: 4px solid rgba(255, 255, 255, 0.3);
                                border-top-color: white;
                                border-radius: 50%;
                                animation: spin 1s linear infinite;
                                margin: 0 auto 30px;
                            "></div>
                            <h2 style="
                                margin: 0 0 20px 0;
                                font-size: 28px;
                                font-weight: bold;
                            ">Авторизация завершена!</h2>
                            <p style="
                                margin: 0 0 30px 0;
                                font-size: 18px;
                                line-height: 1.6;
                                opacity: 0.95;
                            ">
                                Вернитесь в мобильное приложение Kezek.<br/>
                                <strong>Вы будете автоматически авторизованы.</strong>
                            </p>
                            <div style="
                                background: rgba(255, 255, 255, 0.2);
                                border-radius: 12px;
                                padding: 20px;
                                margin-top: 20px;
                            ">
                                <p style="
                                    margin: 0;
                                    font-size: 14px;
                                    opacity: 0.9;
                                ">
                                    💡 Переключитесь на приложение вручную
                                </p>
                            </div>
                            <a
                                href="${intentUrl ?? deepLink}"
                                style="
                                    margin-top: 18px;
                                    display: inline-block;
                                    background: #ffffff;
                                    color: #111827;
                                    text-decoration: none;
                                    font-weight: 700;
                                    border-radius: 10px;
                                    padding: 12px 18px;
                                "
                            >
                                Открыть приложение
                            </a>
                        </div>
                        <style>
                            @keyframes spin {
                                to { transform: rotate(360deg); }
                            }
                        </style>
                    `;
                    document.body.innerHTML = '';
                    document.body.appendChild(instructionDiv);
                    
                    // Продолжаем попытки редиректа в фоне
                    const retryInterval = setInterval(() => {
                        if (!window.location.pathname.includes('callback-mobile')) {
                            clearInterval(retryInterval);
                            return;
                        }
                        try {
                            window.location.href = deepLink;
                        } catch (e) {
                            // Игнорируем ошибки
                        }
                    }, 2000);
                    
                    // Очищаем интервал через 5 минут (на случай, если пользователь не вернется)
                    setTimeout(() => {
                        clearInterval(retryInterval);
                    }, 5 * 60 * 1000);
                }
            }, 1500);

        return () => {
            clearTimeout(fallbackTimer);
        };
    }, [searchParams]);

    return (
        <div style={{ 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center', 
            height: '100vh',
            flexDirection: 'column',
            gap: '16px'
        }}>
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
            <p style={{ color: '#6b7280' }}>Перенаправление в приложение...</p>
        </div>
    );
}

export default function CallbackMobilePage() {
    return (
        <Suspense fallback={
            <div style={{ 
                display: 'flex', 
                justifyContent: 'center', 
                alignItems: 'center', 
                height: '100vh',
                flexDirection: 'column',
                gap: '16px'
            }}>
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
                <p style={{ color: '#6b7280' }}>Загрузка...</p>
            </div>
        }>
            <CallbackMobileContent />
        </Suspense>
    );
}
