import { View, Text, StyleSheet, Alert } from 'react-native';
import { useState, useRef } from 'react';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { supabase } from '../../lib/supabase';
import { AuthStackParamList } from '../../navigation/types';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';

type VerifyScreenRouteProp = RouteProp<AuthStackParamList, 'Verify'>;
type VerifyScreenNavigationProp = NativeStackNavigationProp<AuthStackParamList, 'Verify'>;

export default function VerifyScreen() {
    const route = useRoute<VerifyScreenRouteProp>();
    const navigation = useNavigation<VerifyScreenNavigationProp>();
    const { phone, email } = route.params || {};

    const [code, setCode] = useState('');
    const [loading, setLoading] = useState(false);

    const handleVerify = async () => {
        if (!code || code.length !== 6) {
            Alert.alert('Ошибка', 'Введите 6-значный код');
            return;
        }

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
                throw new Error('Не указан email или телефон');
            }
            // Навигация произойдет автоматически через RootNavigator при изменении сессии
        } catch (error: any) {
            Alert.alert('Ошибка', error.message || 'Неверный код');
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
            Alert.alert('Успешно', 'Код отправлен повторно');
        } catch (error: any) {
            Alert.alert('Ошибка', error.message || 'Не удалось отправить код');
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Подтверждение</Text>
            <Text style={styles.subtitle}>
                Введите код, отправленный на {email || phone}
            </Text>

            <Input
                label="Код подтверждения"
                placeholder="000000"
                value={code}
                onChangeText={(text) => setCode(text.replace(/\D/g, '').slice(0, 6))}
                keyboardType="number-pad"
                maxLength={6}
                style={styles.codeInput}
            />

            <Button
                title="Подтвердить"
                onPress={handleVerify}
                loading={loading}
                disabled={loading || code.length !== 6}
            />

            <Button
                title="Отправить код снова"
                onPress={handleResend}
                variant="outline"
                style={styles.resendButton}
                disabled={loading}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 20,
        backgroundColor: '#fff',
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
    codeInput: {
        fontSize: 24,
        letterSpacing: 8,
        textAlign: 'center',
        marginBottom: 24,
    },
    resendButton: {
        marginTop: 12,
    },
});
