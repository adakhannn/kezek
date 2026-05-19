import { useEffect, useRef, useState } from 'react';
import { Linking, Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';

import { logError, logWarn } from '../../../lib/log';
import { exchangeViaMobileApi } from '../../../navigation/useRootNavigationSession';
import { TELEGRAM_DEEPLINK_AUTH_ENABLED } from './authFeatureFlags';
import { type AuthUiState, transitionAuthUiState } from './authUiState';

const TELEGRAM_POLL_INTERVAL_MS = 2500;
const TELEGRAM_POLL_TIMEOUT_MS = 3 * 60 * 1000;
const TELEGRAM_ACTIVE_FLOW_STORAGE_KEY = 'telegram_mobile_active_login_v1';
const TELEGRAM_WEB_WIDGET_FALLBACK_REDIRECT =
    '/auth/callback-mobile?redirect=kezek://auth/callback';

type ShowToast = (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
type TelegramFlowState = {
    nonce: string;
    botDeepLink: string;
    startedAt: number;
};

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

export function useTelegramSignInFlow({
    apiUrl,
    showToast,
    ensureSessionRestored,
}: {
    apiUrl: string;
    showToast: ShowToast;
    ensureSessionRestored: (callbackUrl?: string, attempts?: number) => Promise<boolean>;
}) {
    const [telegramLoading, setTelegramLoading] = useState(false);
    const [telegramState, setTelegramState] = useState<AuthUiState>('idle');
    const [telegramDeepLink, setTelegramDeepLink] = useState<string | null>(null);
    const [telegramNonce, setTelegramNonce] = useState<string | null>(null);
    const telegramPollingNonceRef = useRef<string | null>(null);
    const telegramPollingInFlightRef = useRef<string | null>(null);
    const telegramFlowRef = useRef<TelegramFlowState | null>(null);

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

    const pollTelegramStatus = async (nonce: string, startedAt: number = Date.now()) => {
        if (telegramPollingInFlightRef.current === nonce) {
            return;
        }

        try {
            setTelegramState((prev) => transitionAuthUiState(prev, 'wait'));
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

                    setTelegramState((prev) => transitionAuthUiState(prev, 'succeed'));
                    telegramPollingNonceRef.current = null;
                    setTelegramNonce(null);
                    setTelegramDeepLink(null);
                    await clearPersistedTelegramFlow();
                    showToast('Подтверждено', 'success');
                    return;
                }

                if (status === 'expired' || status === 'failed') {
                    setTelegramState((prev) =>
                        transitionAuthUiState(prev, status === 'failed' ? 'fail' : 'expire'),
                    );
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

            setTelegramState((prev) => transitionAuthUiState(prev, 'expire'));
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
            setTelegramState((prev) => transitionAuthUiState(prev, 'fail'));
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
            showToast('Вход через Telegram временно недоступен', 'info');
            return;
        }

        setTelegramLoading(true);
        telegramPollingNonceRef.current = null;
        telegramPollingInFlightRef.current = null;
        telegramFlowRef.current = null;
        setTelegramState((prev) => transitionAuthUiState(prev, 'start'));
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
                        throw new Error('Не удалось открыть резервный веб-вход Telegram');
                    }

                    await Linking.openURL(fallbackUrl);
                    showToast(
                        'Мобильный вход через Telegram временно недоступен. Открыт веб-вход.',
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
            setTelegramState((prev) => transitionAuthUiState(prev, 'fail'));
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
        setTelegramState((prev) => transitionAuthUiState(prev, 'cancel'));
        showToast('Вход через Telegram отменен', 'info');
    };

    const recoverTelegramOnAppActive = async () => {
        const flow = telegramFlowRef.current;
        if (!flow) {
            return;
        }

        if (Date.now() - flow.startedAt >= TELEGRAM_POLL_TIMEOUT_MS) {
            telegramPollingNonceRef.current = null;
            telegramPollingInFlightRef.current = null;
            await clearPersistedTelegramFlow();
            setTelegramNonce(null);
            setTelegramDeepLink(null);
            setTelegramState((prev) => transitionAuthUiState(prev, 'expire'));
            return;
        }

        telegramPollingNonceRef.current = flow.nonce;
        void pollTelegramStatus(flow.nonce, flow.startedAt);
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
                setTelegramState((prev) => transitionAuthUiState(prev, 'expire'));
                return;
            }

            setTelegramNonce(storedFlow.nonce);
            setTelegramDeepLink(storedFlow.botDeepLink);
            setTelegramState((prev) => transitionAuthUiState(prev, 'wait'));
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

    return {
        telegramLoading,
        telegramState,
        telegramDeepLink,
        telegramNonce,
        startTelegramMobileLogin,
        openTelegramAgain,
        cancelTelegramLogin,
        recoverTelegramOnAppActive,
        telegramDeeplinkEnabled: TELEGRAM_DEEPLINK_AUTH_ENABLED,
    };
}
