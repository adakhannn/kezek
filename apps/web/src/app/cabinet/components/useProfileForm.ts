'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import { supabase } from '@/lib/supabaseClient';

import {
    createInitialProfile,
    createProfileUpdatePayload,
    mapProfileFromSources,
    sanitizeOtpCode,
    type ProfileFormProfile,
} from './profileFormHelpers';

type TranslateFn = (key: string, fallback?: string) => string;

export function useProfileForm(t: TranslateFn) {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [profile, setProfile] = useState<ProfileFormProfile>(createInitialProfile);
    const [otpCode, setOtpCodeState] = useState('');
    const [otpSending, setOtpSending] = useState(false);
    const [otpVerifying, setOtpVerifying] = useState(false);
    const [showOtpInput, setShowOtpInput] = useState(false);

    const clearMessageLater = useCallback((delayMs: number) => {
        setTimeout(() => setMessage(null), delayMs);
    }, []);

    const loadProfile = useCallback(async () => {
        setLoading(true);
        try {
            const {
                data: { user },
            } = await supabase.auth.getUser();
            if (!user) return;

            const { data, error: fetchError } = await supabase
                .from('profiles')
                .select(
                    'full_name, phone, notify_email, notify_whatsapp, whatsapp_verified, notify_telegram, telegram_id, telegram_verified'
                )
                .eq('id', user.id)
                .maybeSingle();

            if (fetchError) {
                const { logError } = require('@/lib/log');
                logError('ProfileForm', 'Error loading profile', fetchError);
                return;
            }

            setProfile(
                mapProfileFromSources(
                    data,
                    (user.user_metadata ?? {}) as { telegram_id?: number | string | null },
                ),
            );
        } catch (e) {
            const { logError } = require('@/lib/log');
            logError('ProfileForm', 'Error loading profile', e);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void loadProfile();
    }, [loadProfile]);

    const handleSubmit = useCallback(
        async (e: React.FormEvent<HTMLFormElement>) => {
            e.preventDefault();
            setSaving(true);
            setMessage(null);
            setError(null);

            try {
                const res = await fetch('/api/profile/update', {
                    method: 'POST',
                    headers: { 'content-type': 'application/json' },
                    body: JSON.stringify(createProfileUpdatePayload(profile)),
                });

                const data = await res.json();
                if (!res.ok || !data.ok) {
                    throw new Error(
                        data.message || data.error || t('cabinet.profile.error.save', 'Ошибка при сохранении'),
                    );
                }

                setMessage(t('cabinet.profile.saved', 'Профиль обновлен'));
                clearMessageLater(3000);
                router.refresh();
            } catch (e) {
                const msg = e instanceof Error ? e.message : String(e);
                setError(msg);
            } finally {
                setSaving(false);
            }
        },
        [clearMessageLater, profile, router, t],
    );

    const handleSendOtp = useCallback(async () => {
        if (!profile.phone) {
            setError(t('cabinet.profile.error.phoneRequired', 'Сначала укажите номер телефона'));
            return;
        }

        setOtpSending(true);
        setError(null);
        setMessage(null);

        try {
            const res = await fetch('/api/whatsapp/send-otp', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
            });

            const data = await res.json();
            if (!res.ok || !data.ok) {
                throw new Error(
                    data.message || data.error || t('cabinet.profile.error.sendCode', 'Ошибка при отправке кода'),
                );
            }

            setMessage(t('cabinet.profile.whatsapp.codeSent', 'Код отправлен на WhatsApp'));
            setShowOtpInput(true);
            clearMessageLater(5000);
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            setError(msg);
        } finally {
            setOtpSending(false);
        }
    }, [clearMessageLater, profile.phone, t]);

    const handleVerifyOtp = useCallback(async () => {
        if (otpCode.length !== 6) {
            setError(t('cabinet.profile.error.codeLength', 'Введите 6-значный код'));
            return;
        }

        setOtpVerifying(true);
        setError(null);
        setMessage(null);

        try {
            const res = await fetch('/api/whatsapp/verify-otp', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ code: otpCode }),
            });

            const data = await res.json();
            if (!res.ok || !data.ok) {
                throw new Error(
                    data.message || data.error || t('cabinet.profile.error.verifyCode', 'Ошибка при проверке кода'),
                );
            }

            setMessage(t('cabinet.profile.whatsapp.verifiedSuccess', 'WhatsApp номер подтвержден'));
            setProfile((prev) => ({ ...prev, whatsapp_verified: true }));
            setShowOtpInput(false);
            setOtpCodeState('');
            clearMessageLater(5000);
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            setError(msg);
        } finally {
            setOtpVerifying(false);
        }
    }, [clearMessageLater, otpCode, t]);

    const setOtpCode = useCallback((value: string) => {
        setOtpCodeState(sanitizeOtpCode(value));
    }, []);

    const handleTelegramLinkSuccess = useCallback(() => {
        void loadProfile();
        setMessage(t('cabinet.profile.telegram.connected', 'Telegram успешно подключен!'));
        clearMessageLater(3000);
    }, [clearMessageLater, loadProfile, t]);

    const handleTelegramLinkError = useCallback((err: string) => {
        setError(err);
        setTimeout(() => setError(null), 10000);
    }, []);

    return {
        loading,
        saving,
        message,
        error,
        profile,
        setProfile,
        otpCode,
        setOtpCode,
        otpSending,
        otpVerifying,
        showOtpInput,
        setShowOtpInput,
        handleSubmit,
        handleSendOtp,
        handleVerifyOtp,
        handleTelegramLinkSuccess,
        handleTelegramLinkError,
    };
}
