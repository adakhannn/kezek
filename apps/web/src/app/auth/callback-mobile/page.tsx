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
        
        // Извлекаем токены из hash или query параметров
        const hash = window.location.hash.substring(1);
        const hashParams = new URLSearchParams(hash);
        const queryParams = new URLSearchParams(window.location.search);

        const accessToken = hashParams.get('access_token') || queryParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token') || queryParams.get('refresh_token');
        const code = queryParams.get('code');

        // Формируем deep link с токенами
        let deepLink = redirect;
        
        if (accessToken && refreshToken) {
            // Используем hash для передачи токенов (более безопасно)
            deepLink = `${redirect}#access_token=${accessToken}&refresh_token=${refreshToken}&type=recovery`;
        } else if (code) {
            // Используем query параметр для code
            deepLink = `${redirect}?code=${code}`;
        }

        // Пытаемся открыть deep link
        // Если приложение установлено, оно откроется
        // Если нет, пользователь останется на веб-сайте
        window.location.href = deepLink;

        // Fallback: если через 2 секунды не произошел редирект, показываем сообщение
        setTimeout(() => {
            // Проверяем, остались ли мы на этой странице
            if (window.location.pathname.includes('callback-mobile')) {
                // Редиректим на обычную callback страницу
                window.location.href = '/auth/callback';
            }
        }, 2000);
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

