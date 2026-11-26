import { useMemo, useState } from 'react';
import { Share, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import { formatInTimeZone } from 'date-fns-tz';

import Avatar from '../../../components/ui/Avatar';
import Badge from '../../../components/ui/Badge';
import ChipGroup from '../../../components/ui/ChipGroup';
import { DateNavigator } from '../../../components/ui/DateTimeFields';
import EmptyState from '../../../components/ui/EmptyState';
import ListRow, { ListGroup } from '../../../components/ui/ListRow';
import Screen from '../../../components/ui/Screen';
import Section from '../../../components/ui/Section';
import { SkeletonList } from '../../../components/ui/Skeleton';
import { colors } from '../../../constants/colors';
import { radii, space, typeScale } from '../../../constants/theme';
import { useToast } from '../../../contexts/ToastContext';
import { useLanguage } from '../../../i18n';
import type { RootStackParamList } from '../../../navigation/types';
import { BookingStatusPill } from '../../staff/bookingStatusPill';
import { toCsv } from '../opsKit/csv';
import { todayInTz } from '../opsKit/dates';
import { LoadError } from '../opsKit/ui';
import { fetchCalendarDay, type BookingOptions, type CalendarBooking, type StaffOption } from './bookingsData';
import { servicesSummary } from './bookingsQuery';

/** The day's bookings of each shown master, in time order; bookings of other masters are not shown. */
export function groupByStaff(staff: StaffOption[], items: CalendarBooking[]): { member: StaffOption; bookings: CalendarBooking[] }[] {
    return staff.map((member) => ({
        member,
        bookings: items.filter((item) => item.staff_id === member.id).sort((a, b) => a.start_at.localeCompare(b.start_at)),
    }));
}

/** The website's CSV of the day: id, master id, start, end (business time) and status. */
export function calendarCsv(items: CalendarBooking[], timezone: string): string {
    return toCsv([
        ['id', 'staff_id', 'start_at', 'end_at', 'status'],
        ...items.map((item) => [
            item.id,
            item.staff_id,
            formatInTimeZone(new Date(item.start_at), timezone, 'yyyy-MM-dd HH:mm'),
            formatInTimeZone(new Date(item.end_at), timezone, 'yyyy-MM-dd HH:mm'),
            item.status,
        ]),
    ]);
}

/** The start time in a fixed tinted column, so the rows of a master line up like a timetable. */
export function TimeBox({ start }: { start: string }) {
    return (
        <View style={styles.time}>
            <Text style={styles.timeStart}>{start}</Text>
        </View>
    );
}

export default function BookingsCalendarTab({ bizId, timezone, options }: { bizId: string; timezone: string; options: BookingOptions }) {
    const { t } = useLanguage();
    const { showToast } = useToast();
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
    const [date, setDate] = useState(() => todayInTz(timezone));
    const [branchId, setBranchId] = useState('all');
    const [refreshing, setRefreshing] = useState(false);
    const query = useQuery({
        queryKey: ['manage-calendar-day', bizId, date],
        queryFn: () => fetchCalendarDay(bizId, date, timezone),
    });

    const staff = useMemo(
        () => (branchId === 'all' ? options.staff : options.staff.filter((member) => member.branch_id === branchId)),
        [options.staff, branchId],
    );
    const groups = useMemo(() => groupByStaff(staff, query.data ?? []), [staff, query.data]);

    const exportCsv = async () => {
        if (!query.data) return;
        try {
            await Share.share({ title: `bookings-${date}.csv`, message: calendarCsv(query.data, timezone) });
        } catch {
            showToast(t('ops.bookings.calendar.exportError'), 'error');
        }
    };

    const onRefresh = async () => {
        setRefreshing(true);
        try { await query.refetch(); } finally { setRefreshing(false); }
    };

    return (
        <Screen refreshing={refreshing} onRefresh={onRefresh} testID="bookings-calendar-tab">
            <Section gap={space.md}>
                <DateNavigator value={date} onChange={setDate} timeZone={timezone} testID="calendar-date" />
                {options.branches.length > 1 ? (
                    <ChipGroup
                        options={[{ key: 'all', label: t('ops.bookings.allBranches') }, ...options.branches.map((branch) => ({ key: branch.id, label: branch.name }))]}
                        value={branchId}
                        onChange={setBranchId}
                        accessibilityLabel={t('ops.bookings.calendar.branchFilter')}
                        testID="calendar-branch"
                    />
                ) : null}
            </Section>

            <Section
                title={t('ops.bookings.calendar.staffTitle')}
                actionLabel={query.data && query.data.length > 0 ? t('ops.bookings.calendar.exportCsv') : undefined}
                onAction={query.data && query.data.length > 0 ? () => void exportCsv() : undefined}
            >
                {query.isLoading ? (
                    <SkeletonList rows={3} testID="calendar-loading" />
                ) : query.error ? (
                    <LoadError title={t('ops.bookings.calendar.loadError')} onRetry={() => void query.refetch()} />
                ) : staff.length === 0 ? (
                    <EmptyState compact icon="people-outline" title={t('ops.bookings.calendar.noStaff')} />
                ) : (
                    groups.map(({ member, bookings }) => (
                        <ListGroup key={member.id} testID={`calendar-staff-${member.id}`}>
                            <ListRow
                                leading={<Avatar name={member.full_name} size={40} />}
                                title={member.full_name}
                                trailing={bookings.length > 0
                                    ? <Badge label={String(bookings.length)} tone="accent" size="md" />
                                    : <Badge label={t('ops.bookings.calendar.free')} tone="success" />}
                            />
                            {bookings.map((booking) => {
                                const start = formatInTimeZone(new Date(booking.start_at), timezone, 'HH:mm');
                                const end = formatInTimeZone(new Date(booking.end_at), timezone, 'HH:mm');
                                const summary = servicesSummary(booking.booking_services, t);
                                return (
                                    <ListRow
                                        key={booking.id}
                                        leading={<TimeBox start={start} />}
                                        subtitle={`${start}–${end}`}
                                        title={summary ?? `#${booking.id.slice(0, 8)}`}
                                        numberOfLines={2}
                                        trailing={<BookingStatusPill status={booking.status} />}
                                        onPress={() => navigation.navigate('BookingDetails', { id: booking.id })}
                                        accessibilityHint={t('ops.bookings.calendar.openBooking')}
                                    />
                                );
                            })}
                        </ListGroup>
                    ))
                )}
            </Section>
        </Screen>
    );
}

const styles = StyleSheet.create({
    time: {
        width: 56,
        paddingVertical: space.sm,
        borderRadius: radii.md,
        backgroundColor: colors.tone.accent.bg,
        alignItems: 'center',
    },
    timeStart: { ...typeScale.bodyStrong, color: colors.tone.accent.fg, fontVariant: ['tabular-nums'] },
});
