'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import { AlertBanner } from '@/components/ui/AlertBanner';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Input } from '@/components/ui/Input';
import { supabase } from '@/lib/supabaseClient';
import { validatePhone } from '@/lib/validation';

type Props = {
    onDismiss?: () => void;
    onSuccess?: () => void;
};

export function WhatsAppConnectPrompt({ onDismiss, onSuccess }: Props) {
    const { t } = useLanguage();
    const router = useRouter();
    const [phone, setPhone] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError(null);

        const trimmedPhone = phone.trim();
        if (!trimmedPhone) {
            setError(t('notifications.whatsapp.enterPhone', 'Введите номер телефона'));
            return;
        }

        const phoneValidation = validatePhone(trimmedPhone, true);
        if (!phoneValidation.valid) {
            setError(
                phoneValidation.error ||
                    t(
                        'notifications.whatsapp.invalidFormat',
                        'Телефон должен быть в формате E.164, например: +996555123456'
                    )
            );
            return;
        }

        setLoading(true);
        try {
            const response = await fetch('/api/user/update-phone', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ phone: trimmedPhone }),
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(
                    data.error || t('notifications.whatsapp.updateError', 'Не удалось обновить телефон')
                );
            }

            const { error: otpError } = await supabase.auth.signInWithOtp({
                phone: trimmedPhone,
                options: {
                    shouldCreateUser: false,
                },
            });

            if (otpError) {
                throw otpError;
            }

            onSuccess?.();
            router.push(`/auth/verify-otp?phone=${encodeURIComponent(trimmedPhone)}&from=whatsapp-setup`);
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
        } finally {
            setLoading(false);
        }
    }

    if (success) {
        return (
            <Dialog
                open
                onClose={() => setSuccess(false)}
                title={t('notifications.whatsapp.connectedTitle', 'Телефон подключен!')}
                description={t(
                    'notifications.whatsapp.connectedDescription',
                    'Теперь вы будете получать уведомления через WhatsApp'
                )}
                size="sm"
                footer={
                    <div className="flex justify-end">
                        <Button type="button" onClick={() => setSuccess(false)}>
                            OK
                        </Button>
                    </div>
                }
            >
                <div className="flex justify-center">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--status-success-soft)] text-[var(--status-success)]">
                        <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                    </div>
                </div>
            </Dialog>
        );
    }

    return (
        <Dialog
            open
            onClose={() => onDismiss?.()}
            title={t('notifications.whatsapp.connectTitle', 'Подключите WhatsApp')}
            description={t(
                'notifications.whatsapp.connectDescription',
                'Подключите номер телефона для получения уведомлений через WhatsApp. Это удобнее и быстрее!'
            )}
            size="sm"
            footer={
                <div className="flex gap-3">
                    {onDismiss ? (
                        <Button type="button" variant="secondary" fullWidth onClick={onDismiss} disabled={loading}>
                            {t('notifications.whatsapp.later', 'Позже')}
                        </Button>
                    ) : null}
                    <Button type="submit" form="whatsapp-connect-form" fullWidth disabled={loading || !phone.trim()} isLoading={loading}>
                        {loading
                            ? t('notifications.whatsapp.sending', 'Отправка...')
                            : t('notifications.whatsapp.submit', 'Подключить')}
                    </Button>
                </div>
            }
        >
            <form id="whatsapp-connect-form" onSubmit={handleSubmit} className="space-y-4">
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--status-success-soft)] text-[var(--status-success)]">
                        <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.239-.375a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                        </svg>
                    </div>
                    <p className="type-caption text-[var(--text-muted)]">
                        {t('notifications.whatsapp.phoneHint', 'Формат: +996555123456 (с кодом страны)')}
                    </p>
                </div>

                <Input
                    id="phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    label={t('notifications.whatsapp.phoneLabel', 'Номер телефона')}
                    placeholder="+996555123456"
                    disabled={loading}
                    autoComplete="tel"
                />

                {error ? <AlertBanner variant="danger" message={error} /> : null}
            </form>
        </Dialog>
    );
}

