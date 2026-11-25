import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';

import { formatTimeSlot } from '@shared-client/formatters';
import { resolveBusinessTimeZone } from '@shared-client/timezone';
import type { Slot } from '@shared-client/types';

import { useBooking } from '../../contexts/BookingContext';
import { colors } from '../../constants/colors';
import { MIN_TOUCH_TARGET } from '../../constants/accessibility';
import Button from '../../components/ui/Button';
import EmptyState from '../../components/ui/EmptyState';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import MotionPressable from '../../components/ui/MotionPressable';
import OfflineBanner from '../../components/ui/OfflineBanner';
import BookingProgressIndicator from '../../components/BookingProgressIndicator';
import { useLanguage } from '../../i18n';
import { RootStackParamList } from '../../navigation/types';
import { trackMobileEvent } from '../../lib/analytics';
import { useBookingStep5Slots } from './useBookingStep5Slots';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

/** Slot times are shown in the business's own zone (businesses.tz, ARCH-11). */

type TimeSlot = Slot & {
    start_at: string;
    staff_id: string;
    branch_id: string;
};

export default function BookingStep5Time() {
    const navigation = useNavigation<NavigationProp>();
    const { bookingData, setSelectedSlot } = useBooking();
    const tz = resolveBusinessTimeZone(bookingData.business?.tz);
    const { t } = useLanguage();
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
                        <LoadingSpinner message={t('booking.step5.loading')} size="small" />
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
                                        {formatTimeSlot(slot.start_at, tz)}
                                    </Text>
                                </MotionPressable>
                            ))}
                        </View>
                    ) : !showOfflineBanner && domainErrorMessage ? (
                        <EmptyState
                            icon="alert-circle-outline"
                            title={domainErrorMessage}
                            message={t('booking.step5.errorHint')}
                            compact
                            style={styles.noSlotsContainer}
                        />
                    ) : !showOfflineBanner ? (
                        <EmptyState
                            icon="time-outline"
                            title={t('booking.step5.emptyTitle')}
                            message={t('booking.step5.emptyMessage')}
                            compact
                            style={styles.noSlotsContainer}
                        />
                    ) : null}

                    {slots && slots.length > 0 ? (
                        <View style={styles.buttonContainer}>
                            <Button
                                title={t('booking.nav.back')}
                                onPress={() => navigation.goBack()}
                                variant="outline"
                                style={styles.backButton}
                            />
                            <Button
                                title={t('booking.nav.next')}
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
        minHeight: MIN_TOUCH_TARGET,
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

