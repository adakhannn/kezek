import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';

import { formatTimeSlot } from '@shared-client/formatters';
import type { Slot } from '@shared-client/types';

import { useBooking } from '../../contexts/BookingContext';
import { colors } from '../../constants/colors';
import Button from '../../components/ui/Button';
import EmptyState from '../../components/ui/EmptyState';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import MotionPressable from '../../components/ui/MotionPressable';
import OfflineBanner from '../../components/ui/OfflineBanner';
import BookingProgressIndicator from '../../components/BookingProgressIndicator';
import { RootStackParamList } from '../../navigation/types';
import { trackMobileEvent } from '../../lib/analytics';
import { useBookingStep5Slots } from './useBookingStep5Slots';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const TZ = 'Asia/Bishkek';

type TimeSlot = Slot & {
    start_at: string;
    staff_id: string;
    branch_id: string;
};

export default function BookingStep5Time() {
    const navigation = useNavigation<NavigationProp>();
    const { bookingData, setSelectedSlot } = useBooking();
    const { slots, domainErrorMessage, isLoading, refetch, showOfflineBanner } =
        useBookingStep5Slots(bookingData);

    const handleSelectSlot = (slot: TimeSlot) => {
        setSelectedSlot(slot);
        if (bookingData.business?.id) {
            trackMobileEvent({
                eventType: 'booking_flow_step',
                bizId: bookingData.business.id,
                branchId: bookingData.branchId ?? undefined,
                bookingId: undefined,
                metadata: { step: 'slot' },
            });
        }
    };

    const handleNext = () => {
        if (bookingData.selectedSlot) {
            navigation.navigate('BookingStep6Confirm');
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
                    {showOfflineBanner ? <OfflineBanner onRetry={() => refetch()} /> : null}

                    {isLoading ? (
                        <LoadingSpinner message="Загрузка доступного времени..." size="small" />
                    ) : slots && slots.length > 0 ? (
                        <View style={styles.slotsGrid}>
                            {slots.map((slot, index: number) => (
                                <MotionPressable
                                    key={index}
                                    style={[
                                        styles.slotButton,
                                        bookingData.selectedSlot?.start_at === slot.start_at &&
                                            styles.slotButtonSelected,
                                    ]}
                                    onPress={() => handleSelectSlot(slot)}
                                >
                                    <Text
                                        style={[
                                            styles.slotText,
                                            bookingData.selectedSlot?.start_at === slot.start_at &&
                                                styles.slotTextSelected,
                                        ]}
                                    >
                                        {formatTimeSlot(slot.start_at, TZ)}
                                    </Text>
                                </MotionPressable>
                            ))}
                        </View>
                    ) : !showOfflineBanner && domainErrorMessage ? (
                        <EmptyState
                            icon="alert-circle-outline"
                            title={domainErrorMessage}
                            message="Попробуйте выбрать другую дату или обновить список."
                            compact
                            style={styles.noSlotsContainer}
                        />
                    ) : !showOfflineBanner ? (
                        <EmptyState
                            icon="time-outline"
                            title="Нет доступного времени"
                            message="Попробуйте выбрать другую дату."
                            compact
                            style={styles.noSlotsContainer}
                        />
                    ) : null}

                    {slots && slots.length > 0 ? (
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
                    ) : null}
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
    section: {
        padding: 20,
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
        paddingHorizontal: 0,
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

