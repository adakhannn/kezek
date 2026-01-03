import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Constants from 'expo-constants';
import * as WebBrowser from 'expo-web-browser';

import { supabase } from '../../lib/supabase';
import { AuthStackParamList } from '../../navigation/types';
import { useToast } from '../../contexts/ToastContext';
import { validateEmail, validatePhone, normalizePhone, getValidationError } from '../../utils/validation';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';

type SignInScreenNavigationProp = NativeStackNavigationProp<AuthStackParamList, 'SignIn'>;

export default function SignInScreen() {
    const navigation = useNavigation<SignInScreenNavigationProp>();
    const { showToast } = useToast();
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [loading, setLoading] = useState(false);
    const [googleLoading, setGoogleLoading] = useState(false);
    const [mode, setMode] = useState<'email' | 'phone'>('email');
    const [errors, setErrors] = useState<{ email?: string; phone?: string }>({});

    const handleSignIn = async () => {
        // Валидация
        const newErrors: { email?: string; phone?: string } = {};
        
        if (mode === 'email') {
            const emailError = getValidationError('email', email);
            if (emailError) {
                newErrors.email = emailError;
                setErrors(newErrors);
                showToast(emailError, 'error');
                return;
            }
        } else {
            const phoneError = getValidationError('phone', phone);
            if (phoneError) {
                newErrors.phone = phoneError;
                setErrors(newErrors);
                showToast(phoneError, 'error');
                return;
            }
        }

        setErrors({});
        setLoading(true);
        try {
            if (mode === 'email') {
                // Используем промежуточную страницу на веб-сайте, которая редиректит на deep link
                // Это позволяет работать и с веб-версией, и с мобильным приложением
                const redirectTo = 'https://kezek.kg/auth/callback-mobile?redirect=kezek://auth/callback';
                
                const { error } = await supabase.auth.signInWithOtp({
                    email: email.trim(),
                    options: {
                        emailRedirectTo: redirectTo,
                    },
                });
                if (error) throw error;
                showToast('Проверьте email и перейдите по ссылке', 'success');
                // Не переходим на Verify, так как пользователь должен перейти по ссылке из email
            } else {
                const normalizedPhone = normalizePhone(phone);
                const { error } = await supabase.auth.signInWithOtp({
                    phone: normalizedPhone,
                    options: {
                        channel: 'sms',
                    },
                });
                if (error) throw error;
                showToast('Код отправлен на телефон', 'success');
                navigation.navigate('Verify', { phone: normalizedPhone });
            }
        } catch (error: any) {
            showToast(error.message || 'Не удалось отправить код', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleSignIn = async () => {
        setGoogleLoading(true);
        try {
            // Используем промежуточную страницу на веб-сайте, которая редиректит на deep link
            const redirectTo = 'https://kezek.kg/auth/callback-mobile?redirect=kezek://auth/callback';
            
            console.log('[SignInScreen] Starting Google OAuth, redirectTo:', redirectTo);
            
            // Получаем OAuth URL от Supabase
            const { data, error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo,
                    skipBrowserRedirect: true, // Не открываем браузер автоматически
                },
            });
            
            if (error) {
                console.error('[SignInScreen] OAuth error:', error);
                throw error;
            }
            
            if (!data?.url) {
                throw new Error('Не удалось получить OAuth URL');
            }
            
            console.log('[SignInScreen] OAuth URL received, opening browser:', data.url);
            
            // Открываем браузер с OAuth URL
            // Используем WebBrowser для правильной обработки deep links
            const result = await WebBrowser.openAuthSessionAsync(
                data.url,
                redirectTo
            );
            
            console.log('[SignInScreen] WebBrowser result:', result);
            
            if (result.type === 'success' && result.url) {
                // Обрабатываем результат - deep link уже будет обработан RootNavigator
                console.log('[SignInScreen] OAuth completed, URL:', result.url);
            } else if (result.type === 'cancel') {
                console.log('[SignInScreen] OAuth cancelled by user');
                showToast('Вход отменен', 'info');
            } else {
                console.warn('[SignInScreen] OAuth result type:', result.type);
            }
        } catch (error: any) {
            console.error('[SignInScreen] Google sign in error:', error);
            showToast(error.message || 'Не удалось войти через Google', 'error');
        } finally {
            setGoogleLoading(false);
        }
    };

    const handleWhatsAppSignIn = () => {
        navigation.navigate('WhatsApp');
    };

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
            <Text style={styles.title}>Вход в Kezek</Text>
            <Text style={styles.subtitle}>Выберите способ входа</Text>

            <View style={styles.modeSelector}>
                <Button
                    title="Email"
                    onPress={() => setMode('email')}
                    variant={mode === 'email' ? 'primary' : 'outline'}
                    style={styles.modeButton}
                />
                <Button
                    title="Телефон"
                    onPress={() => setMode('phone')}
                    variant={mode === 'phone' ? 'primary' : 'outline'}
                    style={styles.modeButton}
                />
            </View>

            {mode === 'email' ? (
                <Input
                    label="Email"
                    placeholder="example@mail.com"
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                />
            ) : (
                <Input
                    label="Номер телефона"
                    placeholder="+996500574029"
                    value={phone}
                    onChangeText={setPhone}
                    keyboardType="phone-pad"
                />
            )}

            <Button
                title="Отправить код"
                onPress={handleSignIn}
                loading={loading}
                disabled={loading || googleLoading}
            />

            {/* Разделитель */}
            <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>или</Text>
                <View style={styles.dividerLine} />
            </View>

            {/* Кнопка Google */}
            <TouchableOpacity
                style={[styles.socialButton, googleLoading && styles.socialButtonDisabled]}
                onPress={handleGoogleSignIn}
                disabled={loading || googleLoading}
            >
                <Text style={styles.socialButtonText}>
                    {googleLoading ? 'Вход...' : 'Продолжить с Google'}
                </Text>
            </TouchableOpacity>

            {/* Кнопка WhatsApp */}
            <TouchableOpacity
                style={[styles.socialButton, styles.whatsappButton, (loading || googleLoading) && styles.socialButtonDisabled]}
                onPress={handleWhatsAppSignIn}
                disabled={loading || googleLoading}
            >
                <Text style={[styles.socialButtonText, styles.whatsappButtonText]}>
                    Войти через WhatsApp
                </Text>
            </TouchableOpacity>

            <Button
                title="Регистрация"
                onPress={() => navigation.navigate('SignUp')}
                variant="outline"
                style={styles.secondaryButton}
            />
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
    modeSelector: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 24,
    },
    modeButton: {
        flex: 1,
    },
    secondaryButton: {
        marginTop: 12,
    },
    divider: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: 20,
    },
    dividerLine: {
        flex: 1,
        height: 1,
        backgroundColor: '#e5e7eb',
    },
    dividerText: {
        marginHorizontal: 16,
        color: '#6b7280',
        fontSize: 14,
    },
    socialButton: {
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#d1d5db',
        borderRadius: 8,
        paddingVertical: 12,
        paddingHorizontal: 16,
        marginBottom: 12,
        alignItems: 'center',
    },
    socialButtonDisabled: {
        opacity: 0.5,
    },
    socialButtonText: {
        color: '#374151',
        fontSize: 16,
        fontWeight: '600',
    },
    whatsappButton: {
        backgroundColor: '#25D366',
        borderColor: '#25D366',
    },
    whatsappButtonText: {
        color: '#fff',
    },
});
