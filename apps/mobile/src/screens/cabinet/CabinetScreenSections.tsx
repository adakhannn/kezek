import { Ionicons } from '@expo/vector-icons';
import {
    Pressable,
    Text,
    View,
    type NativeScrollEvent,
    type NativeSyntheticEvent,
} from 'react-native';

import Avatar from '../../components/ui/Avatar';
import { StatusPill } from '../../components/ui/Badge';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import EmptyState from '../../components/ui/EmptyState';
import ErrorState from '../../components/ui/ErrorState';
import ListRow, { ListGroup } from '../../components/ui/ListRow';
import MotionPressable from '../../components/ui/MotionPressable';
import OfflineBanner from '../../components/ui/OfflineBanner';
import Screen from '../../components/ui/Screen';
import Section from '../../components/ui/Section';
import { colors } from '../../constants/colors';
import type { Tone } from '../../constants/theme';
import { useLanguage } from '../../i18n';
import type { RootStackParamList } from '../../navigation/types';
import { formatDate, formatTime } from '../../utils/format';
import { getServiceName, getStatusText } from '../../utils/i18n';
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

/** The booking state as a tone of the shared status pill. */
export function bookingStatusTone(status: string): Tone {
    switch (status) {
        case 'paid':
            return 'success';
        case 'confirmed':
            return 'info';
        case 'hold':
            return 'warning';
        case 'cancelled':
            return 'danger';
        default:
            return 'neutral';
    }
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

/**
 * The client cabinet under the "Личный кабинет" header: the person (opens the profile), the next
 * visit, invitations and packages, the bookings with Upcoming / History, then account links.
 * The data state shows only when it matters: an offline copy or a failed refresh.
 */
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
    const { t, locale } = useLanguage();
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
    const isHistory = activeTab === 'history';
    const visibleBookings = isHistory ? pastBookings : upcomingBookings;
    const featuredBooking = upcomingBookings[0] ?? null;
    const syncLabel = lastSyncAt ? `${formatDate(lastSyncAt, locale)} • ${formatTime(lastSyncAt)}` : t('cabinet.sync.pending');

    // Older history pages load as the history list is scrolled to its end (B11).
    const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
        if (isHistory && hasMoreBookings && !isFetchingMore && !loadMoreFailed && isNearBottom(event.nativeEvent)) {
            onLoadMore?.();
        }
    };

    return (
        <Screen
            tabBar
            refreshing={refreshing}
            onRefresh={onRefresh}
            onScroll={handleScroll}
            scrollEventThrottle={200}
            testID="cabinet-screen"
        >
            <Pressable
                onPress={onProfilePress}
                style={({ pressed }) => [styles.hero, pressed ? styles.pressed : null]}
                accessibilityRole="button"
                accessibilityLabel={`${userLabel}, ${t('cabinet.header.profile')}`}
            >
                <Avatar name={userLabel} size={56} />
                <View style={styles.heroText}>
                    <Text style={styles.heroName} numberOfLines={1} ellipsizeMode="middle">
                        {userLabel}
                    </Text>
                    <Text style={styles.heroLink}>{t('cabinet.header.profile')}</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.text.tertiary} />
            </Pressable>

            {hasBookingsError ? (
                <OfflineBanner
                    title={t('cabinet.loadError.title')}
                    message={t('cabinet.loadError.bannerMessage')}
                    onRetry={() => void onRefresh()}
                    style={styles.banner}
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
                    style={styles.banner}
                />
            ) : null}

            {featuredBooking ? (
                <MotionPressable
                    onPress={() => onBookingPress(featuredBooking.id)}
                    scale="firm"
                    accessibilityRole="button"
                    accessibilityHint={t('cabinet.bookings.itemHint')}
                >
                    <Card variant="accent" padding="md" style={styles.nextCard}>
                        <View style={styles.nextTop}>
                            <View style={styles.nextIcon}>
                                <Ionicons name="calendar" size={20} color={colors.text.light} />
                            </View>
                            <View style={styles.nextText}>
                                <Text style={styles.nextLabel}>{t('cabinet.card.nextVisit')}</Text>
                                <Text style={styles.nextTitle} numberOfLines={2}>
                                    {getServiceName(featuredBooking.service, locale) || t('cabinet.overview.upcomingFallback')}
                                </Text>
                            </View>
                        </View>
                        <Text style={styles.nextWhen}>
                            {t('cabinet.overview.when', {
                                date: formatDate(featuredBooking.start_at, locale, featuredBooking.business?.tz),
                                time: formatTime(featuredBooking.start_at, featuredBooking.business?.tz),
                            })}
                        </Text>
                        {featuredBooking.business?.name ? (
                            <Text style={styles.nextMeta} numberOfLines={1}>{featuredBooking.business.name}</Text>
                        ) : null}
                    </Card>
                </MotionPressable>
            ) : null}

            {userId ? (
                <>
                    <StaffInvitationsBlock userId={userId} />
                    <VisitPackagesBlock userId={userId} />
                </>
            ) : null}

            <Section title={t('cabinet.bookings.title')}>
                <View style={styles.tabs} accessibilityRole="tablist">
                    <CabinetTab
                        label={t('cabinet.stats.upcoming')}
                        accessibilityLabel={t('cabinet.bookings.upcomingTabLabel')}
                        count={upcomingBookings.length}
                        selected={activeTab === 'upcoming'}
                        onPress={() => onTabChange('upcoming')}
                    />
                    <CabinetTab
                        label={t('cabinet.stats.history')}
                        accessibilityLabel={t('cabinet.bookings.historyTabLabel')}
                        count={pastBookings.length}
                        selected={activeTab === 'history'}
                        onPress={() => onTabChange('history')}
                    />
                </View>

                {hasBookingsError ? (
                    <ErrorState
                        compact
                        title={t('cabinet.loadError.title')}
                        message={t('cabinet.loadError.listMessage')}
                        retryLabel={t('cabinet.ui.retry')}
                        onRetry={() => void onRefresh()}
                    />
                ) : visibleBookings.length > 0 ? (
                    <View style={styles.bookingsList}>
                        {visibleBookings.map((booking) => (
                            <MotionPressable
                                key={booking.id}
                                onPress={() => onBookingPress(booking.id)}
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
                        icon={isHistory ? 'time-outline' : 'calendar-outline'}
                        title={isHistory ? t('cabinet.empty.historyTitle') : t('cabinet.empty.upcomingTitle')}
                        message={
                            isHistory
                                ? t('cabinet.empty.historyMessage')
                                : t('cabinet.empty.upcomingMessage')
                        }
                        action={isHistory ? undefined : (
                            <Button
                                title={t('cabinet.empty.upcomingAction')}
                                onPress={() => navigation.navigate('Main', { screen: 'Home' })}
                                size="sm"
                                testID="cabinet-empty-find-service"
                            />
                        )}
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
            </Section>

            {userId ? <CabinetWorkspacesBlock /> : null}

            <ListGroup inset>
                <ListRow
                    icon="settings-outline"
                    iconTone="neutral"
                    title={t('cabinet.footer.openProfile')}
                    onPress={onProfilePress}
                />
                <ListRow
                    icon="log-out-outline"
                    title={isSigningOut ? t('cabinet.ui.signingOut') : t('cabinet.footer.signOut')}
                    onPress={onSignOut}
                    disabled={isSigningOut}
                    destructive
                    chevron={false}
                />
            </ListGroup>
        </Screen>
    );
}

function CabinetTab({ label, accessibilityLabel, count, selected, onPress }: {
    label: string;
    accessibilityLabel: string;
    count: number;
    selected: boolean;
    onPress: () => void;
}) {
    return (
        <Pressable
            style={[styles.tab, selected ? styles.tabSelected : null]}
            onPress={onPress}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={accessibilityLabel}
        >
            <Text style={[styles.tabLabel, selected ? styles.tabLabelSelected : null]} numberOfLines={1}>{label}</Text>
            <View style={[styles.tabCount, selected ? styles.tabCountSelected : null]}>
                <Text style={[styles.tabCountText, selected ? styles.tabLabelSelected : null]}>{count}</Text>
            </View>
        </Pressable>
    );
}

/** One booking: service and state, the time, the master and the place, benefits and the review. */
function BookingCard({ booking, isHistory, onReview }: { booking: Booking; isHistory: boolean; onReview?: () => void }) {
    const { t, locale } = useLanguage();
    const statusText = getStatusText(booking.status, locale);
    const benefitAmount = booking.promotion?.final_amount ?? booking.package?.final_amount ?? null;

    return (
        <Card variant="plain" padding="md" style={styles.bookingCard}>
            <View style={styles.bookingHeader}>
                <View style={styles.bookingTitleWrap}>
                    <Text style={styles.bookingService}>{bookingTitle(booking, locale) || t('cabinet.ui.serviceFallback')}</Text>
                    <Text style={styles.bookingBusiness} numberOfLines={1}>{booking.business?.name || t('cabinet.card.noBusiness')}</Text>
                </View>
                <StatusPill label={statusText} tone={bookingStatusTone(booking.status)} />
            </View>

            <View style={styles.whenRow}>
                <Ionicons name={isHistory ? 'time-outline' : 'calendar-clear-outline'} size={16} color={colors.tone.accent.fg} />
                <Text style={styles.whenText}>
                    {formatDate(booking.start_at, locale, booking.business?.tz)} • {formatTime(booking.start_at, booking.business?.tz)}–{formatTime(booking.end_at, booking.business?.tz)}
                </Text>
            </View>

            <View style={styles.metaGroup}>
                <View style={styles.metaItem}>
                    <Ionicons name="person-outline" size={14} color={colors.text.secondary} />
                    <Text style={styles.metaText} numberOfLines={1}>{booking.staff?.full_name || t('cabinet.card.staffPending')}</Text>
                </View>
                <View style={styles.metaItem}>
                    <Ionicons name="location-outline" size={14} color={colors.text.secondary} />
                    <Text style={styles.metaText} numberOfLines={2}>
                        {booking.branch?.address || booking.branch?.name || t('cabinet.card.addressPending')}
                    </Text>
                </View>
                {booking.promotion || booking.package ? (
                    <View style={styles.metaItem} testID={`booking-benefit-${booking.id}`}>
                        <Ionicons
                            name={booking.package ? 'ticket-outline' : 'pricetag-outline'}
                            size={14}
                            color={colors.tone.success.fg}
                        />
                        <Text style={[styles.metaText, styles.benefitText]}>
                            {booking.package ? t('cabinet.card.paidWithPackage') : t('cabinet.card.promotion')}
                            {benefitAmount != null ? ` · ${t('cabinet.card.finalAmount', { amount: benefitAmount })}` : ''}
                        </Text>
                    </View>
                ) : null}
            </View>

            {booking.review || (onReview && (booking.canReview || (booking.review && booking.status === 'paid'))) ? (
                <View style={styles.bookingFooter}>
                    {booking.review ? (
                        <Text style={styles.footerHint}>{t('cabinet.card.reviewed', { rating: booking.review.rating })}</Text>
                    ) : <View />}
                    {onReview && (booking.canReview || (booking.review && booking.status === 'paid')) ? (
                        <Button
                            title={t(booking.review ? 'cabinet.review.edit' : 'cabinet.review.create')}
                            onPress={onReview}
                            variant="outline"
                            size="sm"
                            leadingIcon={<Ionicons name="star-outline" size={16} color={colors.text.primary} />}
                        />
                    ) : null}
                </View>
            ) : null}
        </Card>
    );
}
