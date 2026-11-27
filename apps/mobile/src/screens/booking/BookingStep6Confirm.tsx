import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import { formatTimeSlot } from '@shared-client/formatters';
import { resolveBusinessTimeZone } from '@shared-client/timezone';
import { colors } from '../../constants/colors';
import { radii, space, typeScale } from '../../constants/theme';
import Button from '../../components/ui/Button';
import EmptyState from '../../components/ui/EmptyState';
import FeedbackBanner from '../../components/ui/FeedbackBanner';
import { ListGroup } from '../../components/ui/ListRow';
import OfflineBanner from '../../components/ui/OfflineBanner';
import RatingBadge from '../../components/ui/RatingBadge';
import Screen from '../../components/ui/Screen';
import { translatePlural, useLanguage } from '../../i18n';
import { RootStackParamList } from '../../navigation/types';
import { getServiceName } from '../../utils/i18n';
import BookingGuestForm from './BookingGuestForm';
import { BookingStepScreen, bookingStepStyles } from './BookingStepLayout';
import { useBookingStep6Confirm } from './useBookingStep6Confirm';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

/** Slot times are shown in the business's own zone (businesses.tz, ARCH-11). */

export default function BookingStep6Confirm() {
    const navigation = useNavigation<NavigationProp>();
    const {
        bookingData,
        selectedServices,
        totalDurationMin,
        selectedStaff,
        isAnyStaff,
        dateLabel,
        priceLabel,
        promotionNotes,
        handleCreateBooking,
        isOffline,
        isPending,
        isGuest,
        guestContacts,
        updateGuestContacts,
        guestError,
        handleCreateGuestBooking,
        guestBookingId,
        finishGuestBooking,
        signInInstead,
    } = useBookingStep6Confirm(navigation);
    const selectedBranch = bookingData.branches.find((branch) => branch.id === bookingData.branchId);
    const { t } = useLanguage();
    const tz = resolveBusinessTimeZone(bookingData.business?.tz);
    const isMultiple = selectedServices.length > 1;
    const blocked = isPending || !bookingData.selectedSlot || isOffline;

    if (guestBookingId) {
        return (
            <Screen>
                <EmptyState
                    icon="checkmark-circle-outline"
                    title={t('booking.guest.successTitle')}
                    message={t('booking.guest.successMessage')}
                    action={
                        <Button
                            title={t('booking.guest.done')}
                            onPress={finishGuestBooking}
                            variant="primary"
                            fullWidth
                        />
                    }
                />
            </Screen>
        );
    }

    // The account state decides the action: book (signed in) or book as a guest (C1).
    const next = isGuest === true
        ? { title: t('booking.guest.book'), onPress: handleCreateGuestBooking, loading: isPending, disabled: blocked }
        : isGuest === false
            ? { title: t('booking.book'), onPress: handleCreateBooking, loading: isPending, disabled: blocked }
            : undefined;

    return (
        <BookingStepScreen step={6} keyboard back={() => navigation.goBack()} next={next}>
            {isOffline ? (
                <OfflineBanner message={t('booking.step6.offline')} style={bookingStepStyles.banner} />
            ) : null}

            <ListGroup inset>
                <SummaryRow icon="business-outline" label={t('booking.step6.business')}>
                    <View style={styles.inline}>
                        <Text style={styles.value} numberOfLines={2}>{bookingData.business?.name}</Text>
                        <RatingBadge rating={bookingData.business?.rating_score ?? null} size="small" />
                    </View>
                    {/* Which branch and where: a business can have several. */}
                    {selectedBranch ? (
                        <Text style={styles.hint}>
                            {[selectedBranch.name, selectedBranch.address?.trim()].filter(Boolean).join(' · ')}
                        </Text>
                    ) : null}
                </SummaryRow>
                <SummaryRow
                    icon="cut-outline"
                    label={isMultiple ? t('booking.step6.services') : t('booking.step6.service')}
                >
                    {selectedServices.map((service) => (
                        <Text key={service.id} style={styles.value}>
                            {getServiceName(service, t.locale)}
                        </Text>
                    ))}
                    {totalDurationMin > 0 || priceLabel ? (
                        <View style={styles.inline}>
                            {totalDurationMin > 0 ? (
                                <Text style={styles.hint}>
                                    {translatePlural(t, 'booking.duration.minutesLong', totalDurationMin)}
                                </Text>
                            ) : null}
                            {priceLabel ? <Text style={styles.price}>{priceLabel}</Text> : null}
                        </View>
                    ) : null}
                </SummaryRow>
                <SummaryRow icon="person-outline" label={t('booking.step6.staff')}>
                    <Text style={styles.value}>{selectedStaff?.full_name}</Text>
                    {isAnyStaff ? <Text style={styles.hint}>{t('booking.step6.anyMasterAssigned')}</Text> : null}
                </SummaryRow>
                <SummaryRow icon="calendar-outline" label={t('booking.step6.dateTime')}>
                    {dateLabel ? <Text style={styles.value}>{`${dateLabel.weekday}, ${dateLabel.dayMonth}`}</Text> : null}
                    {bookingData.selectedSlot ? (
                        <Text style={styles.time}>
                            {`${formatTimeSlot(bookingData.selectedSlot.start_at, tz)}–${formatTimeSlot(bookingData.selectedSlot.end_at, tz)}`}
                        </Text>
                    ) : null}
                </SummaryRow>
            </ListGroup>

            {promotionNotes.length > 0 ? (
                <FeedbackBanner
                    variant="success"
                    title={t('booking.step6.promotionTitle')}
                    message={promotionNotes.join(' · ')}
                    style={bookingStepStyles.banner}
                />
            ) : null}

            {isGuest ? (
                <BookingGuestForm
                    contacts={guestContacts}
                    onChange={updateGuestContacts}
                    error={guestError}
                    onSubmit={handleCreateGuestBooking}
                    onSignIn={signInInstead}
                    submitting={isPending}
                    disabled={blocked}
                />
            ) : null}
        </BookingStepScreen>
    );
}

function SummaryRow({ icon, label, children }: { icon: keyof typeof Ionicons.glyphMap; label: string; children: ReactNode }) {
    return (
        <View style={styles.row}>
            <View style={styles.icon}>
                <Ionicons name={icon} size={18} color={colors.tone.accent.fg} />
            </View>
            <View style={styles.body}>
                <Text style={styles.label}>{label}</Text>
                {children}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md, paddingVertical: space.md },
    icon: {
        width: 36,
        height: 36,
        borderRadius: radii.md,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.tone.accent.bg,
    },
    body: { flex: 1, minWidth: 0, gap: space.xxs },
    label: { ...typeScale.caption, color: colors.text.secondary },
    value: { ...typeScale.bodyStrong, color: colors.text.primary },
    inline: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.sm },
    hint: { ...typeScale.caption, color: colors.text.secondary },
    price: { ...typeScale.bodyStrong, color: colors.tone.accent.fg },
    time: { ...typeScale.headline, color: colors.tone.accent.fg },
});
