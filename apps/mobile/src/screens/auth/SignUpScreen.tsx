import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { supabase } from '../../lib/supabase';
import { AuthStackParamList } from '../../navigation/types';
import { useToast } from '../../contexts/ToastContext';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';

type SignUpScreenNavigationProp = NativeStackNavigationProp<AuthStackParamList, 'SignUp'>;

export default function SignUpScreen() {
    const navigation = useNavigation<SignUpScreenNavigationProp>();
    const { showToast } = useToast();
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSignUp = async () => {
        if (!email) {
            showToast('Введите email', 'error');
            return;
        }

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
        } catch (error: any) {
            showToast(error.message || 'Не удалось отправить код', 'error');
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
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
            />

            <Button
                title="Зарегистрироваться"
                onPress={handleSignUp}
                loading={loading}
                disabled={loading}
            />

            <Button
                title="Уже есть аккаунт? Войти"
                onPress={() => navigation.navigate('SignIn')}
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
    secondaryButton: {
        marginTop: 12,
    },
});
