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
const TELEGRAM_POLL_INTERVAL_MS = 2500;
const TELEGRAM_POLL_TIMEOUT_MS = 3 * 60 * 1000;
const TELEGRAM_ACTIVE_FLOW_STORAGE_KEY = 'telegram_mobile_active_login_v1';
const TELEGRAM_WEB_WIDGET_FALLBACK_REDIRECT =
    '/auth/callback-mobile?redirect=kezek://auth/callback';
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
    const appStateRef = useRef<AppStateStatus>(AppState.currentState);

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

        try {
            logDebug('SignInScreen', 'Starting OAuth', {
                provider: 'google',
                redirectTo: MOBILE_REDIRECT,
            });

            const returnUrl = 'kezek://auth/callback';
            const { data, error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: MOBILE_REDIRECT,
                    skipBrowserRedirect: true,
                },
            });

            if (error) {
                logError('SignInScreen', 'OAuth error', { provider: 'google', error });
                throw error;
            }

            if (!data?.url) {
                throw new Error('Не удалось получить OAuth URL');
            }

            const result = await WebBrowser.openAuthSessionAsync(data.url, returnUrl);
            logDebug('SignInScreen', 'OAuth result', { provider: 'google', result });
            WebBrowser.maybeCompleteAuthSession();

            if (result.type === 'success' && result.url) {
                const restored = await ensureSessionRestored(result.url, 4);
                if (restored) {
                    showToast('Вход выполнен успешно', 'success');
                } else {
                    showToast(
                        'Авторизация обработана, но сессия еще не синхронизировалась. Повторите вход.',
                        'info',
                    );
                }
                return;
            }

            if (result.type === 'dismiss') {
                const restored = await ensureSessionRestored(undefined, 6);
                if (restored) {
                    showToast('Вход выполнен успешно', 'success');
                } else {
                    showToast(
                        'Авторизация завершена на веб-сайте. Вернитесь в приложение или перезапустите его.',
                        'info',
                    );
                }
                return;
            }

            if (result.type === 'cancel') {
                showToast('Вход отменен', 'info');
                return;
            }

            if (result.type === 'locked') {
                showToast('Браузер уже открыт. Закройте его и попробуйте снова.', 'info');
                return;
            }

            logWarn('SignInScreen', 'Unexpected OAuth result type', {
                provider: 'google',
                type: result.type,
            });
            showToast('Не удалось завершить авторизацию. Попробуйте снова.', 'error');
        } catch (error: unknown) {
            logError('SignInScreen', 'OAuth sign in error', { provider: 'google', error });
            const errorMessage =
                error instanceof Error ? error.message : 'Не удалось войти через Google';
            showToast(errorMessage, 'error');
        } finally {
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
                    const {
                        data: { session },
                    } = await supabase.auth.getSession();

                    if (!session) {
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



