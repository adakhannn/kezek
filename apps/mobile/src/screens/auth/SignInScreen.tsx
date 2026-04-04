import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Constants from 'expo-constants';
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

export default function SignInScreen() {
    const navigation = useNavigation<SignInScreenNavigationProp>();
    const { showToast } = useToast();
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [googleLoading, setGoogleLoading] = useState(false);
    const [errors, setErrors] = useState<{ email?: string }>({});

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
            const redirectTo = 'https://kezek.kg/auth/callback-mobile?redirect=kezek://auth/callback';

            const { error } = await supabase.auth.signInWithOtp({
                email: email.trim(),
                options: {
                    emailRedirectTo: redirectTo,
                },
            });
            if (error) throw error;
            showToast('РџСЂРѕРІРµСЂСЊС‚Рµ email Рё РїРµСЂРµР№РґРёС‚Рµ РїРѕ СЃСЃС‹Р»РєРµ', 'success');
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'РќРµ СѓРґР°Р»РѕСЃСЊ РѕС‚РїСЂР°РІРёС‚СЊ РєРѕРґ';
            showToast(errorMessage, 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleSignIn = async () => {
        setGoogleLoading(true);
        try {
            const redirectTo = 'https://kezek.kg/auth/callback-mobile?redirect=kezek://auth/callback';

            logDebug('SignInScreen', 'Starting Google OAuth', { redirectTo });

            const { data, error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo,
                    skipBrowserRedirect: true,
                },
            });

            if (error) {
                logError('SignInScreen', 'OAuth error', error);
                throw error;
            }

            if (!data?.url) {
                throw new Error('РќРµ СѓРґР°Р»РѕСЃСЊ РїРѕР»СѓС‡РёС‚СЊ OAuth URL');
            }

            logDebug('SignInScreen', 'OAuth URL received, opening browser', { url: data.url, redirectTo });

            const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);

            logDebug('SignInScreen', 'WebBrowser result', result);
            WebBrowser.maybeCompleteAuthSession();

            if (result.type === 'success' && result.url) {
                logDebug('SignInScreen', 'OAuth completed successfully', { url: result.url });
                setTimeout(async () => {
                    const {
                        data: { session },
                    } = await supabase.auth.getSession();
                    if (session) {
                        logDebug('SignInScreen', 'Session confirmed after OAuth');
                        showToast('Р’С…РѕРґ РІС‹РїРѕР»РЅРµРЅ СѓСЃРїРµС€РЅРѕ', 'success');
                    }
                }, 1000);
            } else if (result.type === 'dismiss') {
                logDebug('SignInScreen', 'Browser dismissed, checking if user authorized on web');

                setTimeout(async () => {
                    const {
                        data: { session },
                    } = await supabase.auth.getSession();
                    if (session) {
                        logDebug('SignInScreen', 'Session found after dismiss');
                        showToast('Р’С…РѕРґ РІС‹РїРѕР»РЅРµРЅ СѓСЃРїРµС€РЅРѕ', 'success');
                    } else {
                        logDebug('SignInScreen', 'No session after dismiss');
                        showToast('РђРІС‚РѕСЂРёР·Р°С†РёСЏ Р·Р°РІРµСЂС€РµРЅР° РЅР° РІРµР±-СЃР°Р№С‚Рµ. Р’РµСЂРЅРёС‚РµСЃСЊ РІ РїСЂРёР»РѕР¶РµРЅРёРµ РёР»Рё РїРµСЂРµР·Р°РїСѓСЃС‚РёС‚Рµ РµРіРѕ.', 'info');
                    }
                }, 3000);
            } else if (result.type === 'cancel') {
                logDebug('SignInScreen', 'OAuth cancelled by user');
                showToast('Р’С…РѕРґ РѕС‚РјРµРЅРµРЅ', 'info');
            } else if (result.type === 'locked') {
                logDebug('SignInScreen', 'OAuth locked (browser already open)');
                showToast('Р‘СЂР°СѓР·РµСЂ СѓР¶Рµ РѕС‚РєСЂС‹С‚. Р—Р°РєСЂРѕР№С‚Рµ РµРіРѕ Рё РїРѕРїСЂРѕР±СѓР№С‚Рµ СЃРЅРѕРІР°.', 'info');
            } else {
                logWarn('SignInScreen', 'OAuth result type', { type: result.type });
                showToast('РќРµ СѓРґР°Р»РѕСЃСЊ Р·Р°РІРµСЂС€РёС‚СЊ Р°РІС‚РѕСЂРёР·Р°С†РёСЋ. РџРѕРїСЂРѕР±СѓР№С‚Рµ СЃРЅРѕРІР°.', 'error');
            }
        } catch (error: unknown) {
            logError('SignInScreen', 'Google sign in error', error);
            const errorMessage = error instanceof Error ? error.message : 'РќРµ СѓРґР°Р»РѕСЃСЊ РІРѕР№С‚Рё С‡РµСЂРµР· Google';
            showToast(errorMessage, 'error');
        } finally {
            setGoogleLoading(false);
        }
    };

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
            <Text style={styles.title}>Р’С…РѕРґ РІ Kezek</Text>
            <Text style={styles.subtitle}>Р’С‹Р±РµСЂРёС‚Рµ СЃРїРѕСЃРѕР± РІС…РѕРґР°</Text>

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
                title="РћС‚РїСЂР°РІРёС‚СЊ РєРѕРґ"
                onPress={handleSignIn}
                loading={loading}
                disabled={loading || googleLoading}
                fullWidth
            />

            <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>РёР»Рё</Text>
                <View style={styles.dividerLine} />
            </View>

            <Button
                title={googleLoading ? 'Р’С…РѕРґ...' : 'РџСЂРѕРґРѕР»Р¶РёС‚СЊ СЃ Google'}
                onPress={handleGoogleSignIn}
                disabled={loading || googleLoading}
                variant="outline"
                style={styles.socialButton}
                fullWidth
            />

            <Button
                title="Р’РѕР№С‚Рё С‡РµСЂРµР· WhatsApp"
                onPress={() => navigation.navigate('WhatsApp')}
                disabled={loading || googleLoading}
                variant="secondary"
                style={styles.whatsAppButton}
                textStyle={styles.whatsAppButtonText}
                fullWidth
            />

            <Button
                title="Р РµРіРёСЃС‚СЂР°С†РёСЏ"
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
