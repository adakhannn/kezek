import { Ionicons } from '@expo/vector-icons';
import { RefreshControl, ScrollView, Text, useWindowDimensions, View } from 'react-native';

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

export const CABINET_STACKED_HEADER_MAX_WIDTH = 420;

export function shouldStackCabinetHeader(width: number) {
    return width <= CABINET_STACKED_HEADER_MAX_WIDTH;
}

type Props = {
    userLabel: string;
    activeTab: 'upcoming' | 'history';
    isOfflineData: boolean;
    hasBookingsError: boolean;
    lastSyncAt: string | null;
    upcomingBookings: Booking[];
    pastBookings: Booking[];
    refreshing: boolean;
    onTabChange: (tab: 'upcoming' | 'history') => void;
    onRefresh: () => Promise<void>;
    onBookingPress: (bookingId: string) => void;
    onProfilePress: () => void;
    onSignOut: () => void;
    isSigningOut: boolean;
};

export function CabinetScreenSections({
    userLabel,
    activeTab,
    isOfflineData,
    hasBookingsError,
    lastSyncAt,
    upcomingBookings,
    pastBookings,
    refreshing,
    onTabChange,
    onRefresh,
    onBookingPress,
    onProfilePress,
    onSignOut,
    isSigningOut,
}: Props) {
    const { width } = useWindowDimensions();
    const isCompact = width <= 380;
    const usesStackedHeader = shouldStackCabinetHeader(width);
    const usesStackedStats = width <= 420;
    const isHistory = activeTab === 'history';
    const visibleBookings = isHistory ? pastBookings : upcomingBookings;
    const featuredBooking = upcomingBookings[0] ?? null;
    const syncLabel = lastSyncAt ? `${formatDate(lastSyncAt)} • ${formatTime(lastSyncAt)}` : 'Синхронизация ожидается';
    const dataModeLabel = hasBookingsError ? 'Ошибка' : isOfflineData ? 'Кэш' : 'Live';

    return (
        <ScrollView
            style={styles.container}
            contentContainerStyle={styles.content}
            testID="cabinet-screen"
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} tintColor={colors.accent.primary} />}
        >
            <View style={[styles.header, usesStackedHeader && styles.headerCompact]}>
                <View style={styles.headerTextWrap}>
                    <Text style={styles.eyebrow}>Кабинет клиента</Text>
                    <Text style={styles.title}>Ваши записи и профиль</Text>
                    <Text style={styles.subtitle} numberOfLines={2} ellipsizeMode="middle">
                        {userLabel}
                    </Text>
                </View>
                <Button
                    title="Профиль"
                    onPress={onProfilePress}
                    variant="secondary"
                    size="sm"
                    fullWidth={usesStackedHeader}
                    leadingIcon={<Ionicons name="person-circle-outline" size={16} color={colors.text.primary} />}
                />
            </View>

            <Card style={styles.overviewCard}>
                <View style={[styles.overviewTopRow, isCompact && styles.overviewTopRowCompact]}>
                    <View style={styles.overviewCopy}>
                        <Text style={styles.overviewLabel}>Ближайший фокус</Text>
                        <Text style={styles.overviewTitle}>
                            {featuredBooking ? featuredBooking.service?.name_ru || 'Предстоящая запись' : 'Записей пока нет'}
                        </Text>
                        <Text style={styles.overviewDescription}>
                            {featuredBooking
                                ? `${formatDate(featuredBooking.start_at)} в ${formatTime(featuredBooking.start_at)}`
                                : 'Когда появится новая запись, здесь будет быстрый ориентир по следующему визиту.'}
                        </Text>
                    </View>
                    <View style={[styles.overviewMetaPill, isCompact && styles.overviewMetaPillCompact]}>
                        <Ionicons name="sync-outline" size={14} color={colors.text.secondary} />
                        <Text style={styles.overviewMetaText}>
                            {hasBookingsError ? 'Ошибка' : isOfflineData ? 'Оффлайн' : 'Актуально'}
                        </Text>
                    </View>
                </View>

                <View style={[styles.statsRow, usesStackedStats && styles.statsRowCompact]}>
                    <View style={[styles.statCard, usesStackedStats && styles.statCardCompact]}>
                        <Text style={styles.statValue}>{upcomingBookings.length}</Text>
                        <Text style={styles.statLabel}>Предстоящие</Text>
                    </View>
                    <View style={[styles.statCard, usesStackedStats && styles.statCardCompact]}>
                        <Text style={styles.statValue}>{pastBookings.length}</Text>
                        <Text style={styles.statLabel}>История</Text>
                    </View>
                    <View
                        style={[
                            styles.statCard,
                            usesStackedStats && styles.statCardCompact,
                            usesStackedStats && styles.statCardWide,
                        ]}
                    >
                        <Text style={styles.statValue}>{dataModeLabel}</Text>
                        <Text style={styles.statLabel}>Режим данных</Text>
                    </View>
                </View>
            </Card>

            {hasBookingsError ? (
                <OfflineBanner
                    title="Не удалось загрузить записи"
                    message="Проверьте соединение и попробуйте обновить кабинет. Если проблема повторится, мы сохраним профиль доступным, но список записей может быть неполным."
                    onRetry={() => void onRefresh()}
                    style={styles.offlineBanner}
                />
            ) : isOfflineData ? (
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
                    accessibilityLabel="Предстоящие записи"
                >
                    <Text style={[styles.tabLabel, activeTab === 'upcoming' && styles.tabLabelActive]}>Предстоящие</Text>
                    <Text style={[styles.tabCount, activeTab === 'upcoming' && styles.tabCountActive]}>{upcomingBookings.length}</Text>
                </MotionPressable>
                <MotionPressable
                    style={[styles.tabButton, activeTab === 'history' && styles.tabButtonActive]}
                    onPress={() => onTabChange('history')}
                    scale="subtle"
                    accessibilityRole="tab"
                    accessibilityState={{ selected: activeTab === 'history' }}
                    accessibilityLabel="История записей"
                >
                    <Text style={[styles.tabLabel, activeTab === 'history' && styles.tabLabelActive]}>История</Text>
                    <Text style={[styles.tabCount, activeTab === 'history' && styles.tabCountActive]}>{pastBookings.length}</Text>
                </MotionPressable>
            </View>

            {hasBookingsError ? (
                <EmptyState
                    compact
                    icon="cloud-offline-outline"
                    title="Не удалось загрузить записи"
                    message="Список записей временно недоступен. Нажмите «Повторить», когда соединение восстановится."
                    action={<Button title="Повторить" onPress={() => void onRefresh()} variant="outline" fullWidth />}
                    style={styles.empty}
                />
            ) : visibleBookings.length > 0 ? (
                <View style={styles.bookingsList}>
                    {visibleBookings.map((booking) => (
                        <MotionPressable
                            key={booking.id}
                            onPress={() => onBookingPress(booking.id)}
                            style={styles.bookingPressable}
                            scale="firm"
                            accessibilityLabel={`${booking.service?.name_ru || 'Услуга'}, ${formatDate(booking.start_at)} ${formatTime(booking.start_at)}`}
                            accessibilityHint="Открывает детали записи"
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
                <Button
                    title={isSigningOut ? 'Выходим...' : 'Выйти из аккаунта'}
                    onPress={onSignOut}
                    variant="outline"
                    fullWidth
                    loading={isSigningOut}
                    disabled={isSigningOut}
                    style={styles.signOutQuickButton}
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
                    <Text style={styles.bookingService}>{booking.service?.name_ru || 'Услуга'}</Text>
                    <Text style={styles.bookingBusiness}>{booking.business?.name || 'Бизнес не указан'}</Text>
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
                        {formatDate(booking.start_at)} • {formatTime(booking.start_at)} - {formatTime(booking.end_at)}
                    </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.text.tertiary} />
            </View>

            <View style={styles.metaGrid}>
                <View style={styles.metaItem}>
                    <Ionicons name="person-outline" size={14} color={colors.text.secondary} />
                    <Text style={styles.metaText}>{booking.staff?.full_name || 'Мастер уточняется'}</Text>
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
                    {isHistory
                        ? 'Откройте, чтобы посмотреть детали и статус визита.'
                        : 'Откройте карточку, чтобы посмотреть детали и подготовиться к визиту.'}
                </Text>
            </View>
        </Card>
    );
}


