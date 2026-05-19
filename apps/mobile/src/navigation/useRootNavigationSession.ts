import { useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus, Linking } from 'react-native';
import type { Session } from '@supabase/supabase-js';

import { getMobileApiUrl } from '../lib/apiUrl';
import { fetchWithTimeout } from '../lib/fetchWithTimeout';
import { supabase } from '../lib/supabase';
import { logDebug, logError, logWarn } from '../lib/log';

const AUTH_CALLBACK_RE =
    /auth\/callback|callback-mobile|access_token=|refresh_token=|\?code=|exchange_code=/i;
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
    return AUTH_CALLBACK_RE.test(url);
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

export function extractHashTokens(url: string) {
    const match = url.match(/#access_token=([^&]+)&refresh_token=([^&]+)/);

    if (!match) {
        return null;
    }

    return {
        accessToken: decodeURIComponent(match[1]),
        refreshToken: decodeURIComponent(match[2]),
    };
}

export async function exchangeViaMobileApi(exchangeCode: string, apiUrl: string) {
    const response = await fetchWithTimeout(
        `${apiUrl}/api/auth/mobile-exchange?code=${encodeURIComponent(exchangeCode)}`,
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

export async function handleDeepLinkAuth(url: string, apiUrl: string) {
    if (!url || !isAuthCallbackUrl(url)) {
        return false;
    }

    if (isAuthCallbackAlreadyProcessed(url)) {
        logDebug('RootNavigatorSession', 'Skipping already processed auth callback URL', { url });
        return true;
    }

    logDebug('RootNavigatorSession', 'Handling auth callback URL', { url });

    try {
        let urlObject: URL;

        try {
            urlObject = new URL(url);
        } catch {
            const tokens = extractHashTokens(url);

            if (tokens) {
                await setSessionFromTokens(tokens.accessToken, tokens.refreshToken);
                markAuthCallbackProcessed(url);
                return true;
            }

            throw new Error('Unable to parse auth callback URL');
        }

        const hashParams = new URLSearchParams(urlObject.hash.slice(1));
        const queryParams = new URLSearchParams(urlObject.search);
        const accessToken =
            hashParams.get('access_token') || queryParams.get('access_token');
        const refreshToken =
            hashParams.get('refresh_token') || queryParams.get('refresh_token');
        const exchangeCode = queryParams.get('exchange_code');
        const code = queryParams.get('code');

        if (exchangeCode) {
            await exchangeViaMobileApi(exchangeCode, apiUrl);
            markAuthCallbackProcessed(url);
            return true;
        }

        if (accessToken && refreshToken) {
            await setSessionFromTokens(accessToken, refreshToken);
            markAuthCallbackProcessed(url);
            return true;
        }

        if (code) {
            const { error } = await supabase.auth.exchangeCodeForSession(code);

            if (error) {
                throw error;
            }

            markAuthCallbackProcessed(url);
            return true;
        }

        logWarn('RootNavigatorSession', 'No auth payload found in callback URL', { url });
        return false;
    } catch (error) {
        logError('RootNavigatorSession', 'Failed to process auth callback URL', error);
        return false;
    }
}

export async function tryRestorePendingSession(apiUrl: string) {
    const response = await fetchWithTimeout(`${apiUrl}/api/auth/mobile-exchange?check=true`);

    if (!response.ok) {
        return false;
    }

    const payload = await response.json();
    const data =
        payload && typeof payload === 'object' && 'data' in payload
            ? (payload.data as { hasPending?: boolean; code?: string })
            : (payload as { hasPending?: boolean; code?: string });

    if (!data.hasPending || !data.code) {
        return false;
    }

    await exchangeViaMobileApi(data.code, apiUrl);
    return true;
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
                const currentSession = await syncSession('app-active');

                if (!currentSession) {
                    const restored = await tryRestorePendingSession(apiUrl);

                    if (restored) {
                        await syncSession('pending-mobile-exchange');
                    }
                }
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
