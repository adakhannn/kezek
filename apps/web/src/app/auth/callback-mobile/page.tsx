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

            // Формируем deep link с кодом обмена
            let deepLink = redirect;
            
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
            // Способ 1: Создаем скрытую ссылку и кликаем по ней (более надежно для мобильных)
            try {
                const link = document.createElement('a');
                link.href = deepLink;
                link.style.display = 'none';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            } catch (e) {
                console.warn('[callback-mobile] link.click() failed:', e);
            }

            // Способ 2: Пробуем через window.location (fallback)
            setTimeout(() => {
                try {
                    window.location.replace(deepLink);
                } catch (e) {
                    console.warn('[callback-mobile] window.location.replace failed:', e);
                }
            }, 100);

            // Способ 3: Пробуем через window.open (еще один fallback)
            setTimeout(() => {
                try {
                    window.open(deepLink, '_self');
                } catch (e) {
                    console.warn('[callback-mobile] window.open failed:', e);
                }
            }, 200);
            
            // Способ 4: Если это Universal Link (https://), пробуем открыть напрямую
            if (deepLink.startsWith('https://')) {
                setTimeout(() => {
                    try {
                        window.location.href = deepLink;
                    } catch (e) {
                        console.warn('[callback-mobile] Direct navigation failed:', e);
                    }
                }, 300);
            }
        };

        // Запускаем обработку токенов
        processTokens();

        // Fallback: если через 2 секунды не произошел редирект, показываем инструкцию
        const fallbackTimer = setTimeout(() => {
            // Проверяем, остались ли мы на этой странице
            if (window.location.pathname.includes('callback-mobile')) {
                // Показываем инструкцию пользователю вместо автоматического редиректа
                const instructionDiv = document.createElement('div');
                instructionDiv.style.cssText = `
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0, 0, 0, 0.9);
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                    align-items: center;
                    padding: 20px;
                    z-index: 10000;
                    color: white;
                    text-align: center;
                `;
                instructionDiv.innerHTML = `
                    <h2 style="margin-bottom: 20px; font-size: 24px;">Авторизация завершена!</h2>
                    <p style="margin-bottom: 30px; font-size: 16px; line-height: 1.6;">
                        Вернитесь в мобильное приложение Kezek.<br/>
                        Вы будете автоматически авторизованы.
                    </p>
                    <button 
                        onclick="window.close()" 
                        style="
                            padding: 12px 24px;
                            background: #6366f1;
                            color: white;
                            border: none;
                            border-radius: 8px;
                            font-size: 16px;
                            cursor: pointer;
                        "
                    >
                        Закрыть
                    </button>
                `;
                document.body.appendChild(instructionDiv);
            }
        }, 2000);

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
