import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { formatInTimeZone } from 'date-fns-tz';
import { addMinutes } from 'date-fns';
import { Ionicons } from '@expo/vector-icons';

import { supabase } from '../../lib/supabase';
import { useBooking } from '../../contexts/BookingContext';

type NavigationProp = NativeStackNavigationProp<any>;

const TZ = 'Asia/Bishkek';

export default function BookingStep5Time() {
    const navigation = useNavigation<NavigationProp>();
    const { bookingData, setSelectedSlot } = useBooking();

    const { data: slots, isLoading } = useQuery({
        queryKey: ['slots', bookingData.business?.id, bookingData.serviceId, bookingData.selectedDate, bookingData.staffId, bookingData.branchId],
        queryFn: async () => {
            if (!bookingData.business?.id || !bookingData.serviceId || !bookingData.selectedDate || !bookingData.staffId || !bookingData.branchId) {
                return [];
            }

            const { data, error } = await supabase.rpc('get_free_slots_service_day_v2', {
                p_biz_id: bookingData.business.id,
                p_service_id: bookingData.serviceId,
                p_day: bookingData.selectedDate,
                p_per_staff: 400,
                p_step_min: 15,
            });

            if (error) throw error;

            const all = data || [];
            const now = new Date();
            const minTime = addMinutes(now, 30);

            const filtered = all.filter(
                (s: any) =>
                    s.staff_id === bookingData.staffId &&
                    s.branch_id === bookingData.branchId &&
                    new Date(s.start_at) > minTime
            );

            return filtered;
        },
        enabled: !!bookingData.business?.id && !!bookingData.serviceId && !!bookingData.staffId && !!bookingData.branchId && !!bookingData.selectedDate,
    });

    const formatTimeSlot = (dateString: string) => {
        const date = new Date(dateString);
        return formatInTimeZone(date, TZ, 'HH:mm');
    };

    const handleSelectSlot = (slot: any) => {
        setSelectedSlot(slot);
        // @ts-ignore
        navigation.navigate('BookingStep6Confirm');
    };

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
            <View style={styles.header}>
                <Text style={styles.title}>{bookingData.business?.name}</Text>
                <Text style={styles.subtitle}>Шаг 5 из 5: Выберите время</Text>
            </View>

            <View style={styles.section}>
                {isLoading ? (
                    <View style={styles.slotsLoadingContainer}>
                        <ActivityIndicator size="small" color="#6366f1" />
                        <Text style={styles.slotsLoadingText}>Загрузка доступного времени...</Text>
                    </View>
                ) : slots && slots.length > 0 ? (
                    <View style={styles.slotsGrid}>
                        {slots.map((slot: any, index: number) => (
                            <TouchableOpacity
                                key={index}
                                style={[
                                    styles.slotButton,
                                    bookingData.selectedSlot?.start_at === slot.start_at && styles.slotButtonSelected,
                                ]}
                                onPress={() => handleSelectSlot(slot)}
                            >
                                <Text
                                    style={[
                                        styles.slotText,
                                        bookingData.selectedSlot?.start_at === slot.start_at && styles.slotTextSelected,
                                    ]}
                                >
                                    {formatTimeSlot(slot.start_at)}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                ) : (
                    <View style={styles.noSlotsContainer}>
                        <Ionicons name="time-outline" size={48} color="#9ca3af" />
                        <Text style={styles.noSlotsText}>Нет доступного времени</Text>
                        <Text style={styles.noSlotsHint}>Попробуйте выбрать другую дату</Text>
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
    section: {
        padding: 20,
    },
    slotsLoadingContainer: {
        padding: 40,
        alignItems: 'center',
        gap: 12,
    },
    slotsLoadingText: {
        fontSize: 14,
        color: '#6b7280',
    },
    slotsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
    },
    slotButton: {
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 10,
        backgroundColor: '#fff',
        borderWidth: 2,
        borderColor: '#e5e7eb',
        minWidth: 80,
        alignItems: 'center',
    },
    slotButtonSelected: {
        backgroundColor: '#6366f1',
        borderColor: '#6366f1',
    },
    slotText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#374151',
    },
    slotTextSelected: {
        color: '#fff',
    },
    noSlotsContainer: {
        padding: 40,
        alignItems: 'center',
        gap: 12,
    },
    noSlotsText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#374151',
    },
    noSlotsHint: {
        fontSize: 14,
        color: '#6b7280',
        textAlign: 'center',
    },
});

