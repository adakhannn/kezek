import { Text, View } from 'react-native';

import Card from '../../components/ui/Card';
import { formatDate, formatTime } from '../../utils/format';
import { styles } from './styles';
import type { UpcomingBooking } from './types';

export function StaffUpcomingBookingCard({ booking }: { booking: UpcomingBooking }) {
    return (
        <Card style={styles.bookingCard}>
            <Text style={styles.bookingService}>{booking.service?.name_ru || 'Услуга'}</Text>
            {booking.client_name && <Text style={styles.bookingClient}>Клиент: {booking.client_name}</Text>}
            {booking.client_phone && <Text style={styles.bookingPhone}>{booking.client_phone}</Text>}
            <View style={styles.bookingTime}>
                <Text style={styles.bookingDate}>{formatDate(booking.start_at)}</Text>
                <Text style={styles.bookingTimeRange}>
                    {formatTime(booking.start_at)} - {formatTime(booking.end_at)}
                </Text>
            </View>
        </Card>
    );
}
