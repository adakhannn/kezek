// apps/web/src/app/auth/callback-yandex/page.tsx
'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect } from 'react';

import { FullScreenStatus } from '@/app/_components/FullScreenStatus';

function YandexCallbackContent() {
    const router = useRouter();
    const searchParams = useSearchParams();

    useEffect(() => {
        const code = searchParams.get('code');
        const error = searchParams.get('error');
        const redirect = searchParams.get('redirect') || '/';

        if (error) {
            router.push(`/auth/sign-in?error=${encodeURIComponent(error)}`);
            return;
        }

        if (code) {
            // Редиректим на API endpoint для обработки
            router.push(`/api/auth/yandex/callback?code=${code}&redirect=${encodeURIComponent(redirect)}`);
        } else {
            router.push('/auth/sign-in?error=no_code');
        }
    }, [router, searchParams]);

    return (
        <FullScreenStatus
            title="Авторизация через Яндекс…"
            subtitle="Обрабатываем данные и настраиваем ваш кабинет"
            message="Пожалуйста, не закрывайте эту вкладку — вы будете автоматически перенаправлены."
            loading
        />
    );
}

export default function YandexCallback() {
    return (
        <Suspense
            fallback={
                <FullScreenStatus
                    title="Загрузка…"
                    subtitle="Готовим страницу авторизации"
                    loading
                />
            }
        >
            <YandexCallbackContent />
        </Suspense>
    );
}

