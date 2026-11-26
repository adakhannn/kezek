import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

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
import { StaffAvatarEditor } from './StaffAvatarEditor';
import { styles } from './staffScreenStyles';
import type { StaffBookingsTab, StaffInfo, UpcomingBooking } from './types';
import { staffServicePriceKey, type StaffService } from './useStaffServices';

const localStyles = StyleSheet.create({
    service: { paddingVertical: 6, gap: 2 },
});

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
    /** The website's "Создать запись": book a client who calls or comes in. */
    onCreateBooking?: () => void;
    /** "Мои услуги" of the website's staff cabinet; undefined while loading. */
    services?: StaffService[];
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
    onCreateBooking,
    services,
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
            {/* The header says "Рабочая зона": the screen opens with the master themselves, photo first. */}
            <View style={styles.header}>
                <StaffAvatarEditor staffId={staffInfo.id} name={staffInfo.full_name} avatarUrl={staffInfo.avatar_url} />
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

            {services ? (
                <Card style={styles.card} testID="staff-services">
                    <Text style={styles.sectionTitle}>{t('parity.staffServices.title', { count: services.length })}</Text>
                    {services.length === 0 ? (
                        <Text style={styles.subtitle}>{t('parity.staffServices.empty')}</Text>
                    ) : (
                        services.map((service) => {
                            const price = staffServicePriceKey(service);
                            return (
                                <View key={service.id} style={localStyles.service}>
                                    <Text style={styles.branchName}>{getServiceName(service, locale)}</Text>
                                    <Text style={styles.subtitle}>
                                        {[t('parity.staffServices.duration', { minutes: String(service.duration_min) }), price ? t(price.key, price.params) : null]
                                            .filter(Boolean)
                                            .join(' · ')}
                                    </Text>
                                </View>
                            );
                        })
                    )}
                </Card>
            ) : null}

            <View style={styles.section}>
                <Button title={t('staff.myShift')} onPress={onOpenShiftQuick} fullWidth />
                {onCreateBooking ? (
                    <Button
                        title={t('parity.staffBooking.title')}
                        onPress={onCreateBooking}
                        variant="outline"
                        fullWidth
                        style={styles.secondaryAction}
                        accessibilityHint={t('parity.staffBooking.clientDescription')}
                    />
                ) : null}
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
