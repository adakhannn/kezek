import { useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus, Linking } from 'react-native';
import type { Session } from '@supabase/supabase-js';

import { getMobileApiUrl } from '../lib/apiUrl';
import { fetchWithTimeout } from '../lib/fetchWithTimeout';
import { supabase } from '../lib/supabase';
import { logDebug, logError, logWarn, maskUrl } from '../lib/log';

const AUTH_CALLBACK_DEDUP_TTL_MS = 2 * 60 * 1000;
export { getMobileApiUrl };

const processedAuthCallbacks = new Map<string, number>();

function markAuthCallbackProcessed(url: string) {
    const now = Date.now();

    for (const [processedUrl, processedAt] of processedAuthCallbacks.entries()) {
        if (now - processedAt > AUTH_CALLBACK_DEDUP_TTL_MS) {
            processedAuthCallbacks.delete(processedUrl);
        }
    }

    processedAuthCallbacks.set(url, now);
}

function isAuthCallbackAlreadyProcessed(url: string) {
    const processedAt = processedAuthCallbacks.get(url);
    if (!processedAt) {
        return false;
    }

    if (Date.now() - processedAt > AUTH_CALLBACK_DEDUP_TTL_MS) {
        processedAuthCallbacks.delete(url);
        return false;
    }

    return true;
}

export function isAuthCallbackUrl(url: string) {
    try {
        const parsed = new URL(url);
        return parsed.protocol === 'kezek:' && parsed.hostname === 'auth' && parsed.pathname === '/callback';
    } catch { return false; }
}

async function setSessionFromTokens(accessToken: string, refreshToken: string) {
    const { error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
    });

    if (error) {
        throw error;
    }
}

export async function exchangeViaMobileApi(exchangeCode: string, apiUrl: string, codeVerifier: string) {
    if (!/^[a-f0-9]{64}$/.test(codeVerifier)) throw new Error('Missing initiating sign-in proof');
    const response = await fetchWithTimeout(
        apiUrl + '/api/auth/mobile-exchange',
        { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: exchangeCode, codeVerifier }) },
    );

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Mobile exchange failed: ${response.status} ${errorText}`);
    }

    const payload = await response.json();
    const tokenData =
        payload && typeof payload === 'object' && 'data' in payload
            ? (payload.data as { accessToken?: string; refreshToken?: string })
            : (payload as { accessToken?: string; refreshToken?: string });

    const { accessToken, refreshToken } = tokenData;
    if (!accessToken || !refreshToken) {
        throw new Error('Mobile exchange response missing tokens');
    }

    await setSessionFromTokens(accessToken, refreshToken);
}

export async function handleDeepLinkAuth(url: string, _apiUrl?: string) {
    if (!url || !isAuthCallbackUrl(url)) {
        return false;
    }

    if (isAuthCallbackAlreadyProcessed(url)) {
        logDebug('RootNavigatorSession', 'Skipping already processed auth callback URL', {
            url: maskUrl(url),
        });
        return true;
    }

    logDebug('RootNavigatorSession', 'Handling auth callback URL', { url: maskUrl(url) });

    try {
        const urlObject = new URL(url);
        const queryParams = new URLSearchParams(urlObject.search);
        // Only an authorization code bound to the SDK's local PKCE verifier.
        // Never accept raw tokens or an unbound mobile exchange link.
        if (urlObject.hash || queryParams.has('access_token') || queryParams.has('refresh_token') || queryParams.has('exchange_code')) return false;
        const code = queryParams.get('code');

        if (code) {
            const { error } = await supabase.auth.exchangeCodeForSession(code);

            if (error) {
                throw error;
            }

            markAuthCallbackProcessed(url);
            return true;
        }

        logWarn('RootNavigatorSession', 'No auth payload found in callback URL', {
            url: maskUrl(url),
        });
        return false;
    } catch (error) {
        logError('RootNavigatorSession', 'Failed to process auth callback URL', error);
        return false;
    }
}

export function useRootNavigationSession() {
    const [session, setSession] = useState<Session | null>(null);
    const [loading, setLoading] = useState(true);
    const sessionRef = useRef<Session | null>(null);

    const updateSession = (nextSession: Session | null) => {
        sessionRef.current = nextSession;
        setSession(nextSession);
    };

    useEffect(() => {
        let isMounted = true;
        const apiUrl = getMobileApiUrl();

        const syncSession = async (reason: string) => {
            const {
                data: { session: currentSession },
                error,
            } = await supabase.auth.getSession();

            if (error) {
                throw error;
            }

            logDebug('RootNavigatorSession', 'Synced session', {
                reason,
                hasSession: !!currentSession,
            });

            if (isMounted) {
                updateSession(currentSession);
            }

            return currentSession;
        };

        const handleIncomingUrl = async (url: string | null) => {
            if (!url) {
                return;
            }

            const handled = await handleDeepLinkAuth(url, apiUrl);

            if (handled && isMounted) {
                await syncSession('deep-link');
            }
        };

        const handleAppStateChange = async (nextAppState: AppStateStatus) => {
            if (nextAppState !== 'active') {
                return;
            }

            try {
                await syncSession('app-active');
            } catch (error) {
                logError('RootNavigatorSession', 'App resume session sync failed', error);
            }
        };

        const bootstrap = async () => {
            try {
                await syncSession('bootstrap');

                const initialUrl = await Linking.getInitialURL();
                await handleIncomingUrl(initialUrl);
            } catch (error) {
                logError('RootNavigatorSession', 'Bootstrap failed', error);
            } finally {
                if (isMounted) {
                    setLoading(false);
                }
            }
        };

        void bootstrap();

        const {
            data: { subscription: authSubscription },
        } = supabase.auth.onAuthStateChange((event, nextSession) => {
            logDebug('RootNavigatorSession', 'Auth state changed', {
                event,
                hasSession: !!nextSession,
            });

            if (isMounted) {
                updateSession(nextSession);
            }
        });

        const linkingSubscription = Linking.addEventListener('url', ({ url }) => {
            void handleIncomingUrl(url);
        });
        const appStateSubscription = AppState.addEventListener(
            'change',
            handleAppStateChange,
        );

        return () => {
            isMounted = false;
            authSubscription.unsubscribe();
            linkingSubscription.remove();
            appStateSubscription.remove();
        };
    }, []);

    return {
        session,
        loading,
        hasSession: !!session,
    };
}
