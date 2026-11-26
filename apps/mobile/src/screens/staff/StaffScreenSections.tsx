import { RefreshControl, ScrollView, Text, View } from 'react-native';

import BookingStatusBadge from '../../components/BookingStatusBadge';
import ClientContactActions from '../../components/ClientContactActions';
import SegmentedTabs from '../../components/SegmentedTabs';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import EmptyState from '../../components/ui/EmptyState';
import MotionPressable from '../../components/ui/MotionPressable';
import { useLanguage } from '../../i18n';
import { formatDate, formatTime } from '../../utils/format';
import { getServiceName } from '../../utils/i18n';
import { styles } from './staffScreenStyles';
import type { StaffBookingsTab, StaffInfo, UpcomingBooking } from './types';

export type StaffBookingsList = {
    tab: StaffBookingsTab;
    onTabChange: (tab: StaffBookingsTab) => void;
    bookings: UpcomingBooking[];
    isLoading: boolean;
    error: Error | null;
    hasMore: boolean;
    isLoadingMore: boolean;
    onLoadMore: () => void;
    onRetry: () => void;
    onOpenBooking: (bookingId: string) => void;
};

type Props = {
    staffInfo: StaffInfo;
    list: StaffBookingsList;
    refreshing: boolean;
    onRefresh: () => Promise<void>;
    onOpenShiftQuick: () => void;
    onOpenShifts: () => void;
    onOpenSchedule: () => void;
    /** Shown when the person works in several businesses. */
    onChangeBusiness?: () => void;
};

export function StaffScreenSections({
    staffInfo,
    list,
    refreshing,
    onRefresh,
    onOpenShiftQuick,
    onOpenShifts,
    onOpenSchedule,
    onChangeBusiness,
}: Props) {
    const { t, locale } = useLanguage();
    const tz = staffInfo.business?.tz;
    return (
        <ScrollView
            style={styles.container}
            contentContainerStyle={styles.content}
            testID="staff-screen"
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} />}
        >
            <View style={styles.header}>
                <Text style={styles.title}>{t('staff.workspace.title')}</Text>
                <Text style={styles.subtitle}>{staffInfo.full_name}</Text>
            </View>

            {staffInfo.branch && (
                <Card style={styles.card}>
                    <Text style={styles.sectionTitle}>{t('staff.workspace.branch')}</Text>
                    <Text style={styles.branchName}>{staffInfo.branch.name}</Text>
                </Card>
            )}

            {(staffInfo.business || onChangeBusiness) && (
                <Card style={styles.card}>
                    <Text style={styles.sectionTitle}>{t('staff.workspace.business')}</Text>
                    {staffInfo.business ? (
                        <Text style={styles.businessName}>{staffInfo.business.name}</Text>
                    ) : null}
                    {onChangeBusiness ? (
                        <Button
                            title={t('staff.workspace.changeBusiness')}
                            onPress={onChangeBusiness}
                            variant="outline"
                            fullWidth
                            accessibilityHint={t('staff.workspace.changeBusinessHint')}
                            style={staffInfo.business ? styles.changeBusinessAction : undefined}
                        />
                    ) : null}
                </Card>
            )}

            <View style={styles.section}>
                <Button title={t('staff.myShift')} onPress={onOpenShiftQuick} fullWidth />
                <Button
                    title={t('staff.workspace.schedule')}
                    onPress={onOpenSchedule}
                    variant="outline"
                    fullWidth
                    style={styles.secondaryAction}
                />
                <Button
                    title={t('staff.workspace.stats')}
                    onPress={onOpenShifts}
                    variant="outline"
                    fullWidth
                    style={styles.secondaryAction}
                />
            </View>

            <View style={styles.section}>
                <Text style={styles.sectionTitle}>{t('staff.workspace.upcoming')}</Text>
                <SegmentedTabs
                    tabs={[
                        { key: 'upcoming', label: t('staff.workspace.tabUpcoming') },
                        { key: 'past', label: t('staff.workspace.tabPast') },
                    ]}
                    value={list.tab}
                    onChange={list.onTabChange}
                    testID="staff-bookings-tabs"
                />

                {list.error && list.bookings.length === 0 ? (
                    <EmptyState
                        icon="alert-circle"
                        title={t('staff.workspace.bookingsLoadError')}
                        message={t('staff.checkConnection')}
                        action={<Button title={t('staff.retry')} onPress={list.onRetry} variant="outline" fullWidth />}
                    />
                ) : list.bookings.length > 0 ? (
                    <View style={styles.bookingsList}>
                        {list.bookings.map((booking) => (
                            <Card key={booking.id} style={styles.bookingCard}>
                                <MotionPressable
                                    onPress={() => list.onOpenBooking(booking.id)}
                                    accessibilityRole="button"
                                    accessibilityHint={t('staff.workspace.openBookingHint')}
                                    scale="firm"
                                    testID={`staff-booking-${booking.id}`}
                                >
                                    <View style={styles.bookingHeader}>
                                        <Text style={styles.bookingService}>
                                            {getServiceName(booking.service, locale) || t('staff.service')}
                                        </Text>
                                        <BookingStatusBadge status={booking.status} />
                                    </View>
                                    {booking.client_name ? (
                                        <Text style={styles.bookingClient}>
                                            {t('staff.workspace.bookingClient', { name: booking.client_name })}
                                        </Text>
                                    ) : null}
                                    <View style={styles.bookingTime}>
                                        <Text style={styles.bookingDate}>{formatDate(booking.start_at, locale, tz)}</Text>
                                        <Text style={styles.bookingTimeRange}>
                                            {formatTime(booking.start_at, tz)} - {formatTime(booking.end_at, tz)}
                                        </Text>
                                    </View>
                                </MotionPressable>
                                <ClientContactActions phone={booking.client_phone} />
                            </Card>
                        ))}
                        {list.hasMore ? (
                            <Button
                                title={t('staff.workspace.loadMore')}
                                onPress={list.onLoadMore}
                                loading={list.isLoadingMore}
                                variant="outline"
                                fullWidth
                            />
                        ) : null}
                    </View>
                ) : list.isLoading ? null : (
                    <EmptyState
                        icon="calendar"
                        title={t(list.tab === 'upcoming' ? 'staff.workspace.emptyTitle' : 'staff.workspace.pastEmptyTitle')}
                        message={t(list.tab === 'upcoming' ? 'staff.workspace.emptyMessage' : 'staff.workspace.pastEmptyMessage')}
                    />
                )}
            </View>
        </ScrollView>
    );
}
