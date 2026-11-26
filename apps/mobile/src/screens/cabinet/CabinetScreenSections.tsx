import { Ionicons } from '@expo/vector-icons';
import {
    RefreshControl,
    ScrollView,
    Text,
    useWindowDimensions,
    View,
    type NativeScrollEvent,
    type NativeSyntheticEvent,
} from 'react-native';

import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import EmptyState from '../../components/ui/EmptyState';
import MotionPressable from '../../components/ui/MotionPressable';
import OfflineBanner from '../../components/ui/OfflineBanner';
import { colors } from '../../constants/colors';
import { useLanguage } from '../../i18n';
import { formatDate, formatTime } from '../../utils/format';
import { getServiceName, getStatusColor, getStatusText } from '../../utils/i18n';
import { styles } from './cabinetScreenStyles';
import { CabinetWorkspacesBlock } from './CabinetWorkspacesBlock';
import { StaffInvitationsBlock } from './StaffInvitationsBlock';
import { bookingTitle, type Booking } from './types';
import { VisitPackagesBlock } from './VisitPackagesBlock';

export const CABINET_STACKED_HEADER_MAX_WIDTH = 420;

/** Distance from the bottom (px) at which the next history page starts loading (B11). */
const LOAD_MORE_THRESHOLD = 320;

export function shouldStackCabinetHeader(width: number) {
    return width <= CABINET_STACKED_HEADER_MAX_WIDTH;
}

export function isNearBottom({ layoutMeasurement, contentOffset, contentSize }: NativeScrollEvent, threshold = LOAD_MORE_THRESHOLD) {
    return layoutMeasurement.height + contentOffset.y >= contentSize.height - threshold;
}

type Props = {
    /** Signed-in user: the packages and invitations blocks load for them. */
    userId?: string;
    hasMoreBookings?: boolean;
    isFetchingMore?: boolean;
    loadMoreFailed?: boolean;
    onLoadMore?: () => void;
    onReview?: (booking: Booking) => void;
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
    userId,
    hasMoreBookings = false,
    isFetchingMore = false,
    loadMoreFailed = false,
    onLoadMore,
    onReview,
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

    // Older history pages load as the history list is scrolled to its end (B11).
    const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
        if (isHistory && hasMoreBookings && !isFetchingMore && !loadMoreFailed && isNearBottom(event.nativeEvent)) {
            onLoadMore?.();
        }
    };

    return (
        <ScrollView
            style={styles.container}
            contentContainerStyle={styles.content}
            testID="cabinet-screen"
            onScroll={handleScroll}
            scrollEventThrottle={200}
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
                                ? getServiceName(featuredBooking.service, locale) || t('cabinet.overview.upcomingFallback')
                                : t('cabinet.overview.empty')}
                        </Text>
                        <Text style={styles.overviewDescription}>
                            {featuredBooking
                                ? t('cabinet.overview.when', {
                                      date: formatDate(featuredBooking.start_at, locale, featuredBooking.business?.tz),
                                      time: formatTime(featuredBooking.start_at, featuredBooking.business?.tz),
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

            {userId ? (
                <>
                    <StaffInvitationsBlock userId={userId} />
                    <VisitPackagesBlock userId={userId} />
                    <CabinetWorkspacesBlock />
                </>
            ) : null}

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
                                service: bookingTitle(booking, locale) || t('cabinet.ui.serviceFallback'),
                                date: formatDate(booking.start_at, locale, booking.business?.tz),
                                time: formatTime(booking.start_at, booking.business?.tz),
                            })}
                            accessibilityHint={t('cabinet.bookings.itemHint')}
                        >
                            <BookingCard
                                booking={booking}
                                isHistory={isHistory}
                                onReview={!isOfflineData && onReview ? () => onReview(booking) : undefined}
                            />
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
            {isHistory && (hasMoreBookings || isFetchingMore || loadMoreFailed) ? (
                <View style={styles.loadMore} testID="cabinet-load-more">
                    {isFetchingMore ? (
                        <Text style={styles.footerHint}>{t('cabinet.bookings.loadingMore')}</Text>
                    ) : loadMoreFailed ? (
                        <>
                            <Text style={styles.footerHint}>{t('cabinet.bookings.loadMoreError')}</Text>
                            <Button title={t('cabinet.ui.retry')} onPress={() => onLoadMore?.()} variant="outline" size="sm" />
                        </>
                    ) : (
                        <Button title={t('cabinet.bookings.loadMore')} onPress={() => onLoadMore?.()} variant="outline" size="sm" />
                    )}
                </View>
            ) : null}

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

function BookingCard({ booking, isHistory, onReview }: { booking: Booking; isHistory: boolean; onReview?: () => void }) {
    const statusColor = getStatusColor(booking.status);
    const { t, locale } = useLanguage();
    const statusText = getStatusText(booking.status, locale);
    const benefitAmount = booking.promotion?.final_amount ?? booking.package?.final_amount ?? null;

    return (
        <Card style={styles.bookingCard}>
            <View style={styles.bookingHeader}>
                <View style={styles.bookingTitleWrap}>
                    <Text style={styles.bookingService}>{bookingTitle(booking, locale) || t('cabinet.ui.serviceFallback')}</Text>
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
                        {formatDate(booking.start_at, locale, booking.business?.tz)} • {formatTime(booking.start_at, booking.business?.tz)} -{' '}
                        {formatTime(booking.end_at, booking.business?.tz)}
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

            {booking.promotion || booking.package ? (
                <View style={styles.benefitRow} testID={`booking-benefit-${booking.id}`}>
                    <Ionicons
                        name={booking.package ? 'ticket-outline' : 'pricetag-outline'}
                        size={14}
                        color={colors.accent.primary}
                    />
                    <Text style={styles.metaText}>
                        {booking.package ? t('cabinet.card.paidWithPackage') : t('cabinet.card.promotion')}
                        {benefitAmount != null ? ` · ${t('cabinet.card.finalAmount', { amount: benefitAmount })}` : ''}
                    </Text>
                </View>
            ) : null}

            {booking.review ? (
                <Text style={styles.footerHint}>{t('cabinet.card.reviewed', { rating: booking.review.rating })}</Text>
            ) : null}

            <View style={styles.bookingFooter}>
                <Text style={styles.footerHint}>
                    {isHistory
                        ? t('cabinet.card.historyHint')
                        : t('cabinet.card.upcomingHint')}
                </Text>
                {onReview && (booking.canReview || (booking.review && booking.status === 'paid')) ? (
                    <Button
                        title={t(booking.review ? 'cabinet.review.edit' : 'cabinet.review.create')}
                        onPress={onReview}
                        variant="outline"
                        size="sm"
                        style={styles.reviewButton}
                    />
                ) : null}
            </View>
        </Card>
    );
}


