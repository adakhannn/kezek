'use client';

import { useCallback } from 'react';

import { toSafeAuthMessage } from '@/lib/authUserMessages';
import { supabase } from '@/lib/supabaseClient';

type UseSignInSubmitActionsOptions = {
    redirectParam: string;
    setSending: (value: boolean) => void;
    setError: (value: string | null) => void;
};

export function useSignInSubmitActions({
    redirectParam,
    setSending,
    setError,
}: UseSignInSubmitActionsOptions) {
    const handleTelegramError = useCallback((err: string) => {
        setError(err);
    }, [setError]);

    const signInWithGoogle = useCallback(async () => {
        setSending(true);
        setError(null);
        try {
            const origin = process.env.NEXT_PUBLIC_SITE_ORIGIN ?? 'https://kezek.kg';
            const redirectTo = `${origin}/auth/callback?from=google&next=${encodeURIComponent(redirectParam)}`;

            const { error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo,
                },
            });
            if (error) throw error;
        } catch (err) {
            setError(toSafeAuthMessage(err));
            setSending(false);
        }
    }, [redirectParam, setError, setSending]);

    const signInWithYandex = useCallback(async () => {
        setSending(true);
        setError(null);
        try {
            const redirectUri =
                process.env.NEXT_PUBLIC_YANDEX_REDIRECT_URI ||
                'https://kezek.kg/auth/callback-yandex';
            const yandexAuthUrl = new URL('https://oauth.yandex.ru/authorize');
            yandexAuthUrl.searchParams.set('response_type', 'code');
            yandexAuthUrl.searchParams.set(
                'client_id',
                process.env.NEXT_PUBLIC_YANDEX_CLIENT_ID || '',
            );
            yandexAuthUrl.searchParams.set('redirect_uri', redirectUri);

            if (typeof window !== 'undefined') {
                sessionStorage.setItem('yandex_redirect', redirectParam);
            }

            window.location.href = yandexAuthUrl.toString();
        } catch (err) {
            setError(toSafeAuthMessage(err));
            setSending(false);
        }
    }, [redirectParam, setError, setSending]);

    return {
        handleTelegramError,
        signInWithGoogle,
        signInWithYandex,
    };
}
