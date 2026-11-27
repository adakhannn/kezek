import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRoute, type RouteProp } from '@react-navigation/native';
import { keepPreviousData, useQuery } from '@tanstack/react-query';

import Avatar from '../../../components/ui/Avatar';
import Badge, { StatusPill } from '../../../components/ui/Badge';
import Card from '../../../components/ui/Card';
import EmptyState from '../../../components/ui/EmptyState';
import { KeyValueRow } from '../../../components/ui/ListRow';
import Screen from '../../../components/ui/Screen';
import Section from '../../../components/ui/Section';
import StatTile, { StatGrid } from '../../../components/ui/StatTile';
import { colors } from '../../../constants/colors';
import { radii, space, typeScale } from '../../../constants/theme';
import { translatePlural, useLanguage, type MobileI18nKey } from '../../../i18n';
import type { RootStackParamList } from '../../../navigation/types';
import { dayLabel, shortDateTime, useCurrentBusinessReady } from '../opsKit/format';
import { formatMoney, formatNumber, formatShare } from '../opsKit/money';
import { LoadError, ScreenSkeleton, ui } from '../opsKit/ui';
import { fetchStaffFinanceStats, guaranteeTopup, type FinancePeriod } from './financeData';
import FinancePeriodPicker, { financePeriodLabel } from './FinancePeriodPicker';
import { MiniStats } from './ManageFinanceScreen';

const PERIOD_LABEL: Record<FinancePeriod, MobileI18nKey> = {
    day: 'ops.finance.period.day',
    month: 'ops.finance.period.month',
    year: 'ops.finance.period.year',
};

/**
 * One master's money of a day, month or year (the website's staff finance stats): turnover, the
 * split between master and business, the guarantee top-up, review flags and the shift ledger.
 * Settings and hour corrections stay with the staff section.
 */
export default function ManageFinanceStaffScreen() {
    const { params } = useRoute<RouteProp<RootStackParamList, 'ManageFinanceStaff'>>();
    const { t, locale } = useLanguage();
    const business = useCurrentBusinessReady(params.bizId);
    const [period, setPeriod] = useState<FinancePeriod>('day');
    const [anchor, setAnchor] = useState<string | null>(null);
    const [refreshing, setRefreshing] = useState(false);
    const query = useQuery({
        queryKey: ['manage-finance-staff', params.bizId, params.staffId, period, anchor],
        queryFn: () => fetchStaffFinanceStats(params.staffId, period, anchor),
        enabled: business.ready,
        placeholderData: keepPreviousData,
    });

    if (business.error) return <LoadError screen title={t('manager.manage.selectError')} onRetry={business.retry} />;
    if (!business.ready || (query.isLoading && !query.data)) return <ScreenSkeleton testID="manage-finance-staff-loading" />;

    const stats = query.data;
    const shownAnchor = anchor ?? stats?.dateFrom ?? '';
    const name = stats?.staffName || params.staffName || '';
    const onRefresh = async () => {
        setRefreshing(true);
        try { await query.refetch(); } finally { setRefreshing(false); }
    };

    const body = () => {
        if (query.error && !query.isFetching) return <LoadError title={t('ops.finance.error.title')} onRetry={() => void query.refetch()} />;
        if (!stats) return null;
        const turnover = stats.totalAmount + stats.totalConsumables;
        const topup = guaranteeTopup(stats);
        const flags = [
            stats.totalLateMinutes > 0 ? `${t('ops.finance.flags.late')}: ${stats.totalLateMinutes}` : null,
            stats.totalConsumables > 0 ? `${t('ops.finance.flags.consumables')}: ${formatMoney(stats.totalConsumables, t)}` : null,
            topup > 0 ? `${t('ops.finance.flags.guarantee')}: ${formatMoney(topup, t)}` : null,
        ].filter((flag): flag is string => !!flag);
        return (
            <View style={[styles.body, { opacity: query.isPlaceholderData ? 0.6 : 1 }]}>
                <View style={styles.summary} testID="finance-staff-summary">
                    <StatTile
                        icon="cash-outline"
                        tone="success"
                        label={t('ops.finance.staffStats.turnover')}
                        value={formatMoney(turnover, t)}
                        hint={financePeriodLabel(period, shownAnchor, locale)}
                    />
                    <StatGrid>
                        <StatTile label={t('ops.finance.staffStats.toEmployee')} value={formatMoney(stats.totalMaster, t)} hint={`${formatShare(stats.totalMaster, turnover)} • ${t('ops.finance.share.split')}`} />
                        <StatTile label={t('ops.finance.staffStats.toBusiness')} value={formatMoney(stats.totalSalon, t)} hint={`${formatShare(stats.totalSalon, turnover)} • ${t('ops.finance.share.split')}`} />
                        <StatTile
                            icon="shield-checkmark-outline"
                            tone={topup > 0 ? 'warning' : undefined}
                            label={t('ops.finance.guarantees.title')}
                            value={formatMoney(topup > 0 ? topup : 0, t)}
                            hint={topup > 0 ? `${t('ops.finance.guarantees.baseShare')}: ${formatMoney(stats.totalBaseMasterShare, t)}` : t('ops.finance.guarantees.notUsed')}
                        />
                    </StatGrid>
                </View>

                <Section
                    title={t('ops.finance.operational.readout')}
                    right={(
                        <StatusPill
                            label={t(flags.length > 0 ? 'ops.finance.flags.reviewNeeded' : 'ops.finance.flags.stable')}
                            tone={flags.length > 0 ? 'warning' : 'success'}
                        />
                    )}
                >
                    <Card variant="plain" padding="md">
                        <KeyValueRow
                            label={t('ops.finance.staffStats.shifts')}
                            value={`${stats.shiftsCount} · ${t('ops.finance.shifts.openCount', { count: stats.openShiftsCount })} • ${t('ops.finance.shifts.closedCount', { count: stats.closedShiftsCount })}`}
                        />
                        <KeyValueRow label={t('ops.finance.staffStats.clients')} value={String(stats.totalClients)} />
                        <KeyValueRow label={t('ops.finance.staffStats.consumables')} value={formatMoney(stats.totalConsumables, t)} />
                        <KeyValueRow
                            label={t('ops.finance.staffStats.late')}
                            value={`${stats.totalLateMinutes} ${t('ops.finance.minutes')}`}
                            tone={stats.totalLateMinutes > 0 ? 'warning' : undefined}
                        />
                        <KeyValueRow label={t('ops.finance.period.label')} value={`${t(PERIOD_LABEL[period])} · ${financePeriodLabel(period, shownAnchor, locale)}`} />
                        {flags.length > 0 ? (
                            <View style={[ui.wrap, styles.flags]}>
                                {flags.map((flag) => <Badge key={flag} label={flag} tone="warning" icon="alert-circle-outline" />)}
                            </View>
                        ) : null}
                    </Card>
                </Section>

                <Section
                    title={t('ops.finance.staffStats.shiftsPeriod')}
                    caption={stats.shifts.length > 0 ? translatePlural(t, 'ops.finance.staffStats.shiftCount', stats.shifts.length) : undefined}
                >
                    {stats.shifts.length === 0 ? (
                        <EmptyState compact icon="time-outline" title={t('ops.finance.staffStats.noData')} />
                    ) : (
                        stats.shifts.map((shift) => (
                            <View key={shift.id} style={styles.shift} testID={`finance-shift-${shift.id}`}>
                                <View style={styles.shiftHead}>
                                    <View style={styles.shiftTitle}>
                                        <Text style={ui.strong}>{dayLabel(shift.shift_date, locale)}</Text>
                                        {shift.opened_at ? (
                                            <Text style={ui.muted}>
                                                {shortDateTime(shift.opened_at, params.tz)}{shift.closed_at ? ` — ${shortDateTime(shift.closed_at, params.tz)}` : ''}
                                            </Text>
                                        ) : null}
                                        {shift.late_minutes > 0 || shift.hours_worked != null ? (
                                            <Text style={ui.muted}>
                                                {[
                                                    shift.hours_worked != null ? t('staff.hours', { hours: formatNumber(shift.hours_worked, locale, 1) }) : null,
                                                    shift.late_minutes > 0 ? `${t('ops.finance.staffStats.late')}: ${shift.late_minutes} ${t('ops.finance.minutes')}` : null,
                                                ].filter(Boolean).join(' · ')}
                                            </Text>
                                        ) : null}
                                    </View>
                                    <StatusPill
                                        label={t(shift.status === 'open' ? 'ops.finance.staffStats.status.open' : 'ops.finance.staffStats.status.closed')}
                                        tone={shift.status === 'open' ? 'success' : 'neutral'}
                                    />
                                </View>
                                <MiniStats
                                    items={[
                                        { label: t('ops.finance.servicesRevenue'), value: formatMoney(shift.total_amount, t) },
                                        { label: t('ops.finance.staffStats.toEmployee'), value: formatMoney(shift.master_share, t) },
                                        { label: t('ops.finance.staffStats.toBusiness'), value: formatMoney(shift.salon_share, t) },
                                    ]}
                                />
                                {shift.consumables_amount > 0 ? (
                                    <KeyValueRow label={t('ops.finance.staffStats.consumables')} value={formatMoney(shift.consumables_amount, t)} />
                                ) : null}
                                {shift.items.map((item) => (
                                    <View key={item.id} style={styles.clientRow}>
                                        <View style={styles.clientText}>
                                            <Text style={ui.text} numberOfLines={1}>{item.client_name || '—'}</Text>
                                            <Text style={ui.muted} numberOfLines={2}>{item.service_name || '—'}</Text>
                                            {item.note ? <Text style={ui.hint}>{item.note}</Text> : null}
                                        </View>
                                        <View style={styles.clientAmount}>
                                            <Text style={ui.strong}>{formatMoney(item.service_amount, t)}</Text>
                                            {item.consumables_amount > 0 ? <Text style={ui.muted}>+ {formatMoney(item.consumables_amount, t)}</Text> : null}
                                        </View>
                                    </View>
                                ))}
                            </View>
                        ))
                    )}
                </Section>
            </View>
        );
    };

    return (
        <Screen refreshing={refreshing} onRefresh={onRefresh} testID="manage-finance-staff-screen">
            {name ? (
                <View style={styles.hero}>
                    <Avatar name={name} size={56} />
                    <Text style={styles.heroName} numberOfLines={2}>{name}</Text>
                </View>
            ) : null}
            <FinancePeriodPicker
                period={period}
                anchor={shownAnchor}
                loading={query.isFetching}
                onPeriodChange={setPeriod}
                onAnchorChange={setAnchor}
                onRefresh={() => void query.refetch()}
            />
            {body()}
        </Screen>
    );
}

const styles = StyleSheet.create({
    hero: { flexDirection: 'row', alignItems: 'center', gap: space.md },
    heroName: { ...typeScale.title, color: colors.text.primary, flex: 1 },
    body: { gap: space.xxl },
    summary: { gap: space.sm },
    flags: { marginTop: space.sm },
    shift: {
        backgroundColor: colors.surface.card,
        borderRadius: radii.lg,
        padding: space.lg,
        gap: space.sm,
    },
    shiftHead: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: space.sm },
    shiftTitle: { flex: 1, gap: space.xxs },
    clientRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: space.md,
        paddingTop: space.sm,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: colors.border.subtle,
    },
    clientText: { flex: 1, gap: space.xxs },
    clientAmount: { alignItems: 'flex-end', gap: space.xxs },
});
