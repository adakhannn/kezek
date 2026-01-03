import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import { supabase } from '../../lib/supabase';
import { useBooking } from '../../contexts/BookingContext';

type NavigationProp = NativeStackNavigationProp<any>;

export default function BookingStep3Staff() {
    const navigation = useNavigation<NavigationProp>();
    const { bookingData, setStaff, setStaffId } = useBooking();

    const { data: staffData, isLoading } = useQuery({
        queryKey: ['staff', bookingData.business?.id, bookingData.branchId],
        queryFn: async () => {
            if (!bookingData.business?.id || !bookingData.branchId) return [];

            const { data, error } = await supabase
                .from('staff')
                .select('id, full_name, branch_id')
                .eq('biz_id', bookingData.business.id)
                .eq('branch_id', bookingData.branchId)
                .eq('is_active', true)
                .order('full_name');

            if (error) throw error;
            return data || [];
        },
        enabled: !!bookingData.business?.id && !!bookingData.branchId,
    });

    useEffect(() => {
        if (staffData) {
            setStaff(staffData);
            if (staffData.length === 1) {
                setStaffId(staffData[0].id);
                setTimeout(() => {
                    // @ts-ignore
                    navigation.navigate('BookingStep4Date');
                }, 300);
            }
        }
    }, [staffData, setStaff, setStaffId, navigation]);

    const handleSelectStaff = (staffId: string) => {
        setStaffId(staffId);
        // @ts-ignore
        navigation.navigate('BookingStep4Date');
    };

    if (isLoading) {
        return (
            <View style={styles.container}>
                <Text style={styles.loadingText}>Загрузка мастеров...</Text>
            </View>
        );
    }

    if (!staffData || staffData.length === 0) {
        return (
            <View style={styles.container}>
                <View style={styles.header}>
                    <Text style={styles.title}>{bookingData.business?.name}</Text>
                    <Text style={styles.subtitle}>Шаг 3 из 5: Выберите мастера</Text>
                </View>
                <View style={styles.emptyContainer}>
                    <Ionicons name="person-outline" size={48} color="#9ca3af" />
                    <Text style={styles.emptyText}>Нет доступных мастеров</Text>
                </View>
            </View>
        );
    }

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
            <View style={styles.header}>
                <Text style={styles.title}>{bookingData.business?.name}</Text>
                <Text style={styles.subtitle}>Шаг 3 из 5: Выберите мастера</Text>
            </View>

            <View style={styles.section}>
                <View style={styles.optionsList}>
                    {staffData.map((staff) => (
                        <TouchableOpacity
                            key={staff.id}
                            style={[
                                styles.optionCard,
                                bookingData.staffId === staff.id && styles.optionCardSelected,
                            ]}
                            onPress={() => handleSelectStaff(staff.id)}
                        >
                            <View style={styles.optionContent}>
                                <View style={[
                                    styles.iconContainer,
                                    bookingData.staffId === staff.id && styles.iconContainerSelected
                                ]}>
                                    <Ionicons 
                                        name="person" 
                                        size={24} 
                                        color={bookingData.staffId === staff.id ? '#6366f1' : '#fff'} 
                                    />
                                </View>
                                <Text
                                    style={[
                                        styles.optionText,
                                        bookingData.staffId === staff.id && styles.optionTextSelected,
                                    ]}
                                >
                                    {staff.full_name}
                                </Text>
                            </View>
                            {bookingData.staffId === staff.id && (
                                <Ionicons name="checkmark-circle" size={24} color="#6366f1" />
                            )}
                        </TouchableOpacity>
                    ))}
                </View>
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

