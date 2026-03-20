import { Text, View } from 'react-native';

import type { Booking } from './types';
import { CabinetBookingCard } from './CabinetBookingCard';
import { styles } from './styles';

export function CabinetBookingListSection({
    bookings,
    emptyText,
    emptyHint,
    onBookingPress,
}: {
    bookings: Booking[];
    emptyText: string;
    emptyHint: string;
    onBookingPress: (bookingId: string) => void;
}) {
    if (bookings.length === 0) {
        return (
            <View style={styles.empty}>
                <Text style={styles.emptyText}>{emptyText}</Text>
                <Text style={styles.emptyHint}>{emptyHint}</Text>
            </View>
        );
    }

    return (
        <View style={styles.bookingsList}>
            {bookings.map((booking) => (
                <CabinetBookingCard key={booking.id} booking={booking} onPress={onBookingPress} />
            ))}
        </View>
    );
}
