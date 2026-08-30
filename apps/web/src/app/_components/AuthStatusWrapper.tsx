'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { supabase } from '@/lib/supabaseClient';

/**
 * Keeps Server Components in sync with meaningful authentication changes.
 * Supabase emits INITIAL_SESSION immediately after subscription; that event is
 * the baseline and must not trigger a refresh, otherwise every RSC remount
 * starts another refresh cycle.
 */
export function AuthStatusUpdater() {
    const router = useRouter();

    useEffect(() => {
        let mounted = true;
        let initialized = false;
        let lastUserId: string | null = null;
        let refreshTimer: ReturnType<typeof setTimeout> | null = null;

        const queueRefresh = () => {
            if (refreshTimer) clearTimeout(refreshTimer);
            refreshTimer = setTimeout(() => {
                if (mounted) router.refresh();
            }, 150);
        };

        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((event, session) => {
            if (!mounted) return;

            const currentUserId = session?.user?.id ?? null;

            if (event === 'INITIAL_SESSION' || !initialized) {
                initialized = true;
                lastUserId = currentUserId;
                return;
            }

            if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
                if (lastUserId !== currentUserId) {
                    lastUserId = currentUserId;
                    queueRefresh();
                }
                return;
            }

            if (event === 'USER_UPDATED') {
                lastUserId = currentUserId;
                queueRefresh();
            }
        });

        return () => {
            mounted = false;
            if (refreshTimer) clearTimeout(refreshTimer);
            subscription.unsubscribe();
        };
    }, [router]);

    return null;
}
