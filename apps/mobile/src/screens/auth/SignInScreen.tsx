import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

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
                const { error } = await supabase.auth.signInWithOtp({
                    email: email.trim(),
                    options: {
                        emailRedirectTo: 'kezek://auth/callback',
                    },
                });
                if (error) throw error;
                showToast('Код отправлен на email', 'success');
                navigation.navigate('Verify', { email: email.trim() });
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
                disabled={loading}
            />

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
});
