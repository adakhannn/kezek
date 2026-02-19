import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Constants from 'expo-constants';
import * as WebBrowser from 'expo-web-browser';

import { supabase } from '../../lib/supabase';
import { AuthStackParamList } from '../../navigation/types';
import { useToast } from '../../contexts/ToastContext';
import { validateEmail, getValidationError } from '../../utils/validation';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { logError, logDebug, logWarn } from '../../lib/log';

type SignInScreenNavigationProp = NativeStackNavigationProp<AuthStackParamList, 'SignIn'>;

export default function SignInScreen() {
    const navigation = useNavigation<SignInScreenNavigationProp>();
    const { showToast } = useToast();
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [googleLoading, setGoogleLoading] = useState(false);
    const [errors, setErrors] = useState<{ email?: string }>({});

    const handleSignIn = async () => {
        // Валидация
        const emailError = getValidationError('email', email);
        if (emailError) {
            setErrors({ email: emailError });
            showToast(emailError, 'error');
            return;
        }

        setErrors({});
        setLoading(true);
        try {
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
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Не удалось отправить код';
            showToast(errorMessage, 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleSignIn = async () => {
        setGoogleLoading(true);
        try {
            // Используем Universal Link (https://kezek.kg) вместо custom scheme
            // Это более надежно работает в мобильных браузерах
            const redirectTo = 'https://kezek.kg/auth/callback-mobile?redirect=kezek://auth/callback';
            
            logDebug('SignInScreen', 'Starting Google OAuth', { redirectTo });
            
            // Получаем OAuth URL от Supabase
            const { data, error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo,
                    skipBrowserRedirect: true, // Не открываем браузер автоматически
                },
            });
            
            if (error) {
                logError('SignInScreen', 'OAuth error', error);
                throw error;
            }
            
            if (!data?.url) {
                throw new Error('Не удалось получить OAuth URL');
            }
            
            logDebug('SignInScreen', 'OAuth URL received, opening browser', { url: data.url, redirectTo });
            
            // Открываем браузер и ждем результат
            const result = await WebBrowser.openAuthSessionAsync(
                data.url,
                redirectTo
            );
            
            logDebug('SignInScreen', 'WebBrowser result', result);
            
            // Завершаем сессию браузера
            WebBrowser.maybeCompleteAuthSession();
            
            // Если результат success и есть URL, обрабатываем его
            if (result.type === 'success' && result.url) {
                logDebug('SignInScreen', 'OAuth completed successfully', { url: result.url });
                // Deep link будет обработан RootNavigator
                // Проверяем сессию через некоторое время
                setTimeout(async () => {
                    const { data: { session } } = await supabase.auth.getSession();
                    if (session) {
                        logDebug('SignInScreen', 'Session confirmed after OAuth');
                        showToast('Вход выполнен успешно', 'success');
                    }
                }, 1000);
            } else if (result.type === 'dismiss') {
                // Браузер был закрыт, но пользователь мог авторизоваться на веб-сайте
                // Проверяем сессию - возможно она уже установлена через deep link
                logDebug('SignInScreen', 'Browser dismissed, checking if user authorized on web');
                
                // Даем время на то, чтобы deep link обработался (если он пришел)
                setTimeout(async () => {
                    // Проверяем, есть ли сессия (может быть установлена через deep link, который пришел позже)
                    const { data: { session }, error } = await supabase.auth.getSession();
                    if (session) {
                        logDebug('SignInScreen', 'Session found after dismiss');
                        showToast('Вход выполнен успешно', 'success');
                    } else {
                        logDebug('SignInScreen', 'No session after dismiss');
                        // Показываем инструкцию пользователю
                        showToast('Авторизация завершена на веб-сайте. Вернитесь в приложение или перезапустите его.', 'info');
                    }
                }, 3000); // Увеличиваем время ожидания для обработки deep link
            } else if (result.type === 'cancel') {
                logDebug('SignInScreen', 'OAuth cancelled by user');
                showToast('Вход отменен', 'info');
            } else if (result.type === 'locked') {
                logDebug('SignInScreen', 'OAuth locked (browser already open)');
                showToast('Браузер уже открыт. Закройте его и попробуйте снова.', 'info');
            } else {
                logWarn('SignInScreen', 'OAuth result type', { type: result.type });
                showToast('Не удалось завершить авторизацию. Попробуйте снова.', 'error');
            }
        } catch (error: unknown) {
            logError('SignInScreen', 'Google sign in error', error);
            const errorMessage = error instanceof Error ? error.message : 'Не удалось войти через Google';
            showToast(errorMessage, 'error');
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

            <Input
                label="Email"
                placeholder="example@mail.com"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                error={errors.email}
            />

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
        fontSize: 32,
        fontWeight: 'bold',
        marginBottom: 8,
        color: '#111827',
    },
    subtitle: {
        fontSize: 18,
        color: '#6b7280',
        marginBottom: 32,
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
