import { useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';

import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { colors } from '../../constants/colors';
import { useToast } from '../../contexts/ToastContext';
import { logDebug } from '../../lib/log';
import { AuthStackParamList } from '../../navigation/types';
import { exchangeViaMobileApi } from '../../navigation/useRootNavigationSession';
import { getValidationError, normalizePhone } from '../../utils/validation';

const API_URL =
    process.env.EXPO_PUBLIC_API_URL ||
    Constants.expoConfig?.extra?.apiUrl ||
    Constants.manifest?.extra?.apiUrl ||
    'https://kezek.kg';

const WHATSAPP_ACTIVE_ATTEMPT_KEY = 'whatsapp_mobile_active_attempt_v1';
const RESEND_COOLDOWN_SEC = 60;

type WhatsAppScreenNavigationProp = NativeStackNavigationProp<AuthStackParamList, 'WhatsApp'>;
type WhatsAppStep = 'phone' | 'otp';

type WhatsAppActiveAttempt = {
    attemptId: string;
    phone: string;
    expiresAt: string;
    cooldownUntil: number;
};

const WHATSAPP_COPY = {
    title: 'Вход через WhatsApp',
    phoneStepSubtitle: 'Введите номер телефона, на него придет код в WhatsApp.',
    otpStepSubtitle: 'Введите код из сообщения WhatsApp.',
    codeSent: 'Код отправлен в WhatsApp.',
    codeHint: 'Код отправлен на',
    invalidCode: 'Введите 6-значный код.',
    wrongCode: 'Неверный код. Проверьте и попробуйте снова.',
    expiredCode: 'Срок действия кода истек. Запросите новый код.',
    tooManyAttempts: 'Слишком много попыток. Подождите и попробуйте позже.',
    providerUnavailable: 'Сервис WhatsApp временно недоступен. Повторите позже.',
    networkFailure: 'Нет соединения. Проверьте интернет и повторите.',
    sendCodeFailed: 'Не удалось отправить код.',
    signInFailed: 'Не удалось выполнить вход.',
    signInSuccess: 'Вход выполнен успешно.',
    unexpectedFormat: 'Неожиданный формат ответа от сервера.',
};

function mapWhatsAppAuthError(error: unknown): string {
    if (!(error instanceof Error)) {
        return WHATSAPP_COPY.signInFailed;
    }

    const message = error.message.toLowerCase();

    if (message.includes('expired') || message.includes('истек')) return WHATSAPP_COPY.expiredCode;
    if (message.includes('invalid code') || message.includes('wrong code') || message.includes('неверн')) return WHATSAPP_COPY.wrongCode;
    if (message.includes('too many') || message.includes('rate limit') || message.includes('429')) return WHATSAPP_COPY.tooManyAttempts;
    if (message.includes('provider') || message.includes('unavailable') || message.includes('503')) return WHATSAPP_COPY.providerUnavailable;
    if (message.includes('network') || message.includes('failed to fetch')) return WHATSAPP_COPY.networkFailure;
    if (message.includes('send')) return WHATSAPP_COPY.sendCodeFailed;

    return error.message || WHATSAPP_COPY.signInFailed;
}

function buildIdempotencyKey(prefix: string) {
    return `${prefix}:${Date.now()}:${Math.random().toString(36).slice(2, 10)}`;
}

function parseApiError(payload: unknown, fallback: string) {
    if (!payload || typeof payload !== 'object') {
        return fallback;
    }

    const obj = payload as { message?: string; error?: string; details?: { providerMessage?: string } };
    return obj.message || obj.error || obj.details?.providerMessage || fallback;
}

function secondsUntil(timestampMs: number) {
    return Math.max(0, Math.ceil((timestampMs - Date.now()) / 1000));
}

export default function WhatsAppScreen() {
    const navigation = useNavigation<WhatsAppScreenNavigationProp>();
    const { showToast } = useToast();

    const [step, setStep] = useState<WhatsAppStep>('phone');
    const [phone, setPhone] = useState('');
    const [otp, setOtp] = useState('');
    const [sending, setSending] = useState(false);
    const [verifying, setVerifying] = useState(false);
    const [countdown, setCountdown] = useState(0);
    const [errorText, setErrorText] = useState<string | null>(null);

    const activeAttemptRef = useRef<WhatsAppActiveAttempt | null>(null);

    const persistActiveAttempt = async (attempt: WhatsAppActiveAttempt) => {
        activeAttemptRef.current = attempt;
        await SecureStore.setItemAsync(WHATSAPP_ACTIVE_ATTEMPT_KEY, JSON.stringify(attempt));
    };

    const clearActiveAttempt = async () => {
        activeAttemptRef.current = null;
        await SecureStore.deleteItemAsync(WHATSAPP_ACTIVE_ATTEMPT_KEY);
    };

    const restoreActiveAttempt = async () => {
        const raw = await SecureStore.getItemAsync(WHATSAPP_ACTIVE_ATTEMPT_KEY);
        if (!raw) return;

        try {
            const parsed = JSON.parse(raw) as Partial<WhatsAppActiveAttempt>;
            if (!parsed.attemptId || !parsed.phone || !parsed.expiresAt || typeof parsed.cooldownUntil !== 'number') {
                throw new Error('Invalid payload');
            }

            const expiresAtMs = Date.parse(parsed.expiresAt);
            if (!Number.isFinite(expiresAtMs) || expiresAtMs <= Date.now()) {
                await clearActiveAttempt();
                return;
            }

            const restored: WhatsAppActiveAttempt = {
                attemptId: parsed.attemptId,
                phone: parsed.phone,
                expiresAt: parsed.expiresAt,
                cooldownUntil: parsed.cooldownUntil,
            };

            activeAttemptRef.current = restored;
            setPhone(restored.phone);
            setStep('otp');
            setCountdown(secondsUntil(restored.cooldownUntil));
        } catch {
            await clearActiveAttempt();
        }
    };

    useEffect(() => {
        void restoreActiveAttempt();

        const subscription = AppState.addEventListener('change', (state: AppStateStatus) => {
            if (state !== 'active') return;

            const activeAttempt = activeAttemptRef.current;
            if (!activeAttempt) return;

            const expiresAtMs = Date.parse(activeAttempt.expiresAt);
            if (expiresAtMs <= Date.now()) {
                setErrorText(WHATSAPP_COPY.expiredCode);
                void clearActiveAttempt();
                setStep('phone');
                setOtp('');
                setCountdown(0);
                return;
            }

            setCountdown(secondsUntil(activeAttempt.cooldownUntil));
        });

        return () => {
            subscription.remove();
        };
    }, []);

    useEffect(() => {
        if (countdown <= 0) return;
        const timer = setTimeout(() => setCountdown((prev) => Math.max(0, prev - 1)), 1000);
        return () => clearTimeout(timer);
    }, [countdown]);

    const handleSendOtp = async () => {
        setErrorText(null);

        const phoneError = getValidationError('phone', phone);
        if (phoneError) {
            showToast(phoneError, 'error');
            setErrorText(phoneError);
            return;
        }

        setSending(true);
        try {
            const normalizedPhone = normalizePhone(phone);
            const response = await fetch(`${API_URL}/api/auth/whatsapp/mobile/start`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-idempotency-key': buildIdempotencyKey('wa-start'),
                    'x-client-timestamp': String(Date.now()),
                },
                body: JSON.stringify({ phone: normalizedPhone }),
            });
            const payload = await response.json();

            if (!response.ok || !payload?.ok) {
                throw new Error(parseApiError(payload, WHATSAPP_COPY.sendCodeFailed));
            }

            const data = payload.data as {
                attemptId: string;
                expiresAt: string;
                maskedDestination?: string;
            };

            const attempt: WhatsAppActiveAttempt = {
                attemptId: data.attemptId,
                phone: normalizedPhone,
                expiresAt: data.expiresAt,
                cooldownUntil: Date.now() + RESEND_COOLDOWN_SEC * 1000,
            };

            await persistActiveAttempt(attempt);

            setStep('otp');
            setOtp('');
            setCountdown(RESEND_COOLDOWN_SEC);
            showToast(WHATSAPP_COPY.codeSent, 'success');
        } catch (error: unknown) {
            const mapped = mapWhatsAppAuthError(error);
            showToast(mapped, 'error');
            setErrorText(mapped);
        } finally {
            setSending(false);
        }
    };

    const handleVerifyOtp = async () => {
        setErrorText(null);

        if (otp.length !== 6) {
            showToast(WHATSAPP_COPY.invalidCode, 'error');
            setErrorText(WHATSAPP_COPY.invalidCode);
            return;
        }

        const activeAttempt = activeAttemptRef.current;
        if (!activeAttempt) {
            setErrorText(WHATSAPP_COPY.expiredCode);
            showToast(WHATSAPP_COPY.expiredCode, 'error');
            setStep('phone');
            return;
        }

        setVerifying(true);
        try {
            const response = await fetch(`${API_URL}/api/auth/whatsapp/mobile/verify`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-idempotency-key': buildIdempotencyKey('wa-verify'),
                    'x-client-timestamp': String(Date.now()),
                },
                body: JSON.stringify({
                    attemptId: activeAttempt.attemptId,
                    phone: activeAttempt.phone,
                    code: otp,
                }),
            });
            const payload = await response.json();

            if (!response.ok || !payload?.ok) {
                throw new Error(parseApiError(payload, WHATSAPP_COPY.wrongCode));
            }

            const data = payload.data as { exchangeCode?: string; status?: string };
            if (!data.exchangeCode || data.status !== 'approved') {
                throw new Error(WHATSAPP_COPY.unexpectedFormat);
            }

            logDebug('WhatsAppScreen', 'Exchangeing approved WhatsApp login', {
                attemptId: activeAttempt.attemptId,
            });

            await exchangeViaMobileApi(data.exchangeCode, API_URL);
            await clearActiveAttempt();
            showToast(WHATSAPP_COPY.signInSuccess, 'success');
        } catch (error: unknown) {
            const mapped = mapWhatsAppAuthError(error);
            showToast(mapped, 'error');
            setErrorText(mapped);
        } finally {
            setVerifying(false);
        }
    };

    const handleResendOtp = () => {
        if (countdown > 0 || sending) return;
        void handleSendOtp();
    };

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
            <Text style={styles.title}>{WHATSAPP_COPY.title}</Text>
            <Text style={styles.subtitle}>{step === 'phone' ? WHATSAPP_COPY.phoneStepSubtitle : WHATSAPP_COPY.otpStepSubtitle}</Text>

            {step === 'phone' ? (
                <>
                    <Input
                        label="Номер телефона"
                        placeholder="+996500574029"
                        value={phone}
                        onChangeText={(value) => {
                            setPhone(value);
                            if (errorText) setErrorText(null);
                        }}
                        keyboardType="phone-pad"
                        containerStyle={styles.field}
                    />
                    <Button
                        title={sending ? 'Отправка...' : 'Отправить код'}
                        onPress={() => void handleSendOtp()}
                        loading={sending}
                        disabled={sending}
                        fullWidth
                    />
                </>
            ) : (
                <>
                    <View style={styles.otpContainer}>
                        <Input
                            placeholder="000000"
                            value={otp}
                            onChangeText={(text) => {
                                setOtp(text.replace(/\D/g, '').slice(0, 6));
                                if (errorText) setErrorText(null);
                            }}
                            keyboardType="number-pad"
                            maxLength={6}
                            autoFocus
                            containerStyle={styles.field}
                            style={styles.otpInput}
                            inputContainerStyle={styles.otpInputContainer}
                        />
                        <Text style={styles.otpHint}>
                            {WHATSAPP_COPY.codeHint} {phone}
                        </Text>
                    </View>

                    <View style={styles.otpActions}>
                        <Button
                            title="Изменить номер"
                            onPress={() => {
                                setStep('phone');
                                setOtp('');
                                setCountdown(0);
                                void clearActiveAttempt();
                            }}
                            variant="ghost"
                            size="sm"
                            style={styles.otpActionButton}
                        />
                        <Button
                            title={countdown > 0 ? `Отправить снова (${countdown}с)` : 'Отправить код снова'}
                            onPress={handleResendOtp}
                            disabled={countdown > 0 || sending}
                            variant="ghost"
                            size="sm"
                            style={styles.otpActionButton}
                        />
                    </View>

                    <Button
                        title={verifying ? 'Проверка...' : 'Войти'}
                        onPress={() => void handleVerifyOtp()}
                        loading={verifying}
                        disabled={verifying || otp.length !== 6}
                        fullWidth
                    />
                </>
            )}

            {errorText ? <Text style={styles.errorText}>{errorText}</Text> : null}

            <Button
                title="Вернуться к другим способам входа"
                onPress={() => navigation.goBack()}
                variant="ghost"
                style={styles.backButton}
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
        fontSize: 28,
        fontWeight: '700',
        marginBottom: 8,
        color: colors.text.primary,
    },
    subtitle: {
        fontSize: 16,
        color: colors.text.secondary,
        marginBottom: colors.layout.space6,
    },
    field: {
        marginBottom: colors.layout.space5,
    },
    otpContainer: {
        marginBottom: colors.layout.space6,
    },
    otpInputContainer: {
        justifyContent: 'center',
    },
    otpInput: {
        fontSize: 32,
        letterSpacing: 8,
        textAlign: 'center',
    },
    otpHint: {
        fontSize: 14,
        color: colors.text.secondary,
        textAlign: 'center',
    },
    otpActions: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: colors.layout.space3,
        marginBottom: colors.layout.space6,
    },
    otpActionButton: {
        flex: 1,
    },
    errorText: {
        marginTop: colors.layout.space4,
        color: '#DC2626',
        fontSize: 14,
    },
    backButton: {
        marginTop: colors.layout.space5,
    },
});
