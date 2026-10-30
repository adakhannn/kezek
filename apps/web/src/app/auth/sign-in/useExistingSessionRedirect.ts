'use client';

import { useEffect } from 'react';

import { logWarn } from '@/lib/log';
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
        let active = true;
        let redirectStarted = false;
        const redirectOnce = () => {
            if (!active || redirectStarted) return;
            // The initial lookup and auth notification can describe the same
            // session. Do not restart its pending navigation/refresh pair.
            redirectStarted = true;
            void decideAndGo(redirectParam).catch(() => {
                redirectStarted = false;
                logWarn('SignIn', 'existing-session redirect failed');
            });
        };
        supabase.auth.getUser().then(({ data }) => {
            if (data.user) redirectOnce();
        });
        const { data: sub } = supabase.auth.onAuthStateChange((_ev, session) => {
            if (session?.user) redirectOnce();
        });
        return () => {
            active = false;
            sub.subscription.unsubscribe();
        };
    }, [decideAndGo, redirectParam]);
}
