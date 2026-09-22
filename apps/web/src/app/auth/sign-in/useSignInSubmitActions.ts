'use client';

import { useCallback } from 'react';

import { toSafeAuthMessage } from '@/lib/authUserMessages';
import { buildGoogleOAuthRedirectUrl } from '@/lib/googleOAuthRedirect';
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
            const redirectTo = buildGoogleOAuthRedirectUrl(
                window.location.origin,
                redirectParam,
            );

            const { error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo,
                    queryParams: {
                        prompt: 'select_account',
                    },
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
            if (typeof window !== 'undefined') {
                sessionStorage.setItem('yandex_redirect', redirectParam);
                const startUrl = new URL('/api/auth/yandex/start', window.location.origin);
                startUrl.searchParams.set('redirect', redirectParam);
                window.location.assign(startUrl.toString());
            }
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
