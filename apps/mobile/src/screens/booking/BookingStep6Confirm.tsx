import { KeyboardAvoidingView, Platform, View, Text, StyleSheet, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { formatTimeSlot } from '@shared-client/formatters';
import { resolveBusinessTimeZone } from '@shared-client/timezone';
import { colors } from '../../constants/colors';
import Card from '../../components/ui/Card';
import EmptyState from '../../components/ui/EmptyState';
import FeedbackBanner from '../../components/ui/FeedbackBanner';
import OfflineBanner from '../../components/ui/OfflineBanner';
import Button from '../../components/ui/Button';
import BookingProgressIndicator from '../../components/BookingProgressIndicator';
import RatingBadge from '../../components/ui/RatingBadge';
import { translatePlural, useLanguage } from '../../i18n';
import { RootStackParamList } from '../../navigation/types';
import BookingGuestForm from './BookingGuestForm';
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
    const { t } = useLanguage();
    const tz = resolveBusinessTimeZone(bookingData.business?.tz);
    const isMultiple = selectedServices.length > 1;

    if (guestBookingId) {
        return (
            <LinearGradient
                colors={[colors.background.gradient.from, colors.background.gradient.via, colors.background.gradient.to]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.gradientContainer}
            >
                <View style={[styles.container, styles.section]}>
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
                </View>
            </LinearGradient>
        );
    }

    return (
        <LinearGradient
            colors={[colors.background.gradient.from, colors.background.gradient.via, colors.background.gradient.to]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.gradientContainer}
        >
            <KeyboardAvoidingView
                style={styles.container}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
            <ScrollView
                style={styles.container}
                contentContainerStyle={styles.content}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
                automaticallyAdjustKeyboardInsets
            >
                <BookingProgressIndicator currentStep={6} />
                <View style={styles.header}>
                    <View style={styles.headerRow}>
                        <Text style={styles.title}>{bookingData.business?.name}</Text>
                        <RatingBadge rating={bookingData.business?.rating_score ?? null} />
                    </View>
                </View>

                <View style={styles.section}>
                    {isOffline && (
                        <OfflineBanner message={t('booking.step6.offline')} />
                    )}
                    <Card style={styles.summaryCard}>
                        <View style={styles.summaryRow}>
                            <Ionicons name="business-outline" size={24} color="#6366f1" />
                            <View style={styles.summaryContent}>
                                <Text style={styles.summaryLabel}>{t('booking.step6.business')}</Text>
                                <Text style={styles.summaryValue}>{bookingData.business?.name}</Text>
                            </View>
                        </View>
                        <View style={styles.summaryDivider} />
                        <View style={styles.summaryRow}>
                            <Ionicons name="cut-outline" size={24} color="#6366f1" />
                            <View style={styles.summaryContent}>
                                <Text style={styles.summaryLabel}>
                                    {isMultiple ? t('booking.step6.services') : t('booking.step6.service')}
                                </Text>
                                {selectedServices.map((service) => (
                                    <Text key={service.id} style={isMultiple ? styles.summaryItem : styles.summaryValue}>
                                        {service.name_ru}
                                    </Text>
                                ))}
                                {totalDurationMin > 0 && (
                                    <Text style={styles.summaryHint}>
                                        {translatePlural(t, 'booking.duration.minutesLong', totalDurationMin)}
                                    </Text>
                                )}
                                {priceLabel && <Text style={styles.summaryPrice}>{priceLabel}</Text>}
                            </View>
                        </View>
                        <View style={styles.summaryDivider} />
                        <View style={styles.summaryRow}>
                            <Ionicons name="person-outline" size={24} color="#6366f1" />
                            <View style={styles.summaryContent}>
                                <Text style={styles.summaryLabel}>{t('booking.step6.staff')}</Text>
                                <Text style={styles.summaryValue}>{selectedStaff?.full_name}</Text>
                                {isAnyStaff ? (
                                    <Text style={styles.summaryHint}>{t('booking.step6.anyMasterAssigned')}</Text>
                                ) : null}
                            </View>
                        </View>
                        <View style={styles.summaryDivider} />
                        <View style={styles.summaryRow}>
                            <Ionicons name="calendar-outline" size={24} color="#6366f1" />
                            <View style={styles.summaryContent}>
                                <Text style={styles.summaryLabel}>{t('booking.step6.dateTime')}</Text>
                                {dateLabel && <Text style={styles.summaryValue}>{dateLabel.dayMonth}</Text>}
                                {bookingData.selectedSlot && (
                                    <Text style={styles.summaryHint}>
                                        {formatTimeSlot(bookingData.selectedSlot.start_at, tz)}
                                    </Text>
                                )}
                            </View>
                        </View>
                    </Card>

                    {promotionNotes.length > 0 ? (
                        <FeedbackBanner
                            variant="success"
                            title={t('booking.step6.promotionTitle')}
                            message={promotionNotes.join(' · ')}
                            style={styles.promotion}
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
                            disabled={isPending || !bookingData.selectedSlot || isOffline}
                        />
                    ) : null}

                    <View style={styles.buttonContainer}>
                        <Button
                            title={t('booking.nav.back')}
                            onPress={() => navigation.goBack()}
                            variant="outline"
                            style={styles.backButton}
                        />
                        {isGuest === false ? (
                            <Button
                                title={t('booking.book')}
                                onPress={handleCreateBooking}
                                loading={isPending}
                                disabled={isPending || !bookingData.selectedSlot || isOffline}
                                variant="primary"
                                style={styles.nextButton}
                            />
                        ) : null}
                    </View>
                </View>
            </ScrollView>
            </KeyboardAvoidingView>
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
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        flexWrap: 'wrap',
    },
    title: {
        fontSize: 24,
        fontWeight: '600',
        color: colors.text.primary,
        marginBottom: 4,
        flex: 1,
    },
    section: {
        padding: 20,
    },
    summaryCard: {
        marginBottom: 20,
    },
    summaryRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 16,
        paddingVertical: 16,
    },
    summaryContent: {
        flex: 1,
    },
    summaryLabel: {
        fontSize: 12,
        fontWeight: '500',
        color: colors.text.secondary,
        marginBottom: 6,
        textTransform: 'uppercase',
    },
    summaryValue: {
        fontSize: 18,
        fontWeight: '600',
        color: colors.text.primary,
    },
    summaryItem: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.text.primary,
        marginBottom: 2,
    },
    summaryHint: {
        fontSize: 14,
        color: colors.text.secondary,
        marginTop: 4,
    },
    summaryPrice: {
        fontSize: 20,
        fontWeight: '700',
        color: '#10b981',
        marginTop: 6,
    },
    summaryDivider: {
        height: 1,
        backgroundColor: colors.border.dark,
        marginVertical: 4,
    },
    promotion: {
        marginBottom: 20,
    },
    buttonContainer: {
        marginTop: 0,
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
