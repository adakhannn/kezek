import { Ionicons } from '@expo/vector-icons';
import { RefreshControl, ScrollView, Text, View } from 'react-native';

import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import EmptyState from '../../components/ui/EmptyState';
import MotionPressable from '../../components/ui/MotionPressable';
import OfflineBanner from '../../components/ui/OfflineBanner';
import { colors } from '../../constants/colors';
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
    const featuredBooking = upcomingBookings[0] ?? null;
    const syncLabel = lastSyncAt ? `${formatDate(lastSyncAt)} ? ${formatTime(lastSyncAt)}` : '????????????? ?????????';

    return (
        <ScrollView
            style={styles.container}
            contentContainerStyle={styles.content}
            testID="cabinet-screen"
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} tintColor={colors.accent.primary} />}
        >
            <View style={styles.header}>
                <View style={styles.headerTextWrap}>
                    <Text style={styles.eyebrow}>Кабинет клиента</Text>
                    <Text style={styles.title}>Ваши записи и профиль</Text>
                    <Text style={styles.subtitle}>{userLabel}</Text>
                </View>
                <Button
                    title="Профиль"
                    onPress={onProfilePress}
                    variant="secondary"
                    size="sm"
                    leadingIcon={<Ionicons name="person-circle-outline" size={16} color={colors.text.primary} />}
                />
            </View>

            <Card style={styles.overviewCard}>
                <View style={styles.overviewTopRow}>
                    <View style={styles.overviewCopy}>
                        <Text style={styles.overviewLabel}>Ближайший фокус</Text>
                        <Text style={styles.overviewTitle}>
                            {featuredBooking ? featuredBooking.service?.name_ru || '??????????? ??????' : '??????? ???? ???'}
                        </Text>
                        <Text style={styles.overviewDescription}>
                            {featuredBooking
                                ? `${formatDate(featuredBooking.start_at)} ? ${formatTime(featuredBooking.start_at)}`
                                : 'Когда появится новая запись, здесь будет быстрый ориентир по следующему визиту.'}
                        </Text>
                    </View>
                    <View style={styles.overviewMetaPill}>
                        <Ionicons name="sync-outline" size={14} color={colors.text.secondary} />
                        <Text style={styles.overviewMetaText}>{isOfflineData ? '???????' : '?????????'}</Text>
                    </View>
                </View>

                <View style={styles.statsRow}>
                    <View style={styles.statCard}>
                        <Text style={styles.statValue}>{upcomingBookings.length}</Text>
                        <Text style={styles.statLabel}>Предстоящие</Text>
                    </View>
                    <View style={styles.statCard}>
                        <Text style={styles.statValue}>{pastBookings.length}</Text>
                        <Text style={styles.statLabel}>История</Text>
                    </View>
                    <View style={styles.statCard}>
                        <Text style={styles.statValue}>{isOfflineData ? '???' : 'Live'}</Text>
                        <Text style={styles.statLabel}>Режим данных</Text>
                    </View>
                </View>
            </Card>

            {isOfflineData ? (
                <OfflineBanner
                    title="Показываем сохраненные записи"
                    message={`Нет подключения к интернету. Вы видите последние доступные данные${lastSyncAt ? ` от ${syncLabel}` : ''}. Потяните экран или нажмите «Обновить», когда сеть вернется.`}
                    onRetry={() => void onRefresh()}
                    style={styles.offlineBanner}
                />
            ) : (
                <Card style={styles.syncCard}>
                    <View style={styles.syncRow}>
                        <View style={styles.syncIconWrap}>
                            <Ionicons name="cloud-done-outline" size={18} color={colors.status.info} />
                        </View>
                        <View style={styles.syncCopy}>
                            <Text style={styles.syncTitle}>Кабинет синхронизирован</Text>
                            <Text style={styles.syncText}>Последняя проверка: {syncLabel}</Text>
                        </View>
                    </View>
                </Card>
            )}

            <View style={styles.sectionHeader}>
                <View>
                    <Text style={styles.sectionTitle}>Мои записи</Text>
                    <Text style={styles.sectionDescription}>
                        {isHistory
                            ? 'Здесь хранятся завершенные и отмененные визиты.'
                            : 'Следите за ближайшими визитами и быстро переходите в детали.'}
                    </Text>
                </View>
            </View>

            <View style={styles.tabsContainer}>
                <MotionPressable
                    style={[styles.tabButton, activeTab === 'upcoming' && styles.tabButtonActive]}
                    onPress={() => onTabChange('upcoming')}
                    scale="subtle"
                    accessibilityRole="tab"
                    accessibilityState={{ selected: activeTab === 'upcoming' }}
                    accessibilityLabel="Upcoming bookings"
                >
                    <Text style={[styles.tabLabel, activeTab === 'upcoming' && styles.tabLabelActive]}>???????????</Text>
                    <Text style={[styles.tabCount, activeTab === 'upcoming' && styles.tabCountActive]}>{upcomingBookings.length}</Text>
                </MotionPressable>
                <MotionPressable
                    style={[styles.tabButton, activeTab === 'history' && styles.tabButtonActive]}
                    onPress={() => onTabChange('history')}
                    scale="subtle"
                    accessibilityRole="tab"
                    accessibilityState={{ selected: activeTab === 'history' }}
                    accessibilityLabel="Booking history"
                >
                    <Text style={[styles.tabLabel, activeTab === 'history' && styles.tabLabelActive]}>История</Text>
                    <Text style={[styles.tabCount, activeTab === 'history' && styles.tabCountActive]}>{pastBookings.length}</Text>
                </MotionPressable>
            </View>

            {visibleBookings.length > 0 ? (
                <View style={styles.bookingsList}>
                    {visibleBookings.map((booking) => (
                        <MotionPressable
                            key={booking.id}
                            onPress={() => onBookingPress(booking.id)}
                            style={styles.bookingPressable}
                            scale="firm"
                            accessibilityLabel={`${booking.service?.name_ru || 'Service'}, ${formatDate(booking.start_at)} ${formatTime(booking.start_at)}`}
                            accessibilityHint="Opens booking details"
                        >
                            <BookingCard booking={booking} isHistory={isHistory} />
                        </MotionPressable>
                    ))}
                </View>
            ) : (
                <EmptyState
                    compact
                    title={isHistory ? 'История пока пустая' : 'Пока нет предстоящих записей'}
                    message={
                        isHistory
                            ? 'Когда визиты завершатся или будут отменены, они появятся здесь.'
                            : 'Запишитесь на услугу, и ближайший визит сразу появится в кабинете.'
                    }
                    style={styles.empty}
                />
            )}

            <View style={styles.footer}>
                <Button
                    title="Открыть профиль и настройки"
                    onPress={onProfilePress}
                    variant="outline"
                    fullWidth
                    trailingIcon={<Ionicons name="chevron-forward" size={16} color={colors.text.primary} />}
                />
            </View>
        </ScrollView>
    );
}

function BookingCard({ booking, isHistory }: { booking: Booking; isHistory: boolean }) {
    const statusColor = getStatusColor(booking.status);
    const statusText = getStatusText(booking.status);

    return (
        <Card style={styles.bookingCard}>
            <View style={styles.bookingHeader}>
                <View style={styles.bookingTitleWrap}>
                    <Text style={styles.bookingService}>{booking.service?.name_ru || '??????'}</Text>
                    <Text style={styles.bookingBusiness}>{booking.business?.name || '?????? ?? ??????'}</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
                    <Text style={styles.statusText}>{statusText}</Text>
                </View>
            </View>

            <View style={styles.timelineCard}>
                <View style={styles.timelineIconWrap}>
                    <Ionicons name={isHistory ? 'time-outline' : 'calendar-clear-outline'} size={16} color={colors.accent.primary} />
                </View>
                <View style={styles.timelineCopy}>
                    <Text style={styles.timelineLabel}>{isHistory ? 'Дата визита' : 'Следующий визит'}</Text>
                    <Text style={styles.timelineValue}>
                        {formatDate(booking.start_at)} ? {formatTime(booking.start_at)} - {formatTime(booking.end_at)}
                    </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.text.tertiary} />
            </View>

            <View style={styles.metaGrid}>
                <View style={styles.metaItem}>
                    <Ionicons name="person-outline" size={14} color={colors.text.secondary} />
                    <Text style={styles.metaText}>{booking.staff?.full_name || '?????? ??????????'}</Text>
                </View>
                <View style={styles.metaItem}>
                    <Ionicons name="location-outline" size={14} color={colors.text.secondary} />
                    <Text style={styles.metaText}>
                        {booking.branch?.address || booking.branch?.name || 'Адрес появится в деталях'}
                    </Text>
                </View>
            </View>

            <View style={styles.bookingFooter}>
                <Text style={styles.footerHint}>
                    {isHistory ? 'Откройте, чтобы посмотреть детали и статус визита.' : 'Откройте карточку, чтобы посмотреть детали и подготовиться к визиту.'}
                </Text>
            </View>
        </Card>
    );
}
