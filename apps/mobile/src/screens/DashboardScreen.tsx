import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { MainTabParamList } from '../navigation/types';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import EmptyState from '../components/ui/EmptyState';

type DashboardScreenNavigationProp = NativeStackNavigationProp<MainTabParamList, 'Dashboard'>;

type Business = {
    id: string;
    name: string;
    slug: string;
    address: string | null;
    phones: string[] | null;
};

export default function DashboardScreen() {
    const navigation = useNavigation<DashboardScreenNavigationProp>();
    const [refreshing, setRefreshing] = useState(false);

    const { user } = useAuth();

    const { data: businesses, isLoading, refetch } = useQuery({
        queryKey: ['my-businesses', user?.id],
        queryFn: async () => {
            if (!user?.id) return [];

            // Проверяем, является ли пользователь владельцем бизнеса
            const { data, error } = await supabase
                .from('businesses')
                .select('id, name, slug, address, phones')
                .eq('owner_id', user.id)
                .eq('is_approved', true)
                .order('created_at', { ascending: false });

            if (error) throw error;
            return (data || []) as Business[];
        },
        enabled: !!user?.id,
    });

    const { data: isOwner } = useQuery({
        queryKey: ['is-owner', user?.id],
        queryFn: async () => {
            if (!user?.id) return false;

            const { count } = await supabase
                .from('businesses')
                .select('id', { count: 'exact', head: true })
                .eq('owner_id', user.id)
                .eq('is_approved', true);

            return (count ?? 0) > 0;
        },
        enabled: !!user?.id,
    });

    const onRefresh = async () => {
        setRefreshing(true);
        await refetch();
        setRefreshing(false);
    };

    if (isLoading && !refreshing) {
        return <LoadingSpinner message="Загрузка..." />;
    }

    if (!isOwner) {
        return (
            <ScrollView style={styles.container}>
                <EmptyState
                    icon="business"
                    title="Вы не являетесь владельцем бизнеса"
                    message="Здесь будут отображаться ваши бизнесы после регистрации"
                />
            </ScrollView>
        );
    }

    return (
        <ScrollView
            style={styles.container}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
            <View style={styles.header}>
                <Text style={styles.title}>Кабинет бизнеса</Text>
                <Text style={styles.subtitle}>
                    Управление {businesses?.length === 1 ? 'бизнесом' : 'бизнесами'}
                </Text>
            </View>

            {businesses && businesses.length > 0 ? (
                <View style={styles.businessList}>
                    {businesses.map((business) => (
                        <TouchableOpacity
                            key={business.id}
                            onPress={() => {
                                // В будущем: навигация на детали бизнеса
                                // navigation.navigate('BusinessDetails', { id: business.id });
                            }}
                        >
                            <Card style={styles.businessCard}>
                                <Text style={styles.businessName}>{business.name}</Text>
                                {business.address && (
                                    <Text style={styles.businessAddress}>{business.address}</Text>
                                )}
                                {business.phones && business.phones.length > 0 && (
                                    <Text style={styles.businessPhone}>
                                        {business.phones[0]}
                                    </Text>
                                )}
                                <View style={styles.businessActions}>
                                    <Button
                                        title="Управление"
                                        onPress={() => {}}
                                        variant="outline"
                                        style={styles.actionButton}
                                    />
                                </View>
                            </Card>
                        </TouchableOpacity>
                    ))}
                </View>
            ) : (
                <EmptyState
                    icon="business"
                    title="Нет бизнесов"
                    message="Зарегистрируйте бизнес, чтобы начать управление"
                />
            )}
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
        marginBottom: 4,
    },
    subtitle: {
        fontSize: 16,
        color: '#6b7280',
    },
    businessList: {
        padding: 20,
        gap: 12,
    },
    businessCard: {
        marginBottom: 12,
    },
    businessName: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#111827',
        marginBottom: 8,
    },
    businessAddress: {
        fontSize: 14,
        color: '#6b7280',
        marginBottom: 4,
    },
    businessPhone: {
        fontSize: 14,
        color: '#6366f1',
        marginBottom: 12,
    },
    businessActions: {
        marginTop: 8,
    },
    actionButton: {
        marginTop: 0,
    },
});
