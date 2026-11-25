import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { ScrollView, Text, View } from 'react-native';

import Card from '../../components/ui/Card';
import MotionPressable from '../../components/ui/MotionPressable';
import { colors } from '../../constants/colors';
import { useLanguage, type Locale, type MobileI18nKey, type Translate } from '../../i18n';
import { formatDate, formatTime } from '../../utils/format';

import { styles } from './homeScreenStyles';
import type { HomeBooking, RecentPlace } from './types';

type UpcomingBookingsSectionProps = {
    bookings: HomeBooking[];
    onOpenAll: () => void;
    onOpenBooking: (bookingId: string) => void;
};

type RecentPlacesSectionProps = {
    places: RecentPlace[];
    onOpenPlace: (slug: string, previewName?: string) => void;
};

function getBookingStatusKey(status: string): MobileI18nKey {
    if (status === 'confirmed') {
        return 'booking.home.status.confirmed';
    }

    if (status === 'hold') {
        return 'booking.home.status.hold';
    }

    if (status === 'paid') {
        return 'booking.home.status.paid';
    }

    return 'booking.home.booking';
}

export function UpcomingBookingsSection({
    bookings,
    onOpenAll,
    onOpenBooking,
}: UpcomingBookingsSectionProps) {
    const { locale, t } = useLanguage();

    if (bookings.length === 0) {
        return null;
    }

    return (
        <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>{t('booking.home.upcomingTitle')}</Text>
                <MotionPressable
                    onPress={onOpenAll}
                    style={styles.sectionLinkPressable}
                    accessibilityLabel={t('booking.home.openAllLabel')}
                    accessibilityHint={t('booking.home.openAllHint')}
                >
                    <Text style={styles.sectionLink}>{t('booking.home.openAll')}</Text>
                </MotionPressable>
            </View>

            {bookings.map((booking) => {
                const bookingLabel = buildBookingAccessibilityLabel(booking, locale, t);

                return (
                    <Card key={booking.id} style={styles.bookingCard}>
                        <MotionPressable
                            style={styles.bookingCardPressable}
                            scale="firm"
                            onPress={() => onOpenBooking(booking.id)}
                            accessibilityLabel={bookingLabel}
                            accessibilityHint={t('booking.home.openBookingHint')}
                        >
                            <View style={styles.bookingRow}>
                                <View style={styles.bookingMain}>
                                    <Text style={styles.bookingBusiness}>
                                        {booking.business?.name || t('booking.home.booking')}
                                    </Text>
                                    {booking.branch?.name ? (
                                        <Text style={styles.bookingBranch}>
                                            {booking.branch.name}
                                        </Text>
                                    ) : null}
                                    {booking.service?.name_ru ? (
                                        <Text style={styles.bookingService}>
                                            {booking.service.name_ru}
                                        </Text>
                                    ) : null}
                                </View>

                                <View style={styles.bookingMeta}>
                                    <Text style={styles.bookingDate}>
                                        {formatDate(booking.start_at, locale, booking.business?.tz)} -{' '}
                                        {formatTime(booking.start_at, booking.business?.tz)}
                                    </Text>
                                    <View style={styles.bookingStatusPill}>
                                        <Text style={styles.bookingStatusText}>
                                            {t(getBookingStatusKey(booking.status))}
                                        </Text>
                                    </View>
                                </View>
                            </View>
                        </MotionPressable>
                    </Card>
                );
            })}
        </View>
    );
}

export function RecentPlacesSection({
    places,
    onOpenPlace,
}: RecentPlacesSectionProps) {
    const { t } = useLanguage();

    if (places.length === 0) {
        return null;
    }

    return (
        <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('booking.home.recentTitle')}</Text>
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.recentPlacesRow}
            >
                {places.map((place) => (
                    <MotionPressable
                        key={place.slug}
                        style={styles.recentPlaceChip}
                        onPress={() => onOpenPlace(place.slug, place.name)}
                        accessibilityLabel={t('booking.home.recentPlaceLabel', { name: place.name })}
                        accessibilityHint={t('booking.home.openBusinessHint')}
                    >
                        <Ionicons
                            name="time-outline"
                            size={16}
                            color={colors.text.secondary}
                            style={{ marginRight: 6 }}
                            accessible={false}
                            importantForAccessibility="no"
                        />
                        <Text style={styles.recentPlaceText}>{place.name}</Text>
                    </MotionPressable>
                ))}
            </ScrollView>
        </View>
    );
}

function buildBookingAccessibilityLabel(booking: HomeBooking, locale: Locale, t: Translate): string {
    const parts = [booking.business?.name || t('booking.home.booking')];

    if (booking.branch?.name) {
        parts.push(t('booking.home.a11y.branch', { name: booking.branch.name }));
    }

    if (booking.service?.name_ru) {
        parts.push(t('booking.home.a11y.service', { name: booking.service.name_ru }));
    }

    parts.push(t('booking.home.a11y.time', {
        date: formatDate(booking.start_at, locale, booking.business?.tz),
        time: formatTime(booking.start_at, booking.business?.tz),
    }));
    parts.push(t('booking.home.a11y.status', { status: t(getBookingStatusKey(booking.status)) }));

    return parts.join('. ');
}
