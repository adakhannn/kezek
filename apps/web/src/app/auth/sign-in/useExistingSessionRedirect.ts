'use client';

import { useEffect } from 'react';

import { supabase } from '@/lib/supabaseClient';

type UseExistingSessionRedirectOptions = {
    redirectParam: string;
    decideAndGo: (fallback: string) => Promise<void>;
};

export function useExistingSessionRedirect({
    redirectParam,
    decideAndGo,
}: UseExistingSessionRedirectOptions) {
    useEffect(() => {
        supabase.auth.getUser().then(({ data }) => {
            if (data.user) void decideAndGo(redirectParam);
        });
        const { data: sub } = supabase.auth.onAuthStateChange((_ev, session) => {
            if (session?.user) void decideAndGo(redirectParam);
        });
        return () => {
            sub.subscription.unsubscribe();
        };
    }, [decideAndGo, redirectParam]);
}
