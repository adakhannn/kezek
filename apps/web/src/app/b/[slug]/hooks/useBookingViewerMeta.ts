'use client';

import { useEffect, useState } from 'react';

import { useBookingFlowStart } from '@/lib/analyticsTrackEvent';
import { getSessionId, trackFunnelEvent } from '@/lib/funnelEvents';
import { supabase } from '@/lib/supabaseClient';

export function useBookingViewerMeta(bizId: string) {
    useBookingFlowStart(bizId);

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

    useEffect(() => {
        if (typeof window === 'undefined') return;

        trackFunnelEvent({
            event_type: 'business_view',
            source: 'public',
            biz_id: bizId,
            session_id: getSessionId(),
            user_agent: navigator.userAgent,
            referrer: document.referrer || null,
        });
    }, [bizId]);

    return { isAuthed };
}
