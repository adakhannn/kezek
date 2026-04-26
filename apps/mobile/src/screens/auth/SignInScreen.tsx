import { useEffect, useRef, useState } from 'react';
import {
    AppState,
    type AppStateStatus,
    Linking,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as WebBrowser from 'expo-web-browser';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';

import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { colors } from '../../constants/colors';
import { useToast } from '../../contexts/ToastContext';
import { trackMobileEvent } from '../../lib/analytics';
import { logDebug, logError, logWarn } from '../../lib/log';
import { supabase } from '../../lib/supabase';
import { AuthStackParamList } from '../../navigation/types';
import {
    exchangeViaMobileApi,
    getMobileApiUrl,
    handleDeepLinkAuth,
    tryRestorePendingSession,
} from '../../navigation/useRootNavigationSession';
import { getValidationError } from '../../utils/validation';

type SignInScreenNavigationProp = NativeStackNavigationProp<AuthStackParamList, 'SignIn'>;

const MOBILE_REDIRECT = 'https://kezek.kg/auth/callback-mobile?redirect=kezek://auth/callback';
const GOOGLE_NATIVE_REDIRECT = 'kezek://auth/callback';
const GOOGLE_SESSION_SYNC_DELAY_MS = 500;
const TELEGRAM_POLL_INTERVAL_MS = 2500;
const TELEGRAM_POLL_TIMEOUT_MS = 3 * 60 * 1000;
const TELEGRAM_ACTIVE_FLOW_STORAGE_KEY = 'telegram_mobile_active_login_v1';
const TELEGRAM_WEB_WIDGET_FALLBACK_REDIRECT =
    '/auth/callback-mobile?redirect=kezek://auth/callback';
const GOOGLE_AUTH_FLOW_NAME = 'mobile_google_oauth';
const MOBILE_GOOGLE_NATIVE_AUTH_ENABLED = (() => {
    const raw = process.env.EXPO_PUBLIC_MOBILE_GOOGLE_NATIVE_AUTH;
    if (raw == null) {
        return true;
    }

    const normalized = raw.trim().toLowerCase();
    if (['1', 'true', 'yes', 'on', 'enabled'].includes(normalized)) {
        return true;
    }
    if (['0', 'false', 'no', 'off', 'disabled'].includes(normalized)) {
        return false;
    }

    return true;
})();
const TELEGRAM_DEEPLINK_AUTH_ENABLED = (() => {
    const raw = process.env.EXPO_PUBLIC_MOBILE_TELEGRAM_DEEPLINK_AUTH;
    if (raw == null) {
        return true;
    }

    const normalized = raw.trim().toLowerCase();
    if (['1', 'true', 'yes', 'on', 'enabled'].includes(normalized)) {
        return true;
    }
    if (['0', 'false', 'no', 'off', 'disabled'].includes(normalized)) {
        return false;
    }

    return true;
})();

type TelegramLoginUiStatus = 'idle' | 'pending' | 'approved' | 'expired';
type TelegramFlowState = {
    nonce: string;
    botDeepLink: string;
    startedAt: number;
};

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

function buildTelegramWebWidgetFallbackUrl(apiUrl: string) {
    const base = apiUrl.replace(/\/+$/, '');
    const redirectParam = encodeURIComponent(TELEGRAM_WEB_WIDGET_FALLBACK_REDIRECT);
    return `${base}/auth/sign-in?redirect=${redirectParam}`;
}

function buildTelegramAppDeepLink(botDeepLink: string): string | null {
    try {
        const parsed = new URL(botDeepLink);
        const host = parsed.hostname.replace(/^www\./, '').toLowerCase();
        if (host !== 't.me' && host !== 'telegram.me') {
            return null;
        }

        const domain = parsed.pathname.replace(/^\/+/, '').trim();
        if (!domain) {
            return null;
        }

        const start = parsed.searchParams.get('start');
        if (start) {
            return `tg://resolve?domain=${encodeURIComponent(domain)}&start=${encodeURIComponent(start)}`;
        }

        const startApp = parsed.searchParams.get('startapp');
        if (startApp) {
            return `tg://resolve?domain=${encodeURIComponent(domain)}&startapp=${encodeURIComponent(startApp)}`;
        }

        return `tg://resolve?domain=${encodeURIComponent(domain)}`;
    } catch {
        return null;
    }
}

async function openTelegramLink(botDeepLink: string) {
    const appDeepLink = buildTelegramAppDeepLink(botDeepLink);

    if (appDeepLink) {
        const canOpenAppDeepLink = await Linking.canOpenURL(appDeepLink);
        if (canOpenAppDeepLink) {
            await Linking.openURL(appDeepLink);
            return;
        }
    }

    const canOpenWebDeepLink = await Linking.canOpenURL(botDeepLink);
    if (!canOpenWebDeepLink) {
        throw new Error('Не удалось открыть Telegram');
    }

    await Linking.openURL(botDeepLink);
}

export default function SignInScreen() {
    const navigation = useNavigation<SignInScreenNavigationProp>();
    const { showToast } = useToast();
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [googleLoading, setGoogleLoading] = useState(false);
    const [telegramLoading, setTelegramLoading] = useState(false);
    const [telegramUiStatus, setTelegramUiStatus] =
        useState<TelegramLoginUiStatus>('idle');
    const [telegramDeepLink, setTelegramDeepLink] = useState<string | null>(null);
    const [telegramNonce, setTelegramNonce] = useState<string | null>(null);
    const [errors, setErrors] = useState<{ email?: string }>({});
    const telegramPollingNonceRef = useRef<string | null>(null);
    const telegramPollingInFlightRef = useRef<string | null>(null);
    const telegramFlowRef = useRef<TelegramFlowState | null>(null);
    const googleAuthInProgressRef = useRef(false);
    const googleSuccessShownRef = useRef(false);
    const googleExpectedStateRef = useRef<string | null>(null);
    const googleLastProcessedCallbackRef = useRef<string | null>(null);
    const googleSessionResolveInFlightRef = useRef(false);
    const appStateRef = useRef<AppStateStatus>(AppState.currentState);
    const googleSuccessMetricSentRef = useRef(false);
    const googleCallbackMetricSentRef = useRef(false);

    const apiUrl = getMobileApiUrl();

    const persistTelegramFlow = async (flow: TelegramFlowState) => {
        telegramFlowRef.current = flow;
        await SecureStore.setItemAsync(
            TELEGRAM_ACTIVE_FLOW_STORAGE_KEY,
            JSON.stringify(flow),
        );
    };

    const clearPersistedTelegramFlow = async () => {
        telegramFlowRef.current = null;
        await SecureStore.deleteItemAsync(TELEGRAM_ACTIVE_FLOW_STORAGE_KEY);
    };

    const loadPersistedTelegramFlow = async () => {
        const raw = await SecureStore.getItemAsync(TELEGRAM_ACTIVE_FLOW_STORAGE_KEY);
        if (!raw) {
            return null;
        }

        try {
            const parsed = JSON.parse(raw) as Partial<TelegramFlowState>;
            if (
                typeof parsed?.nonce !== 'string' ||
                typeof parsed?.botDeepLink !== 'string' ||
                typeof parsed?.startedAt !== 'number'
            ) {
                throw new Error('invalid telegram flow payload');
            }

            return parsed as TelegramFlowState;
        } catch (error: unknown) {
            logWarn('SignInScreen', 'Failed to parse persisted telegram flow', { error });
            await SecureStore.deleteItemAsync(TELEGRAM_ACTIVE_FLOW_STORAGE_KEY);
            return null;
        }
    };

    const ensureSessionRestored = async (callbackUrl?: string, attempts = 4) => {
        if (callbackUrl) {
            await handleDeepLinkAuth(callbackUrl, apiUrl);
        }

        for (let i = 0; i < attempts; i += 1) {
            const {
                data: { session },
            } = await supabase.auth.getSession();
            if (session) {
                return true;
            }

            const restored = await tryRestorePendingSession(apiUrl).catch(() => false);
            if (restored) {
                const {
                    data: { session: restoredSession },
                } = await supabase.auth.getSession();
                if (restoredSession) {
                    return true;
                }
            }

            await new Promise((resolve) => setTimeout(resolve, 700));
        }

        return false;
    };

    const hasActiveSession = async () => {
        const {
            data: { session },
        } = await supabase.auth.getSession();
        return Boolean(session);
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
            return 'Google sign-in redirect is misconfigured. Contact support.';
        }

        if (
            normalized.includes('temporarily_unavailable') ||
            normalized.includes('provider') ||
            normalized.includes('server_error')
        ) {
            return 'Google sign-in is temporarily unavailable. Try again later.';
        }

        if (normalized.includes('oauth_state_mismatch')) {
            return 'Google sign-in session validation failed. Please try again.';
        }

        return raw || 'Failed to sign in with Google';
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

    const handleSignIn = async () => {
        const emailError = getValidationError('email', email);
        if (emailError) {
            setErrors({ email: emailError });
            showToast(emailError, 'error');
            return;
        }

        setErrors({});
        setLoading(true);

        try {
            const { error } = await supabase.auth.signInWithOtp({
                email: email.trim(),
                options: {
                    emailRedirectTo: MOBILE_REDIRECT,
                },
            });

            if (error) {
                throw error;
            }

            showToast('Проверьте email и перейдите по ссылке', 'success');
        } catch (error: unknown) {
            const errorMessage =
                error instanceof Error ? error.message : 'Не удалось отправить код';
            showToast(errorMessage, 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleSignIn = async () => {
        setGoogleLoading(true);
        googleAuthInProgressRef.current = true;
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
                    trackGoogleSuccessOnce({ source: 'oauth_success_result' });
                    logGoogleFlowStage('session_established', {
                        source: 'oauth_success_result',
                    });
                    showGoogleSuccessOnce();
                } else {
                    trackGoogleLoginEvent('mobile_google_login_failed', {
                        reason: 'session_not_established_after_callback',
                    });
                    logWarn('SignInScreen', 'Google auth callback received without session', {
                        flow: GOOGLE_AUTH_FLOW_NAME,
                    });
                    showToast(
                        'Authorization callback received, but session was not established. Please try again.',
                        'info',
                    );
                }
                return;
            }

            if (result.type === 'dismiss') {
                const restored = await tryResolveGoogleSession();
                if (restored) {
                    googleAuthInProgressRef.current = false;
                    trackGoogleSuccessOnce({ source: 'oauth_dismiss_recovery' });
                    logGoogleFlowStage('session_established', {
                        source: 'oauth_dismiss_recovery',
                    });
                    showGoogleSuccessOnce();
                } else {
                    trackGoogleLoginEvent('mobile_google_login_cancelled', {
                        reason: 'dismiss',
                    });
                    logGoogleFlowStage('cancelled', {
                        reason: 'dismiss',
                    });
                    showToast(
                        'Sign-in window was closed. If login completed in browser, return to app and try again.',
                        'info',
                    );
                }
                return;
            }

            if (result.type === 'cancel') {
                googleAuthInProgressRef.current = false;
                trackGoogleLoginEvent('mobile_google_login_cancelled', {
                    reason: 'cancel',
                });
                logGoogleFlowStage('cancelled', { reason: 'cancel' });
                showToast('Sign-in was cancelled', 'info');
                return;
            }

            if (result.type === 'locked') {
                trackGoogleLoginEvent('mobile_google_login_failed', {
                    reason: 'auth_browser_locked',
                });
                logGoogleFlowStage('failed', { reason: 'auth_browser_locked' });
                showToast(
                    'Authentication browser is already open. Close it and try again.',
                    'info',
                );
                return;
            }

            logWarn('SignInScreen', 'Unexpected OAuth result type', {
                provider: 'google',
                type: result.type,
            });
            trackGoogleLoginEvent('mobile_google_login_failed', {
                reason: `unexpected_result_${result.type}`,
            });
            showToast('Failed to complete authorization. Please try again.', 'error');
        } catch (error: unknown) {
            logError('SignInScreen', 'OAuth sign in error', { provider: 'google', error });
            const reason = getGoogleFailureReason(error);
            trackGoogleLoginEvent('mobile_google_login_failed', { reason });
            logGoogleFlowStage('failed', { reason });
            showToast(mapGoogleSignInError(error), 'error');
        } finally {
            googleAuthInProgressRef.current = false;
            googleExpectedStateRef.current = null;
            setGoogleLoading(false);
        }
    };

    const pollTelegramStatus = async (nonce: string, startedAt: number = Date.now()) => {
        if (telegramPollingInFlightRef.current === nonce) {
            return;
        }

        try {
            setTelegramUiStatus('pending');
            telegramPollingNonceRef.current = nonce;
            telegramPollingInFlightRef.current = nonce;

            while (Date.now() - startedAt < TELEGRAM_POLL_TIMEOUT_MS) {
                if (telegramPollingNonceRef.current !== nonce) {
                    return;
                }

                const response = await fetch(
                    `${apiUrl}/api/auth/telegram/mobile/status?nonce=${encodeURIComponent(nonce)}`,
                );

                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(
                        `Telegram mobile status failed: ${response.status} ${errorText}`,
                    );
                }

                const payload = (await response.json()) as {
                    data?: { status?: string; exchangeCode?: string };
                    status?: string;
                    exchangeCode?: string;
                };
                const status = payload?.data?.status ?? payload?.status;
                const exchangeCode = payload?.data?.exchangeCode ?? payload?.exchangeCode;

                if (status === 'approved') {
                    if (!exchangeCode) {
                        await new Promise((resolve) =>
                            setTimeout(resolve, TELEGRAM_POLL_INTERVAL_MS),
                        );
                        continue;
                    }

                    await exchangeViaMobileApi(exchangeCode, apiUrl);
                    const restored = await ensureSessionRestored(undefined, 5);
                    if (!restored) {
                        throw new Error('Сессия не установлена после exchange');
                    }

                    setTelegramUiStatus('approved');
                    telegramPollingNonceRef.current = null;
                    setTelegramNonce(null);
                    setTelegramDeepLink(null);
                    await clearPersistedTelegramFlow();
                    showToast('Подтверждено', 'success');
                    return;
                }

                if (status === 'expired' || status === 'failed') {
                    setTelegramUiStatus('expired');
                    telegramPollingNonceRef.current = null;
                    setTelegramNonce(null);
                    setTelegramDeepLink(null);
                    await clearPersistedTelegramFlow();
                    showToast('Истекло', 'info');
                    return;
                }

                await new Promise((resolve) =>
                    setTimeout(resolve, TELEGRAM_POLL_INTERVAL_MS),
                );
            }

            setTelegramUiStatus('expired');
            telegramPollingNonceRef.current = null;
            setTelegramNonce(null);
            setTelegramDeepLink(null);
            await clearPersistedTelegramFlow();
            showToast('Истекло', 'info');
        } catch (error: unknown) {
            logError('SignInScreen', 'Telegram status polling error', { error });
            telegramPollingNonceRef.current = null;
            setTelegramNonce(null);
            setTelegramDeepLink(null);
            await clearPersistedTelegramFlow();
            setTelegramUiStatus('idle');
            const errorMessage =
                error instanceof Error
                    ? error.message
                    : 'Не удалось завершить вход через Telegram';
            showToast(errorMessage, 'error');
        } finally {
            if (telegramPollingInFlightRef.current === nonce) {
                telegramPollingInFlightRef.current = null;
            }
        }
    };

    const startTelegramMobileLogin = async () => {
        if (!TELEGRAM_DEEPLINK_AUTH_ENABLED) {
            showToast('Telegram login is temporarily unavailable', 'info');
            return;
        }

        setTelegramLoading(true);
        telegramPollingNonceRef.current = null;
        telegramPollingInFlightRef.current = null;
        telegramFlowRef.current = null;
        setTelegramUiStatus('idle');
        setTelegramNonce(null);
        setTelegramDeepLink(null);
        await clearPersistedTelegramFlow();

        try {
            const response = await fetch(`${apiUrl}/api/auth/telegram/mobile/start`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    appName: 'Kezek Mobile',
                    platform: Platform.OS,
                    device: Constants.deviceName ?? null,
                }),
            });

            if (!response.ok) {
                if (response.status === 503) {
                    const fallbackUrl = buildTelegramWebWidgetFallbackUrl(apiUrl);
                    logWarn(
                        'SignInScreen',
                        'Telegram mobile deeplink auth unavailable, fallback to web widget',
                        { fallbackUrl },
                    );

                    const canOpenFallback = await Linking.canOpenURL(fallbackUrl);
                    if (!canOpenFallback) {
                        throw new Error('Failed to open Telegram web login fallback');
                    }

                    await Linking.openURL(fallbackUrl);
                    showToast(
                        'Telegram mobile login is temporarily unavailable. Opened web login.',
                        'info',
                    );
                    return;
                }

                const errorText = await response.text();
                throw new Error(`Telegram mobile start failed: ${response.status} ${errorText}`);
            }

            const payload = (await response.json()) as {
                data?: { nonce?: string; botDeepLink?: string };
                nonce?: string;
                botDeepLink?: string;
            };
            const nonce = payload?.data?.nonce ?? payload?.nonce;
            const botDeepLink = payload?.data?.botDeepLink ?? payload?.botDeepLink;

            if (!nonce || !botDeepLink) {
                throw new Error('Не удалось получить данные запуска Telegram');
            }

            const startedAt = Date.now();
            setTelegramNonce(nonce);
            setTelegramDeepLink(botDeepLink);
            await persistTelegramFlow({ nonce, botDeepLink, startedAt });

            await openTelegramLink(botDeepLink);
            showToast('Открываем Telegram для подтверждения входа', 'info');
            void pollTelegramStatus(nonce, startedAt);
        } catch (error: unknown) {
            logError('SignInScreen', 'Telegram mobile start error', { error });
            const errorMessage =
                error instanceof Error
                    ? error.message
                    : 'Не удалось запустить вход через Telegram';
            showToast(errorMessage, 'error');
            setTelegramUiStatus('idle');
            setTelegramNonce(null);
            setTelegramDeepLink(null);
            await clearPersistedTelegramFlow();
        } finally {
            setTelegramLoading(false);
        }
    };

    const openTelegramAgain = async () => {
        if (!telegramDeepLink) {
            showToast('Ссылка Telegram недоступна. Запустите вход заново.', 'info');
            return;
        }

        try {
            await openTelegramLink(telegramDeepLink);
        } catch (error: unknown) {
            const message =
                error instanceof Error ? error.message : 'Не удалось открыть Telegram';
            showToast(message, 'error');
        }
    };

    const cancelTelegramLogin = () => {
        telegramPollingNonceRef.current = null;
        telegramPollingInFlightRef.current = null;
        void clearPersistedTelegramFlow();
        setTelegramNonce(null);
        setTelegramDeepLink(null);
        setTelegramUiStatus('idle');
        showToast('Вход через Telegram отменен', 'info');
    };

    useEffect(() => {
        let isMounted = true;

        const recoverTelegramFlow = async () => {
            const storedFlow = await loadPersistedTelegramFlow();
            if (!storedFlow || !isMounted) {
                return;
            }

            if (Date.now() - storedFlow.startedAt >= TELEGRAM_POLL_TIMEOUT_MS) {
                await clearPersistedTelegramFlow();
                if (!isMounted) {
                    return;
                }
                setTelegramNonce(null);
                setTelegramDeepLink(null);
                setTelegramUiStatus('expired');
                return;
            }

            setTelegramNonce(storedFlow.nonce);
            setTelegramDeepLink(storedFlow.botDeepLink);
            setTelegramUiStatus('pending');
            telegramPollingNonceRef.current = storedFlow.nonce;
            telegramFlowRef.current = storedFlow;
            void pollTelegramStatus(storedFlow.nonce, storedFlow.startedAt);
        };

        void recoverTelegramFlow();

        return () => {
            isMounted = false;
            telegramPollingNonceRef.current = null;
            telegramPollingInFlightRef.current = null;
        };
    }, []);

    useEffect(() => {
        const handleAppStateChange = (nextAppState: AppStateStatus) => {
            const wasBackground =
                appStateRef.current === 'background' || appStateRef.current === 'inactive';
            appStateRef.current = nextAppState;

            if (!wasBackground || nextAppState !== 'active') {
                return;
            }

            if (googleAuthInProgressRef.current) {
                void (async () => {
                    const restored = await tryResolveGoogleSession();
                    if (restored) {
                        googleAuthInProgressRef.current = false;
                        setGoogleLoading(false);
                        trackGoogleSuccessOnce({ source: 'app_state_recovery' });
                        logGoogleFlowStage('session_established', {
                            source: 'app_state_recovery',
                        });
                        showGoogleSuccessOnce();
                    }
                })();
            }

            const flow = telegramFlowRef.current;
            if (!flow) {
                return;
            }

            if (Date.now() - flow.startedAt >= TELEGRAM_POLL_TIMEOUT_MS) {
                telegramPollingNonceRef.current = null;
                telegramPollingInFlightRef.current = null;
                void clearPersistedTelegramFlow();
                setTelegramNonce(null);
                setTelegramDeepLink(null);
                setTelegramUiStatus('expired');
                return;
            }

            telegramPollingNonceRef.current = flow.nonce;
            void pollTelegramStatus(flow.nonce, flow.startedAt);
        };

        const subscription = AppState.addEventListener('change', handleAppStateChange);
        return () => {
            subscription.remove();
        };
    }, []);

    const anySocialLoading = googleLoading || telegramLoading;

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
            <Text style={styles.title}>Вход в Kezek</Text>
            <Text style={styles.subtitle}>Выберите способ входа</Text>

            <Input
                label="Email"
                placeholder="example@mail.com"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                error={errors.email}
                containerStyle={styles.field}
            />

            <Button
                title="Отправить код"
                onPress={handleSignIn}
                loading={loading}
                disabled={loading || anySocialLoading}
                fullWidth
            />

            <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>или</Text>
                <View style={styles.dividerLine} />
            </View>

            <Button
                title={googleLoading ? 'Вход...' : 'Продолжить с Google'}
                onPress={() => void handleGoogleSignIn()}
                disabled={loading || anySocialLoading}
                variant="outline"
                style={styles.socialButton}
                fullWidth
            />

            <Button
                title={telegramLoading ? 'Вход...' : 'Войти через Telegram'}
                onPress={() => void startTelegramMobileLogin()}
                disabled={
                    loading || anySocialLoading || !TELEGRAM_DEEPLINK_AUTH_ENABLED
                }
                variant="outline"
                style={styles.telegramButton}
                fullWidth
            />
            {telegramUiStatus !== 'idle' && (
                <Text style={styles.telegramStatusText}>
                    {telegramUiStatus === 'pending'
                        ? 'Ожидаем подтверждение'
                        : telegramUiStatus === 'approved'
                            ? 'Подтверждено'
                            : 'Истекло'}
                </Text>
            )}
            {telegramNonce && (
                <View style={styles.telegramFlowActions}>
                    <Button
                        title="Открыть Telegram снова"
                        onPress={() => void openTelegramAgain()}
                        variant="outline"
                        style={styles.telegramActionButton}
                        fullWidth
                    />
                    <Button
                        title="Отменить вход"
                        onPress={cancelTelegramLogin}
                        variant="ghost"
                        style={styles.telegramActionButton}
                        fullWidth
                    />
                </View>
            )}

            <Button
                title="Войти через WhatsApp"
                onPress={() => navigation.navigate('WhatsApp')}
                disabled={loading || anySocialLoading}
                variant="secondary"
                style={styles.whatsAppButton}
                textStyle={styles.whatsAppButtonText}
                fullWidth
            />

            <Button
                title="Регистрация"
                onPress={() => navigation.navigate('SignUp')}
                variant="ghost"
                style={styles.secondaryButton}
                fullWidth
            />
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.surface.page,
    },
    content: {
        padding: colors.layout.space5,
    },
    title: {
        fontSize: 32,
        fontWeight: '700',
        marginBottom: 8,
        color: colors.text.primary,
    },
    subtitle: {
        fontSize: 18,
        color: colors.text.secondary,
        marginBottom: colors.layout.space6,
    },
    field: {
        marginBottom: colors.layout.space5,
    },
    divider: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: colors.layout.space5,
    },
    dividerLine: {
        flex: 1,
        height: 1,
        backgroundColor: colors.border.subtle,
    },
    dividerText: {
        marginHorizontal: colors.layout.space4,
        color: colors.text.secondary,
        fontSize: 14,
    },
    socialButton: {
        marginBottom: colors.layout.space3,
    },
    telegramButton: {
        marginBottom: colors.layout.space3,
        borderColor: '#229ED9',
    },
    telegramStatusText: {
        marginTop: -6,
        marginBottom: colors.layout.space3,
        color: colors.text.secondary,
        fontSize: 14,
    },
    telegramFlowActions: {
        marginBottom: colors.layout.space3,
        gap: colors.layout.space2,
    },
    telegramActionButton: {
        marginBottom: 0,
    },
    whatsAppButton: {
        marginBottom: colors.layout.space3,
        backgroundColor: '#25D366',
        borderColor: '#25D366',
    },
    whatsAppButtonText: {
        color: colors.text.light,
    },
    secondaryButton: {
        marginTop: colors.layout.space2,
    },
});



