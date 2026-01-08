'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

import { supabase } from '@/lib/supabaseClient';

/**
 * Висящее уведомление, напоминающее пользователю заполнить имя
 */
export function NameReminderBanner() {
    const pathname = usePathname();
    const [show, setShow] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let mounted = true;

        // Если пользователь уже находится в кабинете, баннер не показываем,
        // чтобы он не мигал во время редактирования профиля.
        if (pathname.startsWith('/cabinet')) {
            setShow(false);
            setLoading(false);
            return () => {
                mounted = false;
            };
        }

        const checkName = async () => {
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) {
                    if (mounted) {
                        setShow(false);
                        setLoading(false);
                    }
                    return;
                }

                // Проверяем, является ли пользователь суперадмином
                const { data: isSuper } = await supabase.rpc('is_super_admin');
                if (isSuper) {
                    // Для суперадмина не показываем баннер
                    if (mounted) {
                        setShow(false);
                        setLoading(false);
                    }
                    return;
                }

                const { data: profile } = await supabase
                    .from('profiles')
                    .select('full_name')
                    .eq('id', user.id)
                    .maybeSingle();

                // Показываем уведомление, если имени нет
                if (mounted) {
                    setShow(!profile?.full_name?.trim());
                    setLoading(false);
                }
            } catch (error) {
                console.warn('NameReminderBanner: error checking name', error);
                if (mounted) {
                    setLoading(false);
                }
            }
        };

        checkName();

        // Подписываемся на изменения авторизации
        const {
            data: { subscription: authSubscription },
        } = supabase.auth.onAuthStateChange(() => {
            if (mounted) {
                checkName();
            }
        });

        // Подписываемся на изменения в таблице profiles
        const profileSubscription = supabase
            .channel('profile-changes')
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'profiles',
                },
                () => {
                    if (mounted) {
                        checkName();
                    }
                }
            )
            .subscribe();

        return () => {
            mounted = false;
            authSubscription.unsubscribe();
            profileSubscription.unsubscribe();
        };
    }, [pathname]);

    if (loading || !show) {
        return null;
    }

    return (
        <div className="sticky top-14 sm:top-16 z-[99] bg-gradient-to-r from-indigo-600 to-pink-600 text-white shadow-lg">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-3">
                <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2 flex-1">
                        <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <p className="text-sm font-medium">
                            Пожалуйста, заполните ваше имя в профиле для лучшего опыта использования сервиса.
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <Link
                            href="/cabinet"
                            className="px-4 py-2 bg-white text-indigo-600 font-medium rounded-lg hover:bg-gray-100 transition-colors text-sm whitespace-nowrap"
                        >
                            Заполнить профиль
                        </Link>
                        <button
                            onClick={() => setShow(false)}
                            className="text-white/80 hover:text-white transition-colors"
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

