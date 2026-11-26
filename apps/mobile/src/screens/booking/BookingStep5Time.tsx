import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { formatTimeSlot } from '@shared-client/formatters';
import { resolveBusinessTimeZone } from '@shared-client/timezone';
import type { Slot } from '@shared-client/types';

import { useBooking } from '../../contexts/BookingContext';
import { colors } from '../../constants/colors';
import { MIN_TOUCH_TARGET } from '../../constants/accessibility';
import { radii, space, typeScale } from '../../constants/theme';
import Button from '../../components/ui/Button';
import EmptyState from '../../components/ui/EmptyState';
import FeedbackBanner from '../../components/ui/FeedbackBanner';
import OfflineBanner from '../../components/ui/OfflineBanner';
import Section from '../../components/ui/Section';
import { SkeletonBlock } from '../../components/ui/Skeleton';
import { useLanguage } from '../../i18n';
import { RootStackParamList } from '../../navigation/types';
import { trackMobileEvent } from '../../lib/analytics';
import { ANY_STAFF } from './bookingSelection';
import { BookingContextLine, BookingStepScreen, bookingStepStyles } from './BookingStepLayout';
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
        <View style={bookingStepStyles.emptyActions}>
            <Button title={t('booking.step5.chooseOtherDate')} onPress={() => navigation.goBack()} variant="primary" fullWidth />
            <Button title={t('booking.retry')} onPress={() => void refetch()} variant="outline" fullWidth />
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

    const hasSlots = Boolean(slots && slots.length > 0);

    return (
        <BookingStepScreen
            step={5}
            back={() => navigation.goBack()}
            next={hasSlots ? {
                title: t('booking.nav.next'),
                onPress: handleNext,
                disabled: !bookingData.selectedSlot,
            } : undefined}
        >
            <BookingContextLine name={bookingData.business?.name} />

            {showOfflineBanner ? <OfflineBanner onRetry={() => refetch()} style={bookingStepStyles.banner} /> : null}

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
                    style={bookingStepStyles.banner}
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
                    style={bookingStepStyles.banner}
                />
            ) : null}

            {isLoading ? (
                <View accessibilityLabel={t('booking.step5.loading')} style={styles.grid}>
                    {Array.from({ length: 8 }, (_, index) => (
                        <SkeletonBlock key={index} width="22%" height={MIN_TOUCH_TARGET} radius={radii.md} style={styles.skeletonSlot} />
                    ))}
                </View>
            ) : hasSlots ? (
                <Section title={t('booking.progress.time')}>
                    <View style={styles.grid}>
                        {slots!.map((slot) => {
                            const master = isAny ? staffName(slot.staff_id) : null;
                            const time = formatTimeSlot(slot.start_at, tz);
                            const selected = isSelected(slot);
                            return (
                                <Pressable
                                    key={`${slot.staff_id}:${slot.start_at}`}
                                    style={({ pressed }) => [
                                        styles.slot,
                                        master ? styles.slotWide : null,
                                        selected ? styles.slotSelected : null,
                                        pressed ? styles.pressed : null,
                                    ]}
                                    onPress={() => handleSelectSlot(slot)}
                                    accessibilityRole="radio"
                                    accessibilityLabel={master ? `${time}, ${master}` : time}
                                    accessibilityState={{ selected, checked: selected }}
                                >
                                    <Text style={[styles.slotText, selected ? styles.slotTextSelected : null]}>
                                        {time}
                                    </Text>
                                    {master ? (
                                        <Text style={[styles.slotMaster, selected ? styles.slotTextSelected : null]} numberOfLines={1}>
                                            {master}
                                        </Text>
                                    ) : null}
                                </Pressable>
                            );
                        })}
                    </View>
                </Section>
            ) : !showOfflineBanner && worksElsewhere ? (
                <EmptyState
                    icon="swap-horizontal-outline"
                    title={t('booking.step5.otherBranchTitle')}
                    message={t('booking.step5.otherBranchMessage')}
                    compact
                    action={emptyActions}
                />
            ) : !showOfflineBanner && domainErrorMessage ? (
                <EmptyState
                    icon="alert-circle-outline"
                    title={domainErrorMessage}
                    message={t('booking.step5.errorHint')}
                    compact
                    action={emptyActions}
                />
            ) : !showOfflineBanner && !hasMore ? (
                <EmptyState
                    icon="time-outline"
                    title={t('booking.step5.emptyTitle')}
                    message={t('booking.step5.emptyMessage')}
                    compact
                    action={emptyActions}
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
                        fullWidth
                    />
                </View>
            ) : null}
        </BookingStepScreen>
    );
}

const styles = StyleSheet.create({
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
    skeletonSlot: { flexGrow: 1 },
    slot: {
        flexBasis: '22%',
        flexGrow: 1,
        minHeight: MIN_TOUCH_TARGET,
        paddingHorizontal: space.sm,
        paddingVertical: space.sm,
        borderRadius: radii.md,
        backgroundColor: colors.surface.card,
        borderWidth: 1,
        borderColor: colors.surface.card,
        alignItems: 'center',
        justifyContent: 'center',
    },
    slotWide: { flexBasis: '30%' },
    slotSelected: { backgroundColor: colors.accent.primary, borderColor: colors.accent.primary },
    pressed: { opacity: colors.interactive.pressedOpacity },
    slotText: { ...typeScale.bodyStrong, color: colors.text.primary, fontVariant: ['tabular-nums'] },
    slotTextSelected: { color: colors.text.light },
    slotMaster: { ...typeScale.caption, color: colors.text.secondary, maxWidth: '100%' },
    loadMore: { gap: space.sm },
    loadMoreHint: { ...typeScale.caption, color: colors.text.secondary, textAlign: 'center' },
    loadMoreError: { ...typeScale.caption, color: colors.tone.danger.fg, textAlign: 'center' },
});
