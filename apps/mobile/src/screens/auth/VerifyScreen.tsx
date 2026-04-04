import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { colors } from '../../constants/colors';
import { useToast } from '../../contexts/ToastContext';
import { supabase } from '../../lib/supabase';
import { AuthStackParamList } from '../../navigation/types';
import { getValidationError } from '../../utils/validation';

type VerifyScreenRouteProp = RouteProp<AuthStackParamList, 'Verify'>;
type VerifyScreenNavigationProp = NativeStackNavigationProp<AuthStackParamList, 'Verify'>;

export default function VerifyScreen() {
    const route = useRoute<VerifyScreenRouteProp>();
    const navigation = useNavigation<VerifyScreenNavigationProp>();
    const { showToast } = useToast();
    const { phone, email } = route.params || {};

    const [code, setCode] = useState('');
    const [loading, setLoading] = useState(false);
    const [codeError, setCodeError] = useState<string | null>(null);

    const handleVerify = async () => {
        const error = getValidationError('code', code);
        if (error) {
            setCodeError(error);
            showToast(error, 'error');
            return;
        }

        setCodeError(null);
        setLoading(true);
        try {
            if (email) {
                const { error } = await supabase.auth.verifyOtp({
                    email,
                    token: code,
                    type: 'email',
                });
                if (error) throw error;
            } else if (phone) {
                const { error } = await supabase.auth.verifyOtp({
                    phone: phone.startsWith('+') ? phone : `+${phone}`,
                    token: code,
                    type: 'sms',
                });
                if (error) throw error;
            } else {
                throw new Error('РќРµ СѓРєР°Р·Р°РЅ email РёР»Рё С‚РµР»РµС„РѕРЅ');
            }
            showToast('Р’С…РѕРґ РІС‹РїРѕР»РЅРµРЅ СѓСЃРїРµС€РЅРѕ', 'success');
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'РќРµРІРµСЂРЅС‹Р№ РєРѕРґ';
            showToast(errorMessage, 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleResend = async () => {
        setLoading(true);
        try {
            if (email) {
                const { error } = await supabase.auth.signInWithOtp({
                    email,
                    options: {
                        emailRedirectTo: 'kezek://auth/callback',
                    },
                });
                if (error) throw error;
            } else if (phone) {
                const { error } = await supabase.auth.signInWithOtp({
                    phone: phone.startsWith('+') ? phone : `+${phone}`,
                    options: {
                        channel: 'sms',
                    },
                });
                if (error) throw error;
            }
            showToast('РљРѕРґ РѕС‚РїСЂР°РІР»РµРЅ РїРѕРІС‚РѕСЂРЅРѕ', 'success');
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'РќРµ СѓРґР°Р»РѕСЃСЊ РѕС‚РїСЂР°РІРёС‚СЊ РєРѕРґ';
            showToast(errorMessage, 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={styles.container}>
            <Text style={styles.title}>РџРѕРґС‚РІРµСЂР¶РґРµРЅРёРµ</Text>
            <Text style={styles.subtitle}>Р’РІРµРґРёС‚Рµ РєРѕРґ, РѕС‚РїСЂР°РІР»РµРЅРЅС‹Р№ РЅР° {email || phone}</Text>

            <Input
                label="РљРѕРґ РїРѕРґС‚РІРµСЂР¶РґРµРЅРёСЏ"
                placeholder="000000"
                value={code}
                onChangeText={(text) => setCode(text.replace(/\D/g, '').slice(0, 6))}
                keyboardType="number-pad"
                maxLength={6}
                error={codeError ?? undefined}
                containerStyle={styles.field}
                style={styles.codeInput}
                inputContainerStyle={styles.codeInputContainer}
            />

            <Button
                title="РџРѕРґС‚РІРµСЂРґРёС‚СЊ"
                onPress={handleVerify}
                loading={loading}
                disabled={loading || code.length !== 6}
                fullWidth
            />

            <Button
                title="РћС‚РїСЂР°РІРёС‚СЊ РєРѕРґ СЃРЅРѕРІР°"
                onPress={handleResend}
                variant="ghost"
                style={styles.resendButton}
                disabled={loading}
                fullWidth
            />

            <Button
                title="РќР°Р·Р°Рґ"
                onPress={() => navigation.goBack()}
                variant="secondary"
                style={styles.backButton}
                fullWidth
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: colors.layout.space5,
        backgroundColor: colors.surface.page,
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
        marginBottom: colors.layout.space5,
    },
    field: {
        marginBottom: colors.layout.space5,
    },
    codeInputContainer: {
        justifyContent: 'center',
    },
    codeInput: {
        fontSize: 24,
        letterSpacing: 8,
        textAlign: 'center',
    },
    resendButton: {
        marginTop: colors.layout.space3,
    },
    backButton: {
        marginTop: colors.layout.space2,
    },
});
