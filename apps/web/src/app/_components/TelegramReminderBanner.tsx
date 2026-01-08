'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { supabase } from '@/lib/supabaseClient';

/**
 * Висящее уведомление, напоминающее пользователю подключить Telegram для уведомлений
 */
export function TelegramReminderBanner() {
    const router = useRouter();
    const [show, setShow] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let mounted = true;

        const checkTelegram = async () => {
            try {
                const {
                    data: { user },
                } = await supabase.auth.getUser();
                if (!user) {
                    if (mounted) {
                        setShow(false);
                        setLoading(false);
                    }
                    return;
                }

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
                    console.warn('TelegramReminderBanner: failed to load profile', error);
                }

                const hasTelegram = !!profile?.telegram_id && !!profile?.telegram_verified;

                if (mounted) {
                    // Показываем баннер, если Telegram ещё не подключен/не подтверждён
                    setShow(!hasTelegram);
                    setLoading(false);
                }
            } catch (error) {
                console.warn('TelegramReminderBanner: error checking telegram', error);
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

    return (
        <div className="sticky top-14 sm:top-16 z-40 bg-gradient-to-r from-sky-600 to-blue-600 text-white shadow-lg">
            <div className="mx-auto max-w-7xl px-3 sm:px-4 lg:px-8 py-2.5 sm:py-3">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
                    <div className="flex items-start sm:items-center gap-2 flex-1 min-w-0">
                        <svg className="w-5 h-5 flex-shrink-0 mt-0.5 sm:mt-0" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 0C5.371 0 0 5.371 0 12s5.371 12 12 12 12-5.371 12-12S18.629 0 12 0zm5.496 8.246l-1.89 8.91c-.143.637-.523.793-1.059.494l-2.93-2.162-1.414 1.362c-.156.156-.287.287-.586.287l.21-3.004 5.472-4.946c.238-.21-.051-.328-.369-.118l-6.768 4.263-2.91-.909c-.633-.197-.647-.633.133-.936l11.37-4.386c.523-.189.983.118.812.935z" />
                        </svg>
                        <p className="text-xs sm:text-sm font-medium leading-relaxed">
                            Подключите Telegram для получения уведомлений о бронированиях. Это удобно и безопасно!
                        </p>
                    </div>
                    <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
                        <button
                            onClick={() =>
                                router.push('/auth/sign-in?redirect=/cabinet')
                            }
                            className="flex-1 sm:flex-none px-3 sm:px-4 py-2 bg-white text-sky-600 font-medium rounded-lg hover:bg-gray-100 transition-colors text-xs sm:text-sm whitespace-nowrap"
                        >
                            <span className="hidden sm:inline">Подключить Telegram</span>
                            <span className="sm:hidden">Подключить</span>
                        </button>
                        <button
                            onClick={() => setShow(false)}
                            className="text-white/80 hover:text-white transition-colors flex-shrink-0 p-1"
                            aria-label="Закрыть"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}


