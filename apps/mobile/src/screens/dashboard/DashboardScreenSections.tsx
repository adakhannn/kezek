import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';

import BookingStatusBadge from '../../components/BookingStatusBadge';
import ClientContactActions from '../../components/ClientContactActions';
import SegmentedTabs from '../../components/SegmentedTabs';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import EmptyState from '../../components/ui/EmptyState';
import MotionPressable from '../../components/ui/MotionPressable';
import { useLanguage, type MobileI18nKey } from '../../i18n';
import { formatDate, formatTime } from '../../utils/format';
import { getServiceName } from '../../utils/i18n';
import { styles } from './dashboardScreenStyles';
import { availableManagerActions } from './managerBookings';
import type { Business, ManagerBooking, ManagerBookingAction, ManagerBookingsScope } from './types';

const ACTION_LABEL: Record<ManagerBookingAction, MobileI18nKey> = {
    confirm: 'manager.action.confirm',
    attended: 'manager.action.attended',
    no_show: 'manager.action.noShow',
    cancel: 'manager.action.cancel',
};
const ACTION_VARIANT: Record<ManagerBookingAction, 'primary' | 'outline' | 'ghost' | 'danger'> = {
    confirm: 'primary',
    attended: 'primary',
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
};

export function DashboardScreenSections(props: Props) {
    const { t, locale } = useLanguage();
    const { businesses, business, bookings, scope, timezone } = props;
    return (
        <ScrollView
            style={styles.container}
            contentContainerStyle={styles.content}
            testID="dashboard-screen"
            refreshControl={
                <RefreshControl refreshing={props.refreshing} onRefresh={() => void props.onRefresh()} />
            }
        >
            <View style={styles.header}>
                <Text style={styles.title}>{t('staff.dashboard.title')}</Text>
                <Text style={styles.subtitle}>
                    {t(businesses.length === 1 ? 'staff.dashboard.subtitleOne' : 'staff.dashboard.subtitleMany')}
                </Text>
            </View>

            {business ? (
                <View style={styles.section}>
                    {businesses.length > 1 ? (
                        <View style={styles.businessChips} accessibilityLabel={t('manager.feed.businessLabel')}>
                            {businesses.map((item) => {
                                const selected = item.id === business.id;
                                return (
                                    <Pressable
                                        key={item.id}
                                        onPress={() => props.onSelectBusiness(item.id)}
                                        accessibilityRole="button"
                                        accessibilityState={{ selected }}
                                        style={[styles.businessChip, selected ? styles.businessChipSelected : null]}
                                    >
                                        <Text style={[styles.businessChipText, selected ? styles.businessChipTextSelected : null]}>{item.name}</Text>
                                    </Pressable>
                                );
                            })}
                        </View>
                    ) : null}

                    <Card style={styles.businessCard}>
                        <Text style={styles.businessName}>{business.name}</Text>
                        {business.role ? <Text style={styles.businessRole}>{t(`manager.role.${business.role}` as MobileI18nKey)}</Text> : null}
                        {business.address ? <Text style={styles.businessAddress}>{business.address}</Text> : null}
                        <Text style={styles.webHint}>{t('manager.feed.webHint')}</Text>
                        <View style={styles.businessActions}>
                            <Button title={t('staff.dashboard.openWeb')} onPress={props.onOpenWeb} variant="outline" fullWidth />
                        </View>
                    </Card>

                    <Text style={styles.sectionTitle}>{t('manager.feed.title')}</Text>
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
                        <EmptyState
                            icon="alert-circle"
                            title={t('manager.feed.loadError')}
                            message={t('staff.checkConnection')}
                            action={<Button title={t('staff.retry')} onPress={props.onRetryBookings} variant="outline" fullWidth />}
                        />
                    ) : bookings.length > 0 ? (
                        <View style={styles.bookingsList}>
                            {bookings.map((booking) => {
                                const actions = availableManagerActions(booking, props.now);
                                const pending = props.pendingBookingId === booking.id;
                                return (
                                    <Card key={booking.id} style={styles.bookingCard}>
                                        <MotionPressable
                                            onPress={() => props.onOpenBooking(booking.id)}
                                            accessibilityRole="button"
                                            accessibilityHint={t('staff.workspace.openBookingHint')}
                                            scale="firm"
                                            testID={`manager-booking-${booking.id}`}
                                        >
                                            <View style={styles.bookingHeader}>
                                                <Text style={styles.bookingTime}>
                                                    {scope === 'upcoming' ? `${formatDate(booking.start_at, locale, timezone)} · ` : ''}
                                                    {formatTime(booking.start_at, timezone)} - {formatTime(booking.end_at, timezone)}
                                                </Text>
                                                <BookingStatusBadge status={booking.status} />
                                            </View>
                                            <Text style={styles.bookingService}>
                                                {getServiceName(booking.service, locale) || t('staff.service')}
                                            </Text>
                                            <Text style={styles.bookingMeta}>
                                                {booking.client_name ? t('manager.feed.client', { name: booking.client_name }) : t('manager.feed.clientUnknown')}
                                            </Text>
                                            {booking.staff_name ? <Text style={styles.bookingMeta}>{t('manager.feed.staff', { name: booking.staff_name })}</Text> : null}
                                            {booking.branch_name ? (
                                                <Text style={styles.bookingMeta}>{t('manager.feed.branch', { name: booking.branch_name })}</Text>
                                            ) : null}
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
                    ) : props.bookingsLoading ? null : (
                        <EmptyState
                            icon="calendar"
                            title={t(scope === 'today' ? 'manager.feed.emptyTodayTitle' : 'manager.feed.emptyUpcomingTitle')}
                            message={t('manager.feed.emptyMessage')}
                        />
                    )}
                </View>
            ) : (
                <EmptyState
                    icon="business"
                    title={t('staff.dashboard.emptyTitle')}
                    message={t('staff.dashboard.emptyMessage')}
                />
            )}
        </ScrollView>
    );
}
