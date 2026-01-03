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
        
        console.log('[callback-mobile] Starting redirect, redirect param:', redirect);
        console.log('[callback-mobile] Current URL:', window.location.href);
        console.log('[callback-mobile] Hash:', window.location.hash);
        console.log('[callback-mobile] Search:', window.location.search);
        
        // Извлекаем токены из hash или query параметров
        const hash = window.location.hash.substring(1);
        const hashParams = new URLSearchParams(hash);
        const queryParams = new URLSearchParams(window.location.search);

        const accessToken = hashParams.get('access_token') || queryParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token') || queryParams.get('refresh_token');
        const code = queryParams.get('code');

        console.log('[callback-mobile] Extracted:', { 
            hasAccessToken: !!accessToken, 
            hasRefreshToken: !!refreshToken, 
            hasCode: !!code 
        });

        // Формируем deep link с токенами
        let deepLink = redirect;
        
        if (accessToken && refreshToken) {
            // Используем hash для передачи токенов (более безопасно)
            deepLink = `${redirect}#access_token=${encodeURIComponent(accessToken)}&refresh_token=${encodeURIComponent(refreshToken)}&type=recovery`;
        } else if (code) {
            // Используем query параметр для code
            deepLink = `${redirect}?code=${encodeURIComponent(code)}`;
        }

        console.log('[callback-mobile] Deep link:', deepLink);

        // Пытаемся открыть deep link несколькими способами
        // Способ 1: Создаем скрытую ссылку и кликаем по ней (более надежно для мобильных)
        const link = document.createElement('a');
        link.href = deepLink;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

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

        // Fallback: если через 3 секунды не произошел редирект, редиректим на обычную callback страницу
        const fallbackTimer = setTimeout(() => {
            console.warn('[callback-mobile] Deep link redirect failed, falling back to web callback');
            // Проверяем, остались ли мы на этой странице
            if (window.location.pathname.includes('callback-mobile')) {
                // Редиректим на обычную callback страницу с токенами
                let webCallbackUrl = '/auth/callback';
                if (accessToken && refreshToken) {
                    webCallbackUrl += `#access_token=${encodeURIComponent(accessToken)}&refresh_token=${encodeURIComponent(refreshToken)}`;
                } else if (code) {
                    webCallbackUrl += `?code=${encodeURIComponent(code)}`;
                }
                window.location.href = webCallbackUrl;
            }
        }, 3000);

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

