import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import Card from '../../components/ui/Card';
import MotionPressable from '../../components/ui/MotionPressable';
import { colors } from '../../constants/colors';
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
    onOpenPlace: (slug: string) => void;
};

function getBookingStatusLabel(status: string) {
    if (status === 'confirmed') {
        return 'Подтверждено';
    }

    if (status === 'hold') {
        return 'Ожидает';
    }

    if (status === 'paid') {
        return 'Оплачено';
    }

    return 'Запись';
}

export function UpcomingBookingsSection({
    bookings,
    onOpenAll,
    onOpenBooking,
}: UpcomingBookingsSectionProps) {
    if (bookings.length === 0) {
        return null;
    }

    return (
        <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>Ближайшие записи</Text>
                <MotionPressable onPress={onOpenAll} style={styles.sectionLinkPressable}>
                    <Text style={styles.sectionLink}>Открыть все</Text>
                </MotionPressable>
            </View>

            {bookings.map((booking) => (
                <Card key={booking.id} style={styles.bookingCard}>
                    <MotionPressable
                        style={styles.bookingCardPressable}
                        scale="firm"
                        onPress={() => onOpenBooking(booking.id)}
                    >
                        <View style={styles.bookingRow}>
                            <View style={styles.bookingMain}>
                                <Text style={styles.bookingBusiness}>
                                    {booking.business?.name || 'Запись'}
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
                                    {formatDate(booking.start_at)} • {formatTime(booking.start_at)}
                                </Text>
                                <View style={styles.bookingStatusPill}>
                                    <Text style={styles.bookingStatusText}>
                                        {getBookingStatusLabel(booking.status)}
                                    </Text>
                                </View>
                            </View>
                        </View>
                    </MotionPressable>
                </Card>
            ))}
        </View>
    );
}

export function RecentPlacesSection({
    places,
    onOpenPlace,
}: RecentPlacesSectionProps) {
    if (places.length === 0) {
        return null;
    }

    return (
        <View style={styles.section}>
            <Text style={styles.sectionTitle}>Недавние места</Text>
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.recentPlacesRow}
            >
                {places.map((place) => (
                    <MotionPressable
                        key={place.slug}
                        style={styles.recentPlaceChip}
                        onPress={() => onOpenPlace(place.slug)}
                    >
                        <Ionicons
                            name="time-outline"
                            size={16}
                            color={colors.text.secondary}
                            style={{ marginRight: 6 }}
                        />
                        <Text style={styles.recentPlaceText}>{place.name}</Text>
                    </MotionPressable>
                ))}
            </ScrollView>
        </View>
    );
}

