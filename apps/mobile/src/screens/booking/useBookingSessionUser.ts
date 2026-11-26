import { useEffect, useState } from 'react';

import { supabase } from '../../lib/supabase';

type SessionUser = { ready: boolean; userId: string | null };

/**
 * The signed-in user of the booking flow, or null for a guest. The booking screens work with or
 * without a session (C1), so nothing here requires one.
 */
export function useBookingSessionUser(): SessionUser {
    const [state, setState] = useState<SessionUser>({ ready: false, userId: null });

    useEffect(() => {
        let active = true;
        Promise.resolve(supabase.auth.getSession())
            .then((result) => {
                if (active) setState({ ready: true, userId: result?.data?.session?.user?.id ?? null });
            })
            .catch(() => {
                if (active) setState({ ready: true, userId: null });
            });
        const listener = supabase.auth.onAuthStateChange((_event, session) => {
            if (active) setState({ ready: true, userId: session?.user?.id ?? null });
        });
        return () => {
            active = false;
            listener?.data?.subscription?.unsubscribe();
        };
    }, []);

    return state;
}
