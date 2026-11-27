import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { StatusPill } from '../../components/ui/Badge';
import { ListGroup } from '../../components/ui/ListRow';
import MotionPressable from '../../components/ui/MotionPressable';
import Section from '../../components/ui/Section';
import { colors } from '../../constants/colors';
import type { Tone } from '../../constants/theme';
import { useLanguage, type Locale, type MobileI18nKey, type Translate } from '../../i18n';
import { formatDate, formatTime } from '../../utils/format';
import { getServiceName } from '../../utils/i18n';

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

function getBookingStatusTone(status: string): Tone {
    if (status === 'confirmed' || status === 'paid') return 'success';
    if (status === 'hold') return 'warning';
    return 'neutral';
}

/** The next visits as rows of one group: place, service and branch, then time and state. */
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
        <Section
            title={t('booking.home.upcomingTitle')}
            right={(
                <Pressable
                    onPress={onOpenAll}
                    hitSlop={8}
                    style={({ pressed }) => [styles.sectionAction, pressed ? styles.pressed : null]}
                    accessibilityRole="button"
                    accessibilityLabel={t('booking.home.openAllLabel')}
                    accessibilityHint={t('booking.home.openAllHint')}
                >
                    <Text style={styles.sectionActionText}>{t('booking.home.openAll')}</Text>
                </Pressable>
            )}
        >
            <ListGroup>
                {bookings.map((booking) => {
                    const serviceName = getServiceName(booking.service, locale);
                    const meta = [serviceName, booking.branch?.name].filter(Boolean).join(' · ');

                    return (
                        <Pressable
                            key={booking.id}
                            style={({ pressed }) => [styles.bookingRow, pressed ? styles.pressed : null]}
                            onPress={() => onOpenBooking(booking.id)}
                            accessibilityRole="button"
                            accessibilityLabel={buildBookingAccessibilityLabel(booking, locale, t)}
                            accessibilityHint={t('booking.home.openBookingHint')}
                        >
                            <View style={styles.bookingDay}>
                                <Ionicons name="calendar-outline" size={20} color={colors.tone.accent.fg} />
                            </View>
                            <View style={styles.bookingMain}>
                                <Text style={styles.bookingTitle} numberOfLines={1}>
                                    {booking.business?.name || t('booking.home.booking')}
                                </Text>
                                <Text style={styles.bookingWhen} numberOfLines={1}>
                                    {formatDate(booking.start_at, locale, booking.business?.tz)} • {formatTime(booking.start_at, booking.business?.tz)}
                                </Text>
                                {meta ? <Text style={styles.bookingMeta} numberOfLines={1}>{meta}</Text> : null}
                            </View>
                            <View style={styles.bookingSide}>
                                <StatusPill label={t(getBookingStatusKey(booking.status))} tone={getBookingStatusTone(booking.status)} />
                            </View>
                        </Pressable>
                    );
                })}
            </ListGroup>
        </Section>
    );
}

/** Places opened before, as one line of pills that scrolls sideways. */
export function RecentPlacesSection({
    places,
    onOpenPlace,
}: RecentPlacesSectionProps) {
    const { t } = useLanguage();

    if (places.length === 0) {
        return null;
    }

    return (
        <Section title={t('booking.home.recentTitle')}>
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.bleedRow}
                contentContainerStyle={styles.bleedContent}
            >
                {places.map((place) => (
                    <MotionPressable
                        key={place.slug}
                        style={styles.placeChip}
                        onPress={() => onOpenPlace(place.slug, place.name)}
                        accessibilityRole="button"
                        accessibilityLabel={t('booking.home.recentPlaceLabel', { name: place.name })}
                        accessibilityHint={t('booking.home.openBusinessHint')}
                    >
                        <Ionicons
                            name="time-outline"
                            size={16}
                            color={colors.text.secondary}
                            accessible={false}
                            importantForAccessibility="no"
                        />
                        <Text style={styles.placeChipText} numberOfLines={1}>{place.name}</Text>
                    </MotionPressable>
                ))}
            </ScrollView>
        </Section>
    );
}

function buildBookingAccessibilityLabel(booking: HomeBooking, locale: Locale, t: Translate): string {
    const parts = [booking.business?.name || t('booking.home.booking')];

    if (booking.branch?.name) {
        parts.push(t('booking.home.a11y.branch', { name: booking.branch.name }));
    }

    const serviceName = getServiceName(booking.service, locale);
    if (serviceName) {
        parts.push(t('booking.home.a11y.service', { name: serviceName }));
    }

    parts.push(t('booking.home.a11y.time', {
        date: formatDate(booking.start_at, locale, booking.business?.tz),
        time: formatTime(booking.start_at, booking.business?.tz),
    }));
    parts.push(t('booking.home.a11y.status', { status: t(getBookingStatusKey(booking.status)) }));

    return parts.join('. ');
}
