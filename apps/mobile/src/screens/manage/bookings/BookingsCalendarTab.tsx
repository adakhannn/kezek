import { useMemo, useState } from 'react';
import { RefreshControl, ScrollView, Share, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import { formatInTimeZone } from 'date-fns-tz';

import BookingStatusBadge from '../../../components/BookingStatusBadge';
import Button from '../../../components/ui/Button';
import Card from '../../../components/ui/Card';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';
import MotionPressable from '../../../components/ui/MotionPressable';
import { colors } from '../../../constants/colors';
import { useToast } from '../../../contexts/ToastContext';
import { useLanguage } from '../../../i18n';
import type { RootStackParamList } from '../../../navigation/types';
import { toCsv } from '../opsKit/csv';
import { addDaysToDate, todayInTz } from '../opsKit/dates';
import { dayLabel } from '../opsKit/format';
import { ChipGroup, Field, LoadError, Stepper, ui } from '../opsKit/ui';
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

export default function BookingsCalendarTab({ bizId, timezone, options }: { bizId: string; timezone: string; options: BookingOptions }) {
    const { t, locale } = useLanguage();
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
        <ScrollView
            style={ui.screen}
            contentContainerStyle={ui.content}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} />}
            testID="bookings-calendar-tab"
        >
            <Text style={ui.sectionTitle}>{t('ops.bookings.calendar.title')}</Text>
            <Text style={ui.muted}>{t('ops.bookings.tabs.calendarDesc')}</Text>
            {options.branches.length > 1 ? (
                <Field label={t('ops.bookings.calendar.branchFilter')}>
                    <ChipGroup
                        options={[{ key: 'all', label: t('ops.bookings.allBranches') }, ...options.branches.map((branch) => ({ key: branch.id, label: branch.name }))]}
                        value={branchId}
                        onChange={setBranchId}
                        testID="calendar-branch"
                    />
                </Field>
            ) : null}
            <Field label={t('ops.bookings.calendar.date')}>
                <Stepper
                    label={dayLabel(date, locale)}
                    onPrev={() => setDate((value) => addDaysToDate(value, -1))}
                    onNext={() => setDate((value) => addDaysToDate(value, 1))}
                    prevLabel={t('ops.common.prevDay')}
                    nextLabel={t('ops.common.nextDay')}
                    pickDate={{ value: date, onPick: setDate }}
                    testID="calendar-date"
                />
                <View style={ui.wrap}>
                    <Button title={t('ops.common.today')} onPress={() => setDate(todayInTz(timezone))} variant="outline" size="sm" />
                    <Button
                        title={t('ops.bookings.calendar.exportCsv')}
                        onPress={() => void exportCsv()}
                        variant="outline"
                        size="sm"
                        disabled={!query.data}
                    />
                </View>
            </Field>

            {query.isLoading ? (
                <LoadingSpinner message={t('common.loading')} />
            ) : query.error ? (
                <LoadError title={t('ops.bookings.calendar.loadError')} onRetry={() => void query.refetch()} />
            ) : staff.length === 0 ? (
                <Text style={ui.muted}>{t('ops.bookings.calendar.noStaff')}</Text>
            ) : (
                groups.map(({ member, bookings }) => (
                    <Card key={member.id} padding="md" testID={`calendar-staff-${member.id}`}>
                        <Text style={[ui.text, { fontWeight: '700' }]}>{member.full_name}</Text>
                        {bookings.length === 0 ? (
                            <Text style={[ui.muted, { marginTop: 4 }]}>{t('ops.bookings.calendar.free')}</Text>
                        ) : (
                            bookings.map((booking) => {
                                const time = `${formatInTimeZone(new Date(booking.start_at), timezone, 'HH:mm')}–${formatInTimeZone(new Date(booking.end_at), timezone, 'HH:mm')}`;
                                const summary = servicesSummary(booking.booking_services, t);
                                return (
                                    <MotionPressable
                                        key={booking.id}
                                        onPress={() => navigation.navigate('BookingDetails', { id: booking.id })}
                                        accessibilityRole="button"
                                        accessibilityLabel={`${t('ops.bookings.calendar.openBooking')} ${time}${summary ? `, ${summary}` : ''}`}
                                        style={[ui.listRow, { alignItems: 'flex-start' }]}
                                    >
                                        <View style={{ flex: 1, gap: 2 }}>
                                            <Text style={[ui.text, { fontWeight: '600' }]}>{time}</Text>
                                            <Text style={ui.muted} numberOfLines={3}>{summary ?? `#${booking.id.slice(0, 8)}`}</Text>
                                        </View>
                                        <BookingStatusBadge status={booking.status} />
                                    </MotionPressable>
                                );
                            })
                        )}
                    </Card>
                ))
            )}
            <Text style={[ui.hint, { color: colors.text.tertiary }]}>{t('ops.bookings.summary.today')}</Text>
        </ScrollView>
    );
}
