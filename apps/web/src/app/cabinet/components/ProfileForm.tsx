'use client';

import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';

import { TelegramLinkWidget } from './TelegramLinkWidget';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
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
    const router = useRouter();
    const { t } = useLanguage();
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
                throw new Error(data.message || data.error || t('cabinet.profile.error.save', 'Ошибка при сохранении'));
            }

            setMessage(t('cabinet.profile.saved', 'Профиль обновлен'));
            setTimeout(() => setMessage(null), 3000);
            
            // Обновляем страницу, чтобы обновить баннеры (NameReminderBanner и др.)
            router.refresh();
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            setError(msg);
        } finally {
            setSaving(false);
        }
    }

    async function handleSendOtp() {
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
                throw new Error(data.message || data.error || t('cabinet.profile.error.sendCode', 'Ошибка при отправке кода'));
            }

            setMessage(t('cabinet.profile.whatsapp.codeSent', 'Код отправлен на WhatsApp'));
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
                throw new Error(data.message || data.error || t('cabinet.profile.error.verifyCode', 'Ошибка при проверке кода'));
            }

            setMessage(t('cabinet.profile.whatsapp.verifiedSuccess', 'WhatsApp номер подтвержден'));
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
                <p className="mt-4 text-gray-500 dark:text-gray-400">
                    {t('cabinet.profile.loading', 'Загрузка...')}
                </p>
            </div>
        );
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        {t('cabinet.profile.name.label', 'Имя')}
                    </label>
                    <input
                        type="text"
                        className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                        value={profile.full_name || ''}
                        onChange={(e) => setProfile({ ...profile, full_name: e.target.value || null })}
                        placeholder={t('cabinet.profile.name.placeholder', 'Ваше имя')}
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        {t('cabinet.profile.phone.label', 'Телефон')} <span className="text-gray-500 text-xs">({t('cabinet.profile.phone.hint', 'для связи, не используется для входа')})</span>
                    </label>
                    <div className="relative">
                        <input
                            type="tel"
                            className={`w-full rounded border px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-1 dark:text-gray-100 ${
                                !profile.phone
                                    ? 'border-amber-300 bg-amber-50/50 focus:border-amber-400 focus:ring-amber-400 dark:border-amber-700 dark:bg-amber-950/20'
                                    : 'border-gray-300 bg-white focus:border-indigo-500 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-800'
                            }`}
                            value={profile.phone || ''}
                            onChange={(e) => setProfile({ ...profile, phone: e.target.value || null })}
                            placeholder={t('cabinet.profile.phone.placeholder', '+996555123456')}
                        />
                        {!profile.phone && (
                            <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                <svg className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                            </div>
                        )}
                    </div>
                    {!profile.phone ? (
                        <div className="mt-1.5 flex items-start gap-2 rounded-lg bg-amber-50/80 border border-amber-200 px-2.5 py-2 text-xs text-amber-800 dark:bg-amber-950/30 dark:border-amber-900/50 dark:text-amber-200">
                            <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                            <div>
                                <p className="font-medium">{t('cabinet.profile.phone.warning.title', 'Заполните номер телефона')}</p>
                                <p className="mt-0.5 text-amber-700 dark:text-amber-300">{t('cabinet.profile.phone.warning.desc', 'Это нужно для связи с вами')}</p>
                            </div>
                        </div>
                    ) : (
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                            {t('cabinet.profile.phone.description', 'Укажите номер телефона, чтобы мастера могли связаться с вами при необходимости')}
                        </p>
                    )}
                </div>
                
                {/* Настройки уведомлений */}
                <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
                        {t('cabinet.profile.notifications.title', 'Уведомления о бронированиях')}
                    </h3>
                    <div className="space-y-3">
                        <label className="flex items-center justify-between cursor-pointer">
                            <div className="flex items-center gap-2">
                                <svg className="w-5 h-5 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                </svg>
                                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                    {t('cabinet.profile.notifications.email', 'Email')}
                                </span>
                            </div>
                            <input
                                type="checkbox"
                                checked={profile.notify_email}
                                onChange={(e) => setProfile({ ...profile, notify_email: e.target.checked })}
                                className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                            />
                        </label>
                        {/* WhatsApp временно скрыт */}
                        {false && (
                        <div className="space-y-2">
                            <label className="flex items-center justify-between cursor-pointer">
                                <div className="flex items-center gap-2">
                                    <svg className="w-5 h-5 text-gray-500 dark:text-gray-400" fill="currentColor" viewBox="0 0 24 24">
                                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                                    </svg>
                                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                        {t('cabinet.profile.notifications.whatsapp', 'WhatsApp')}
                                    </span>
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
                                            <span>{t('cabinet.profile.whatsapp.verified', 'Номер подтвержден')}</span>
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400">
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                                </svg>
                                                <span>{t('cabinet.profile.whatsapp.notVerified', 'Номер не подтвержден. Подтвердите для получения уведомлений.')}</span>
                                            </div>
                                            {!showOtpInput ? (
                                                <button
                                                    type="button"
                                                    onClick={handleSendOtp}
                                                    disabled={otpSending || !profile.phone}
                                                    className="text-sm px-3 py-1.5 rounded bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    {otpSending ? t('cabinet.profile.whatsapp.sending', 'Отправка...') : t('cabinet.profile.whatsapp.sendCode', 'Отправить код')}
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
                                                            placeholder={t('cabinet.profile.whatsapp.codePlaceholder', '000000')}
                                                            className="w-24 rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-center text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={handleVerifyOtp}
                                                            disabled={otpVerifying || otpCode.length !== 6}
                                                            className="text-sm px-3 py-1.5 rounded bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                                        >
                                                            {otpVerifying ? t('cabinet.profile.whatsapp.verifying', 'Проверка...') : t('cabinet.profile.whatsapp.verify', 'Подтвердить')}
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
                                                        {t('cabinet.profile.whatsapp.cancel', 'Отменить')}
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                        )}

                        {/* Telegram */}
                        <label className="flex items-center justify-between cursor-pointer">
                            <div className="flex items-center gap-2">
                                <svg className="w-5 h-5 text-gray-500 dark:text-gray-400" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M12 0C5.371 0 0 5.371 0 12s5.371 12 12 12 12-5.371 12-12S18.629 0 12 0zm5.496 8.246l-1.89 8.91c-.143.637-.523.793-1.059.494l-2.93-2.162-1.414 1.362c-.156.156-.287.287-.586.287l.21-3.004 5.472-4.946c.238-.21-.051-.328-.369-.118l-6.768 4.263-2.91-.909c-.633-.197-.647-.633.133-.936l11.37-4.386c.523-.189.983.118.812.935z" />
                                </svg>
                                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                    {t('cabinet.profile.notifications.telegram', 'Telegram')}
                                </span>
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
                                    {t('cabinet.profile.telegram.notConnected', 'Чтобы получать уведомления в Telegram, подключите Telegram аккаунт:')}
                                </p>
                                <div className="flex justify-start">
                                    <TelegramLinkWidget
                                        onSuccess={() => {
                                            loadProfile();
                                            setMessage(t('cabinet.profile.telegram.connected', 'Telegram успешно подключен!'));
                                            setTimeout(() => setMessage(null), 3000);
                                        }}
                                        onError={(err) => {
                                            setError(err);
                                            setTimeout(() => setError(null), 10000);
                                        }}
                                        size="medium"
                                    />
                                </div>
                                {error && error.includes('уже привязан') && (
                                    <div className="mt-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40">
                                        <p className="text-xs text-amber-800 dark:text-amber-200 font-medium mb-2">
                                            {t('cabinet.profile.telegram.alreadyLinked.title', 'Этот Telegram аккаунт уже привязан к другому пользователю.')}
                                        </p>
                                        <p className="text-xs text-amber-700 dark:text-amber-300 mb-2">
                                            {t('cabinet.profile.telegram.alreadyLinked.desc', 'Чтобы использовать другой Telegram аккаунт:')}
                                        </p>
                                        <ol className="text-xs text-amber-700 dark:text-amber-300 list-decimal list-inside space-y-1 ml-2">
                                            <li dangerouslySetInnerHTML={{ __html: t('cabinet.profile.telegram.alreadyLinked.step1', 'Откройте <a href="https://web.telegram.org" target="_blank" rel="noopener noreferrer" class="underline">web.telegram.org</a> в новой вкладке') }} />
                                            <li>{t('cabinet.profile.telegram.alreadyLinked.step2', 'Выйдите из текущего Telegram аккаунта')}</li>
                                            <li>{t('cabinet.profile.telegram.alreadyLinked.step3', 'Войдите в нужный Telegram аккаунт')}</li>
                                            <li>{t('cabinet.profile.telegram.alreadyLinked.step4', 'Вернитесь на эту страницу и попробуйте снова')}</li>
                                        </ol>
                                        <p className="text-xs text-amber-600 dark:text-amber-400 mt-2 italic">
                                            {t('cabinet.profile.telegram.alreadyLinked.hint', 'Или используйте режим инкогнито браузера для входа в другой аккаунт.')}
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                    <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                        {t('cabinet.profile.notifications.desc', 'Выберите способы получения уведомлений о ваших бронированиях')}
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
                    {saving ? t('cabinet.profile.saving', 'Сохранение...') : t('cabinet.profile.save', 'Сохранить')}
                </button>
            </form>
    );
}

