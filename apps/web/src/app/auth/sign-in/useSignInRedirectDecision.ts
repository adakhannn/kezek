'use client';

import type { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import { useCallback } from 'react';

import { logWarn } from '@/lib/log';
import { decideSignInRedirect } from '@/lib/signInRedirectLogic';
import { supabase } from '@/lib/supabaseClient';

type UseSignInRedirectDecisionOptions = {
    router: AppRouterInstance;
};

export function useSignInRedirectDecision({
    router,
}: UseSignInRedirectDecisionOptions) {
    const fetchIsSuper = useCallback(async (): Promise<boolean> => {
        const { data, error } = await supabase.rpc('is_super_admin');
        if (error) {
            logWarn('SignIn', 'is_super_admin error', { error: error.message });
            return false;
        }
        return !!data;
    }, []);

    const fetchOwnsBusiness = useCallback(
        async (userId?: string): Promise<boolean> => {
            if (!userId) return false;
            const { count, error } = await supabase
                .from('businesses')
                .select('id', { count: 'exact', head: true })
                .eq('owner_id', userId);
            if (error) {
                logWarn('SignIn', 'owner check error', { userId, error: error.message });
                return false;
            }
            return (count ?? 0) > 0;
        },
        [],
    );

    const fetchMyRoles = useCallback(async (): Promise<string[]> => {
        const { data, error } = await supabase.rpc('my_role_keys');
        if (error) {
            logWarn('SignIn', 'my_role_keys error', { error: error.message });
            return [];
        }
        return Array.isArray(data) ? (data as string[]) : [];
    }, []);

    const fetchCurrentBusinessState = useCallback(async (userId: string) => {
        if (!userId) return null;

        const res = await fetch('/api/me/current-business', {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
        });

        if (!res.ok) {
            return null;
        }

        const json = (await res.json()) as {
            ok: boolean;
            data?: { currentBizId: string | null; businesses: { id: string }[] };
        };

        return json.ok && json.data ? json.data : null;
    }, []);

    const setCurrentBusiness = useCallback(async (bizId: string) => {
        await fetch('/api/me/current-business', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ bizId }),
        });
    }, []);

    const fetchActiveStaff = useCallback(async (userId?: string): Promise<boolean> => {
        if (!userId) return false;

        const { data: staff } = await supabase
            .from('staff')
            .select('id')
            .eq('user_id', userId)
            .eq('is_active', true)
            .maybeSingle();

        return !!staff;
    }, []);

    const decideRedirect = useCallback(
        async (fallback: string, userId?: string) => {
            return decideSignInRedirect(
                {
                    fetchIsSuper,
                    fetchCurrentBusinessState,
                    setCurrentBusiness,
                    fetchOwnsBusiness,
                    fetchActiveStaff,
                    fetchMyRoles,
                    warn: (message: string, details?: unknown) => logWarn('SignIn', message, details),
                },
                fallback,
                userId,
            );
        },
        [
            fetchActiveStaff,
            fetchCurrentBusinessState,
            fetchIsSuper,
            fetchMyRoles,
            fetchOwnsBusiness,
            setCurrentBusiness,
        ],
    );

    const decideAndGo = useCallback(
        async (fallback: string) => {
            const { data } = await supabase.auth.getUser();
            const uid = data.user?.id;
            const target = await decideRedirect(fallback, uid);
            router.replace(target);
        },
        [decideRedirect, router],
    );

    return {
        decideAndGo,
        decideRedirect,
    };
}
