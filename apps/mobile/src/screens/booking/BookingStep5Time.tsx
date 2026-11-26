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
import FeedbackBanner from '../../components/ui/FeedbackBanner';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import MotionPressable from '../../components/ui/MotionPressable';
import OfflineBanner from '../../components/ui/OfflineBanner';
import BookingProgressIndicator from '../../components/BookingProgressIndicator';
import { useLanguage } from '../../i18n';
import { RootStackParamList } from '../../navigation/types';
import { trackMobileEvent } from '../../lib/analytics';
import { ANY_STAFF } from './bookingSelection';
import { useBookingSessionUser } from './useBookingSessionUser';
import { useBookingStep5Slots } from './useBookingStep5Slots';
import { useClientDayBookings } from './useClientDayBookings';

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
    const {
        slots,
        domainErrorMessage,
        isLoading,
        refetch,
        showOfflineBanner,
        hasMore,
        loadMore,
        loadingMore,
        loadMoreFailed,
        worksElsewhere,
    } = useBookingStep5Slots(bookingData);
    const isAny = bookingData.staffId === ANY_STAFF;
    const { userId } = useBookingSessionUser();
    const dayBookings = useClientDayBookings({
        bizId: bookingData.business?.id,
        day: bookingData.selectedDate,
        timeZone: bookingData.business?.tz,
        userId,
    });
    const dayBookingsCount = dayBookings.data ?? 0;
    const staffName = (staffId: string) =>
        bookingData.staff.find((person) => person.id === staffId)?.full_name ?? null;
    const isSelected = (slot: TimeSlot) =>
        bookingData.selectedSlot?.start_at === slot.start_at && bookingData.selectedSlot?.staff_id === slot.staff_id;

    // No time this day (or the master works elsewhere, or the check failed): offer the way out on
    // the screen itself, as the web step does (another date, retry), not only the header arrow.
    const emptyActions = (
        <View style={styles.emptyActions}>
            <Button title={t('booking.step5.chooseOtherDate')} onPress={() => navigation.goBack()} variant="primary" />
            <Button title={t('booking.retry')} onPress={() => void refetch()} variant="outline" />
        </View>
    );

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

                    {/* C8: a reminder only; another booking on the same day is still allowed (web SlotPicker). */}
                    {userId && dayBookingsCount > 0 ? (
                        <FeedbackBanner
                            variant="warning"
                            title={t('booking.existingBookings.title')}
                            message={
                                dayBookingsCount === 1
                                    ? t('booking.existingBookings.single')
                                    : t('booking.existingBookings.several', { count: dayBookingsCount })
                            }
                            style={styles.banner}
                        />
                    ) : null}
                    {userId && dayBookings.isError ? (
                        <FeedbackBanner
                            variant="warning"
                            compact
                            title={t('booking.existingBookings.checkFailedTitle')}
                            message={t('booking.existingBookings.checkFailed')}
                            action={
                                <Button
                                    title={t('booking.retry')}
                                    onPress={() => {
                                        void dayBookings.refetch();
                                    }}
                                    loading={dayBookings.isFetching}
                                    variant="outline"
                                    size="sm"
                                />
                            }
                            style={styles.banner}
                        />
                    ) : null}

                    {isLoading ? (
                        <LoadingSpinner message={t('booking.step5.loading')} size="small" />
                    ) : slots && slots.length > 0 ? (
                        <View style={styles.slotsGrid}>
                            {slots.map((slot) => {
                                const master = isAny ? staffName(slot.staff_id) : null;
                                const time = formatTimeSlot(slot.start_at, tz);
                                return (
                                    <MotionPressable
                                        key={`${slot.staff_id}:${slot.start_at}`}
                                        style={[styles.slotButton, isSelected(slot) && styles.slotButtonSelected]}
                                        onPress={() => handleSelectSlot(slot)}
                                        accessibilityLabel={master ? `${time}, ${master}` : time}
                                        accessibilityState={{ selected: isSelected(slot) }}
                                    >
                                        <Text style={[styles.slotText, isSelected(slot) && styles.slotTextSelected]}>
                                            {time}
                                        </Text>
                                        {master ? (
                                            <Text style={styles.slotMaster} numberOfLines={1}>
                                                {master}
                                            </Text>
                                        ) : null}
                                    </MotionPressable>
                                );
                            })}
                        </View>
                    ) : !showOfflineBanner && worksElsewhere ? (
                        <EmptyState
                            icon="swap-horizontal-outline"
                            title={t('booking.step5.otherBranchTitle')}
                            message={t('booking.step5.otherBranchMessage')}
                            compact
                            action={emptyActions}
                            style={styles.noSlotsContainer}
                        />
                    ) : !showOfflineBanner && domainErrorMessage ? (
                        <EmptyState
                            icon="alert-circle-outline"
                            title={domainErrorMessage}
                            message={t('booking.step5.errorHint')}
                            compact
                            action={emptyActions}
                            style={styles.noSlotsContainer}
                        />
                    ) : !showOfflineBanner && !hasMore ? (
                        <EmptyState
                            icon="time-outline"
                            title={t('booking.step5.emptyTitle')}
                            message={t('booking.step5.emptyMessage')}
                            compact
                            action={emptyActions}
                            style={styles.noSlotsContainer}
                        />
                    ) : null}

                    {!isLoading && hasMore ? (
                        <View style={styles.loadMore}>
                            <Text style={styles.loadMoreHint}>{t('booking.step5.partial')}</Text>
                            {loadMoreFailed ? (
                                <Text style={styles.loadMoreError} accessibilityLiveRegion="polite">
                                    {t('booking.step5.loadMoreFailed')}
                                </Text>
                            ) : null}
                            <Button
                                title={t('booking.step5.loadMore')}
                                onPress={loadMore}
                                loading={loadingMore}
                                variant="outline"
                            />
                        </View>
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
    slotMaster: {
        marginTop: 2,
        fontSize: 11,
        color: colors.text.secondary,
        maxWidth: 120,
    },
    banner: {
        marginBottom: 16,
    },
    loadMore: {
        marginTop: 16,
        gap: 8,
    },
    loadMoreHint: {
        fontSize: 13,
        color: colors.text.secondary,
    },
    loadMoreError: {
        fontSize: 13,
        color: colors.status.danger,
    },
    emptyActions: {
        gap: 10,
        alignSelf: 'stretch',
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

