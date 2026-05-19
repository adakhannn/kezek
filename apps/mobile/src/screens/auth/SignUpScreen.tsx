import { useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { colors } from '../../constants/colors';
import { useToast } from '../../contexts/ToastContext';
import { supabase } from '../../lib/supabase';
import { AuthStackParamList } from '../../navigation/types';
import { getValidationError } from '../../utils/validation';

type SignUpScreenNavigationProp = NativeStackNavigationProp<AuthStackParamList, 'SignUp'>;

export default function SignUpScreen() {
    const navigation = useNavigation<SignUpScreenNavigationProp>();
    const { showToast } = useToast();
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [emailError, setEmailError] = useState<string | null>(null);

    const handleSignUp = async () => {
        const validationError = getValidationError('email', email);
        if (validationError) {
            setEmailError(validationError);
            showToast(validationError, 'error');
            return;
        }

        setEmailError(null);
        setLoading(true);
        try {
            const { error } = await supabase.auth.signInWithOtp({
                email,
                options: {
                    emailRedirectTo: 'kezek://auth/callback',
                    shouldCreateUser: true,
                },
            });
            if (error) throw error;
            showToast('Код отправлен на email', 'success');
            navigation.navigate('Verify', { email });
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Не удалось отправить код';
            showToast(errorMessage, 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
            <Text style={styles.title}>Регистрация</Text>
            <Text style={styles.subtitle}>Создайте аккаунт в Kezek</Text>

            <Input
                label="Email"
                placeholder="example@mail.com"
                value={email}
                onChangeText={(value) => {
                    setEmail(value);
                    if (emailError) {
                        setEmailError(null);
                    }
                }}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                error={emailError ?? undefined}
                helperText="Используйте рабочий email для регистрации."
                accessibilityHint="Введите email для регистрации и получения кода."
                containerStyle={styles.field}
            />

            <Button
                title="Зарегистрироваться"
                onPress={handleSignUp}
                loading={loading}
                disabled={loading || !email.trim()}
                accessibilityHint="Отправляет код подтверждения на email."
                fullWidth
            />

            <Button
                title="Уже есть аккаунт? Войти"
                onPress={() => navigation.navigate('SignIn')}
                variant="ghost"
                style={styles.secondaryButton}
                disabled={loading}
                accessibilityHint="Переход на экран входа."
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
        lineHeight: 22,
        color: colors.text.secondary,
        marginBottom: colors.layout.space5,
    },
    field: {
        marginBottom: colors.layout.space5,
    },
    secondaryButton: {
        marginTop: colors.layout.space3,
    },
});
