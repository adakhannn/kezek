import { Text, TouchableOpacity, View } from 'react-native';

import Card from '../../components/ui/Card';
import { getStatusColor, getStatusText } from '../../utils/i18n';
import { formatDate, formatTime } from '../../utils/format';
import type { Booking } from './types';
import { styles } from './styles';

export function CabinetBookingCard({
    booking,
    onPress,
}: {
    booking: Booking;
    onPress: (bookingId: string) => void;
}) {
    return (
        <TouchableOpacity onPress={() => onPress(booking.id)}>
            <Card style={styles.bookingCard}>
                <View style={styles.bookingHeader}>
                    <Text style={styles.bookingService}>{booking.service?.name_ru || 'Услуга'}</Text>
                    <View style={[styles.statusBadge, { backgroundColor: getStatusColor(booking.status) }]}>
                        <Text style={styles.statusText}>{getStatusText(booking.status)}</Text>
                    </View>
                </View>

                {booking.business && <Text style={styles.bookingBusiness}>{booking.business.name}</Text>}
                {booking.staff && <Text style={styles.bookingStaff}>Мастер: {booking.staff.full_name}</Text>}
                {booking.branch && (
                    <Text style={styles.bookingBranch}>
                        {booking.branch.name}
                        {booking.branch.address && ` • ${booking.branch.address}`}
                    </Text>
                )}

                <View style={styles.bookingTime}>
                    <Text style={styles.bookingDate}>{formatDate(booking.start_at)}</Text>
                    <Text style={styles.bookingTimeRange}>
                        {formatTime(booking.start_at)} - {formatTime(booking.end_at)}
                    </Text>
                </View>
            </Card>
        </TouchableOpacity>
    );
}
