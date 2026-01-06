'use client';

import { useEffect, useState } from 'react';


import { NameReminderBanner } from './NameReminderBanner';
import { TelegramReminderBanner } from './TelegramReminderBanner';
import { WhatsAppReminderBanner } from './WhatsAppReminderBanner';

import { supabase } from '@/lib/supabaseClient';

type BannerState = {
    showName: boolean;
    showWhatsApp: boolean;
    showTelegram: boolean;
    loading: boolean;
};

/**
 * Компонент, который показывает только один баннер за раз с приоритетом:
 * 1. Имя (самый важный)
 * 2. WhatsApp
 * 3. Telegram
 */
export function ReminderBanners() {
    const [state, setState] = useState<BannerState>({
        showName: false,
        showWhatsApp: false,
        showTelegram: false,
        loading: true,
    });

    useEffect(() => {
        let mounted = true;

        const checkBanners = async () => {
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) {
                    if (mounted) {
                        setState({ showName: false, showWhatsApp: false, showTelegram: false, loading: false });
                    }
                    return;
                }

                // Суперадмину баннеры не показываем
                const { data: isSuper } = await supabase.rpc('is_super_admin');
                if (isSuper) {
                    if (mounted) {
                        setState({ showName: false, showWhatsApp: false, showTelegram: false, loading: false });
                    }
                    return;
                }

                // Проверяем профиль
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('full_name, phone, whatsapp_verified, telegram_id, telegram_verified')
                    .eq('id', user.id)
                    .maybeSingle<{
                        full_name: string | null;
                        phone: string | null;
                        whatsapp_verified: boolean | null;
                        telegram_id: number | null;
                        telegram_verified: boolean | null;
                    }>();

                const hasName = !!profile?.full_name?.trim();
                // WhatsApp: нужен и phone в auth, и whatsapp_verified в профиле
                const hasWhatsApp = !!(user.phone || profile?.phone) && !!profile?.whatsapp_verified;
                const hasTelegram = !!profile?.telegram_id && !!profile?.telegram_verified;

                if (mounted) {
                    // Приоритет: имя → WhatsApp → Telegram
                    // Показываем только один баннер за раз
                    if (!hasName) {
                        setState({ showName: true, showWhatsApp: false, showTelegram: false, loading: false });
                    } else if (!hasWhatsApp) {
                        setState({ showName: false, showWhatsApp: true, showTelegram: false, loading: false });
                    } else if (!hasTelegram) {
                        setState({ showName: false, showWhatsApp: false, showTelegram: true, loading: false });
                    } else {
                        setState({ showName: false, showWhatsApp: false, showTelegram: false, loading: false });
                    }
                }
            } catch (error) {
                console.warn('ReminderBanners: error checking banners', error);
                if (mounted) {
                    setState({ showName: false, showWhatsApp: false, showTelegram: false, loading: false });
                }
            }
        };

        checkBanners();

        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange(() => {
            if (mounted) {
                checkBanners();
            }
        });

        return () => {
            mounted = false;
            subscription.unsubscribe();
        };
    }, []);

    if (state.loading) {
        return null;
    }

    return (
        <>
            {state.showName && <NameReminderBanner />}
            {state.showWhatsApp && <WhatsAppReminderBanner />}
            {state.showTelegram && <TelegramReminderBanner />}
        </>
    );
}

