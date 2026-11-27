import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import ClientContactActions from '../../components/ClientContactActions';
import SegmentedTabs from '../../components/SegmentedTabs';
import Button from '../../components/ui/Button';
import EmptyState from '../../components/ui/EmptyState';
import ErrorState from '../../components/ui/ErrorState';
import ListRow, { ListGroup } from '../../components/ui/ListRow';
import Screen from '../../components/ui/Screen';
import Section from '../../components/ui/Section';
import { SkeletonList } from '../../components/ui/Skeleton';
import { MIN_TOUCH_TARGET } from '../../constants/accessibility';
import { colors } from '../../constants/colors';
import { radii, space, typeScale } from '../../constants/theme';
import { useLanguage } from '../../i18n';
import { formatDate, formatTime } from '../../utils/format';
import { getServiceName } from '../../utils/i18n';
import { BookingStatusPill } from './bookingStatusPill';
import { StaffAvatarEditor } from './StaffAvatarEditor';
import type { StaffBookingsTab, StaffInfo, UpcomingBooking } from './types';
import { staffServicePriceKey, type StaffService } from './useStaffServices';

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

/**
 * The master's workspace tab: the master with their photo, where they work, the shift as the one
 * primary action, the other tools as rows, their services and their bookings.
 */
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
    const hasPlace = !!(staffInfo.business || staffInfo.branch || onChangeBusiness);

    return (
        <Screen tabBar refreshing={refreshing} onRefresh={onRefresh} testID="staff-screen">
            {/* The header says "Рабочая зона": the screen opens with the master themselves, photo first. */}
            <StaffAvatarEditor staffId={staffInfo.id} name={staffInfo.full_name} avatarUrl={staffInfo.avatar_url} />

            <View style={styles.actions}>
                <Button
                    title={t('staff.myShift')}
                    onPress={onOpenShiftQuick}
                    size="lg"
                    fullWidth
                    leadingIcon={<Ionicons name="time-outline" size={20} color={colors.text.light} />}
                />
                <ListGroup inset>
                    {onCreateBooking ? (
                        <ListRow
                            icon="add-circle-outline"
                            title={t('parity.staffBooking.title')}
                            onPress={onCreateBooking}
                            accessibilityHint={t('parity.staffBooking.clientDescription')}
                        />
                    ) : null}
                    <ListRow icon="calendar-outline" iconTone="info" title={t('staff.workspace.schedule')} onPress={onOpenSchedule} />
                    <ListRow icon="stats-chart-outline" iconTone="success" title={t('staff.workspace.stats')} onPress={onOpenShifts} />
                </ListGroup>
            </View>

            {hasPlace ? (
                <Section title={t('staff.workspace.placeTitle')}>
                    <ListGroup inset>
                        {staffInfo.business ? (
                            <ListRow icon="business-outline" iconTone="neutral" title={t('staff.workspace.business')} value={staffInfo.business.name} />
                        ) : null}
                        {staffInfo.branch ? (
                            <ListRow icon="location-outline" iconTone="neutral" title={t('staff.workspace.branch')} value={staffInfo.branch.name} />
                        ) : null}
                        {onChangeBusiness ? (
                            <ListRow
                                icon="swap-horizontal-outline"
                                title={t('staff.workspace.changeBusiness')}
                                onPress={onChangeBusiness}
                                accessibilityHint={t('staff.workspace.changeBusinessHint')}
                            />
                        ) : null}
                    </ListGroup>
                </Section>
            ) : null}

            {services ? (
                <Section title={t('parity.staffServices.title', { count: services.length })} testID="staff-services">
                    {services.length === 0 ? (
                        <EmptyState compact icon="cut-outline" title={t('parity.staffServices.empty')} />
                    ) : (
                        <ListGroup inset>
                            {services.map((service) => {
                                const price = staffServicePriceKey(service, locale);
                                return (
                                    <ListRow
                                        key={service.id}
                                        icon="cut-outline"
                                        title={getServiceName(service, locale)}
                                        subtitle={t('parity.staffServices.duration', { minutes: String(service.duration_min) })}
                                        value={price ? t(price.key, price.params) : undefined}
                                    />
                                );
                            })}
                        </ListGroup>
                    )}
                </Section>
            ) : null}

            <Section title={t('staff.workspace.upcoming')}>
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
                    <ErrorState compact title={t('staff.workspace.bookingsLoadError')} onRetry={list.onRetry} />
                ) : list.bookings.length > 0 ? (
                    <>
                        <ListGroup>
                            {list.bookings.map((booking) => (
                                <BookingItem
                                    key={booking.id}
                                    booking={booking}
                                    tz={tz}
                                    onOpen={() => list.onOpenBooking(booking.id)}
                                />
                            ))}
                        </ListGroup>
                        {list.hasMore ? (
                            <Button
                                title={t('staff.workspace.loadMore')}
                                onPress={list.onLoadMore}
                                loading={list.isLoadingMore}
                                variant="outline"
                                fullWidth
                            />
                        ) : null}
                    </>
                ) : list.isLoading ? (
                    <SkeletonList rows={3} avatar={false} />
                ) : (
                    <EmptyState
                        compact
                        icon="calendar-outline"
                        title={t(list.tab === 'upcoming' ? 'staff.workspace.emptyTitle' : 'staff.workspace.pastEmptyTitle')}
                        message={t(list.tab === 'upcoming' ? 'staff.workspace.emptyMessage' : 'staff.workspace.pastEmptyMessage')}
                        action={list.tab === 'upcoming' && onCreateBooking ? (
                            <Button title={t('parity.staffBooking.title')} onPress={onCreateBooking} variant="outline" fullWidth />
                        ) : undefined}
                    />
                )}
            </Section>
        </Screen>
    );
}

/** One booking: start time on the left, service and client, the status, and the client's contacts. */
function BookingItem({ booking, tz, onOpen }: { booking: UpcomingBooking; tz: string | null | undefined; onOpen: () => void }) {
    const { t, locale } = useLanguage();
    const service = getServiceName(booking.service, locale) || t('staff.service');
    const start = formatTime(booking.start_at, tz);
    return (
        <View style={styles.booking}>
            <Pressable
                onPress={onOpen}
                accessibilityRole="button"
                accessibilityHint={t('staff.workspace.openBookingHint')}
                style={({ pressed }) => [styles.bookingRow, pressed ? styles.pressed : null]}
                testID={`staff-booking-${booking.id}`}
            >
                <View style={styles.timeBox}>
                    <Text style={styles.timeText}>{start}</Text>
                </View>
                <View style={styles.bookingBody}>
                    <Text style={styles.bookingService} numberOfLines={2}>{service}</Text>
                    {booking.client_name ? (
                        <Text style={styles.bookingMeta} numberOfLines={1}>
                            {t('staff.workspace.bookingClient', { name: booking.client_name })}
                        </Text>
                    ) : null}
                    <Text style={styles.bookingMeta}>
                        {formatDate(booking.start_at, locale, tz)} · {start} – {formatTime(booking.end_at, tz)}
                    </Text>
                </View>
                <BookingStatusPill status={booking.status} />
            </Pressable>
            <ClientContactActions phone={booking.client_phone} />
        </View>
    );
}

const styles = StyleSheet.create({
    actions: { gap: space.md },
    booking: { paddingVertical: space.md, gap: space.sm },
    bookingRow: { minHeight: MIN_TOUCH_TARGET, flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
    pressed: { opacity: colors.interactive.pressedOpacity },
    timeBox: {
        minWidth: 56,
        paddingVertical: space.sm,
        paddingHorizontal: space.xs,
        borderRadius: radii.md,
        backgroundColor: colors.tone.accent.bg,
        alignItems: 'center',
    },
    timeText: { ...typeScale.bodyStrong, color: colors.tone.accent.fg },
    bookingBody: { flex: 1, minWidth: 0, gap: space.xxs },
    bookingService: { ...typeScale.bodyStrong, color: colors.text.primary },
    bookingMeta: { ...typeScale.caption, color: colors.text.secondary },
});
