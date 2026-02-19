import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity } from 'react-native';
import { useState, useEffect } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { AuthStackParamList } from '../../navigation/types';
import { useToast } from '../../contexts/ToastContext';
import { normalizePhone, getValidationError } from '../../utils/validation';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { apiRequest } from '../../lib/api';
import Constants from 'expo-constants';
import { logError, logDebug } from '../../lib/log';

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

    // Таймер для повторной отправки
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

            // Создаем сессию через API
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
                hasMagicLink: !!sessionData.magicLink 
            });

            if (!sessionData.ok) {
                throw new Error(sessionData.message || 'Не удалось создать сессию');
            }

            // API возвращает email и password для входа
            if (sessionData.email && sessionData.password && sessionData.needsSignIn) {
                const { supabase } = await import('../../lib/supabase');
                
                // Входим с временным паролем
                const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
                    email: sessionData.email,
                    password: sessionData.password,
                });

                if (signInError) {
                    logError('WhatsAppScreen', 'Sign in error', signInError);
                    throw new Error('Не удалось войти: ' + signInError.message);
                }

                // Проверяем, что сессия создана
                const { data: { user: currentUser }, error: userError } = await supabase.auth.getUser();
                if (userError || !currentUser) {
                    logError('WhatsAppScreen', 'User not found after sign in', userError);
                    throw new Error('Вход выполнен, но сессия не была создана');
                }

                logDebug('WhatsAppScreen', 'Sign in successful', { userId: currentUser.id });
                showToast('Вход выполнен успешно', 'success');
                
                // Навигация произойдет автоматически через RootNavigator при изменении auth state
                // Даем небольшую задержку для обновления состояния
                setTimeout(() => {
                    // RootNavigator автоматически переключится на Main navigator при изменении session
                }, 500);
            } else if (sessionData.session) {
                // Если есть готовые токены (старый формат)
                const { supabase } = await import('../../lib/supabase');
                const { error } = await supabase.auth.setSession({
                    access_token: sessionData.session.access_token,
                    refresh_token: sessionData.session.refresh_token,
                });

                if (error) throw error;

                showToast('Вход выполнен успешно', 'success');
            } else if (sessionData.magicLink) {
                // Если есть magic link, открываем его
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
        handleSendOtp();
    };

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
            <Text style={styles.title}>Вход через WhatsApp</Text>
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
                    />
                    <Button
                        title={sending ? 'Отправка...' : 'Отправить код'}
                        onPress={handleSendOtp}
                        loading={sending}
                        disabled={sending}
                    />
                </>
            ) : (
                <>
                    <View style={styles.otpContainer}>
                        <TextInput
                            style={styles.otpInput}
                            value={otp}
                            onChangeText={(text) => setOtp(text.replace(/\D/g, '').slice(0, 6))}
                            placeholder="000000"
                            keyboardType="number-pad"
                            maxLength={6}
                            autoFocus
                        />
                        <Text style={styles.otpHint}>Код отправлен на {phone}</Text>
                    </View>

                    <View style={styles.otpActions}>
                        <TouchableOpacity onPress={() => setStep('phone')}>
                            <Text style={styles.linkText}>Изменить номер</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={handleResendOtp} disabled={countdown > 0}>
                            <Text style={[styles.linkText, countdown > 0 && styles.linkTextDisabled]}>
                                {countdown > 0 ? `Отправить снова (${countdown}с)` : 'Отправить код снова'}
                            </Text>
                        </TouchableOpacity>
                    </View>

                    <Button
                        title={verifying ? 'Проверка...' : 'Войти'}
                        onPress={handleVerifyOtp}
                        loading={verifying}
                        disabled={verifying || otp.length !== 6}
                    />
                </>
            )}

            <TouchableOpacity 
                style={styles.backButton}
                onPress={() => navigation.goBack()}
            >
                <Text style={styles.backButtonText}>Вернуться к другим способам входа</Text>
            </TouchableOpacity>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    content: {
        padding: 20,
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        marginBottom: 8,
        color: '#111827',
    },
    subtitle: {
        fontSize: 16,
        color: '#6b7280',
        marginBottom: 24,
    },
    otpContainer: {
        marginBottom: 24,
    },
    otpInput: {
        fontSize: 32,
        letterSpacing: 8,
        textAlign: 'center',
        borderWidth: 1,
        borderColor: '#d1d5db',
        borderRadius: 8,
        paddingVertical: 16,
        marginBottom: 8,
        backgroundColor: '#f9fafb',
    },
    otpHint: {
        fontSize: 14,
        color: '#6b7280',
        textAlign: 'center',
    },
    otpActions: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 24,
    },
    linkText: {
        color: '#6366f1',
        fontSize: 14,
    },
    linkTextDisabled: {
        opacity: 0.5,
    },
    backButton: {
        marginTop: 24,
        alignItems: 'center',
    },
    backButtonText: {
        color: '#6b7280',
        fontSize: 14,
    },
});

