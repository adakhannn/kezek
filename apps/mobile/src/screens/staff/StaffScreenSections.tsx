import { RefreshControl, ScrollView, Text, View } from 'react-native';

import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import EmptyState from '../../components/ui/EmptyState';
import { formatDate, formatTime } from '../../utils/format';
import { styles } from './staffScreenStyles';
import type { StaffInfo, UpcomingBooking } from './types';

type Props = {
    staffInfo: StaffInfo;
    upcomingBookings: UpcomingBooking[];
    refreshing: boolean;
    onRefresh: () => Promise<void>;
    onOpenShiftQuick: () => void;
    onOpenShifts: () => void;
};

export function StaffScreenSections({
    staffInfo,
    upcomingBookings,
    refreshing,
    onRefresh,
    onOpenShiftQuick,
    onOpenShifts,
}: Props) {
    return (
        <ScrollView
            style={styles.container}
            testID="staff-screen"
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} />}
        >
            <View style={styles.header}>
                <Text style={styles.title}>Кабинет сотрудника</Text>
                <Text style={styles.subtitle}>{staffInfo.full_name}</Text>
            </View>

            {staffInfo.branch && (
                <Card style={styles.card}>
                    <Text style={styles.sectionTitle}>Р¤РёР»РёР°Р»</Text>
                    <Text style={styles.branchName}>{staffInfo.branch.name}</Text>
                </Card>
            )}

            {staffInfo.business && (
                <Card style={styles.card}>
                    <Text style={styles.sectionTitle}>Р‘РёР·РЅРµСЃ</Text>
                    <Text style={styles.businessName}>{staffInfo.business.name}</Text>
                </Card>
            )}

            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Предстоящие записи</Text>

                {upcomingBookings.length > 0 ? (
                    <View style={styles.bookingsList}>
                        {upcomingBookings.map((booking) => (
                            <Card key={booking.id} style={styles.bookingCard}>
                                <Text style={styles.bookingService}>
                                    {booking.service?.name_ru || 'РЈСЃР»СѓРіР°'}
                                </Text>
                                {booking.client_name && (
                                    <Text style={styles.bookingClient}>РљР»РёРµРЅС‚: {booking.client_name}</Text>
                                )}
                                {booking.client_phone && (
                                    <Text style={styles.bookingPhone}>{booking.client_phone}</Text>
                                )}
                                <View style={styles.bookingTime}>
                                    <Text style={styles.bookingDate}>{formatDate(booking.start_at)}</Text>
                                    <Text style={styles.bookingTimeRange}>
                                        {formatTime(booking.start_at)} - {formatTime(booking.end_at)}
                                    </Text>
                                </View>
                            </Card>
                        ))}
                    </View>
                ) : (
                    <EmptyState
                        icon="calendar"
                        title="Нет предстоящих записей"
                        message="Записи появятся здесь, когда клиенты запишутся к вам"
                    />
                )}
            </View>

            <View style={styles.section}>
                <Button title="Моя смена" onPress={onOpenShiftQuick} fullWidth />
                <Button
                    title="РЎС‚Р°С‚РёСЃС‚РёРєР°"
                    onPress={onOpenShifts}
                    variant="outline"
                    fullWidth
                    style={styles.secondaryAction}
                />
            </View>
        </ScrollView>
    );
}
