import { RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native';

import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import EmptyState from '../../components/ui/EmptyState';
import { formatDate, formatTime } from '../../utils/format';
import { getStatusColor, getStatusText } from '../../utils/i18n';
import { styles } from './cabinetScreenStyles';
import type { Booking } from './types';

type Props = {
    userLabel: string;
    activeTab: 'upcoming' | 'history';
    isOfflineData: boolean;
    lastSyncAt: string | null;
    upcomingBookings: Booking[];
    pastBookings: Booking[];
    refreshing: boolean;
    onTabChange: (tab: 'upcoming' | 'history') => void;
    onRefresh: () => Promise<void>;
    onBookingPress: (bookingId: string) => void;
    onProfilePress: () => void;
};

export function CabinetScreenSections({
    userLabel,
    activeTab,
    isOfflineData,
    lastSyncAt,
    upcomingBookings,
    pastBookings,
    refreshing,
    onTabChange,
    onRefresh,
    onBookingPress,
    onProfilePress,
}: Props) {
    const isHistory = activeTab === 'history';
    const visibleBookings = isHistory ? pastBookings : upcomingBookings;

    return (
        <ScrollView
            style={styles.container}
            testID="cabinet-screen"
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} />}
        >
            <View style={styles.header}>
                <Text style={styles.title}>Личный кабинет</Text>
                <Text style={styles.subtitle}>{userLabel}</Text>
            </View>

            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Мои записи</Text>

                <View style={styles.tabsContainer}>
                    <TouchableOpacity
                        style={[styles.tabButton, activeTab === 'upcoming' && styles.tabButtonActive]}
                        onPress={() => onTabChange('upcoming')}
                    >
                        <Text
                            style={[
                                styles.tabButtonText,
                                activeTab === 'upcoming' && styles.tabButtonTextActive,
                            ]}
                        >
                            Предстоящие
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.tabButton, activeTab === 'history' && styles.tabButtonActive]}
                        onPress={() => onTabChange('history')}
                    >
                        <Text
                            style={[
                                styles.tabButtonText,
                                activeTab === 'history' && styles.tabButtonTextActive,
                            ]}
                        >
                            История
                        </Text>
                    </TouchableOpacity>
                </View>

                {isOfflineData && (
                    <View style={styles.offlineBanner}>
                        <Text style={styles.offlineBannerText}>
                            Нет подключения к интернету — показаны сохранённые данные
                            {lastSyncAt
                                ? ` (последняя синхронизация: ${formatDate(lastSyncAt)} ${formatTime(lastSyncAt)})`
                                : ''}
                        </Text>
                    </View>
                )}

                {visibleBookings.length > 0 ? (
                    <View style={styles.bookingsList}>
                        {visibleBookings.map((booking) => (
                            <TouchableOpacity key={booking.id} onPress={() => onBookingPress(booking.id)}>
                                <BookingCard booking={booking} />
                            </TouchableOpacity>
                        ))}
                    </View>
                ) : (
                    <View style={styles.empty}>
                        <Text style={styles.emptyText}>
                            {isHistory ? 'У вас пока нет прошедших записей' : 'У вас пока нет записей'}
                        </Text>
                        <Text style={styles.emptyHint}>
                            {isHistory
                                ? 'Здесь появятся завершённые записи после первой синхронизации'
                                : 'Запишитесь на услугу, чтобы увидеть её здесь'}
                        </Text>
                    </View>
                )}
            </View>

            <View style={styles.footer}>
                <Button title="Профиль" onPress={onProfilePress} variant="outline" />
            </View>
        </ScrollView>
    );
}

function BookingCard({ booking }: { booking: Booking }) {
    return (
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
    );
}
