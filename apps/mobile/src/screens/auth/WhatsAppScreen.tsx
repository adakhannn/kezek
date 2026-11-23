import { useEffect, useRef, useState } from 'react';
import {
    AppState,
    type AppStateStatus,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as SecureStore from 'expo-secure-store';

import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { colors } from '../../constants/colors';
import { useToast } from '../../contexts/ToastContext';
import { useLanguage, type Translate } from '../../i18n';
import { getMobileApiUrl } from '../../lib/apiUrl';
import { createMobileAuthProof } from '../../lib/authCrypto';
import { WHATSAPP_ACTIVE_ATTEMPT_KEY } from '../../lib/authStorageKeys';
import { fetchWithTimeout, isTimeoutError } from '../../lib/fetchWithTimeout';
import { getErrorMessage } from '../../lib/errors';
import {
    getStableIdempotencyKey,
    type StableIdempotencyEntry,
} from '../../lib/idempotency';
import { logDebug } from '../../lib/log';
import { AuthStackParamList } from '../../navigation/types';
import { exchangeViaMobileApi } from '../../navigation/useRootNavigationSession';
import { getValidationError, normalizePhone } from '../../utils/validation';

const RESEND_COOLDOWN_SEC = 60;

type WhatsAppScreenNavigationProp = NativeStackNavigationProp<AuthStackParamList, 'WhatsApp'>;
type WhatsAppStep = 'phone' | 'otp';

type WhatsAppActiveAttempt = {
    attemptId: string;
    codeVerifier: string;
    phone: string;
    expiresAt: string;
    cooldownUntil: number;
};

/**
 * The user-facing text for a failed send or verify. The API answers in the app language
 * (X-Kezek-Locale), so a message it sends that matches nothing here is shown as it is.
 */
function mapWhatsAppAuthError(error: unknown, t: Translate): string {
    if (!(error instanceof Error)) {
        return t('auth.whatsapp.signInFailed');
    }

    const message = error.message.toLowerCase();

    // Matching the Russian API text, not UI text.
    if (message.includes('expired') || message.includes('истек')) return t('auth.whatsapp.expiredCode');
    if (message.includes('invalid code') || message.includes('wrong code') || message.includes('неверн')) return t('auth.whatsapp.wrongCode');
    if (message.includes('too many') || message.includes('rate limit') || message.includes('429')) return t('auth.whatsapp.tooManyAttempts');
    if (message.includes('provider') || message.includes('unavailable') || message.includes('503')) return t('auth.whatsapp.providerUnavailable');
    if (message.includes('network') || message.includes('failed to fetch')) return t('auth.whatsapp.networkFailure');
    if (isTimeoutError(error) || message.includes('timed out') || message.includes('timeout')) {
        return t('auth.error.timeout');
    }
    if (message.includes('send')) return t('auth.whatsapp.sendCodeFailed');

    return getErrorMessage(error, t('auth.whatsapp.signInFailed'), t);
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
    const { t } = useLanguage();
    const apiUrl = getMobileApiUrl();

    const [step, setStep] = useState<WhatsAppStep>('phone');
    const [phone, setPhone] = useState('');
    const [otp, setOtp] = useState('');
    const [sending, setSending] = useState(false);
    const [verifying, setVerifying] = useState(false);
    const [countdown, setCountdown] = useState(0);
    const [errorText, setErrorText] = useState<string | null>(null);
    const [phoneError, setPhoneError] = useState<string | null>(null);
    const [otpError, setOtpError] = useState<string | null>(null);

    const activeAttemptRef = useRef<WhatsAppActiveAttempt | null>(null);
    const sendIdempotencyRef = useRef<StableIdempotencyEntry | null>(null);
    const sendProofRef = useRef<{ key: string; codeVerifier: string; codeChallenge: string } | null>(null);
    const verifyIdempotencyRef = useRef<StableIdempotencyEntry | null>(null);

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
            if (!parsed.attemptId || !parsed.phone || !parsed.expiresAt || typeof parsed.cooldownUntil !== 'number' ||
                typeof parsed.codeVerifier !== 'string' || !/^[a-f0-9]{64}$/.test(parsed.codeVerifier)) {
                throw new Error('Invalid payload');
            }

            const expiresAtMs = Date.parse(parsed.expiresAt);
            if (!Number.isFinite(expiresAtMs) || expiresAtMs <= Date.now()) {
                await clearActiveAttempt();
                return;
            }

            const restored: WhatsAppActiveAttempt = {
                attemptId: parsed.attemptId,
                codeVerifier: parsed.codeVerifier,
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
                setErrorText(t('auth.whatsapp.expiredCode'));
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
        // Mount-only: restoring the attempt and the AppState listener must not restart on a language change.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (countdown <= 0) return;
        const timer = setTimeout(() => setCountdown((prev) => Math.max(0, prev - 1)), 1000);
        return () => clearTimeout(timer);
    }, [countdown]);

    const handleSendOtp = async () => {
        setErrorText(null);
        setOtpError(null);

        const phoneValidationError = getValidationError('phone', phone, t);
        if (phoneValidationError) {
            showToast(phoneValidationError, 'error');
            setPhoneError(phoneValidationError);
            return;
        }

        setPhoneError(null);
        setSending(true);
        try {
            const normalizedPhone = normalizePhone(phone);
            const idempotency = getStableIdempotencyKey(
                sendIdempotencyRef.current,
                normalizedPhone,
                'wa-start',
            );
            sendIdempotencyRef.current = idempotency;
            if (sendProofRef.current?.key !== idempotency.key) {
                sendProofRef.current = { key: idempotency.key, ...await createMobileAuthProof() };
            }
            const proof = sendProofRef.current;
            const response = await fetchWithTimeout(`${apiUrl}/api/auth/whatsapp/mobile/start`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-idempotency-key': idempotency.key,
                    'x-client-timestamp': String(Date.now()),
                },
                body: JSON.stringify({ phone: normalizedPhone, codeChallenge: proof.codeChallenge }),
            });
            const payload = await response.json();

            if (!response.ok || !payload?.ok) {
                throw new Error(parseApiError(payload, t('auth.whatsapp.sendCodeFailed')));
            }

            const data = payload.data as {
                attemptId: string;
                expiresAt: string;
                maskedDestination?: string;
            };

            const attempt: WhatsAppActiveAttempt = {
                attemptId: data.attemptId,
                codeVerifier: proof.codeVerifier,
                phone: normalizedPhone,
                expiresAt: data.expiresAt,
                cooldownUntil: Date.now() + RESEND_COOLDOWN_SEC * 1000,
            };

            await persistActiveAttempt(attempt);
            sendIdempotencyRef.current = null;
            sendProofRef.current = null;

            setStep('otp');
            setOtp('');
            setCountdown(RESEND_COOLDOWN_SEC);
            showToast(t('auth.whatsapp.codeSent'), 'success');
        } catch (error: unknown) {
            const mapped = mapWhatsAppAuthError(error, t);
            showToast(mapped, 'error');
            setErrorText(mapped);
        } finally {
            setSending(false);
        }
    };

    const handleVerifyOtp = async () => {
        setErrorText(null);
        setPhoneError(null);

        if (otp.length !== 6) {
            showToast(t('auth.whatsapp.invalidCode'), 'error');
            setOtpError(t('auth.whatsapp.invalidCode'));
            return;
        }

        setOtpError(null);
        const activeAttempt = activeAttemptRef.current;
        if (!activeAttempt) {
            setErrorText(t('auth.whatsapp.expiredCode'));
            showToast(t('auth.whatsapp.expiredCode'), 'error');
            setStep('phone');
            return;
        }

        setVerifying(true);
        try {
            const idempotency = getStableIdempotencyKey(
                verifyIdempotencyRef.current,
                `${activeAttempt.attemptId}:${otp}`,
                'wa-verify',
            );
            verifyIdempotencyRef.current = idempotency;
            const response = await fetchWithTimeout(`${apiUrl}/api/auth/whatsapp/mobile/verify`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-idempotency-key': idempotency.key,
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
                throw new Error(parseApiError(payload, t('auth.whatsapp.wrongCode')));
            }

            const data = payload.data as { exchangeCode?: string; status?: string };
            if (!data.exchangeCode || data.status !== 'approved') {
                throw new Error(t('auth.whatsapp.unexpectedFormat'));
            }

            logDebug('WhatsAppScreen', 'Exchangeing approved WhatsApp login', {
                attemptId: activeAttempt.attemptId,
            });

            await exchangeViaMobileApi(data.exchangeCode, apiUrl, activeAttempt.codeVerifier);
            await clearActiveAttempt();
            verifyIdempotencyRef.current = null;
            showToast(t('auth.whatsapp.signInSuccess'), 'success');
        } catch (error: unknown) {
            const mapped = mapWhatsAppAuthError(error, t);
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
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
        <ScrollView
            style={styles.container}
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            automaticallyAdjustKeyboardInsets
        >
            <Text style={styles.title}>{t('auth.whatsapp.title')}</Text>
            <Text style={styles.subtitle}>{step === 'phone' ? t('auth.whatsapp.phoneStepSubtitle') : t('auth.whatsapp.otpStepSubtitle')}</Text>

            {step === 'phone' ? (
                <>
                    <Input
                        label={t('auth.whatsapp.phoneLabel')}
                        placeholder="+996 XXX XX XX XX"
                        value={phone}
                        onChangeText={(value) => {
                            setPhone(value);
                            sendIdempotencyRef.current = null;
                            if (phoneError) setPhoneError(null);
                            if (errorText) setErrorText(null);
                        }}
                        keyboardType="phone-pad"
                        error={phoneError ?? undefined}
                        helperText={t('auth.whatsapp.phoneHelper')}
                        accessibilityHint={t('auth.whatsapp.phoneHint')}
                        containerStyle={styles.field}
                        returnKeyType="done"
                        onSubmitEditing={() => {
                            if (!sending) {
                                void handleSendOtp();
                            }
                        }}
                    />
                    <Button
                        title={sending ? t('auth.whatsapp.sending') : t('auth.whatsapp.sendCode')}
                        onPress={() => void handleSendOtp()}
                        loading={sending}
                        disabled={sending}
                        accessibilityHint={t('auth.whatsapp.sendCodeHint')}
                        fullWidth
                    />
                </>
            ) : (
                <>
                    <View style={styles.otpContainer}>
                        <Input
                            accessibilityLabel={t('auth.whatsapp.codeLabel')}
                            placeholder="000000"
                            value={otp}
                            onChangeText={(text) => {
                                setOtp(text.replace(/\D/g, '').slice(0, 6));
                                verifyIdempotencyRef.current = null;
                                if (otpError) setOtpError(null);
                                if (errorText) setErrorText(null);
                            }}
                            keyboardType="number-pad"
                            maxLength={6}
                            autoFocus
                            error={otpError ?? undefined}
                            helperText={t('auth.code.helper')}
                            accessibilityHint={t('auth.whatsapp.codeHint')}
                            containerStyle={styles.field}
                            style={styles.otpInput}
                            inputContainerStyle={styles.otpInputContainer}
                            returnKeyType="done"
                            onSubmitEditing={() => {
                                if (otp.length === 6 && !sending && !verifying) {
                                    void handleVerifyOtp();
                                }
                            }}
                        />
                        <Text accessibilityLiveRegion="polite" style={styles.otpHint}>
                            {t('auth.whatsapp.codeSentTo', { phone })}
                        </Text>
                    </View>

                    <View style={styles.otpActions}>
                        <Button
                            title={t('auth.whatsapp.changePhone')}
                            onPress={() => {
                                setStep('phone');
                                setOtp('');
                                setCountdown(0);
                                setOtpError(null);
                                verifyIdempotencyRef.current = null;
                                void clearActiveAttempt();
                            }}
                            variant="ghost"
                            size="sm"
                            style={styles.otpActionButton}
                            disabled={sending || verifying}
                            accessibilityHint={t('auth.whatsapp.changePhoneHint')}
                        />
                        <Button
                            title={countdown > 0 ? t('auth.whatsapp.resendIn', { seconds: countdown }) : t('auth.code.resend')}
                            onPress={handleResendOtp}
                            disabled={countdown > 0 || sending}
                            variant="ghost"
                            size="sm"
                            style={styles.otpActionButton}
                            accessibilityHint={t('auth.whatsapp.resendHint')}
                        />
                    </View>

                    <Button
                        title={verifying ? t('auth.whatsapp.verifying') : t('auth.whatsapp.submit')}
                        onPress={() => void handleVerifyOtp()}
                        loading={verifying}
                        disabled={verifying || sending || otp.length !== 6}
                        accessibilityHint={t('auth.code.submitHint')}
                        fullWidth
                    />
                </>
            )}

            {errorText ? (
                <Text
                    accessibilityLiveRegion="assertive"
                    accessibilityRole="alert"
                    style={styles.errorText}
                >
                    {errorText}
                </Text>
            ) : null}

            <Button
                title={t('auth.whatsapp.back')}
                onPress={() => navigation.goBack()}
                variant="ghost"
                style={styles.backButton}
                disabled={sending || verifying}
                accessibilityHint={t('auth.whatsapp.backHint')}
                fullWidth
            />
        </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.surface.page,
    },
    content: {
        flexGrow: 1,
        padding: colors.layout.space5,
        paddingBottom: colors.layout.space8,
    },
    title: {
        fontSize: 28,
        fontWeight: '700',
        marginBottom: 8,
        color: colors.text.primary,
    },
    subtitle: {
        fontSize: 16,
        lineHeight: 22,
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
        lineHeight: 20,
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
        color: colors.status.danger,
        fontSize: 14,
        lineHeight: 20,
    },
    backButton: {
        marginTop: colors.layout.space5,
    },
});

