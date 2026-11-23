import { Ionicons } from '@expo/vector-icons';
import { RefreshControl, ScrollView, Text, useWindowDimensions, View } from 'react-native';

import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import EmptyState from '../../components/ui/EmptyState';
import MotionPressable from '../../components/ui/MotionPressable';
import OfflineBanner from '../../components/ui/OfflineBanner';
import { colors } from '../../constants/colors';
import { useLanguage } from '../../i18n';
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
    const { t, locale } = useLanguage();
    const isCompact = width <= 380;
    const usesStackedHeader = shouldStackCabinetHeader(width);
    const usesStackedStats = width <= 420;
    const isHistory = activeTab === 'history';
    const visibleBookings = isHistory ? pastBookings : upcomingBookings;
    const featuredBooking = upcomingBookings[0] ?? null;
    const syncLabel = lastSyncAt ? `${formatDate(lastSyncAt, locale)} • ${formatTime(lastSyncAt)}` : t('cabinet.sync.pending');
    const dataModeLabel = hasBookingsError
        ? t('cabinet.state.error')
        : isOfflineData
          ? t('cabinet.dataMode.cache')
          : t('cabinet.dataMode.live');

    return (
        <ScrollView
            style={styles.container}
            contentContainerStyle={styles.content}
            testID="cabinet-screen"
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} tintColor={colors.accent.primary} />}
        >
            <View style={[styles.header, usesStackedHeader && styles.headerCompact]}>
                <View style={styles.headerTextWrap}>
                    <Text style={styles.eyebrow}>{t('cabinet.header.eyebrow')}</Text>
                    <Text style={styles.title}>{t('cabinet.header.title')}</Text>
                    <Text style={styles.subtitle} numberOfLines={2} ellipsizeMode="middle">
                        {userLabel}
                    </Text>
                </View>
                <Button
                    title={t('cabinet.header.profile')}
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
                        <Text style={styles.overviewLabel}>{t('cabinet.overview.label')}</Text>
                        <Text style={styles.overviewTitle}>
                            {featuredBooking
                                ? featuredBooking.service?.name_ru || t('cabinet.overview.upcomingFallback')
                                : t('cabinet.overview.empty')}
                        </Text>
                        <Text style={styles.overviewDescription}>
                            {featuredBooking
                                ? t('cabinet.overview.when', {
                                      date: formatDate(featuredBooking.start_at, locale),
                                      time: formatTime(featuredBooking.start_at),
                                  })
                                : t('cabinet.overview.emptyHint')}
                        </Text>
                    </View>
                    <View style={[styles.overviewMetaPill, isCompact && styles.overviewMetaPillCompact]}>
                        <Ionicons name="sync-outline" size={14} color={colors.text.secondary} />
                        <Text style={styles.overviewMetaText}>
                            {hasBookingsError
                                ? t('cabinet.state.error')
                                : isOfflineData
                                  ? t('cabinet.state.offline')
                                  : t('cabinet.state.fresh')}
                        </Text>
                    </View>
                </View>

                <View style={[styles.statsRow, usesStackedStats && styles.statsRowCompact]}>
                    <View style={[styles.statCard, usesStackedStats && styles.statCardCompact]}>
                        <Text style={styles.statValue}>{upcomingBookings.length}</Text>
                        <Text style={styles.statLabel}>{t('cabinet.stats.upcoming')}</Text>
                    </View>
                    <View style={[styles.statCard, usesStackedStats && styles.statCardCompact]}>
                        <Text style={styles.statValue}>{pastBookings.length}</Text>
                        <Text style={styles.statLabel}>{t('cabinet.stats.history')}</Text>
                    </View>
                    <View
                        style={[
                            styles.statCard,
                            usesStackedStats && styles.statCardCompact,
                            usesStackedStats && styles.statCardWide,
                        ]}
                    >
                        <Text style={styles.statValue}>{dataModeLabel}</Text>
                        <Text style={styles.statLabel}>{t('cabinet.stats.dataMode')}</Text>
                    </View>
                </View>
            </Card>

            {hasBookingsError ? (
                <OfflineBanner
                    title={t('cabinet.loadError.title')}
                    message={t('cabinet.loadError.bannerMessage')}
                    onRetry={() => void onRefresh()}
                    style={styles.offlineBanner}
                />
            ) : isOfflineData ? (
                <OfflineBanner
                    title={t('cabinet.offline.title')}
                    message={
                        lastSyncAt
                            ? t('cabinet.offline.messageSince', { date: syncLabel })
                            : t('cabinet.offline.message')
                    }
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
                            <Text style={styles.syncTitle}>{t('cabinet.synced.title')}</Text>
                            <Text style={styles.syncText}>{t('cabinet.synced.lastCheck', { date: syncLabel })}</Text>
                        </View>
                    </View>
                </Card>
            )}

            <View style={styles.sectionHeader}>
                <View>
                    <Text style={styles.sectionTitle}>{t('cabinet.bookings.title')}</Text>
                    <Text style={styles.sectionDescription}>
                        {isHistory
                            ? t('cabinet.bookings.historyHint')
                            : t('cabinet.bookings.upcomingHint')}
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
                    accessibilityLabel={t('cabinet.bookings.upcomingTabLabel')}
                >
                    <Text style={[styles.tabLabel, activeTab === 'upcoming' && styles.tabLabelActive]}>{t('cabinet.stats.upcoming')}</Text>
                    <Text style={[styles.tabCount, activeTab === 'upcoming' && styles.tabCountActive]}>{upcomingBookings.length}</Text>
                </MotionPressable>
                <MotionPressable
                    style={[styles.tabButton, activeTab === 'history' && styles.tabButtonActive]}
                    onPress={() => onTabChange('history')}
                    scale="subtle"
                    accessibilityRole="tab"
                    accessibilityState={{ selected: activeTab === 'history' }}
                    accessibilityLabel={t('cabinet.bookings.historyTabLabel')}
                >
                    <Text style={[styles.tabLabel, activeTab === 'history' && styles.tabLabelActive]}>{t('cabinet.stats.history')}</Text>
                    <Text style={[styles.tabCount, activeTab === 'history' && styles.tabCountActive]}>{pastBookings.length}</Text>
                </MotionPressable>
            </View>

            {hasBookingsError ? (
                <EmptyState
                    compact
                    icon="cloud-offline-outline"
                    title={t('cabinet.loadError.title')}
                    message={t('cabinet.loadError.listMessage')}
                    action={<Button title={t('cabinet.ui.retry')} onPress={() => void onRefresh()} variant="outline" fullWidth />}
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
                            accessibilityLabel={t('cabinet.bookings.itemLabel', {
                                service: booking.service?.name_ru || t('cabinet.ui.serviceFallback'),
                                date: formatDate(booking.start_at, locale),
                                time: formatTime(booking.start_at),
                            })}
                            accessibilityHint={t('cabinet.bookings.itemHint')}
                        >
                            <BookingCard booking={booking} isHistory={isHistory} />
                        </MotionPressable>
                    ))}
                </View>
            ) : (
                <EmptyState
                    compact
                    title={isHistory ? t('cabinet.empty.historyTitle') : t('cabinet.empty.upcomingTitle')}
                    message={
                        isHistory
                            ? t('cabinet.empty.historyMessage')
                            : t('cabinet.empty.upcomingMessage')
                    }
                    style={styles.empty}
                />
            )}

            <View style={styles.footer}>
                <Button
                    title={t('cabinet.footer.openProfile')}
                    onPress={onProfilePress}
                    variant="outline"
                    fullWidth
                    trailingIcon={<Ionicons name="chevron-forward" size={16} color={colors.text.primary} />}
                />
                <Button
                    title={isSigningOut ? t('cabinet.ui.signingOut') : t('cabinet.footer.signOut')}
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
    const { t, locale } = useLanguage();
    const statusText = getStatusText(booking.status, locale);

    return (
        <Card style={styles.bookingCard}>
            <View style={styles.bookingHeader}>
                <View style={styles.bookingTitleWrap}>
                    <Text style={styles.bookingService}>{booking.service?.name_ru || t('cabinet.ui.serviceFallback')}</Text>
                    <Text style={styles.bookingBusiness}>{booking.business?.name || t('cabinet.card.noBusiness')}</Text>
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
                    <Text style={styles.timelineLabel}>{isHistory ? t('cabinet.card.visitDate') : t('cabinet.card.nextVisit')}</Text>
                    <Text style={styles.timelineValue}>
                        {formatDate(booking.start_at, locale)} • {formatTime(booking.start_at)} - {formatTime(booking.end_at)}
                    </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.text.tertiary} />
            </View>

            <View style={styles.metaGrid}>
                <View style={styles.metaItem}>
                    <Ionicons name="person-outline" size={14} color={colors.text.secondary} />
                    <Text style={styles.metaText}>{booking.staff?.full_name || t('cabinet.card.staffPending')}</Text>
                </View>
                <View style={styles.metaItem}>
                    <Ionicons name="location-outline" size={14} color={colors.text.secondary} />
                    <Text style={styles.metaText}>
                        {booking.branch?.address || booking.branch?.name || t('cabinet.card.addressPending')}
                    </Text>
                </View>
            </View>

            <View style={styles.bookingFooter}>
                <Text style={styles.footerHint}>
                    {isHistory
                        ? t('cabinet.card.historyHint')
                        : t('cabinet.card.upcomingHint')}
                </Text>
            </View>
        </Card>
    );
}


