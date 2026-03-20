import type { MutableRefObject } from 'react';
import type { AppStateStatus } from 'react-native';

import { supabase } from '../lib/supabase';
import { logDebug, logError, logWarn } from '../lib/log';

import {
    buildMobileExchangeUrl,
    buildMobilePendingCheckUrl,
    extractAuthCallbackParams,
    isAuthCallbackUrl,
    resolveMobileApiUrl,
} from './authBootstrap';

type SessionLike = unknown;

function getMobileApiUrl() {
    const Constants = require('expo-constants').default;

    return resolveMobileApiUrl({
        envApiUrl: process.env.EXPO_PUBLIC_API_URL,
        expoConfigApiUrl: Constants.expoConfig?.extra?.apiUrl,
        manifestApiUrl: Constants.manifest?.extra?.apiUrl,
    });
}

async function setSessionFromTokens(accessToken: string, refreshToken: string, source: string) {
    const { error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
    });

    if (error) {
        logError('RootNavigator', `Error setting session from ${source}`, error);
        return false;
    }

    logDebug('RootNavigator', 'Session set successfully', { source });
    return true;
}

async function exchangePendingCode(code: string) {
    try {
        const apiUrl = getMobileApiUrl();
        const exchangeResponse = await fetch(buildMobileExchangeUrl(apiUrl, code));

        if (!exchangeResponse.ok) {
            const errorText = await exchangeResponse.text();
            logError('RootNavigator', 'Pending token exchange failed', {
                status: exchangeResponse.status,
                errorText,
            });
            return false;
        }

        const { accessToken, refreshToken } = await exchangeResponse.json();
        return setSessionFromTokens(accessToken, refreshToken, 'pending-tokens');
    } catch (error) {
        logError('RootNavigator', 'Error exchanging pending tokens', error);
        return false;
    }
}

export async function handleAuthCallbackUrl(url: string) {
    if (!isAuthCallbackUrl(url)) {
        return;
    }

    logDebug('RootNavigator', 'Handling auth callback URL', { url });

    try {
        const { accessToken, refreshToken, code, exchangeCode } = extractAuthCallbackParams(url);

        logDebug('RootNavigator', 'Extracted auth callback params', {
            hasAccessToken: !!accessToken,
            hasRefreshToken: !!refreshToken,
            hasCode: !!code,
            hasExchangeCode: !!exchangeCode,
        });

        if (!exchangeCode && accessToken && refreshToken && url.includes('#access_token=')) {
            await setSessionFromTokens(accessToken, refreshToken, 'hash-tokens');
            return;
        }

        if (exchangeCode) {
            try {
                const apiUrl = getMobileApiUrl();
                const response = await fetch(buildMobileExchangeUrl(apiUrl, exchangeCode));

                if (!response.ok) {
                    const errorText = await response.text();
                    logError('RootNavigator', 'API exchange failed', { status: response.status, errorText });
                    return;
                }

                const { accessToken: apiAccessToken, refreshToken: apiRefreshToken } = await response.json();
                await setSessionFromTokens(apiAccessToken, apiRefreshToken, 'api-exchange');
            } catch (error) {
                logError('RootNavigator', 'Error exchanging code via API', error);
            }
            return;
        }

        if (accessToken && refreshToken) {
            await setSessionFromTokens(accessToken, refreshToken, 'direct-tokens');
            return;
        }

        if (code) {
            const { error } = await supabase.auth.exchangeCodeForSession(code);
            if (error) {
                logError('RootNavigator', 'Error exchanging code', error);
            } else {
                logDebug('RootNavigator', 'Code exchanged successfully, session created');
            }
            return;
        }

        logWarn('RootNavigator', 'No tokens or code found in auth callback URL');
    } catch (error) {
        logError('RootNavigator', 'Error handling deep link', error);
    }
}

export async function checkPendingTokens(sessionRef: MutableRefObject<SessionLike>) {
    if (sessionRef.current) {
        return;
    }

    logDebug('RootNavigator', 'No session, checking for pending tokens');

    try {
        const apiUrl = getMobileApiUrl();
        const checkResponse = await fetch(buildMobilePendingCheckUrl(apiUrl));

        if (!checkResponse.ok) {
            return;
        }

        const checkData = await checkResponse.json();
        if (!checkData.hasPending || !checkData.code) {
            logDebug('RootNavigator', 'No pending tokens found');
            return;
        }

        logDebug('RootNavigator', 'Found pending tokens, exchanging code', { code: checkData.code });
        await exchangePendingCode(checkData.code);
    } catch (error) {
        logError('RootNavigator', 'Error checking pending tokens', error);
    }
}

export async function handleActiveAppState(params: {
    nextAppState: AppStateStatus;
    sessionRef: MutableRefObject<SessionLike>;
    setSession: (session: SessionLike) => void;
}) {
    const { nextAppState, sessionRef, setSession } = params;

    if (nextAppState !== 'active') {
        return;
    }

    logDebug('RootNavigator', 'App became active, checking session');

    const { data: { session: currentSession } } = await supabase.auth.getSession();
    if (currentSession && !sessionRef.current) {
        logDebug('RootNavigator', 'Session found after app became active');
        sessionRef.current = currentSession;
        setSession(currentSession);
        return;
    }

    if (!currentSession && sessionRef.current) {
        logDebug('RootNavigator', 'Session lost after app became active');
        sessionRef.current = null;
        setSession(null);
        return;
    }

    await checkPendingTokens(sessionRef);

    const { data: { session: refreshedSession } } = await supabase.auth.getSession();
    if (refreshedSession && !sessionRef.current) {
        sessionRef.current = refreshedSession;
        setSession(refreshedSession);
    }
}
