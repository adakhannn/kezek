'use client';

import { useState, useEffect } from 'react';

import { TelegramLinkWidget } from './TelegramLinkWidget';

import { supabase } from '@/lib/supabaseClient';


type Profile = {
    full_name: string | null;
    phone: string | null;
    notify_email: boolean;
    notify_whatsapp: boolean;
    whatsapp_verified: boolean;
    notify_telegram: boolean;
    telegram_connected: boolean;
};

export default function ProfileForm() {
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [profile, setProfile] = useState<Profile>({ 
        full_name: null, 
        phone: null,
        notify_email: true,
        notify_whatsapp: true,
        whatsapp_verified: false,
        notify_telegram: true,
        telegram_connected: false,
    });
    const [otpCode, setOtpCode] = useState('');
    const [otpSending, setOtpSending] = useState(false);
    const [otpVerifying, setOtpVerifying] = useState(false);
    const [showOtpInput, setShowOtpInput] = useState(false);

    useEffect(() => {
        loadProfile();
    }, []);

    async function loadProfile() {
        setLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data, error: fetchError } = await supabase
                .from('profiles')
                .select('full_name, phone, notify_email, notify_whatsapp, whatsapp_verified, notify_telegram, telegram_id, telegram_verified')
                .eq('id', user.id)
                .maybeSingle();

            if (fetchError) {
                console.error('Error loading profile:', fetchError);
                return;
            }

            const meta = (user.user_metadata ?? {}) as { telegram_id?: number | string | null };
            const telegramFromProfile = !!data?.telegram_id && !!data?.telegram_verified;
            const telegramFromMeta = !!meta.telegram_id;

            setProfile({
                full_name: data?.full_name ?? null,
                phone: data?.phone ?? null,
                notify_email: data?.notify_email ?? true,
                notify_whatsapp: data?.notify_whatsapp ?? true,
                whatsapp_verified: data?.whatsapp_verified ?? false,
                notify_telegram: data?.notify_telegram ?? true,
                telegram_connected: telegramFromProfile || telegramFromMeta,
            });
        } catch (e) {
            console.error('Error loading profile:', e);
        } finally {
            setLoading(false);
        }
    }

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setSaving(true);
        setMessage(null);
        setError(null);

        try {
            const res = await fetch('/api/profile/update', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({
                    full_name: profile.full_name || null,
                    phone: profile.phone || null,
                    notify_email: profile.notify_email,
                    notify_whatsapp: profile.notify_whatsapp,
                    notify_telegram: profile.notify_telegram,
                }),
            });

            const data = await res.json();
            if (!res.ok || !data.ok) {
                throw new Error(data.message || data.error || 'Ошибка при сохранении');
            }

            setMessage('Профиль обновлен');
            setTimeout(() => setMessage(null), 3000);
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            setError(msg);
        } finally {
            setSaving(false);
        }
    }

    async function handleSendOtp() {
        if (!profile.phone) {
            setError('Сначала укажите номер телефона');
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
                throw new Error(data.message || data.error || 'Ошибка при отправке кода');
            }

            setMessage('Код отправлен на WhatsApp');
            setShowOtpInput(true);
            setTimeout(() => setMessage(null), 5000);
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            setError(msg);
        } finally {
            setOtpSending(false);
        }
    }

    async function handleVerifyOtp() {
        if (otpCode.length !== 6) {
            setError('Введите 6-значный код');
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
                throw new Error(data.message || data.error || 'Ошибка при проверке кода');
            }

            setMessage('WhatsApp номер подтвержден');
            setProfile({ ...profile, whatsapp_verified: true });
            setShowOtpInput(false);
            setOtpCode('');
            setTimeout(() => setMessage(null), 5000);
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            setError(msg);
        } finally {
            setOtpVerifying(false);
        }
    }

    if (loading) {
        return (
            <div className="text-center py-8">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                <p className="mt-4 text-gray-500 dark:text-gray-400">Загрузка...</p>
            </div>
        );
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Имя
                    </label>
                    <input
                        type="text"
                        className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                        value={profile.full_name || ''}
                        onChange={(e) => setProfile({ ...profile, full_name: e.target.value || null })}
                        placeholder="Ваше имя"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Телефон <span className="text-gray-500 text-xs">(для связи, не используется для входа)</span>
                    </label>
                    <input
                        type="tel"
                        className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                        value={profile.phone || ''}
                        onChange={(e) => setProfile({ ...profile, phone: e.target.value || null })}
                        placeholder="+996XXXXXXXXX"
                    />
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        Укажите номер телефона, чтобы мастера могли связаться с вами при необходимости
                    </p>
                </div>
                
                {/* Настройки уведомлений */}
                <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
                        Уведомления о бронированиях
                    </h3>
                    <div className="space-y-3">
                        <label className="flex items-center justify-between cursor-pointer">
                            <div className="flex items-center gap-2">
                                <svg className="w-5 h-5 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                </svg>
                                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Email</span>
                            </div>
                            <input
                                type="checkbox"
                                checked={profile.notify_email}
                                onChange={(e) => setProfile({ ...profile, notify_email: e.target.checked })}
                                className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                            />
                        </label>
                        <div className="space-y-2">
                            <label className="flex items-center justify-between cursor-pointer">
                                <div className="flex items-center gap-2">
                                    <svg className="w-5 h-5 text-gray-500 dark:text-gray-400" fill="currentColor" viewBox="0 0 24 24">
                                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                                    </svg>
                                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">WhatsApp</span>
                                </div>
                                <input
                                    type="checkbox"
                                    checked={profile.notify_whatsapp}
                                    onChange={(e) => setProfile({ ...profile, notify_whatsapp: e.target.checked })}
                                    className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                                />
                            </label>
                            
                            {/* Статус верификации WhatsApp */}
                            {profile.notify_whatsapp && (
                                <div className="ml-7 space-y-2">
                                    {profile.whatsapp_verified ? (
                                        <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                            </svg>
                                            <span>Номер подтвержден</span>
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400">
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                                </svg>
                                                <span>Номер не подтвержден. Подтвердите для получения уведомлений.</span>
                                            </div>
                                            {!showOtpInput ? (
                                                <button
                                                    type="button"
                                                    onClick={handleSendOtp}
                                                    disabled={otpSending || !profile.phone}
                                                    className="text-sm px-3 py-1.5 rounded bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    {otpSending ? 'Отправка...' : 'Отправить код'}
                                                </button>
                                            ) : (
                                                <div className="space-y-2">
                                                    <div className="flex gap-2">
                                                        <input
                                                            type="text"
                                                            inputMode="numeric"
                                                            pattern="[0-9]*"
                                                            maxLength={6}
                                                            value={otpCode}
                                                            onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                                                            placeholder="000000"
                                                            className="w-24 rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-center text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={handleVerifyOtp}
                                                            disabled={otpVerifying || otpCode.length !== 6}
                                                            className="text-sm px-3 py-1.5 rounded bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                                        >
                                                            {otpVerifying ? 'Проверка...' : 'Подтвердить'}
                                                        </button>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setShowOtpInput(false);
                                                            setOtpCode('');
                                                        }}
                                                        className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                                                    >
                                                        Отменить
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Telegram */}
                        <label className="flex items-center justify-between cursor-pointer">
                            <div className="flex items-center gap-2">
                                <svg className="w-5 h-5 text-gray-500 dark:text-gray-400" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M12 0C5.371 0 0 5.371 0 12s5.371 12 12 12 12-5.371 12-12S18.629 0 12 0zm5.496 8.246l-1.89 8.91c-.143.637-.523.793-1.059.494l-2.93-2.162-1.414 1.362c-.156.156-.287.287-.586.287l.21-3.004 5.472-4.946c.238-.21-.051-.328-.369-.118l-6.768 4.263-2.91-.909c-.633-.197-.647-.633.133-.936l11.37-4.386c.523-.189.983.118.812.935z" />
                                </svg>
                                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Telegram</span>
                            </div>
                            <input
                                type="checkbox"
                                checked={profile.notify_telegram}
                                onChange={(e) =>
                                    setProfile({
                                        ...profile,
                                        notify_telegram: e.target.checked,
                                    })
                                }
                                className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                            />
                        </label>
                        {!profile.telegram_connected && (
                            <div className="ml-7 mt-2 space-y-2">
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                    Чтобы получать уведомления в Telegram, подключите Telegram аккаунт:
                                </p>
                                <div className="flex justify-start">
                                    <TelegramLinkWidget
                                        onSuccess={() => {
                                            loadProfile();
                                            setMessage('Telegram успешно подключен!');
                                            setTimeout(() => setMessage(null), 3000);
                                        }}
                                        onError={(err) => {
                                            setError(err);
                                            setTimeout(() => setError(null), 5000);
                                        }}
                                        size="medium"
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                    <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                        Выберите способы получения уведомлений о ваших бронированиях
                    </p>
                </div>
                
                {message && (
                    <div className="rounded bg-green-50 border border-green-200 px-3 py-2 text-sm text-green-800 dark:bg-green-950/40 dark:border-green-900/60 dark:text-green-100">
                        {message}
                    </div>
                )}
                {error && (
                    <div className="rounded bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-800 dark:bg-red-950/40 dark:border-red-900/60 dark:text-red-100">
                        {error}
                    </div>
                )}
                <button
                    type="submit"
                    disabled={saving}
                    className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                    {saving ? 'Сохранение...' : 'Сохранить'}
                </button>
            </form>
    );
}

