import { View, Text, TouchableOpacity } from 'react-native';

import Card from '../../components/ui/Card';
import { formatDate, formatTime } from '../../utils/format';

type UpcomingBooking = {
    id: string;
    start_at: string;
    status: string;
    business: {
        name: string;
        slug: string | null;
    } | null;
    branch: {
        name: string | null;
    } | null;
    service: {
        name_ru: string | null;
    } | null;
};

type Props = {
    user: unknown;
    bookings: UpcomingBooking[];
    styles: any;
    onOpenAll: () => void;
    onOpenBooking: (id: string) => void;
};

export function HomeUpcomingBookingsSection({
    user,
    bookings,
    styles,
    onOpenAll,
    onOpenBooking,
}: Props) {
    if (!user || bookings.length === 0) {
        return null;
    }

    return (
        <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>Ближайшие записи</Text>
                <TouchableOpacity onPress={onOpenAll}>
                    <Text style={styles.sectionLink}>Открыть все</Text>
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
                                    {booking.business?.name || 'Запись'}
                                </Text>
                                {booking.branch?.name && (
                                    <Text style={styles.bookingBranch}>{booking.branch.name}</Text>
                                )}
                                {booking.service?.name_ru && (
                                    <Text style={styles.bookingService}>{booking.service.name_ru}</Text>
                                )}
                            </View>
                            <View style={styles.bookingMeta}>
                                <Text style={styles.bookingDate}>
                                    {formatDate(booking.start_at)} • {formatTime(booking.start_at)}
                                </Text>
                                <View style={styles.bookingStatusPill}>
                                    <Text style={styles.bookingStatusText}>
                                        {booking.status === 'confirmed'
                                            ? 'Подтверждено'
                                            : booking.status === 'hold'
                                            ? 'Ожидает'
                                            : booking.status === 'paid'
                                            ? 'Оплачено'
                                            : 'Запись'}
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
