import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import { supabase } from '../../lib/supabase';
import { useBooking } from '../../contexts/BookingContext';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';

type RouteParams = {
    slug: string;
};

type NavigationProp = NativeStackNavigationProp<any>;
type RouteProp = RouteProp<{ params: RouteParams }, 'params'>;

export default function BookingStep1Branch() {
    const navigation = useNavigation<NavigationProp>();
    const route = useRoute<RouteProp>();
    const { slug } = route.params || {};
    const { bookingData, setBusiness, setBranches, setBranchId } = useBooking();

    const { data: businessData, isLoading } = useQuery({
        queryKey: ['business', slug],
        queryFn: async () => {
            const { data: biz, error } = await supabase
                .from('businesses')
                .select('id, name, slug')
                .eq('slug', slug)
                .eq('is_approved', true)
                .single();

            if (error) throw error;
            if (!biz) throw new Error('Бизнес не найден');

            const { data: branches, error: branchesError } = await supabase
                .from('branches')
                .select('id, name')
                .eq('biz_id', biz.id)
                .eq('is_active', true)
                .order('name');

            if (branchesError) throw branchesError;

            return {
                business: biz,
                branches: branches || [],
            };
        },
        enabled: !!slug,
    });

    useEffect(() => {
        if (businessData) {
            setBusiness(businessData.business);
            setBranches(businessData.branches);
            if (businessData.branches.length === 1) {
                // Если филиал один, автоматически выбираем его
                setBranchId(businessData.branches[0].id);
                setTimeout(() => {
                    // @ts-ignore
                    navigation.navigate('BookingStep2Service');
                }, 300);
            }
        }
    }, [businessData, setBusiness, setBranches, setBranchId, navigation]);

    const handleSelectBranch = (branchId: string) => {
        setBranchId(branchId);
        // @ts-ignore
        navigation.navigate('BookingStep2Service');
    };

    if (isLoading) {
        return (
            <View style={styles.container}>
                <Text style={styles.loadingText}>Загрузка...</Text>
            </View>
        );
    }

    if (!businessData) {
        return (
            <View style={styles.container}>
                <Text style={styles.error}>Бизнес не найден</Text>
            </View>
        );
    }

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
            <View style={styles.header}>
                <Text style={styles.title}>{businessData.business.name}</Text>
                <Text style={styles.subtitle}>Шаг 1 из 5: Выберите филиал</Text>
            </View>

            <View style={styles.section}>
                {businessData.branches.length > 0 ? (
                    <View style={styles.optionsList}>
                        {businessData.branches.map((branch) => (
                            <TouchableOpacity
                                key={branch.id}
                                style={[
                                    styles.optionCard,
                                    bookingData.branchId === branch.id && styles.optionCardSelected,
                                ]}
                                onPress={() => handleSelectBranch(branch.id)}
                            >
                                <View style={styles.optionContent}>
                                    <View style={[
                                        styles.iconContainer,
                                        bookingData.branchId === branch.id && styles.iconContainerSelected
                                    ]}>
                                        <Ionicons 
                                            name="location" 
                                            size={24} 
                                            color={bookingData.branchId === branch.id ? '#6366f1' : '#fff'} 
                                        />
                                    </View>
                                    <Text
                                        style={[
                                            styles.optionText,
                                            bookingData.branchId === branch.id && styles.optionTextSelected,
                                        ]}
                                    >
                                        {branch.name}
                                    </Text>
                                </View>
                                {bookingData.branchId === branch.id && (
                                    <Ionicons name="checkmark-circle" size={24} color="#6366f1" />
                                )}
                            </TouchableOpacity>
                        ))}
                    </View>
                ) : (
                    <View style={styles.emptyContainer}>
                        <Ionicons name="location-outline" size={48} color="#9ca3af" />
                        <Text style={styles.emptyText}>Нет доступных филиалов</Text>
                    </View>
                )}
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f9fafb',
    },
    content: {
        paddingBottom: 40,
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
    loadingText: {
        textAlign: 'center',
        padding: 40,
        color: '#6b7280',
    },
    error: {
        textAlign: 'center',
        padding: 40,
        color: '#ef4444',
        fontSize: 16,
    },
    section: {
        padding: 20,
    },
    optionsList: {
        gap: 12,
    },
    optionCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 20,
        borderRadius: 12,
        backgroundColor: '#fff',
        borderWidth: 2,
        borderColor: '#e5e7eb',
    },
    optionCardSelected: {
        borderColor: '#6366f1',
        backgroundColor: '#f0f4ff',
    },
    optionContent: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        gap: 16,
    },
    iconContainer: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#6366f1',
        justifyContent: 'center',
        alignItems: 'center',
    },
    iconContainerSelected: {
        backgroundColor: '#fff',
        borderWidth: 2,
        borderColor: '#6366f1',
    },
    optionText: {
        fontSize: 18,
        fontWeight: '500',
        color: '#111827',
        flex: 1,
    },
    optionTextSelected: {
        color: '#6366f1',
        fontWeight: '600',
    },
    emptyContainer: {
        padding: 40,
        alignItems: 'center',
        gap: 12,
    },
    emptyText: {
        fontSize: 16,
        color: '#6b7280',
    },
});

