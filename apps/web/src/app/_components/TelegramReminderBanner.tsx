'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { useLanguage } from './i18n/LanguageProvider';

import { logWarn } from '@/lib/log';
import { supabase } from '@/lib/supabaseClient';

const TELEGRAM_REMINDER_SNOOZE_MS = 7 * 24 * 60 * 60 * 1000;
const TELEGRAM_REMINDER_STORAGE_PREFIX = 'kezek:telegram-reminder:snoozed-until:';

export function isTelegramReminderSnoozed(value: string | null, now = Date.now()): boolean {
    if (!value) return false;
    const snoozedUntil = Number(value);
    return Number.isFinite(snoozedUntil) && snoozedUntil > now;
}

/**
 * Висящее уведомление, напоминающее пользователю подключить Telegram для уведомлений
 */
export function TelegramReminderBanner() {
    const { t } = useLanguage();
    const router = useRouter();
    const [show, setShow] = useState(false);
    const [loading, setLoading] = useState(true);
    const [userId, setUserId] = useState<string | null>(null);

    useEffect(() => {
        let mounted = true;

        const checkTelegram = async () => {
            try {
                const {
                    data: { user },
                } = await supabase.auth.getUser();
                if (!user) {
                    if (mounted) {
                        setUserId(null);
                        setShow(false);
                        setLoading(false);
                    }
                    return;
                }

                if (mounted) setUserId(user.id);

                // Суперадмину баннер не показываем
                const { data: isSuper } = await supabase.rpc('is_super_admin');
                if (isSuper) {
                    if (mounted) {
                        setShow(false);
                        setLoading(false);
                    }
                    return;
                }

                // Проверяем профиль на наличие Telegram
                const { data: profile, error } = await supabase
                    .from('profiles')
                    .select('telegram_id, telegram_verified')
                    .eq('id', user.id)
                    .maybeSingle<{ telegram_id: number | null; telegram_verified: boolean | null }>();

                if (error) {
                    logWarn('TelegramReminderBanner', 'failed to load profile', error);
                }

                const hasTelegram = !!profile?.telegram_id && !!profile?.telegram_verified;
                const snoozed = isTelegramReminderSnoozed(
                    window.localStorage.getItem(`${TELEGRAM_REMINDER_STORAGE_PREFIX}${user.id}`),
                );

                if (mounted) {
                    // Показываем баннер, если Telegram ещё не подключен/не подтверждён
                    setShow(!hasTelegram && !snoozed);
                    setLoading(false);
                }
            } catch (error) {
                logWarn('TelegramReminderBanner', 'error checking telegram', error);
                if (mounted) {
                    setLoading(false);
                }
            }
        };

        checkTelegram();

        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange(() => {
            if (mounted) {
                checkTelegram();
            }
        });

        return () => {
            mounted = false;
            subscription.unsubscribe();
        };
    }, []);

    if (loading || !show) {
        return null;
    }

    const handleRemindLater = () => {
        if (userId) {
            window.localStorage.setItem(
                `${TELEGRAM_REMINDER_STORAGE_PREFIX}${userId}`,
                String(Date.now() + TELEGRAM_REMINDER_SNOOZE_MS),
            );
        }
        setShow(false);
    };

    return (
        <section className="relative z-20 px-3 pt-3 sm:px-4 sm:pt-4 lg:px-6" aria-labelledby="telegram-reminder-title">
            <div className="mx-auto max-w-7xl rounded-2xl border border-sky-400/25 bg-[color:color-mix(in_srgb,var(--surface-card)_92%,rgb(14_165_233)_8%)] px-4 py-3 shadow-[var(--shadow-sm)] sm:px-5 sm:py-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-5">
                    <div className="flex min-w-0 items-start gap-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-500/15 text-sky-500">
                            <svg className="h-5 w-5" aria-hidden="true" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M12 0C5.371 0 0 5.371 0 12s5.371 12 12 12 12-5.371 12-12S18.629 0 12 0zm5.496 8.246l-1.89 8.91c-.143.637-.523.793-1.059.494l-2.93-2.162-1.414 1.362c-.156.156-.287.287-.586.287l.21-3.004 5.472-4.946c.238-.21-.051-.328-.369-.118l-6.768 4.263-2.91-.909c-.633-.197-.647-.633.133-.936l11.37-4.386c.523-.189.983.118.812.935z" />
                            </svg>
                        </span>
                        <div className="min-w-0">
                            <h2 id="telegram-reminder-title" className="text-sm font-semibold text-[var(--text-primary)] sm:text-base">
                                {t('notifications.telegram.title', 'Не пропускайте изменения записи')}
                            </h2>
                            <p className="mt-0.5 text-sm leading-5 text-[var(--text-secondary)]">
                                {t('notifications.telegram.message', 'Подключите Telegram — сообщим о подтверждении, переносе или отмене.')}
                            </p>
                        </div>
                    </div>
                    <div className="flex w-full items-center gap-2 sm:w-auto sm:shrink-0">
                        <button
                            type="button"
                            onClick={() => router.push('/cabinet/profile#telegram-connection')}
                            className="inline-flex min-h-10 flex-1 items-center justify-center rounded-xl bg-sky-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-sky-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 sm:flex-none"
                        >
                            {t('notifications.telegram.connectFull', 'Подключить Telegram')}
                        </button>
                        <button
                            type="button"
                            onClick={handleRemindLater}
                            className="hidden min-h-10 rounded-xl px-3 py-2 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-emphasis)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] sm:inline-flex sm:items-center"
                        >
                            {t('notifications.telegram.later', 'Напомнить позже')}
                        </button>
                        <button
                            type="button"
                            onClick={handleRemindLater}
                            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-emphasis)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] sm:hidden"
                            aria-label={t('notifications.telegram.later', 'Напомнить позже')}
                        >
                            <svg className="h-5 w-5" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>
            </div>
        </section>
    );
}


