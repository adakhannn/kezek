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

type SignUpScreenNavigationProp = NativeStackNavigationProp<AuthStackParamList, 'SignUp'>;

export default function SignUpScreen() {
    const navigation = useNavigation<SignUpScreenNavigationProp>();
    const { showToast } = useToast();
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSignUp = async () => {
        if (!email) {
            showToast('Р’РІРµРґРёС‚Рµ email', 'error');
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
            <Text style={styles.subtitle}>РЎРѕР·РґР°Р№С‚Рµ Р°РєРєР°СѓРЅС‚ РІ Kezek</Text>

            <Input
                label="Email"
                placeholder="example@mail.com"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                containerStyle={styles.field}
            />

            <Button
                title="Зарегистрироваться"
                onPress={handleSignUp}
                loading={loading}
                disabled={loading}
                fullWidth
            />

            <Button
                title="РЈР¶Рµ РµСЃС‚СЊ Р°РєРєР°СѓРЅС‚? Р’РѕР№С‚Рё"
                onPress={() => navigation.navigate('SignIn')}
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
    secondaryButton: {
        marginTop: colors.layout.space3,
    },
});
