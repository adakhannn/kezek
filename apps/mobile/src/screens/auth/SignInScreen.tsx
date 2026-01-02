import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { supabase } from '../../lib/supabase';
import { AuthStackParamList } from '../../navigation/types';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';

type SignInScreenNavigationProp = NativeStackNavigationProp<AuthStackParamList, 'SignIn'>;

export default function SignInScreen() {
    const navigation = useNavigation<SignInScreenNavigationProp>();
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [loading, setLoading] = useState(false);
    const [mode, setMode] = useState<'email' | 'phone'>('email');

    const handleSignIn = async () => {
        if (mode === 'email' && !email) {
            Alert.alert('Ошибка', 'Введите email');
            return;
        }
        if (mode === 'phone' && !phone) {
            Alert.alert('Ошибка', 'Введите номер телефона');
            return;
        }

        setLoading(true);
        try {
            if (mode === 'email') {
                const { error } = await supabase.auth.signInWithOtp({
                    email,
                    options: {
                        emailRedirectTo: 'kezek://auth/callback',
                    },
                });
                if (error) throw error;
                navigation.navigate('Verify', { email });
            } else {
                const { error } = await supabase.auth.signInWithOtp({
                    phone: phone.startsWith('+') ? phone : `+${phone}`,
                    options: {
                        channel: 'sms',
                    },
                });
                if (error) throw error;
                navigation.navigate('Verify', { phone });
            }
        } catch (error: any) {
            Alert.alert('Ошибка', error.message || 'Не удалось отправить код');
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
