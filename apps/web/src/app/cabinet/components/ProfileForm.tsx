'use client';

import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useMemo, useState } from 'react';

import { TelegramLinkWidget } from './TelegramLinkWidget';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import { AlertBanner } from '@/components/ui/AlertBanner';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
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
    const [initialProfile, setInitialProfile] = useState<Profile>({
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

    useEffect(() => {
        if (!message) return;
        const timeoutId = window.setTimeout(() => setMessage(null), 3500);
        return () => window.clearTimeout(timeoutId);
    }, [message]);

    const normalizedPhone = (profile.phone ?? '').trim();
    const phoneValidationError =
        normalizedPhone && !/^\+?[0-9\s()-]{8,20}$/.test(normalizedPhone)
            ? t('cabinet.profile.phone.invalid', 'Укажите корректный номер телефона')
            : null;

    const isDirty = useMemo(() => {
        return JSON.stringify(profile) !== JSON.stringify(initialProfile);
    }, [initialProfile, profile]);

    const canSubmit = isDirty && !saving && !phoneValidationError;

    async function loadProfile() {
        setLoading(true);
        try {
            const {
                data: { user },
            } = await supabase.auth.getUser();
            if (!user) return;

            const { data, error: fetchError } = await supabase
                .from('profiles')
                .select('full_name, phone, notify_email, notify_whatsapp, whatsapp_verified, notify_telegram, telegram_id, telegram_verified')
                .eq('id', user.id)
                .maybeSingle();

            if (fetchError) {
                const { logError } = require('@/lib/log');
                logError('ProfileForm', 'Error loading profile', fetchError);
                return;
            }

            const meta = (user.user_metadata ?? {}) as { telegram_id?: number | string | null };
            const telegramFromProfile = !!data?.telegram_id && !!data?.telegram_verified;
            const telegramFromMeta = !!meta.telegram_id;

            const nextProfile = {
                full_name: data?.full_name ?? null,
                phone: data?.phone ?? null,
                notify_email: data?.notify_email ?? true,
                notify_whatsapp: data?.notify_whatsapp ?? true,
                whatsapp_verified: data?.whatsapp_verified ?? false,
                notify_telegram: data?.notify_telegram ?? true,
                telegram_connected: telegramFromProfile || telegramFromMeta,
            };

            setProfile(nextProfile);
            setInitialProfile(nextProfile);
        } catch (e) {
            const { logError } = require('@/lib/log');
            logError('ProfileForm', 'Error loading profile', e);
        } finally {
            setLoading(false);
        }
    }

    async function handleSubmit(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        if (!isDirty) {
            setMessage(t('cabinet.profile.noChanges', 'Изменений пока нет'));
            return;
        }
        if (phoneValidationError) {
            setError(phoneValidationError);
            return;
        }
        setSaving(true);
        setMessage(null);
        setError(null);

        try {
            const res = await fetch('/api/profile/update', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({
                    full_name: profile.full_name || null,
                    phone: normalizedPhone || null,
                    notify_email: profile.notify_email,
                    notify_whatsapp: profile.notify_whatsapp,
                    notify_telegram: profile.notify_telegram,
                }),
            });

            const data = await res.json();
            if (!res.ok || !data.ok) {
                throw new Error(data.message || data.error || t('cabinet.profile.error.save', 'Ошибка при сохранении'));
            }

            const nextProfile = {
                ...profile,
                phone: normalizedPhone || null,
            };
            setProfile(nextProfile);
            setInitialProfile(nextProfile);
            setMessage(t('cabinet.profile.saved', 'Профиль обновлен'));
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
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            setError(msg);
        } finally {
            setOtpVerifying(false);
        }
    }

    function resetChanges() {
        setProfile(initialProfile);
        setError(null);
        setMessage(t('cabinet.profile.reset', 'Изменения отменены'));
        setShowOtpInput(false);
        setOtpCode('');
    }

    if (loading) {
        return (
            <Card variant="elevated" padding="lg" className="py-10 text-center">
                <div className="mx-auto inline-block h-8 w-8 animate-spin rounded-full border-b-2 border-[var(--accent-primary)]" />
                <p className="type-body mt-4 text-gray-500 dark:text-gray-400">
                    {t('cabinet.profile.loading', 'Загрузка...')}
                </p>
            </Card>
        );
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-5">
            <Card variant="default" padding="lg" className="space-y-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                        <h3 className="type-section-title text-gray-900 dark:text-gray-100">
                            {t('cabinet.profile.section.personal', 'Личные данные')}
                        </h3>
                        <p className="type-caption mt-1 text-gray-500 dark:text-gray-400">
                            {t('cabinet.profile.section.personalDesc', 'Поддерживайте профиль актуальным, чтобы связь и запись проходили без лишнего трения')}
                        </p>
                    </div>
                    <div className="rounded-full border border-[var(--border-subtle)] bg-[var(--surface-emphasis)] px-3 py-2 text-xs font-medium text-[var(--text-secondary)]">
                        {isDirty
                            ? t('cabinet.profile.unsaved', 'Есть несохраненные изменения')
                            : t('cabinet.profile.synced', 'Все изменения сохранены')}
                    </div>
                </div>
                <Input
                    label={t('cabinet.profile.name.label', 'Имя')}
                    value={profile.full_name || ''}
                    onChange={(e) => {
                        setProfile({ ...profile, full_name: e.target.value || null });
                        setError(null);
                    }}
                    placeholder={t('cabinet.profile.name.placeholder', 'Ваше имя')}
                />

                <Input
                    label={t('cabinet.profile.phone.label', 'Телефон')}
                    type="tel"
                    value={profile.phone || ''}
                    onChange={(e) => {
                        setProfile({ ...profile, phone: e.target.value || null });
                        setError(null);
                    }}
                    placeholder={t('cabinet.profile.phone.placeholder', '+996555123456')}
                    helperText={
                        !profile.phone
                            ? t('cabinet.profile.phone.warning.desc', 'Это нужно для связи с вами')
                            : t(
                                  'cabinet.profile.phone.description',
                                  'Укажите номер телефона, чтобы мастера могли связаться с вами при необходимости',
                              )
                    }
                    error={phoneValidationError ?? undefined}
                    className={!profile.phone ? 'border-amber-300 bg-amber-50/50 focus:border-amber-400 dark:border-amber-700 dark:bg-amber-950/20' : undefined}
                />

            </Card>

            {!profile.phone && (
                <Card
                    variant="outlined"
                    padding="sm"
                    className="border-amber-200 bg-amber-50/80 text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200"
                >
                    <div className="flex items-start gap-2">
                        <svg className="mt-0.5 h-4 w-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        <div>
                            <p className="type-label">
                                {t('cabinet.profile.phone.warning.title', 'Заполните номер телефона')}
                            </p>
                            <p className="type-caption mt-1 text-amber-700 dark:text-amber-300">
                                {t('cabinet.profile.phone.warning.desc', 'Это нужно для связи с вами')}
                            </p>
                        </div>
                    </div>
                </Card>
            )}

            <Card variant="default" padding="lg" className="space-y-4">
                <div>
                    <h3 className="type-section-title text-gray-900 dark:text-gray-100">
                        {t('cabinet.profile.notifications.title', 'Уведомления о бронированиях')}
                    </h3>
                    <p className="type-caption mt-1 text-gray-500 dark:text-gray-400">
                        {t('cabinet.profile.notifications.desc', 'Выберите способы получения уведомлений о ваших бронированиях')}
                    </p>
                </div>

                <div className="space-y-3">
                    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-card)] px-3 py-3">
                        <div className="flex items-center gap-2">
                            <svg className="h-5 w-5 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                            </svg>
                            <span className="type-body font-medium text-gray-700 dark:text-gray-300">
                                {t('cabinet.profile.notifications.email', 'Email')}
                            </span>
                        </div>
                        <input
                            type="checkbox"
                            checked={profile.notify_email}
                            onChange={(e) => {
                                setProfile({ ...profile, notify_email: e.target.checked });
                                setError(null);
                            }}
                            className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        />
                    </label>

                    {false && (
                        <div className="space-y-2">
                            <label className="flex cursor-pointer items-center justify-between gap-3 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-card)] px-3 py-3">
                                <div className="flex items-center gap-2">
                                    <svg className="h-5 w-5 text-gray-500 dark:text-gray-400" fill="currentColor" viewBox="0 0 24 24">
                                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                                    </svg>
                                    <span className="type-body font-medium text-gray-700 dark:text-gray-300">
                                        {t('cabinet.profile.notifications.whatsapp', 'WhatsApp')}
                                    </span>
                                </div>
                                <input
                                    type="checkbox"
                                    checked={profile.notify_whatsapp}
                                    onChange={(e) => {
                                        setProfile({ ...profile, notify_whatsapp: e.target.checked });
                                        setError(null);
                                    }}
                                    className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                />
                            </label>

                            {profile.notify_whatsapp && (
                                <div className="ml-7 space-y-2">
                                    {profile.whatsapp_verified ? (
                                        <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                            </svg>
                                            <span>{t('cabinet.profile.whatsapp.verified', 'Номер подтвержден')}</span>
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400">
                                                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                                </svg>
                                                <span>{t('cabinet.profile.whatsapp.notVerified', 'Номер не подтвержден. Подтвердите для получения уведомлений.')}</span>
                                            </div>
                                            {!showOtpInput ? (
                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    onClick={handleSendOtp}
                                                    disabled={otpSending || !profile.phone}
                                                >
                                                    {otpSending ? t('cabinet.profile.whatsapp.sending', 'Отправка...') : t('cabinet.profile.whatsapp.sendCode', 'Отправить код')}
                                                </Button>
                                            ) : (
                                                <div className="space-y-2">
                                                    <div className="flex flex-wrap gap-2">
                                                        <Input
                                                            type="text"
                                                            inputMode="numeric"
                                                            pattern="[0-9]*"
                                                            maxLength={6}
                                                            value={otpCode}
                                                            onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                                                            placeholder={t('cabinet.profile.whatsapp.codePlaceholder', '000000')}
                                                            fieldSize="sm"
                                                            className="w-28 text-center"
                                                        />
                                                        <Button
                                                            type="button"
                                                            size="sm"
                                                            onClick={handleVerifyOtp}
                                                            disabled={otpVerifying || otpCode.length !== 6}
                                                            isLoading={otpVerifying}
                                                        >
                                                            {t('cabinet.profile.whatsapp.verify', 'Подтвердить')}
                                                        </Button>
                                                    </div>
                                                    <Button
                                                        type="button"
                                                        size="sm"
                                                        variant="ghost"
                                                        onClick={() => {
                                                            setShowOtpInput(false);
                                                            setOtpCode('');
                                                        }}
                                                    >
                                                        {t('cabinet.profile.whatsapp.cancel', 'Отменить')}
                                                    </Button>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-card)] px-3 py-3">
                        <div className="flex items-center gap-2">
                            <svg className="h-5 w-5 text-gray-500 dark:text-gray-400" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M12 0C5.371 0 0 5.371 0 12s5.371 12 12 12 12-5.371 12-12S18.629 0 12 0zm5.496 8.246l-1.89 8.91c-.143.637-.523.793-1.059.494l-2.93-2.162-1.414 1.362c-.156.156-.287.287-.586.287l.21-3.004 5.472-4.946c.238-.21-.051-.328-.369-.118l-6.768 4.263-2.91-.909c-.633-.197-.647-.633.133-.936l11.37-4.386c.523-.189.983.118.812.935z" />
                            </svg>
                            <span className="type-body font-medium text-gray-700 dark:text-gray-300">
                                {t('cabinet.profile.notifications.telegram', 'Telegram')}
                            </span>
                        </div>
                        <input
                            type="checkbox"
                            checked={profile.notify_telegram}
                            onChange={(e) => {
                                setProfile({
                                    ...profile,
                                    notify_telegram: e.target.checked,
                                });
                                setError(null);
                            }}
                            className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        />
                    </label>

                    {!profile.telegram_connected && (
                        <div className="ml-7 mt-2 space-y-2">
                            <p className="type-caption text-gray-500 dark:text-gray-400">
                                {t('cabinet.profile.telegram.notConnected', 'Чтобы получать уведомления в Telegram, подключите Telegram аккаунт:')}
                            </p>
                            <div className="flex justify-start">
                                <TelegramLinkWidget
                                    onSuccess={() => {
                                        loadProfile();
                                        setMessage(t('cabinet.profile.telegram.connected', 'Telegram успешно подключен!'));
                                    }}
                                    onError={(err) => {
                                        setError(err);
                                        setTimeout(() => setError(null), 10000);
                                    }}
                                    size="medium"
                                />
                            </div>
                            {error && error.includes('уже привязан') && (
                                <Card
                                    variant="outlined"
                                    padding="sm"
                                    className="border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-950/20"
                                >
                                    <p className="type-label mb-2 text-amber-800 dark:text-amber-200">
                                        {t('cabinet.profile.telegram.alreadyLinked.title', 'Этот Telegram аккаунт уже привязан к другому пользователю.')}
                                    </p>
                                    <p className="type-caption mb-2 text-amber-700 dark:text-amber-300">
                                        {t('cabinet.profile.telegram.alreadyLinked.desc', 'Чтобы использовать другой Telegram аккаунт:')}
                                    </p>
                                    <ol className="type-caption ml-2 list-inside list-decimal space-y-1 text-amber-700 dark:text-amber-300">
                                        <li>
                                            {t('cabinet.profile.telegram.alreadyLinked.step1.prefix', 'Откройте')}{' '}
                                            <a href="https://web.telegram.org" target="_blank" rel="noopener noreferrer" className="underline">
                                                web.telegram.org
                                            </a>{' '}
                                            {t('cabinet.profile.telegram.alreadyLinked.step1.suffix', 'в новой вкладке')}
                                        </li>
                                        <li>{t('cabinet.profile.telegram.alreadyLinked.step2', 'Выйдите из текущего Telegram аккаунта')}</li>
                                        <li>{t('cabinet.profile.telegram.alreadyLinked.step3', 'Войдите в нужный Telegram аккаунт')}</li>
                                        <li>{t('cabinet.profile.telegram.alreadyLinked.step4', 'Вернитесь на эту страницу и попробуйте снова')}</li>
                                    </ol>
                                    <p className="type-caption mt-2 italic text-amber-600 dark:text-amber-400">
                                        {t('cabinet.profile.telegram.alreadyLinked.hint', 'Или используйте режим инкогнито браузера для входа в другой аккаунт.')}
                                    </p>
                                </Card>
                            )}
                        </div>
                    )}
                </div>
            </Card>

            {message ? <AlertBanner variant="success" message={message} /> : null}

            {error ? <AlertBanner variant="danger" message={error} /> : null}

            {isDirty && !error ? (
                <AlertBanner
                    variant="info"
                    title={t('cabinet.profile.unsavedTitle', 'Изменения еще не сохранены')}
                    message={t('cabinet.profile.unsavedMessage', 'Проверьте данные и сохраните профиль, чтобы обновления применились к следующим записям и уведомлениям')}
                />
            ) : null}

            <Card variant="elevated" padding="md" className="sticky bottom-4 z-10 border border-[var(--border-subtle)] bg-[color:color-mix(in_srgb,var(--surface-card)_94%,transparent)] backdrop-blur">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <p className="type-label text-gray-900 dark:text-gray-100">
                            {isDirty
                                ? t('cabinet.profile.saveBar.titleDirty', 'Профиль изменен')
                                : t('cabinet.profile.saveBar.titleClean', 'Профиль актуален')}
                        </p>
                        <p className="type-caption mt-1 text-gray-500 dark:text-gray-400">
                            {isDirty
                                ? t('cabinet.profile.saveBar.descDirty', 'Сохраните изменения, когда будете готовы')
                                : t('cabinet.profile.saveBar.descClean', 'Новых действий не требуется')}
                        </p>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row">
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={resetChanges}
                            disabled={!isDirty || saving}
                        >
                            {t('common.reset', 'Сбросить')}
                        </Button>
                        <Button type="submit" isLoading={saving} disabled={!canSubmit}>
                            {saving ? t('cabinet.profile.saving', 'Сохранение...') : t('cabinet.profile.save', 'Сохранить')}
                        </Button>
                    </div>
                </div>
            </Card>
        </form>
    );
}




