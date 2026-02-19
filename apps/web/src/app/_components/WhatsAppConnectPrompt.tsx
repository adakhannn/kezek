'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { supabase } from '@/lib/supabaseClient';
import { validatePhone } from '@/lib/validation';
import { t } from '@/app/_components/i18n/LanguageProvider';

type Props = {
    onDismiss?: () => void;
    onSuccess?: () => void;
};

export function WhatsAppConnectPrompt({ onDismiss, onSuccess }: Props) {
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
            // Обновляем телефон пользователя через API
            const resp = await fetch('/api/user/update-phone', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ phone: trimmedPhone }),
            });

            if (!resp.ok) {
                const data = await resp.json();
                throw new Error(
                    data.error || t('notifications.whatsapp.updateError', 'Не удалось обновить телефон')
                );
            }

            // Отправляем OTP на телефон для подтверждения
            const { error: otpError } = await supabase.auth.signInWithOtp({
                phone: trimmedPhone,
                options: {
                    shouldCreateUser: false, // не создаем нового пользователя
                },
            });

            if (otpError) {
                throw otpError;
            }

            // Если OTP отправлен успешно, перенаправляем на страницу подтверждения
            router.push(`/auth/verify-otp?phone=${encodeURIComponent(trimmedPhone)}&from=whatsapp-setup`);
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
        } finally {
            setLoading(false);
        }
    }

    if (success) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl border border-gray-200 dark:border-gray-700">
                    <div className="text-center">
                        <div className="w-16 h-16 mx-auto mb-4 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                            <svg className="w-8 h-8 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                        </div>
                        <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
                            {t('notifications.whatsapp.connectedTitle', 'Телефон подключен!')}
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                            {t(
                                'notifications.whatsapp.connectedDescription',
                                'Теперь вы будете получать уведомления через WhatsApp'
                            )}
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-md w-full shadow-2xl border border-gray-200 dark:border-gray-700">
                <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
                                <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.239-.375a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                                </svg>
                            </div>
                            <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                                {t('notifications.whatsapp.connectTitle', 'Подключите WhatsApp')}
                            </h3>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                            {t(
                                'notifications.whatsapp.connectDescription',
                                'Подключите номер телефона для получения уведомлений через WhatsApp. Это удобнее и быстрее!'
                            )}
                        </p>
                    </div>
                    {onDismiss && (
                        <button
                            onClick={onDismiss}
                            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    )}
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label
                            htmlFor="phone"
                            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                        >
                            {t('notifications.whatsapp.phoneLabel', 'Номер телефона')}
                        </label>
                        <input
                            id="phone"
                            type="tel"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            placeholder="+996555123456"
                            className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                            required
                            disabled={loading}
                        />
                        <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                            {t(
                                'notifications.whatsapp.phoneHint',
                                'Формат: +996555123456 (с кодом страны)'
                            )}
                        </p>
                    </div>

                    {error && (
                        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                            <p className="text-sm text-red-800 dark:text-red-300">{error}</p>
                        </div>
                    )}

                    <div className="flex gap-3">
                        {onDismiss && (
                            <button
                                type="button"
                                onClick={onDismiss}
                                disabled={loading}
                                className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
                            >
                                {t('notifications.whatsapp.later', 'Позже')}
                            </button>
                        )}
                        <button
                            type="submit"
                            disabled={loading || !phone.trim()}
                            className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-indigo-600 to-pink-600 rounded-lg hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading
                                ? t('notifications.whatsapp.sending', 'Отправка...')
                                : t('notifications.whatsapp.submit', 'Подключить')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

