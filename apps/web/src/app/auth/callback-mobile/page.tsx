// apps/web/src/app/auth/callback-mobile/page.tsx
'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, Suspense } from 'react';

/**
 * Промежуточная страница для редиректа с веб-сайта на мобильное приложение
 * Извлекает токены из URL и редиректит на deep link
 */
function CallbackMobileContent() {
    const searchParams = useSearchParams();

    useEffect(() => {
        const redirect = searchParams.get('redirect') || 'kezek://auth/callback';
        
        // Логирование для отладки (только в dev режиме)
        if (process.env.NODE_ENV === 'development') {
            console.warn('[callback-mobile] Starting redirect, redirect param:', redirect);
            console.warn('[callback-mobile] Current URL:', window.location.href);
        }
        
        // Извлекаем токены из hash или query параметров
        const hash = window.location.hash.substring(1);
        const hashParams = new URLSearchParams(hash);
        const queryParams = new URLSearchParams(window.location.search);

        const accessToken = hashParams.get('access_token') || queryParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token') || queryParams.get('refresh_token');
        const code = queryParams.get('code');

        // Логирование для отладки
        if (process.env.NODE_ENV === 'development') {
            console.warn('[callback-mobile] Extracted:', { 
                hasAccessToken: !!accessToken, 
                hasRefreshToken: !!refreshToken, 
                hasCode: !!code 
            });
        }

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
                        console.error('[callback-mobile] Failed to store tokens:', errorText);
                    }
                } catch (error) {
                    console.error('[callback-mobile] Error storing tokens:', error);
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
            
            // Функция для попытки редиректа
            const attemptRedirect = (method: string, fn: () => void) => {
                try {
                    fn();
                    redirectAttempted = true;
                    console.warn(`[callback-mobile] Redirect attempted via ${method}`);
                } catch (e) {
                    console.warn(`[callback-mobile] ${method} failed:`, e);
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
