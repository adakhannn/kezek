import { useEffect, useRef, useState } from 'react';
import { AppState, Linking } from 'react-native';

import { supabase } from '../lib/supabase';
import { logDebug } from '../lib/log';

import { handleActiveAppState, handleAuthCallbackUrl } from './rootAuthSessionRuntime';

type SessionLike = unknown;

export function useRootAuthSession() {
    const [session, setSession] = useState<SessionLike>(null);
    const [loading, setLoading] = useState(true);
    const sessionRef = useRef<SessionLike>(null);

    useEffect(() => {
        sessionRef.current = session;
    }, [session]);

    useEffect(() => {
        let active = true;

        supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
            if (!active) return;

            logDebug('RootNavigator', 'Initial session check', { hasSession: !!initialSession });
            sessionRef.current = initialSession;
            setSession(initialSession);
            setLoading(false);
        });

        const {
            data: { subscription: authSubscription },
        } = supabase.auth.onAuthStateChange((event, nextSession) => {
            logDebug('RootNavigator', 'Auth state changed', { event, hasSession: !!nextSession });
            sessionRef.current = nextSession;
            setSession(nextSession);
        });

        Linking.getInitialURL().then((url) => {
            if (!url) {
                logDebug('RootNavigator', 'No initial URL');
                return;
            }

            logDebug('RootNavigator', 'Initial URL', { url });
            handleAuthCallbackUrl(url);
        });

        const linkingSubscription = Linking.addEventListener('url', ({ url }) => {
            logDebug('RootNavigator', 'URL event received', { url });
            handleAuthCallbackUrl(url);
        });

        const appStateSubscription = AppState.addEventListener('change', (nextAppState) => {
            handleActiveAppState({
                nextAppState,
                sessionRef,
                setSession,
            });
        });

        return () => {
            active = false;
            authSubscription.unsubscribe();
            linkingSubscription.remove();
            appStateSubscription.remove();
        };
    }, []);

    return {
        loading,
        session,
    };
}
