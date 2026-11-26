import { useEffect, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { formatInTimeZone } from 'date-fns-tz';

import ClientContactActions from '../../../components/ClientContactActions';
import Button from '../../../components/ui/Button';
import Card from '../../../components/ui/Card';
import EmptyState from '../../../components/ui/EmptyState';
import Input from '../../../components/ui/Input';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';
import MotionPressable from '../../../components/ui/MotionPressable';
import { colors } from '../../../constants/colors';
import { useToast } from '../../../contexts/ToastContext';
import { useNow } from '../../../hooks/useNow';
import { useLanguage, type MobileI18nKey } from '../../../i18n';
import { getErrorMessage } from '../../../lib/errors';
import type { RootStackParamList } from '../../../navigation/types';
import { getServiceName } from '../../../utils/i18n';
import { runManagerBookingAction } from '../../dashboard/managerBookings';
import type { ManagerBookingAction } from '../../dashboard/types';
import { dayBoundsInTz, todayInTz } from '../opsKit/dates';
import { ChipGroup, Field, LoadError, ui } from '../opsKit/ui';
import BookingRowActions from './BookingRowActions';
import { fetchBookingsPage, fetchCurrentStaffId, type BranchOption } from './bookingsData';
import {
    bookingStatusLabelKey,
    dashboardBookingsRpcArgs,
    lastPage,
    SEARCH_DEBOUNCE_MS,
    servicesSummary,
    STATUS_FILTERS,
    type BookingStatus,
    type BookingsPreset,
    type BookingsStatusFilter,
} from './bookingsQuery';

const STATUS_LABEL: Record<BookingsStatusFilter, MobileI18nKey> = {
    all: 'ops.bookings.filters.statusAll',
    hold: 'ops.bookings.status.hold',
    confirmed: 'ops.bookings.status.confirmed',
    paid: 'ops.bookings.status.paid',
    cancelled: 'ops.bookings.status.cancelled',
    no_show: 'ops.bookings.status.no_show',
};

/** The colours of the app's status badges (components/BookingStatusBadge). */
const STATUS_COLOR: Record<BookingStatus, string> = {
    hold: colors.status.hold,
    confirmed: colors.status.info,
    paid: colors.status.success,
    cancelled: colors.status.danger,
    no_show: colors.text.secondary,
};
const STATUS_SURFACE: Record<BookingStatus, string> = {
    hold: colors.feedback.warningSurface,
    confirmed: colors.feedback.infoSurface,
    paid: colors.feedback.successSurface,
    cancelled: colors.feedback.dangerSurface,
    no_show: colors.surface.elevated,
};

const ACTION_DONE: Record<ManagerBookingAction, MobileI18nKey> = {
    confirm: 'ops.bookings.actions.confirmed',
    cancel: 'ops.bookings.actions.cancelled',
    attended: 'ops.bookings.actions.attendedDone',
    no_show: 'ops.bookings.actions.noShowDone',
};

/** The website's bookings list: search over the whole history, status / branch filters, presets, pages and actions. */
export default function BookingsListTab({ bizId, timezone, branches }: { bizId: string; timezone: string; branches: BranchOption[] }) {
    const { t } = useLanguage();
    const { showToast } = useToast();
    const { now } = useNow();
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
    const queryClient = useQueryClient();
    const [statusFilter, setStatusFilter] = useState<BookingsStatusFilter>('all');
    const [branchFilter, setBranchFilter] = useState('all');
    const [preset, setPreset] = useState<BookingsPreset>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [refreshing, setRefreshing] = useState(false);

    // Typing is debounced; a new search starts on page 1.
    useEffect(() => {
        const next = searchQuery.trim();
        if (next === search) return undefined;
        const timer = setTimeout(() => {
            setSearch(next);
            setPage(1);
        }, next ? SEARCH_DEBOUNCE_MS : 0);
        return () => clearTimeout(timer);
    }, [searchQuery, search]);

    const staffQuery = useQuery({
        queryKey: ['manage-current-staff', bizId],
        queryFn: () => fetchCurrentStaffId(bizId),
        staleTime: 5 * 60_000,
    });
    const currentStaffId = staffQuery.data ?? null;

    // The business day moves at midnight while the screen stays open (FE-14).
    const today = todayInTz(timezone, now);
    const args = useMemo(() => dashboardBookingsRpcArgs({
        bizId,
        statusFilter,
        branchFilter,
        preset,
        search,
        page,
        todayBounds: preset === 'today' ? dayBoundsInTz(today, timezone) : null,
        currentStaffId: preset === 'myStaff' ? currentStaffId : null,
    }), [bizId, statusFilter, branchFilter, preset, search, page, today, timezone, currentStaffId]);

    const listQuery = useQuery({
        queryKey: ['manage-bookings-list', args],
        queryFn: () => fetchBookingsPage(args),
        placeholderData: keepPreviousData,
    });
    const data = listQuery.data;
    const shownIsCurrent = !listQuery.isPlaceholderData;

    // The page is past the end (bookings were cancelled or filtered away): show the last page.
    useEffect(() => {
        if (data && shownIsCurrent && data.rows.length === 0 && args.p_offset > 0) setPage(lastPage(data.total));
    }, [data, shownIsCurrent, args.p_offset]);

    const action = useMutation({
        mutationFn: ({ bookingId, kind }: { bookingId: string; kind: ManagerBookingAction }) => runManagerBookingAction(bookingId, kind),
        onSuccess: (_result, variables) => showToast(t(ACTION_DONE[variables.kind]), 'success'),
        onError: (error) => showToast(getErrorMessage(error, t('ops.bookings.actions.error'), t), 'error'),
        onSettled: () => {
            void queryClient.invalidateQueries({ queryKey: ['manage-bookings-list'] });
            void queryClient.invalidateQueries({ queryKey: ['manage-calendar-day'] });
            void queryClient.invalidateQueries({ queryKey: ['manager-bookings'] });
        },
    });

    const choose = <T,>(setter: (value: T) => void) => (value: T) => {
        setter(value);
        setPage(1);
    };

    const modeKey: MobileI18nKey = preset === 'today'
        ? 'ops.bookings.mode.today'
        : preset === 'myStaff'
          ? 'ops.bookings.mode.myStaff'
          : searchQuery.trim()
            ? 'ops.bookings.mode.search'
            : 'ops.bookings.mode.history';

    const presets: { key: Exclude<BookingsPreset, null>; label: string }[] = [
        { key: 'today', label: t('ops.bookings.presets.today') },
        ...(currentStaffId ? [{ key: 'myStaff' as const, label: t('ops.bookings.presets.myStaff') }] : []),
        { key: 'holdConfirmed', label: t('ops.bookings.presets.holdConfirmed') },
    ];

    const rows = data?.rows ?? [];
    const total = data?.total ?? 0;
    const pages = lastPage(total);
    const busy = listQuery.isFetching;

    const onRefresh = async () => {
        setRefreshing(true);
        try { await listQuery.refetch(); } finally { setRefreshing(false); }
    };

    return (
        <ScrollView
            style={ui.screen}
            contentContainerStyle={ui.content}
            keyboardShouldPersistTaps="handled"
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} />}
            testID="bookings-list-tab"
        >
            <View style={ui.rowBetween}>
                <View style={ui.badge}><Text style={ui.badgeText}>{t(modeKey)}</Text></View>
                <Text style={ui.muted} accessibilityLiveRegion="polite">
                    {t('ops.bookings.results', { shown: rows.length, total })}
                </Text>
            </View>
            <Input
                label={t('ops.bookings.filters.search')}
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder={t('ops.bookings.filters.searchPlaceholder')}
                helperText={t('ops.bookings.filters.searchHint')}
                autoCorrect={false}
                autoCapitalize="none"
                returnKeyType="search"
                testID="bookings-search"
            />
            <Field label={t('ops.bookings.presets.title')}>
                <ChipGroup
                    options={presets}
                    value={preset}
                    onChange={(value) => choose(setPreset)(preset === value ? null : value)}
                    testID="bookings-preset"
                />
            </Field>
            <Field label={t('ops.bookings.filters.status')} hint={preset ? t('ops.bookings.presets.replacesStatus') : undefined}>
                <ChipGroup
                    options={STATUS_FILTERS.map((key) => ({ key, label: t(STATUS_LABEL[key]) }))}
                    value={statusFilter}
                    onChange={choose(setStatusFilter)}
                    disabled={!!preset}
                    testID="bookings-status"
                />
            </Field>
            {branches.length > 0 ? (
                <Field label={t('ops.bookings.filters.branch')}>
                    <ChipGroup
                        options={[{ key: 'all', label: t('ops.bookings.allBranches') }, ...branches.map((branch) => ({ key: branch.id, label: branch.name }))]}
                        value={branchFilter}
                        onChange={choose(setBranchFilter)}
                        testID="bookings-branch"
                    />
                </Field>
            ) : null}
            <Button title={t('ops.bookings.refresh')} onPress={() => void listQuery.refetch()} variant="outline" size="sm" loading={busy} />

            {listQuery.isLoading ? (
                <LoadingSpinner message={t('common.loading')} />
            ) : listQuery.error && shownIsCurrent ? (
                <LoadError title={t('ops.bookings.list.loadError')} onRetry={() => void listQuery.refetch()} />
            ) : rows.length === 0 ? (
                <EmptyState icon="calendar" title={t('ops.bookings.list.empty')} message={t('ops.bookings.list.emptyHint')} />
            ) : (
                <View style={{ gap: colors.layout.space3, opacity: busy && !shownIsCurrent ? 0.6 : 1 }} accessibilityState={{ busy }}>
                    {rows.map((row) => {
                        const branchName = branches.find((branch) => branch.id === row.branch_id)?.name ?? null;
                        const serviceLabel = servicesSummary(row.booking_services, t) || (row.service ? getServiceName(row.service, t.locale) : '');
                        const clientLabel = row.client_name || (row.client_id ? t('ops.bookings.client') : t('ops.bookings.walkIn'));
                        return (
                            <Card key={row.id} padding="md" testID={`bookings-row-${row.id}`}>
                                <View style={ui.rowBetween}>
                                    <MotionPressable
                                        onPress={() => navigation.navigate('BookingDetails', { id: row.id })}
                                        accessibilityRole="link"
                                        accessibilityLabel={`${t('ops.bookings.calendar.openBooking')} #${row.id.slice(0, 8)}`}
                                        style={{ minHeight: 44, justifyContent: 'center' }}
                                    >
                                        <Text style={[ui.muted, { color: colors.accent.indigo, fontFamily: 'monospace' }]}>#{row.id.slice(0, 8)}</Text>
                                    </MotionPressable>
                                    <View style={[ui.badge, { backgroundColor: STATUS_SURFACE[row.status] }]}>
                                        <Text style={[ui.badgeText, { color: STATUS_COLOR[row.status] }]}>
                                            {t(bookingStatusLabelKey(row.status, row.start_at, now))}
                                        </Text>
                                    </View>
                                </View>
                                <Text style={[ui.text, { fontWeight: '600' }]}>{serviceLabel || '—'}</Text>
                                {branchName ? <Text style={ui.muted}>{branchName}</Text> : null}
                                <Text style={[ui.text, { marginTop: 6 }]}>
                                    {formatInTimeZone(new Date(row.start_at), timezone, 'dd.MM.yyyy')}{'  '}
                                    {formatInTimeZone(new Date(row.start_at), timezone, 'HH:mm')} - {formatInTimeZone(new Date(row.end_at), timezone, 'HH:mm')}
                                </Text>
                                <Text style={ui.muted}>{t('ops.bookings.list.master')}: {row.staff_name || '—'}</Text>
                                <Text style={ui.muted}>{t('ops.bookings.client')}: {clientLabel}</Text>
                                <ClientContactActions phone={row.client_phone} />
                                <View style={{ marginTop: colors.layout.space2 }}>
                                    <BookingRowActions
                                        bookingId={row.id}
                                        status={row.status}
                                        startAt={row.start_at}
                                        now={now}
                                        pending={action.isPending && action.variables?.bookingId === row.id}
                                        onAction={(bookingId, kind) => action.mutate({ bookingId, kind })}
                                    />
                                </View>
                            </Card>
                        );
                    })}
                </View>
            )}

            {total > rows.length || page > 1 ? (
                <View style={ui.rowBetween} testID="bookings-pagination">
                    <Button title={t('ops.common.prev')} onPress={() => setPage((value) => Math.max(1, value - 1))} variant="outline" size="sm" disabled={page <= 1 || busy} />
                    <Text style={ui.muted}>{t('ops.common.pageOf', { page, pages })}</Text>
                    <Button title={t('ops.common.next')} onPress={() => setPage((value) => Math.min(pages, value + 1))} variant="outline" size="sm" disabled={page >= pages || busy} />
                </View>
            ) : null}
        </ScrollView>
    );
}
