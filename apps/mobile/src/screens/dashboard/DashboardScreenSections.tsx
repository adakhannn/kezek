import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import BookingStatusBadge from '../../components/BookingStatusBadge';
import ClientContactActions from '../../components/ClientContactActions';
import SegmentedTabs from '../../components/SegmentedTabs';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import ChipGroup from '../../components/ui/ChipGroup';
import EmptyState from '../../components/ui/EmptyState';
import ErrorState from '../../components/ui/ErrorState';
import ListRow, { ListGroup } from '../../components/ui/ListRow';
import MotionPressable from '../../components/ui/MotionPressable';
import Screen from '../../components/ui/Screen';
import Section from '../../components/ui/Section';
import { SkeletonList } from '../../components/ui/Skeleton';
import { MIN_TOUCH_TARGET } from '../../constants/accessibility';
import { colors } from '../../constants/colors';
import { radii, space, typeScale } from '../../constants/theme';
import { useLanguage, type MobileI18nKey } from '../../i18n';
import { formatDate, formatTime } from '../../utils/format';
import { getServiceName } from '../../utils/i18n';
import { manageMenuFor, type ManageMenuItem } from '../manage/manageMenu';
import { availableManagerActions } from './managerBookings';
import type { Business, ManagerBooking, ManagerBookingAction, ManagerBookingsScope } from './types';

const ACTION_LABEL: Record<ManagerBookingAction, MobileI18nKey> = {
    confirm: 'manager.action.confirm',
    attended: 'manager.action.attended',
    no_show: 'manager.action.noShow',
    cancel: 'manager.action.cancel',
};
// A list of cards: no gradient (primary) button per card, as in the owner's bookings list.
const ACTION_VARIANT: Record<ManagerBookingAction, 'secondary' | 'outline' | 'ghost' | 'danger'> = {
    confirm: 'secondary',
    attended: 'secondary',
    no_show: 'outline',
    cancel: 'ghost',
};

type Props = {
    businesses: Business[];
    business: Business | null;
    onSelectBusiness: (bizId: string) => void;
    scope: ManagerBookingsScope;
    onScopeChange: (scope: ManagerBookingsScope) => void;
    bookings: ManagerBooking[];
    timezone: string | null;
    now: Date;
    bookingsLoading: boolean;
    bookingsError: Error | null;
    hasMore: boolean;
    isLoadingMore: boolean;
    onLoadMore: () => void;
    onRetryBookings: () => void;
    pendingBookingId: string | null;
    onAction: (booking: ManagerBooking, action: ManagerBookingAction) => void;
    onOpenBooking: (bookingId: string) => void;
    refreshing: boolean;
    onRefresh: () => Promise<void>;
    onOpenWeb: () => void;
    /** A management section of the chosen business (the website's /dashboard pages). */
    onOpenManage: (item: ManageMenuItem) => void;
};

/**
 * The Business tab: the header says "Мой бизнес", so the screen opens with the business itself
 * (switcher, name and role), then the management sections as an even grid, then today's bookings.
 */
export function DashboardScreenSections(props: Props) {
    const { t, locale } = useLanguage();
    const { businesses, business, bookings, scope, timezone } = props;

    if (!business) {
        return (
            <Screen tabBar refreshing={props.refreshing} onRefresh={props.onRefresh} testID="dashboard-screen">
                <EmptyState
                    icon="business-outline"
                    title={t('staff.dashboard.emptyTitle')}
                    message={t('staff.dashboard.emptyMessage')}
                />
            </Screen>
        );
    }

    const menu = manageMenuFor(business.role);
    const allBookings = menu.find((item) => item.key === 'bookings');

    return (
        <Screen tabBar refreshing={props.refreshing} onRefresh={props.onRefresh} testID="dashboard-screen">
            <View style={styles.hero}>
                {businesses.length > 1 ? (
                    <ChipGroup
                        options={businesses.map((item) => ({ key: item.id, label: item.name }))}
                        value={business.id}
                        onChange={props.onSelectBusiness}
                        accessibilityLabel={t('manager.feed.businessLabel')}
                        testID="dashboard-business"
                    />
                ) : null}
                <Card variant="accent" padding="md" style={styles.businessCard}>
                    <View style={styles.businessTop}>
                        <View style={styles.businessIcon}>
                            <Ionicons name="storefront-outline" size={22} color={colors.tone.accent.fg} />
                        </View>
                        <View style={styles.businessText}>
                            <Text style={styles.businessName} numberOfLines={2} accessibilityRole="header">{business.name}</Text>
                            {business.address ? <Text style={styles.businessAddress} numberOfLines={2}>{business.address}</Text> : null}
                        </View>
                    </View>
                    {business.role ? <Badge label={t(`manager.role.${business.role}` as MobileI18nKey)} tone="accent" size="md" /> : null}
                </Card>
            </View>

            {menu.length > 0 ? (
                <Section title={t('manager.manage.sectionTitle')}>
                    {/* Rows of two equal cells: MotionPressable styles its inner view, so the cell
                        width is set on a wrapper here, not on the pressable. */}
                    <View style={styles.grid} testID="manage-menu">
                        {Array.from({ length: Math.ceil(menu.length / 2) }, (_, row) => menu.slice(row * 2, row * 2 + 2)).map((pair) => (
                            <View key={pair[0].key} style={styles.gridRow}>
                                {pair.map((item) => (
                            <View key={item.key} style={styles.gridCell}>
                            <MotionPressable
                                key={item.key}
                                onPress={() => props.onOpenManage(item)}
                                accessibilityRole="button"
                                accessibilityLabel={t(item.label)}
                                style={styles.tile}
                                testID={`manage-${item.key}`}
                            >
                                <View style={styles.tileIcon}>
                                    <Ionicons name={item.icon} size={18} color={colors.tone.accent.fg} />
                                </View>
                                <Text style={styles.tileLabel} numberOfLines={2}>{t(item.label)}</Text>
                            </MotionPressable>
                            </View>
                                ))}
                                {pair.length === 1 ? <View style={styles.gridCell} /> : null}
                            </View>
                        ))}
                    </View>
                </Section>
            ) : (
                <Text style={styles.webHint}>{t('manager.feed.webHint')}</Text>
            )}

            <Section
                title={t('manager.feed.title')}
                actionLabel={allBookings ? t('manager.feed.allBookings') : undefined}
                onAction={allBookings ? () => props.onOpenManage(allBookings) : undefined}
                gap={0}
            >
                <SegmentedTabs
                    tabs={[
                        { key: 'today', label: t('manager.feed.tabToday') },
                        { key: 'upcoming', label: t('manager.feed.tabUpcoming') },
                    ]}
                    value={scope}
                    onChange={props.onScopeChange}
                    testID="manager-bookings-tabs"
                />

                {props.bookingsError && bookings.length === 0 ? (
                    <ErrorState compact title={t('manager.feed.loadError')} onRetry={props.onRetryBookings} />
                ) : bookings.length > 0 ? (
                    <View style={styles.bookings}>
                        {bookings.map((booking) => {
                            const actions = availableManagerActions(booking, props.now);
                            const pending = props.pendingBookingId === booking.id;
                            return (
                                <Card key={booking.id} variant="plain" padding="md" style={styles.booking}>
                                    <MotionPressable
                                        onPress={() => props.onOpenBooking(booking.id)}
                                        accessibilityRole="button"
                                        accessibilityHint={t('staff.workspace.openBookingHint')}
                                        scale="firm"
                                        testID={`manager-booking-${booking.id}`}
                                        style={styles.bookingBody}
                                    >
                                        <View style={styles.bookingHeader}>
                                            <Text style={styles.bookingTime}>
                                                {scope === 'upcoming' ? `${formatDate(booking.start_at, locale, timezone)} · ` : ''}
                                                {formatTime(booking.start_at, timezone)}–{formatTime(booking.end_at, timezone)}
                                            </Text>
                                            <BookingStatusBadge status={booking.status} />
                                        </View>
                                        <Text style={styles.bookingService} numberOfLines={2}>
                                            {getServiceName(booking.service, locale) || t('staff.service')}
                                        </Text>
                                        <Text style={styles.bookingMeta} numberOfLines={1}>
                                            {booking.client_name ? t('manager.feed.client', { name: booking.client_name }) : t('manager.feed.clientUnknown')}
                                        </Text>
                                        {booking.staff_name ? <Text style={styles.bookingMeta} numberOfLines={1}>{t('manager.feed.staff', { name: booking.staff_name })}</Text> : null}
                                        {booking.branch_name ? <Text style={styles.bookingMeta} numberOfLines={1}>{t('manager.feed.branch', { name: booking.branch_name })}</Text> : null}
                                    </MotionPressable>
                                    <ClientContactActions phone={booking.client_phone} />
                                    {actions.length > 0 ? (
                                        <View style={styles.bookingActions}>
                                            {actions.map((action) => (
                                                <Button
                                                    key={action}
                                                    title={t(ACTION_LABEL[action])}
                                                    onPress={() => props.onAction(booking, action)}
                                                    variant={ACTION_VARIANT[action]}
                                                    size="sm"
                                                    disabled={!!props.pendingBookingId}
                                                    loading={pending}
                                                    style={styles.bookingAction}
                                                />
                                            ))}
                                        </View>
                                    ) : null}
                                </Card>
                            );
                        })}
                        {props.hasMore ? (
                            <Button
                                title={t('manager.feed.loadMore')}
                                onPress={props.onLoadMore}
                                loading={props.isLoadingMore}
                                variant="outline"
                                fullWidth
                            />
                        ) : null}
                    </View>
                ) : props.bookingsLoading ? (
                    <SkeletonList rows={3} avatar={false} />
                ) : (
                    <EmptyState
                        compact
                        icon="calendar-clear-outline"
                        title={t(scope === 'today' ? 'manager.feed.emptyTodayTitle' : 'manager.feed.emptyUpcomingTitle')}
                        message={t('manager.feed.emptyMessage')}
                    />
                )}
            </Section>

            <ListGroup>
                <ListRow
                    icon="open-outline"
                    iconTone="neutral"
                    title={t('staff.dashboard.openWeb')}
                    onPress={props.onOpenWeb}
                    accessibilityHint={t('manager.feed.webHint')}
                />
            </ListGroup>
        </Screen>
    );
}

const styles = StyleSheet.create({
    hero: { gap: space.md },
    businessCard: { gap: space.md },
    businessTop: { flexDirection: 'row', alignItems: 'center', gap: space.md },
    businessIcon: {
        width: 44,
        height: 44,
        borderRadius: radii.md,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.tone.accent.bg,
    },
    businessText: { flex: 1, gap: space.xxs },
    businessName: { ...typeScale.title, color: colors.text.primary },
    businessAddress: { ...typeScale.caption, color: colors.text.secondary },
    webHint: { ...typeScale.caption, color: colors.text.secondary },
    grid: { gap: space.sm },
    gridRow: { flexDirection: 'row', gap: space.sm },
    gridCell: { flex: 1 },
    tile: {
        flex: 1,
        minHeight: 56,
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.md,
        paddingHorizontal: space.md,
        paddingVertical: space.sm,
        borderRadius: radii.lg,
        backgroundColor: colors.surface.card,
    },
    tileIcon: {
        width: 32,
        height: 32,
        borderRadius: radii.sm,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.tone.accent.bg,
    },
    tileLabel: { ...typeScale.callout, fontWeight: '600', color: colors.text.primary, flexShrink: 1 },
    bookings: { gap: space.sm },
    booking: { gap: space.sm },
    bookingBody: { gap: space.xs },
    bookingHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
    bookingTime: { ...typeScale.bodyStrong, color: colors.text.primary, flexShrink: 1, fontVariant: ['tabular-nums'] },
    bookingService: { ...typeScale.body, color: colors.text.primary },
    bookingMeta: { ...typeScale.caption, color: colors.text.secondary },
    bookingActions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
    bookingAction: { flexGrow: 1, minHeight: MIN_TOUCH_TARGET },
});

