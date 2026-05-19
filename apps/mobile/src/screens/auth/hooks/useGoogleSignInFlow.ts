import { useEffect, useRef, useState } from 'react';
import * as WebBrowser from 'expo-web-browser';
import * as SecureStore from 'expo-secure-store';

import { trackMobileEvent } from '../../../lib/analytics';
import { logDebug, logError, logWarn } from '../../../lib/log';
import { supabase } from '../../../lib/supabase';
import {
    handleDeepLinkAuth,
    tryRestorePendingSession,
} from '../../../navigation/useRootNavigationSession';
import { MOBILE_GOOGLE_NATIVE_AUTH_ENABLED } from './authFeatureFlags';
import { type AuthUiState, transitionAuthUiState } from './authUiState';

const MOBILE_REDIRECT = 'https://kezek.kg/auth/callback-mobile?redirect=kezek://auth/callback';
const GOOGLE_NATIVE_REDIRECT = 'kezek://auth/callback';
const GOOGLE_SESSION_SYNC_DELAY_MS = 500;
const GOOGLE_AUTH_FLOW_NAME = 'mobile_google_oauth';
const GOOGLE_ACTIVE_FLOW_STORAGE_KEY = 'google_mobile_active_login_v1';
const GOOGLE_ACTIVE_FLOW_TTL_MS = 10 * 60 * 1000;

function getUrlParam(url: string, key: string) {
    try {
        const parsed = new URL(url);
        const queryValue = parsed.searchParams.get(key);
        if (queryValue) {
            return queryValue;
        }

        if (parsed.hash) {
            const hashParams = new URLSearchParams(parsed.hash.replace(/^#/, ''));
            return hashParams.get(key);
        }

        return null;
    } catch {
        return null;
    }
}

type ShowToast = (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;

export function useGoogleSignInFlow({
    apiUrl,
    showToast,
}: {
    apiUrl: string;
    showToast: ShowToast;
}) {
    const [googleLoading, setGoogleLoading] = useState(false);
    const [googleState, setGoogleState] = useState<AuthUiState>('idle');
    const googleAuthInProgressRef = useRef(false);
    const googleSuccessShownRef = useRef(false);
    const googleExpectedStateRef = useRef<string | null>(null);
    const googleLastProcessedCallbackRef = useRef<string | null>(null);
    const googleSessionResolveInFlightRef = useRef(false);
    const googleSuccessMetricSentRef = useRef(false);
    const googleCallbackMetricSentRef = useRef(false);

    const hasActiveSession = async () => {
        const {
            data: { session },
        } = await supabase.auth.getSession();
        return Boolean(session);
    };

    const persistActiveGoogleFlow = async () => {
        await SecureStore.setItemAsync(
            GOOGLE_ACTIVE_FLOW_STORAGE_KEY,
            JSON.stringify({ startedAt: Date.now() }),
        );
    };

    const clearPersistedGoogleFlow = async () => {
        await SecureStore.deleteItemAsync(GOOGLE_ACTIVE_FLOW_STORAGE_KEY);
    };

    const hasPersistedGoogleFlow = async () => {
        const raw = await SecureStore.getItemAsync(GOOGLE_ACTIVE_FLOW_STORAGE_KEY);
        if (!raw) {
            return false;
        }

        try {
            const parsed = JSON.parse(raw) as { startedAt?: number };
            if (typeof parsed.startedAt !== 'number') {
                throw new Error('invalid_google_flow_payload');
            }

            if (Date.now() - parsed.startedAt > GOOGLE_ACTIVE_FLOW_TTL_MS) {
                await clearPersistedGoogleFlow();
                return false;
            }

            return true;
        } catch {
            await clearPersistedGoogleFlow();
            return false;
        }
    };

    const tryResolveGoogleSession = async (callbackUrl?: string) => {
        if (googleSessionResolveInFlightRef.current) {
            return false;
        }
        googleSessionResolveInFlightRef.current = true;

        const finish = (value: boolean) => {
            googleSessionResolveInFlightRef.current = false;
            return value;
        };

        if (callbackUrl) {
            if (googleLastProcessedCallbackRef.current === callbackUrl) {
                return finish(await hasActiveSession());
            }

            const callbackState = getUrlParam(callbackUrl, 'state');
            const expectedState = googleExpectedStateRef.current;
            if (expectedState && callbackState && callbackState !== expectedState) {
                googleLastProcessedCallbackRef.current = callbackUrl;
                throw new Error('oauth_state_mismatch');
            }

            await handleDeepLinkAuth(callbackUrl, apiUrl);
            googleLastProcessedCallbackRef.current = callbackUrl;
        }

        if (await hasActiveSession()) {
            return finish(true);
        }

        await new Promise((resolve) => setTimeout(resolve, GOOGLE_SESSION_SYNC_DELAY_MS));
        if (await hasActiveSession()) {
            return finish(true);
        }

        const restored = await tryRestorePendingSession(apiUrl).catch(() => false);
        if (!restored) {
            return finish(false);
        }

        return finish(await hasActiveSession());
    };

    const showGoogleSuccessOnce = () => {
        if (googleSuccessShownRef.current) {
            return;
        }

        googleSuccessShownRef.current = true;
        showToast('Вход выполнен успешно', 'success');
    };

    const mapGoogleSignInError = (error: unknown) => {
        const raw = error instanceof Error ? error.message : String(error);
        const normalized = raw.toLowerCase();

        if (
            normalized.includes('network') ||
            normalized.includes('failed to fetch') ||
            normalized.includes('timed out')
        ) {
            return 'Network error. Check your internet connection and try again.';
        }

        if (
            normalized.includes('redirect') ||
            normalized.includes('invalid redirect') ||
            normalized.includes('redirect_uri_mismatch') ||
            normalized.includes('callback')
        ) {
            return 'Неверная конфигурация входа Google. Обратитесь в поддержку.';
        }

        if (
            normalized.includes('temporarily_unavailable') ||
            normalized.includes('provider') ||
            normalized.includes('server_error')
        ) {
            return 'Вход через Google временно недоступен. Попробуйте позже.';
        }

        if (normalized.includes('oauth_state_mismatch')) {
            return 'Не удалось подтвердить сессию Google. Повторите попытку.';
        }

        return raw || 'Не удалось выполнить вход через Google';
    };

    const trackGoogleLoginEvent = (
        eventType:
            | 'mobile_google_login_started'
            | 'mobile_google_login_callback_received'
            | 'mobile_google_login_success'
            | 'mobile_google_login_failed'
            | 'mobile_google_login_cancelled',
        metadata?: Record<string, unknown>,
    ) => {
        void trackMobileEvent({
            eventType,
            metadata: {
                flow: GOOGLE_AUTH_FLOW_NAME,
                ...metadata,
            },
        });
    };

    const logGoogleFlowStage = (stage: string, details?: Record<string, unknown>) => {
        logDebug('SignInScreen', 'Google auth flow stage', {
            flow: GOOGLE_AUTH_FLOW_NAME,
            stage,
            ...details,
        });
    };

    const trackGoogleSuccessOnce = (metadata?: Record<string, unknown>) => {
        if (googleSuccessMetricSentRef.current) {
            return;
        }

        googleSuccessMetricSentRef.current = true;
        trackGoogleLoginEvent('mobile_google_login_success', metadata);
    };

    const trackGoogleCallbackOnce = (metadata?: Record<string, unknown>) => {
        if (googleCallbackMetricSentRef.current) {
            return;
        }

        googleCallbackMetricSentRef.current = true;
        trackGoogleLoginEvent('mobile_google_login_callback_received', metadata);
    };

    const getGoogleFailureReason = (error: unknown): string => {
        const raw = error instanceof Error ? error.message : String(error);
        const normalized = raw.toLowerCase();

        if (
            normalized.includes('network') ||
            normalized.includes('failed to fetch') ||
            normalized.includes('timed out')
        ) {
            return 'network';
        }

        if (
            normalized.includes('redirect') ||
            normalized.includes('redirect_uri_mismatch') ||
            normalized.includes('callback')
        ) {
            return 'redirect_config';
        }

        if (normalized.includes('oauth_state_mismatch')) {
            return 'state_mismatch';
        }

        if (
            normalized.includes('temporarily_unavailable') ||
            normalized.includes('provider') ||
            normalized.includes('server_error')
        ) {
            return 'provider_unavailable';
        }

        return 'unknown';
    };

    const handleGoogleSignIn = async () => {
        setGoogleLoading(true);
        setGoogleState((prev) => transitionAuthUiState(prev, 'start'));
        googleAuthInProgressRef.current = true;
        await persistActiveGoogleFlow();
        googleSuccessShownRef.current = false;
        googleExpectedStateRef.current = null;
        googleLastProcessedCallbackRef.current = null;
        googleSuccessMetricSentRef.current = false;
        googleCallbackMetricSentRef.current = false;

        try {
            const redirectTo = MOBILE_GOOGLE_NATIVE_AUTH_ENABLED
                ? GOOGLE_NATIVE_REDIRECT
                : MOBILE_REDIRECT;
            trackGoogleLoginEvent('mobile_google_login_started', {
                redirect: MOBILE_GOOGLE_NATIVE_AUTH_ENABLED ? 'native' : 'web_callback',
            });
            logGoogleFlowStage('started', {
                provider: 'google',
                redirectTo,
                nativeAuthEnabled: MOBILE_GOOGLE_NATIVE_AUTH_ENABLED,
            });

            const returnUrl = GOOGLE_NATIVE_REDIRECT;
            const { data, error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo,
                    skipBrowserRedirect: true,
                },
            });

            if (error) {
                logError('SignInScreen', 'OAuth error', { provider: 'google', error });
                throw error;
            }

            if (!data?.url) {
                throw new Error('Failed to get OAuth URL');
            }

            logGoogleFlowStage('oauth_url_received', {
                hasUrl: true,
            });

            googleExpectedStateRef.current = getUrlParam(data.url, 'state');

            const result = await WebBrowser.openAuthSessionAsync(data.url, returnUrl);
            logGoogleFlowStage('auth_session_result', {
                resultType: result.type,
                hasUrl: Boolean(result.type === 'success' && 'url' in result && result.url),
            });
            WebBrowser.maybeCompleteAuthSession();

            if (result.type === 'success' && result.url) {
                trackGoogleCallbackOnce({ source: 'open_auth_session' });
                logGoogleFlowStage('callback_received', { source: 'open_auth_session' });
                const restored = await tryResolveGoogleSession(result.url);
                if (restored) {
                    googleAuthInProgressRef.current = false;
                    setGoogleState((prev) => transitionAuthUiState(prev, 'succeed'));
                    await clearPersistedGoogleFlow();
                    trackGoogleSuccessOnce({ source: 'oauth_success_result' });
                    logGoogleFlowStage('session_established', {
                        source: 'oauth_success_result',
                    });
                    showGoogleSuccessOnce();
                } else {
                    setGoogleState((prev) => transitionAuthUiState(prev, 'fail'));
                    await clearPersistedGoogleFlow();
                    trackGoogleLoginEvent('mobile_google_login_failed', {
                        reason: 'session_not_established_after_callback',
                    });
                    logWarn('SignInScreen', 'Google auth callback received without session', {
                        flow: GOOGLE_AUTH_FLOW_NAME,
                    });
                    showToast(
                        'Колбэк авторизации получен, но сессия не установлена. Попробуйте снова.',
                        'info',
                    );
                }
                return;
            }

            if (result.type === 'dismiss') {
                const restored = await tryResolveGoogleSession();
                if (restored) {
                    googleAuthInProgressRef.current = false;
                    setGoogleState((prev) => transitionAuthUiState(prev, 'succeed'));
                    await clearPersistedGoogleFlow();
                    trackGoogleSuccessOnce({ source: 'oauth_dismiss_recovery' });
                    logGoogleFlowStage('session_established', {
                        source: 'oauth_dismiss_recovery',
                    });
                    showGoogleSuccessOnce();
                } else {
                    setGoogleState((prev) => transitionAuthUiState(prev, 'cancel'));
                    await clearPersistedGoogleFlow();
                    trackGoogleLoginEvent('mobile_google_login_cancelled', {
                        reason: 'dismiss',
                    });
                    logGoogleFlowStage('cancelled', {
                        reason: 'dismiss',
                    });
                    showToast(
                        'Окно входа закрыто. Если вход завершен в браузере, вернитесь в приложение и повторите.',
                        'info',
                    );
                }
                return;
            }

            if (result.type === 'cancel') {
                googleAuthInProgressRef.current = false;
                setGoogleState((prev) => transitionAuthUiState(prev, 'cancel'));
                await clearPersistedGoogleFlow();
                trackGoogleLoginEvent('mobile_google_login_cancelled', {
                    reason: 'cancel',
                });
                logGoogleFlowStage('cancelled', { reason: 'cancel' });
                showToast('Вход отменен', 'info');
                return;
            }

            if (result.type === 'locked') {
                setGoogleState((prev) => transitionAuthUiState(prev, 'fail'));
                await clearPersistedGoogleFlow();
                trackGoogleLoginEvent('mobile_google_login_failed', {
                    reason: 'auth_browser_locked',
                });
                logGoogleFlowStage('failed', { reason: 'auth_browser_locked' });
                showToast(
                    'Браузер авторизации уже открыт. Закройте его и попробуйте снова.',
                    'info',
                );
                return;
            }

            logWarn('SignInScreen', 'Unexpected OAuth result type', {
                provider: 'google',
                type: result.type,
            });
            setGoogleState((prev) => transitionAuthUiState(prev, 'fail'));
            await clearPersistedGoogleFlow();
            trackGoogleLoginEvent('mobile_google_login_failed', {
                reason: `unexpected_result_${result.type}`,
            });
            showToast('Не удалось завершить авторизацию. Попробуйте снова.', 'error');
        } catch (error: unknown) {
            logError('SignInScreen', 'OAuth sign in error', { provider: 'google', error });
            const reason = getGoogleFailureReason(error);
            setGoogleState((prev) => transitionAuthUiState(prev, 'fail'));
            await clearPersistedGoogleFlow();
            trackGoogleLoginEvent('mobile_google_login_failed', { reason });
            logGoogleFlowStage('failed', { reason });
            showToast(mapGoogleSignInError(error), 'error');
        } finally {
            googleAuthInProgressRef.current = false;
            googleExpectedStateRef.current = null;
            setGoogleLoading(false);
            setGoogleState((prev) => transitionAuthUiState(prev, 'reset'));
        }
    };

    const recoverGoogleOnAppActive = async () => {
        if (!googleAuthInProgressRef.current) {
            return;
        }

        const restored = await tryResolveGoogleSession();
        if (restored) {
            googleAuthInProgressRef.current = false;
            setGoogleLoading(false);
            setGoogleState((prev) => transitionAuthUiState(prev, 'succeed'));
            await clearPersistedGoogleFlow();
            trackGoogleSuccessOnce({ source: 'app_state_recovery' });
            logGoogleFlowStage('session_established', {
                source: 'app_state_recovery',
            });
            showGoogleSuccessOnce();
        }
    };

    useEffect(() => {
        let mounted = true;
        const recoverAfterRestart = async () => {
            const hasFlow = await hasPersistedGoogleFlow();
            if (!hasFlow || !mounted) {
                return;
            }

            googleAuthInProgressRef.current = true;
            setGoogleLoading(true);
            setGoogleState((prev) => transitionAuthUiState(prev, 'wait'));
            await recoverGoogleOnAppActive();
            if (mounted) {
                setGoogleLoading(false);
                setGoogleState((prev) => transitionAuthUiState(prev, 'reset'));
            }
        };

        void recoverAfterRestart();
        return () => {
            mounted = false;
        };
    }, []);

    return {
        googleLoading,
        googleState,
        handleGoogleSignIn,
        recoverGoogleOnAppActive,
    };
}
