'use client';

import type { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import { useCallback } from 'react';

import { supabase } from '@/lib/supabaseClient';

type Mode = 'phone' | 'email';

type UseSignInSubmitActionsOptions = {
    mode: Mode;
    phone: string;
    email: string;
    redirectParam: string;
    router: AppRouterInstance;
    setSending: (value: boolean) => void;
    setError: (value: string | null) => void;
};

export function useSignInSubmitActions({
    mode,
    phone,
    email,
    redirectParam,
    router,
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
            const origin =
                typeof window !== 'undefined'
                    ? window.location.origin
                    : process.env.NEXT_PUBLIC_SITE_ORIGIN ?? 'https://kezek.kg';
            const redirectTo = `${origin}/auth/callback?from=google`;

            const { error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo,
                },
            });
            if (error) throw error;
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
            setSending(false);
        }
    }, [setError, setSending]);

    const signInWithYandex = useCallback(async () => {
        setSending(true);
        setError(null);
        try {
            const origin = process.env.NEXT_PUBLIC_SITE_ORIGIN || 'https://kezek.kg';
            const redirectUri = `${origin}/auth/callback-yandex`;
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
            setError(err instanceof Error ? err.message : String(err));
            setSending(false);
        }
    }, [redirectParam, setError, setSending]);

    const sendOtp = useCallback(async (e: React.FormEvent) => {
        e.preventDefault();
        setSending(true);
        setError(null);

        try {
            if (mode === 'phone') {
                const phoneNormalized = phone.trim();

                const { error } = await supabase.auth.signInWithOtp({
                    phone: phoneNormalized,
                    options: { channel: 'sms' },
                });
                if (error) throw error;

                router.push(
                    `/auth/verify-otp?phone=${encodeURIComponent(phoneNormalized)}&redirect=${encodeURIComponent(redirectParam)}`,
                );
            } else {
                const origin =
                    typeof window !== 'undefined'
                        ? window.location.origin
                        : process.env.NEXT_PUBLIC_SITE_ORIGIN ?? 'https://kezek.kg';
                const emailRedirectTo = `${origin}/auth/callback?next=${encodeURIComponent(redirectParam)}`;

                const { error } = await supabase.auth.signInWithOtp({
                    email,
                    options: {
                        emailRedirectTo,
                    },
                });
                if (error) throw error;

                router.push(
                    `/auth/verify-email?email=${encodeURIComponent(email)}&redirect=${encodeURIComponent(redirectParam)}`,
                );
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            setSending(false);
        }
    }, [email, mode, phone, redirectParam, router, setError, setSending]);

    return {
        handleTelegramError,
        signInWithGoogle,
        signInWithYandex,
        sendOtp,
    };
}
