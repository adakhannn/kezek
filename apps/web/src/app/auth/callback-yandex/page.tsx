// apps/web/src/app/auth/callback-yandex/page.tsx
'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect } from 'react';

import { FullScreenStatus } from '@/app/_components/FullScreenStatus';
import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import { sanitizeAuthReturnPath } from '@/lib/authReturnUrl';

function YandexCallbackContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { t } = useLanguage();

    useEffect(() => {
        const code = searchParams.get('code');
        const error = searchParams.get('error');
        const state = searchParams.get('state');
        
        // Получаем redirect из sessionStorage или используем дефолтный
        const redirect = typeof window !== 'undefined' 
            ? sanitizeAuthReturnPath(sessionStorage.getItem('yandex_redirect'))
            : '/';

        if (error) {
            if (typeof window !== 'undefined') {
                sessionStorage.removeItem('yandex_redirect');
            }
            router.push(`/auth/sign-in?error=${encodeURIComponent(error)}`);
            return;
        }

        if (code) {
            // Редиректим на API endpoint для обработки
            // Используем window.location.href вместо router.push для правильного редиректа на API route
            if (typeof window !== 'undefined') {
                sessionStorage.removeItem('yandex_redirect');
                window.location.replace(
                    `/api/auth/yandex/callback?code=${encodeURIComponent(code)}&redirect=${encodeURIComponent(redirect)}${state ? `&state=${encodeURIComponent(state)}` : ''}`,
                );
            }
        } else {
            if (typeof window !== 'undefined') {
                sessionStorage.removeItem('yandex_redirect');
                router.push('/auth/sign-in?error=no_code');
            }
        }
    }, [router, searchParams]);

    return (
        <FullScreenStatus
            title={t('auth.yandexCallback.title', 'Авторизация через Яндекс…')}
            subtitle={t('auth.yandexCallback.subtitle', 'Обрабатываем данные и настраиваем ваш кабинет')}
            message={t('auth.yandexCallback.message', 'Пожалуйста, не закрывайте эту вкладку — вы будете автоматически перенаправлены.')}
            loading
        />
    );
}

export default function YandexCallback() {
    const { t } = useLanguage();

    return (
        <Suspense
            fallback={
                <FullScreenStatus
                    title={t('auth.callback.loading.title', 'Загрузка…')}
                    subtitle={t('auth.callback.loading.subtitle', 'Готовим страницу авторизации')}
                    loading
                />
            }
        >
            <YandexCallbackContent />
        </Suspense>
    );
}

