import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Constants from 'expo-constants';

import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { colors } from '../../constants/colors';
import { useToast } from '../../contexts/ToastContext';
import { apiRequest } from '../../lib/api';
import { logDebug, logError } from '../../lib/log';
import { AuthStackParamList } from '../../navigation/types';
import { getValidationError, normalizePhone } from '../../utils/validation';

const API_URL =
    process.env.EXPO_PUBLIC_API_URL ||
    Constants.expoConfig?.extra?.apiUrl ||
    Constants.manifest?.extra?.apiUrl ||
    'https://kezek.kg';

type WhatsAppScreenNavigationProp = NativeStackNavigationProp<AuthStackParamList, 'WhatsApp'>;

export default function WhatsAppScreen() {
    const navigation = useNavigation<WhatsAppScreenNavigationProp>();
    const { showToast } = useToast();
    const [step, setStep] = useState<'phone' | 'otp'>('phone');
    const [phone, setPhone] = useState('');
    const [otp, setOtp] = useState('');
    const [sending, setSending] = useState(false);
    const [verifying, setVerifying] = useState(false);
    const [countdown, setCountdown] = useState(0);

    useEffect(() => {
        if (countdown > 0) {
            const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
            return () => clearTimeout(timer);
        }
    }, [countdown]);

    const handleSendOtp = async () => {
        const phoneError = getValidationError('phone', phone);
        if (phoneError) {
            showToast(phoneError, 'error');
            return;
        }

        setSending(true);
        try {
            const normalizedPhone = normalizePhone(phone);
            const response = await fetch(`${API_URL}/api/auth/whatsapp/send-otp`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone: normalizedPhone }),
            });
            const data = await response.json();

            if (!data.ok) {
                throw new Error(data.message || 'Не удалось отправить код');
            }

            setStep('otp');
            setCountdown(60);
            showToast('Код отправлен на WhatsApp', 'success');
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Не удалось отправить код';
            showToast(errorMessage, 'error');
        } finally {
            setSending(false);
        }
    };

    const handleVerifyOtp = async () => {
        if (otp.length !== 6) {
            showToast('Введите 6-значный код', 'error');
            return;
        }

        setVerifying(true);
        try {
            const normalizedPhone = normalizePhone(phone);
            logDebug('WhatsAppScreen', 'Verifying OTP', { phone: normalizedPhone });

            const response = await fetch(`${API_URL}/api/auth/whatsapp/verify-otp`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone: normalizedPhone, code: otp }),
            });
            const data = await response.json();

            logDebug('WhatsAppScreen', 'Verify OTP response', { ok: data.ok, userId: data.userId });

            if (!data.ok) {
                throw new Error(data.message || 'Неверный код');
            }

            logDebug('WhatsAppScreen', 'Creating session', { userId: data.userId });
            const sessionResponse = await fetch(`${API_URL}/api/auth/whatsapp/create-session`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    phone: normalizedPhone,
                    userId: data.userId,
                }),
            });
            const sessionData = await sessionResponse.json();

            logDebug('WhatsAppScreen', 'Create session response', {
                ok: sessionData.ok,
                hasEmail: !!sessionData.email,
                hasPassword: !!sessionData.password,
                hasSession: !!sessionData.session,
                hasMagicLink: !!sessionData.magicLink,
            });

            if (!sessionData.ok) {
                throw new Error(sessionData.message || 'Не удалось создать сессию');
            }

            if (sessionData.email && sessionData.password && sessionData.needsSignIn) {
                const { supabase } = await import('../../lib/supabase');

                const { error: signInError } = await supabase.auth.signInWithPassword({
                    email: sessionData.email,
                    password: sessionData.password,
                });

                if (signInError) {
                    logError('WhatsAppScreen', 'Sign in error', signInError);
                    throw new Error('Не удалось войти: ' + signInError.message);
                }

                const {
                    data: { user: currentUser },
                    error: userError,
                } = await supabase.auth.getUser();
                if (userError || !currentUser) {
                    logError('WhatsAppScreen', 'User not found after sign in', userError);
                    throw new Error('Вход выполнен, но сессия не была создана');
                }

                logDebug('WhatsAppScreen', 'Sign in successful', { userId: currentUser.id });
                showToast('Вход выполнен успешно', 'success');
            } else if (sessionData.session) {
                const { supabase } = await import('../../lib/supabase');
                const { error } = await supabase.auth.setSession({
                    access_token: sessionData.session.access_token,
                    refresh_token: sessionData.session.refresh_token,
                });

                if (error) throw error;

                showToast('Вход выполнен успешно', 'success');
            } else if (sessionData.magicLink) {
                showToast('Проверьте email для завершения входа', 'info');
            } else {
                throw new Error('Неожиданный формат ответа от сервера');
            }
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Не удалось войти';
            showToast(errorMessage, 'error');
        } finally {
            setVerifying(false);
        }
    };

    const handleResendOtp = () => {
        if (countdown > 0) return;
        void handleSendOtp();
    };

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
            <Text style={styles.title}>Р’С…РѕРґ С‡РµСЂРµР· WhatsApp</Text>
            <Text style={styles.subtitle}>
                {step === 'phone'
                    ? 'Введите номер телефона для получения кода'
                    : 'Введите код, отправленный на WhatsApp'}
            </Text>

            {step === 'phone' ? (
                <>
                    <Input
                        label="Номер телефона"
                        placeholder="+996500574029"
                        value={phone}
                        onChangeText={setPhone}
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
                            onChangeText={(text) => setOtp(text.replace(/\D/g, '').slice(0, 6))}
                            keyboardType="number-pad"
                            maxLength={6}
                            autoFocus
                            containerStyle={styles.field}
                            style={styles.otpInput}
                            inputContainerStyle={styles.otpInputContainer}
                        />
                        <Text style={styles.otpHint}>Код отправлен на {phone}</Text>
                    </View>

                    <View style={styles.otpActions}>
                        <Button
                            title="Изменить номер"
                            onPress={() => setStep('phone')}
                            variant="ghost"
                            size="sm"
                            style={styles.otpActionButton}
                        />
                        <Button
                            title={countdown > 0 ? `Отправить снова (${countdown}с)` : 'Отправить код снова'}
                            onPress={handleResendOtp}
                            disabled={countdown > 0}
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
    backButton: {
        marginTop: colors.layout.space5,
    },
});
