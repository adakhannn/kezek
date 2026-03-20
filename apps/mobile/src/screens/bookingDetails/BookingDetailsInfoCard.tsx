import { Text, View } from 'react-native';

import Card from '../../components/ui/Card';
import { formatDate, formatTime } from '../../utils/format';
import { getStatusColor, getStatusText } from '../../utils/i18n';
import type { BookingDetails } from './types';
import { getBookingTimelineSteps } from './timeline';
import { styles } from './styles';

export function BookingDetailsInfoCard({ booking }: { booking: BookingDetails }) {
    const timelineSteps = getBookingTimelineSteps(booking.status, false);

    return (
        <Card style={styles.card}>
            <View style={styles.header}>
                <Text style={styles.serviceName}>{booking.service?.name_ru || 'Услуга'}</Text>
                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(booking.status) }]}>
                    <Text style={styles.statusText}>{getStatusText(booking.status)}</Text>
                </View>
            </View>

            {booking.business && (
                <View style={styles.section}>
                    <Text style={styles.label}>Бизнес</Text>
                    <Text style={styles.value}>{booking.business.name}</Text>
                    {booking.business.phones && booking.business.phones.length > 0 && (
                        <Text style={styles.phone}>{booking.business.phones[0]}</Text>
                    )}
                </View>
            )}

            {booking.staff && (
                <View style={styles.section}>
                    <Text style={styles.label}>Мастер</Text>
                    <Text style={styles.value}>{booking.staff.full_name}</Text>
                </View>
            )}

            {booking.branch && (
                <View style={styles.section}>
                    <Text style={styles.label}>Филиал</Text>
                    <Text style={styles.value}>{booking.branch.name}</Text>
                    {booking.branch.address && <Text style={styles.address}>{booking.branch.address}</Text>}
                </View>
            )}

            <View style={styles.timelineSection}>
                <Text style={styles.label}>Статус</Text>
                <View style={styles.timelineRow}>
                    {timelineSteps.map((step, index) => (
                        <View key={step.key} style={styles.timelineStep}>
                            <View style={[styles.timelineDot, step.done && styles.timelineDotDone]}>
                                {step.done && <Text style={styles.timelineDotText}>✓</Text>}
                            </View>
                            <Text style={styles.timelineLabel}>{step.label}</Text>
                            {index < timelineSteps.length - 1 && <View style={styles.timelineConnector} />}
                        </View>
                    ))}
                </View>
            </View>

            <View style={styles.section}>
                <Text style={styles.label}>Дата и время</Text>
                <Text style={styles.value}>{formatDate(booking.start_at)}</Text>
                <Text style={styles.time}>
                    {formatTime(booking.start_at)} - {formatTime(booking.end_at)}
                </Text>
                {booking.service?.duration_min && (
                    <Text style={styles.duration}>Продолжительность: {booking.service.duration_min} мин.</Text>
                )}
            </View>

            {booking.service && (booking.service.price_from || booking.service.price_to) && (
                <View style={styles.section}>
                    <Text style={styles.label}>Стоимость</Text>
                    <Text style={styles.price}>
                        {booking.service.price_from && booking.service.price_to
                            ? `${booking.service.price_from} - ${booking.service.price_to} сом`
                            : booking.service.price_from
                              ? `от ${booking.service.price_from} сом`
                              : booking.service.price_to
                                ? `до ${booking.service.price_to} сом`
                                : ''}
                    </Text>
                </View>
            )}
        </Card>
    );
}
