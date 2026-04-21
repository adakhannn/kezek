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
                throw new Error(data.message || 'РќРµ СѓРґР°Р»РѕСЃСЊ РѕС‚РїСЂР°РІРёС‚СЊ РєРѕРґ');
            }

            setStep('otp');
            setCountdown(60);
            showToast('??? ????????? ?? WhatsApp', 'success');
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'РќРµ СѓРґР°Р»РѕСЃСЊ РѕС‚РїСЂР°РІРёС‚СЊ РєРѕРґ';
            showToast(errorMessage, 'error');
        } finally {
            setSending(false);
        }
    };

    const handleVerifyOtp = async () => {
        if (otp.length !== 6) {
            showToast('Р’РІРµРґРёС‚Рµ 6-Р·РЅР°С‡РЅС‹Р№ РєРѕРґ', 'error');
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
                throw new Error(data.message || 'РќРµРІРµСЂРЅС‹Р№ РєРѕРґ');
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
                throw new Error(sessionData.message || '?? ??????? ??????? ??????');
            }

            if (sessionData.email && sessionData.password && sessionData.needsSignIn) {
                const { supabase } = await import('../../lib/supabase');

                const { error: signInError } = await supabase.auth.signInWithPassword({
                    email: sessionData.email,
                    password: sessionData.password,
                });

                if (signInError) {
                    logError('WhatsAppScreen', 'Sign in error', signInError);
                    throw new Error('РќРµ СѓРґР°Р»РѕСЃСЊ РІРѕР№С‚Рё: ' + signInError.message);
                }

                const {
                    data: { user: currentUser },
                    error: userError,
                } = await supabase.auth.getUser();
                if (userError || !currentUser) {
                    logError('WhatsAppScreen', 'User not found after sign in', userError);
                    throw new Error('Р’С…РѕРґ РІС‹РїРѕР»РЅРµРЅ, РЅРѕ СЃРµСЃСЃРёСЏ РЅРµ Р±С‹Р»Р° СЃРѕР·РґР°РЅР°');
                }

                logDebug('WhatsAppScreen', 'Sign in successful', { userId: currentUser.id });
                showToast('???? ???????? ???????', 'success');
            } else if (sessionData.session) {
                const { supabase } = await import('../../lib/supabase');
                const { error } = await supabase.auth.setSession({
                    access_token: sessionData.session.access_token,
                    refresh_token: sessionData.session.refresh_token,
                });

                if (error) throw error;

                showToast('???? ???????? ???????', 'success');
            } else if (sessionData.magicLink) {
                showToast('РџСЂРѕРІРµСЂСЊС‚Рµ email РґР»СЏ Р·Р°РІРµСЂС€РµРЅРёСЏ РІС…РѕРґР°', 'info');
            } else {
                throw new Error('РќРµРѕР¶РёРґР°РЅРЅС‹Р№ С„РѕСЂРјР°С‚ РѕС‚РІРµС‚Р° РѕС‚ СЃРµСЂРІРµСЂР°');
            }
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'РќРµ СѓРґР°Р»РѕСЃСЊ РІРѕР№С‚Рё';
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
                    ? 'Р’РІРµРґРёС‚Рµ РЅРѕРјРµСЂ С‚РµР»РµС„РѕРЅР° РґР»СЏ РїРѕР»СѓС‡РµРЅРёСЏ РєРѕРґР°'
                    : 'Р’РІРµРґРёС‚Рµ РєРѕРґ, РѕС‚РїСЂР°РІР»РµРЅРЅС‹Р№ РЅР° WhatsApp'}
            </Text>

            {step === 'phone' ? (
                <>
                    <Input
                        label="РќРѕРјРµСЂ С‚РµР»РµС„РѕРЅР°"
                        placeholder="+996500574029"
                        value={phone}
                        onChangeText={setPhone}
                        keyboardType="phone-pad"
                        containerStyle={styles.field}
                    />
                    <Button
                        title={sending ? 'РћС‚РїСЂР°РІРєР°...' : 'РћС‚РїСЂР°РІРёС‚СЊ РєРѕРґ'}
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
                        <Text style={styles.otpHint}>РљРѕРґ РѕС‚РїСЂР°РІР»РµРЅ РЅР° {phone}</Text>
                    </View>

                    <View style={styles.otpActions}>
                        <Button
                            title="РР·РјРµРЅРёС‚СЊ РЅРѕРјРµСЂ"
                            onPress={() => setStep('phone')}
                            variant="ghost"
                            size="sm"
                            style={styles.otpActionButton}
                        />
                        <Button
                            title={countdown > 0 ? `????????? ????? (${countdown}?)` : '????????? ??? ?????'}
                            onPress={handleResendOtp}
                            disabled={countdown > 0}
                            variant="ghost"
                            size="sm"
                            style={styles.otpActionButton}
                        />
                    </View>

                    <Button
                        title={verifying ? 'РџСЂРѕРІРµСЂРєР°...' : 'Р’РѕР№С‚Рё'}
                        onPress={() => void handleVerifyOtp()}
                        loading={verifying}
                        disabled={verifying || otp.length !== 6}
                        fullWidth
                    />
                </>
            )}

            <Button
                title="Р’РµСЂРЅСѓС‚СЊСЃСЏ Рє РґСЂСѓРіРёРј СЃРїРѕСЃРѕР±Р°Рј РІС…РѕРґР°"
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
