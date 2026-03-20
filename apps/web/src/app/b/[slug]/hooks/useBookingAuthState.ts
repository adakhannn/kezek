import { useEffect, useState } from 'react';

import { supabase } from '@/lib/supabaseClient';

export function useBookingAuthState() {
    const [isAuthed, setIsAuthed] = useState(false);

    useEffect(() => {
        let ignore = false;

        (async () => {
            const { data: auth } = await supabase.auth.getUser();
            if (!ignore) {
                setIsAuthed(!!auth.user);
            }
        })();

        const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
            setIsAuthed(!!session?.user);
        });

        return () => {
            ignore = true;
            sub.subscription.unsubscribe();
        };
    }, []);

    return { isAuthed };
}
