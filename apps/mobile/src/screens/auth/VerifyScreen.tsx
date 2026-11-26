import { useState } from 'react';
import {
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
} from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { colors } from '../../constants/colors';
import { layout, space, typeScale } from '../../constants/theme';
import { useToast } from '../../contexts/ToastContext';
import { useLanguage } from '../../i18n';
import { getErrorMessage } from '../../lib/errors';
import { supabase } from '../../lib/supabase';
import { AuthStackParamList } from '../../navigation/types';
import { getValidationError } from '../../utils/validation';

type VerifyScreenRouteProp = RouteProp<AuthStackParamList, 'Verify'>;
type VerifyScreenNavigationProp = NativeStackNavigationProp<AuthStackParamList, 'Verify'>;

export default function VerifyScreen() {
    const route = useRoute<VerifyScreenRouteProp>();
    const navigation = useNavigation<VerifyScreenNavigationProp>();
    const { showToast } = useToast();
    const { t } = useLanguage();
    const { phone, email } = route.params || {};

    const [code, setCode] = useState('');
    const [loading, setLoading] = useState(false);
    const [codeError, setCodeError] = useState<string | null>(null);

    const handleVerify = async () => {
        const error = getValidationError('code', code, t);
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
                throw new Error(t('auth.verify.error.noContact'));
            }
            showToast(t('auth.signedIn'), 'success');
        } catch (error: unknown) {
            showToast(
                getErrorMessage(error, t('auth.verify.error.verify'), t),
                'error',
            );
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
            showToast(t('auth.verify.resent'), 'success');
        } catch (error: unknown) {
            showToast(
                getErrorMessage(error, t('auth.verify.error.resend'), t),
                'error',
            );
        } finally {
            setLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
        <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            automaticallyAdjustKeyboardInsets
        >
            <Text style={styles.subtitle}>{t('auth.verify.subtitle', { contact: email || phone || '' })}</Text>

            <Input
                label={t('auth.verify.codeLabel')}
                placeholder="000000"
                value={code}
                onChangeText={(text) => {
                    setCode(text.replace(/\D/g, '').slice(0, 6));
                    if (codeError) {
                        setCodeError(null);
                    }
                }}
                keyboardType="number-pad"
                maxLength={6}
                error={codeError ?? undefined}
                helperText={t('auth.code.helper')}
                accessibilityHint={t('auth.verify.codeHint')}
                containerStyle={styles.field}
                style={styles.codeInput}
                inputContainerStyle={styles.codeInputContainer}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={() => {
                    if (code.length === 6 && !loading) {
                        void handleVerify();
                    }
                }}
            />

            <Button
                title={t('auth.verify.submit')}
                onPress={handleVerify}
                loading={loading}
                disabled={loading || code.length !== 6}
                accessibilityHint={t('auth.code.submitHint')}
                fullWidth
            />

            <Button
                title={t('auth.code.resend')}
                onPress={handleResend}
                variant="ghost"
                style={styles.resendButton}
                disabled={loading}
                accessibilityHint={t('auth.verify.resendHint')}
                fullWidth
            />

            <Button
                title={t('auth.verify.back')}
                onPress={() => navigation.goBack()}
                variant="secondary"
                style={styles.backButton}
                disabled={loading}
                accessibilityHint={t('auth.verify.backHint')}
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
        paddingHorizontal: layout.gutter,
        paddingTop: space.xxl,
        paddingBottom: space.xxxl,
    },
    subtitle: {
        ...typeScale.body,
        color: colors.text.secondary,
        marginBottom: space.xxl,
    },
    field: {
        marginBottom: space.xl,
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
        marginTop: space.md,
    },
    backButton: {
        marginTop: space.sm,
    },
});
