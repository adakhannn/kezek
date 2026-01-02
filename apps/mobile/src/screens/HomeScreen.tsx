import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { supabase } from '../lib/supabase';
import { MainTabParamList } from '../navigation/types';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import EmptyState from '../components/ui/EmptyState';

type HomeScreenNavigationProp = NativeStackNavigationProp<MainTabParamList, 'Home'>;

type Business = {
    id: string;
    name: string;
    slug: string;
};

export default function HomeScreen() {
    const navigation = useNavigation<HomeScreenNavigationProp>();
    const [search, setSearch] = useState('');
    const [refreshing, setRefreshing] = useState(false);

    const { data: businesses, isLoading, refetch } = useQuery({
        queryKey: ['businesses', search],
        queryFn: async () => {
            let query = supabase.from('businesses').select('id, name, slug').eq('is_active', true);

            if (search) {
                query = query.ilike('name', `%${search}%`);
            }

            const { data, error } = await query.limit(20);
            if (error) throw error;
            return data as Business[];
        },
    });

    const onRefresh = async () => {
        setRefreshing(true);
        await refetch();
        setRefreshing(false);
    };

    const handleBusinessPress = (slug: string) => {
        // @ts-ignore - типы навигации будут исправлены позже
        navigation.navigate('Booking', { slug });
    };

    return (
        <ScrollView
            style={styles.container}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
            <View style={styles.header}>
                <Text style={styles.title}>Kezek</Text>
                <Text style={styles.subtitle}>Бронирование в Оше</Text>
            </View>

            <View style={styles.searchContainer}>
                <Input
                    placeholder="Поиск бизнеса..."
                    value={search}
                    onChangeText={setSearch}
                    style={styles.searchInput}
                />
            </View>

            {isLoading && !refreshing ? (
                <LoadingSpinner message="Загрузка..." />
            ) : businesses && businesses.length > 0 ? (
                <View style={styles.businessList}>
                    {businesses.map((business) => (
                        <TouchableOpacity
                            key={business.id}
                            onPress={() => handleBusinessPress(business.slug)}
                        >
                            <Card style={styles.businessCard}>
                                <Text style={styles.businessName}>{business.name}</Text>
                            </Card>
                        </TouchableOpacity>
                    ))}
                </View>
            ) : (
                <EmptyState
                    icon="search"
                    title={search ? 'Ничего не найдено' : 'Нет доступных бизнесов'}
                    message={search ? 'Попробуйте другой запрос' : 'Бизнесы появятся здесь после регистрации'}
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
        fontSize: 32,
        fontWeight: 'bold',
        color: '#111827',
        marginBottom: 4,
    },
    subtitle: {
        fontSize: 16,
        color: '#6b7280',
    },
    searchContainer: {
        padding: 20,
    },
    searchInput: {
        marginBottom: 0,
    },
    loading: {
        textAlign: 'center',
        padding: 40,
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
        fontSize: 18,
        fontWeight: '600',
        color: '#111827',
    },
    empty: {
        padding: 40,
        alignItems: 'center',
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#374151',
        marginBottom: 8,
        textAlign: 'center',
    },
    emptyHint: {
        fontSize: 14,
        color: '#6b7280',
        textAlign: 'center',
    },
});
