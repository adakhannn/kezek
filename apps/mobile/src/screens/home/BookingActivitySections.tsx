import React from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import Card from '../../components/ui/Card';
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
        return 'РџРѕРґС‚РІРµСЂР¶РґРµРЅРѕ';
    }

    if (status === 'hold') {
        return 'РћР¶РёРґР°РµС‚';
    }

    if (status === 'paid') {
        return 'РћРїР»Р°С‡РµРЅРѕ';
    }

    return 'Р—Р°РїРёСЃСЊ';
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
                <Text style={styles.sectionTitle}>Р‘Р»РёР¶Р°Р№С€РёРµ Р·Р°РїРёСЃРё</Text>
                <TouchableOpacity onPress={onOpenAll}>
                    <Text style={styles.sectionLink}>РћС‚РєСЂС‹С‚СЊ РІСЃРµ</Text>
                </TouchableOpacity>
            </View>

            {bookings.map((booking) => (
                <Card key={booking.id} style={styles.bookingCard}>
                    <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={() => onOpenBooking(booking.id)}
                    >
                        <View style={styles.bookingRow}>
                            <View style={styles.bookingMain}>
                                <Text style={styles.bookingBusiness}>
                                    {booking.business?.name || 'Р—Р°РїРёСЃСЊ'}
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
                                    {formatDate(booking.start_at)} вЂў {formatTime(booking.start_at)}
                                </Text>
                                <View style={styles.bookingStatusPill}>
                                    <Text style={styles.bookingStatusText}>
                                        {getBookingStatusLabel(booking.status)}
                                    </Text>
                                </View>
                            </View>
                        </View>
                    </TouchableOpacity>
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
            <Text style={styles.sectionTitle}>РќРµРґР°РІРЅРёРµ РјРµСЃС‚Р°</Text>
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.recentPlacesRow}
            >
                {places.map((place) => (
                    <TouchableOpacity
                        key={place.slug}
                        style={styles.recentPlaceChip}
                        activeOpacity={0.7}
                        onPress={() => onOpenPlace(place.slug)}
                    >
                        <Ionicons
                            name="time-outline"
                            size={16}
                            color={colors.text.secondary}
                            style={{ marginRight: 6 }}
                        />
                        <Text style={styles.recentPlaceText}>{place.name}</Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>
        </View>
    );
}
