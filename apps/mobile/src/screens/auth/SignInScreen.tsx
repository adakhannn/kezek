import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as WebBrowser from 'expo-web-browser';

import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { colors } from '../../constants/colors';
import { useToast } from '../../contexts/ToastContext';
import { supabase } from '../../lib/supabase';
import { logDebug, logError, logWarn } from '../../lib/log';
import { AuthStackParamList } from '../../navigation/types';
import { getValidationError } from '../../utils/validation';

type SignInScreenNavigationProp = NativeStackNavigationProp<AuthStackParamList, 'SignIn'>;

type OAuthProvider = 'google' | 'telegram';

const MOBILE_REDIRECT = 'https://kezek.kg/auth/callback-mobile?redirect=kezek://auth/callback';

export default function SignInScreen() {
    const navigation = useNavigation<SignInScreenNavigationProp>();
    const { showToast } = useToast();
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [googleLoading, setGoogleLoading] = useState(false);
    const [telegramLoading, setTelegramLoading] = useState(false);
    const [errors, setErrors] = useState<{ email?: string }>({});

    const setProviderLoading = (provider: OAuthProvider, value: boolean) => {
        if (provider === 'google') {
            setGoogleLoading(value);
            return;
        }
        setTelegramLoading(value);
    };

    const getProviderLabel = (provider: OAuthProvider) => (provider === 'google' ? 'Google' : 'Telegram');

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
            if (error) throw error;
            showToast('Проверьте email и перейдите по ссылке', 'success');
        } catch (error: unknown) {
            const errorMessage =
                error instanceof Error ? error.message : 'Не удалось отправить код';
            showToast(errorMessage, 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleOAuthSignIn = async (provider: OAuthProvider) => {
        const providerLabel = getProviderLabel(provider);
        setProviderLoading(provider, true);

        try {
            logDebug('SignInScreen', 'Starting OAuth', { provider, redirectTo: MOBILE_REDIRECT });
            let authUrl: string;
            let returnUrl = 'kezek://auth/callback';

            if (provider === 'telegram') {
                const redirectPath = '/auth/callback-mobile?redirect=kezek://auth/callback';
                authUrl = `https://kezek.kg/auth/sign-in?redirect=${encodeURIComponent(redirectPath)}`;
            } else {
                const { data, error } = await supabase.auth.signInWithOAuth({
                    provider: 'google',
                    options: {
                        redirectTo: MOBILE_REDIRECT,
                        skipBrowserRedirect: true,
                    },
                });

                if (error) {
                    logError('SignInScreen', 'OAuth error', { provider, error });
                    throw error;
                }

                if (!data?.url) {
                    throw new Error('?? ??????? ???????? OAuth URL');
                }

                authUrl = data.url;
            }

            const result = await WebBrowser.openAuthSessionAsync(authUrl, returnUrl);
            logDebug('SignInScreen', 'OAuth result', { provider, result });
            WebBrowser.maybeCompleteAuthSession();

            if (result.type === 'success' && result.url) {
                setTimeout(async () => {
                    const {
                        data: { session },
                    } = await supabase.auth.getSession();

                    if (session) {
                        showToast('Вход выполнен успешно', 'success');
                    }
                }, 1000);
                return;
            }

            if (result.type === 'dismiss') {
                setTimeout(async () => {
                    const {
                        data: { session },
                    } = await supabase.auth.getSession();

                    if (session) {
                        showToast('Вход выполнен успешно', 'success');
                    } else {
                        showToast(
                            'Авторизация завершена на веб-сайте. Вернитесь в приложение или перезапустите его.',
                            'info',
                        );
                    }
                }, 3000);
                return;
            }

            if (result.type === 'cancel') {
                showToast('Вход отменен', 'info');
                return;
            }

            if (result.type === 'locked') {
                showToast(
                    'Браузер уже открыт. Закройте его и попробуйте снова.',
                    'info',
                );
                return;
            }

            logWarn('SignInScreen', 'Unexpected OAuth result type', { provider, type: result.type });
            showToast('Не удалось завершить авторизацию. Попробуйте снова.', 'error');
        } catch (error: unknown) {
            logError('SignInScreen', 'OAuth sign in error', { provider, error });
            const fallback =
                providerLabel === 'Google'
                    ? 'Не удалось войти через Google'
                    : 'Не удалось войти через Telegram';
            const errorMessage = error instanceof Error ? error.message : fallback;
            showToast(errorMessage, 'error');
        } finally {
            setProviderLoading(provider, false);
        }
    };

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
                onPress={() => void handleOAuthSignIn('google')}
                disabled={loading || anySocialLoading}
                variant="outline"
                style={styles.socialButton}
                fullWidth
            />

            <Button
                title={telegramLoading ? 'Вход...' : 'Войти через Telegram'}
                onPress={() => void handleOAuthSignIn('telegram')}
                disabled={loading || anySocialLoading}
                variant="outline"
                style={styles.telegramButton}
                fullWidth
            />

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
