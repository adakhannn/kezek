import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { formatInTimeZone } from 'date-fns-tz';
import { addMinutes } from 'date-fns';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { supabase } from '../../lib/supabase';
import { useBooking } from '../../contexts/BookingContext';
import { colors } from '../../constants/colors';
import Button from '../../components/ui/Button';
import BookingProgressIndicator from '../../components/BookingProgressIndicator';
import { RootStackParamList } from '../../navigation/types';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const TZ = 'Asia/Bishkek';

type TimeSlot = {
    start_at: string;
    staff_id: string;
    branch_id: string;
    [key: string]: unknown;
};

export default function BookingStep5Time() {
    const navigation = useNavigation<NavigationProp>();
    const { bookingData, setSelectedSlot } = useBooking();

    const { data: slots, isLoading } = useQuery<TimeSlot[]>({
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

            const all = (data || []) as TimeSlot[];
            const now = new Date();
            const minTime = addMinutes(now, 30);

            const filtered = all.filter(
                (s) =>
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

    const handleSelectSlot = (slot: TimeSlot) => {
        setSelectedSlot(slot);
    };

    const handleNext = () => {
        if (bookingData.selectedSlot) {
            // Навигация в BookingStep6Confirm находится в RootStack
            (navigation as unknown as { navigate: (screen: keyof RootStackParamList, params?: RootStackParamList[keyof RootStackParamList]) => void }).navigate('BookingStep6Confirm');
        }
    };

    return (
        <LinearGradient
            colors={[colors.background.gradient.from, colors.background.gradient.via, colors.background.gradient.to]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.gradientContainer}
        >
            <ScrollView style={styles.container} contentContainerStyle={styles.content}>
                <BookingProgressIndicator currentStep={5} />
                <View style={styles.header}>
                    <Text style={styles.title}>{bookingData.business?.name}</Text>
                </View>

            <View style={styles.section}>
                {isLoading ? (
                    <View style={styles.slotsLoadingContainer}>
                        <ActivityIndicator size="small" color="#6366f1" />
                        <Text style={styles.slotsLoadingText}>Загрузка доступного времени...</Text>
                    </View>
                ) : slots && slots.length > 0 ? (
                    <View style={styles.slotsGrid}>
                        {slots.map((slot, index) => (
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

                {slots && slots.length > 0 && (
                    <View style={styles.buttonContainer}>
                        <Button
                            title="Назад"
                            onPress={() => navigation.goBack()}
                            variant="outline"
                            style={styles.backButton}
                        />
                        <Button
                            title="Дальше"
                            onPress={handleNext}
                            disabled={!bookingData.selectedSlot}
                            variant="primary"
                            style={styles.nextButton}
                        />
                    </View>
                )}
            </View>
            </ScrollView>
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    gradientContainer: {
        flex: 1,
    },
    container: {
        flex: 1,
    },
    content: {
        paddingBottom: 40,
    },
    header: {
        padding: 20,
        paddingTop: 24,
    },
    title: {
        fontSize: 24,
        fontWeight: '600',
        color: colors.text.primary,
        marginBottom: 4,
    },
    subtitle: {
        fontSize: 16,
        color: colors.text.secondary,
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
        color: colors.text.secondary,
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
        backgroundColor: colors.background.secondary,
        borderWidth: 1,
        borderColor: colors.border.light,
        minWidth: 80,
        alignItems: 'center',
    },
    slotButtonSelected: {
        borderColor: colors.primary.from,
    },
    slotText: {
        fontSize: 15,
        fontWeight: '600',
        color: colors.text.primary,
    },
    slotTextSelected: {
        color: colors.primary.from,
    },
    noSlotsContainer: {
        padding: 40,
        alignItems: 'center',
        gap: 12,
    },
    noSlotsText: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.text.secondary,
    },
    noSlotsHint: {
        fontSize: 14,
        color: colors.text.tertiary,
        textAlign: 'center',
    },
    buttonContainer: {
        marginTop: 24,
        paddingHorizontal: 0,
        flexDirection: 'row',
        gap: 12,
    },
    backButton: {
        flex: 1,
    },
    nextButton: {
        flex: 1,
    },
});

