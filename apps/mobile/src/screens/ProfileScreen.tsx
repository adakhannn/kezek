import { View, Text, StyleSheet, ScrollView, Alert, Switch } from 'react-native';
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { supabase } from '../lib/supabase';
import { apiRequest } from '../lib/api';
import { MainTabParamList } from '../navigation/types';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';

type ProfileScreenNavigationProp = NativeStackNavigationProp<MainTabParamList, 'Cabinet'>;

type Profile = {
    id: string;
    full_name: string | null;
    phone: string | null;
    email: string | null;
    notify_email: boolean;
    notify_whatsapp: boolean;
};

export default function ProfileScreen() {
    const navigation = useNavigation<ProfileScreenNavigationProp>();
    const queryClient = useQueryClient();

    const { data: user } = useQuery({
        queryKey: ['user'],
        queryFn: async () => {
            const { data: { user }, error } = await supabase.auth.getUser();
            if (error) throw error;
            return user;
        },
    });

    const { data: profile, isLoading } = useQuery({
        queryKey: ['profile', user?.id],
        queryFn: async () => {
            if (!user?.id) return null;

            const { data, error } = await supabase
                .from('profiles')
                .select('id, full_name, phone, email, notify_email, notify_whatsapp')
                .eq('id', user.id)
                .single();

            if (error) throw error;
            return data as Profile;
        },
        enabled: !!user?.id,
    });

    const [fullName, setFullName] = useState('');
    const [phone, setPhone] = useState('');
    const [notifyEmail, setNotifyEmail] = useState(true);
    const [notifyWhatsApp, setNotifyWhatsApp] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (profile) {
            setFullName(profile.full_name || '');
            setPhone(profile.phone || '');
            setNotifyEmail(profile.notify_email ?? true);
            setNotifyWhatsApp(profile.notify_whatsapp ?? true);
        }
    }, [profile]);

    const updateProfileMutation = useMutation({
        mutationFn: async () => {
            return apiRequest('/profile/update', {
                method: 'POST',
                body: JSON.stringify({
                    full_name: fullName.trim() || null,
                    phone: phone.trim() || null,
                    notify_email: notifyEmail,
                    notify_whatsapp: notifyWhatsApp,
                }),
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['profile', user?.id] });
            Alert.alert('Успешно', 'Профиль обновлен');
        },
        onError: (error: Error) => {
            Alert.alert('Ошибка', error.message || 'Не удалось обновить профиль');
        },
    });

    const handleSave = () => {
        if (!fullName.trim()) {
            Alert.alert('Ошибка', 'Введите имя');
            return;
        }
        updateProfileMutation.mutate();
    };

    const handleSignOut = async () => {
        Alert.alert('Выход', 'Вы уверены, что хотите выйти?', [
            { text: 'Отмена', style: 'cancel' },
            {
                text: 'Выйти',
                style: 'destructive',
                onPress: async () => {
                    await supabase.auth.signOut();
                },
            },
        ]);
    };

    if (isLoading) {
        return (
            <View style={styles.container}>
                <Text style={styles.loading}>Загрузка...</Text>
            </View>
        );
    }

    return (
        <ScrollView style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>Профиль</Text>
            </View>

            <Card style={styles.card}>
                <Text style={styles.sectionTitle}>Личная информация</Text>

                <Input
                    label="Имя"
                    placeholder="Введите ваше имя"
                    value={fullName}
                    onChangeText={setFullName}
                />

                <Input
                    label="Телефон"
                    placeholder="+996500574029"
                    value={phone}
                    onChangeText={setPhone}
                    keyboardType="phone-pad"
                />

                {user?.email && (
                    <View style={styles.emailContainer}>
                        <Text style={styles.label}>Email</Text>
                        <Text style={styles.emailValue}>{user.email}</Text>
                        <Text style={styles.emailHint}>Email нельзя изменить</Text>
                    </View>
                )}
            </Card>

            <Card style={styles.card}>
                <Text style={styles.sectionTitle}>Уведомления</Text>

                <View style={styles.switchRow}>
                    <View style={styles.switchLabelContainer}>
                        <Text style={styles.switchLabel}>Email уведомления</Text>
                        <Text style={styles.switchHint}>Получать уведомления на email</Text>
                    </View>
                    <Switch
                        value={notifyEmail}
                        onValueChange={setNotifyEmail}
                        trackColor={{ false: '#d1d5db', true: '#6366f1' }}
                        thumbColor="#fff"
                    />
                </View>

                <View style={styles.switchRow}>
                    <View style={styles.switchLabelContainer}>
                        <Text style={styles.switchLabel}>WhatsApp уведомления</Text>
                        <Text style={styles.switchHint}>Получать уведомления в WhatsApp</Text>
                    </View>
                    <Switch
                        value={notifyWhatsApp}
                        onValueChange={setNotifyWhatsApp}
                        trackColor={{ false: '#d1d5db', true: '#6366f1' }}
                        thumbColor="#fff"
                    />
                </View>
            </Card>

            <View style={styles.actions}>
                <Button
                    title="Сохранить"
                    onPress={handleSave}
                    loading={updateProfileMutation.isPending}
                    disabled={updateProfileMutation.isPending}
                />

                <Button
                    title="Выйти"
                    onPress={handleSignOut}
                    variant="outline"
                    style={styles.signOutButton}
                />
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f9fafb',
    },
    header: {
        padding: 20,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#e5e7eb',
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#111827',
    },
    loading: {
        textAlign: 'center',
        padding: 40,
        color: '#6b7280',
    },
    card: {
        margin: 20,
        marginBottom: 0,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 16,
    },
    emailContainer: {
        marginTop: 8,
    },
    label: {
        fontSize: 14,
        fontWeight: '500',
        color: '#374151',
        marginBottom: 8,
    },
    emailValue: {
        fontSize: 16,
        color: '#111827',
        marginBottom: 4,
    },
    emailHint: {
        fontSize: 12,
        color: '#6b7280',
    },
    switchRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#e5e7eb',
    },
    switchLabelContainer: {
        flex: 1,
        marginRight: 12,
    },
    switchLabel: {
        fontSize: 16,
        fontWeight: '500',
        color: '#111827',
        marginBottom: 4,
    },
    switchHint: {
        fontSize: 14,
        color: '#6b7280',
    },
    actions: {
        padding: 20,
        paddingBottom: 40,
    },
    signOutButton: {
        marginTop: 12,
        borderColor: '#ef4444',
    },
});

