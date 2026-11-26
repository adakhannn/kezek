import { useState } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { useRoute, type RouteProp } from '@react-navigation/native';
import { keepPreviousData, useQuery } from '@tanstack/react-query';

import Card from '../../../components/ui/Card';
import EmptyState from '../../../components/ui/EmptyState';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';
import { colors } from '../../../constants/colors';
import { translatePlural, useLanguage, type MobileI18nKey } from '../../../i18n';
import type { RootStackParamList } from '../../../navigation/types';
import { shortDateTime, useCurrentBusinessReady } from '../opsKit/format';
import { formatMoney, formatShare } from '../opsKit/money';
import { LoadError, SectionTitle, StatTile, ui } from '../opsKit/ui';
import { fetchStaffFinanceStats, guaranteeTopup, type FinancePeriod } from './financeData';
import FinancePeriodPicker, { financePeriodLabel } from './FinancePeriodPicker';

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

    if (business.error) return <LoadError title={t('manager.manage.selectError')} onRetry={business.retry} />;
    if (!business.ready || (query.isLoading && !query.data)) return <LoadingSpinner message={t('ops.finance.loading')} />;

    const stats = query.data;
    const shownAnchor = anchor ?? stats?.dateFrom ?? '';
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
            <View style={{ gap: colors.layout.space3, opacity: query.isPlaceholderData ? 0.6 : 1 }}>
                <View style={ui.tiles} testID="finance-staff-summary">
                    <StatTile label={t('ops.finance.staffStats.turnover')} value={formatMoney(turnover, t)} hint={financePeriodLabel(period, shownAnchor, locale)} style={{ flexBasis: '100%' }} />
                    <StatTile label={t('ops.finance.staffStats.toEmployee')} value={formatMoney(stats.totalMaster, t)} hint={`${formatShare(stats.totalMaster, turnover)} • ${t('ops.finance.share.split')}`} />
                    <StatTile label={t('ops.finance.staffStats.toBusiness')} value={formatMoney(stats.totalSalon, t)} hint={`${formatShare(stats.totalSalon, turnover)} • ${t('ops.finance.share.split')}`} />
                    <StatTile
                        label={t('ops.finance.guarantees.title')}
                        value={formatMoney(topup > 0 ? topup : 0, t)}
                        hint={topup > 0 ? `${t('ops.finance.guarantees.baseShare')}: ${formatMoney(stats.totalBaseMasterShare, t)}` : t('ops.finance.guarantees.notUsed')}
                        style={{ flexBasis: '100%' }}
                    />
                </View>

                <Card padding="md">
                    <View style={ui.rowBetween}>
                        <SectionTitle>{t('ops.finance.operational.readout')}</SectionTitle>
                        <View style={ui.badge}>
                            <Text style={[ui.badgeText, flags.length > 0 ? ui.warningText : ui.successText]}>
                                {t(flags.length > 0 ? 'ops.finance.flags.reviewNeeded' : 'ops.finance.flags.stable')}
                            </Text>
                        </View>
                    </View>
                    <View style={[ui.tiles, { marginTop: colors.layout.space2 }]}>
                        <StatTile
                            label={t('ops.finance.staffStats.shifts')}
                            value={String(stats.shiftsCount)}
                            hint={`${t('ops.finance.shifts.openCount', { count: stats.openShiftsCount })} • ${t('ops.finance.shifts.closedCount', { count: stats.closedShiftsCount })}`}
                        />
                        <StatTile label={t('ops.finance.staffStats.clients')} value={String(stats.totalClients)} />
                        <StatTile label={t('ops.finance.staffStats.consumables')} value={formatMoney(stats.totalConsumables, t)} />
                        <StatTile label={t('ops.finance.staffStats.late')} value={`${stats.totalLateMinutes} ${t('ops.finance.minutes')}`} />
                        <StatTile label={t('ops.finance.period.label')} value={t(PERIOD_LABEL[period])} hint={financePeriodLabel(period, shownAnchor, locale)} />
                    </View>
                    {flags.length > 0 ? (
                        <View style={[ui.wrap, { marginTop: colors.layout.space2 }]}>
                            {flags.map((flag) => (
                                <View key={flag} style={ui.badge}><Text style={[ui.badgeText, ui.warningText]}>{flag}</Text></View>
                            ))}
                        </View>
                    ) : null}
                </Card>

                {stats.shifts.length === 0 ? (
                    <EmptyState compact icon="time" title={t('ops.finance.staffStats.noData')} />
                ) : (
                    <>
                        <SectionTitle>
                            {t('ops.finance.staffStats.shiftsPeriod')} · {translatePlural(t, 'ops.finance.staffStats.shiftCount', stats.shifts.length)}
                        </SectionTitle>
                        {stats.shifts.map((shift) => (
                            <Card key={shift.id} padding="md" testID={`finance-shift-${shift.id}`}>
                                <View style={ui.rowBetween}>
                                    <Text style={[ui.text, { fontWeight: '700' }]}>{shift.shift_date}</Text>
                                    <View style={ui.badge}>
                                        <Text style={[ui.badgeText, shift.status === 'open' ? ui.successText : null]}>
                                            {t(shift.status === 'open' ? 'ops.finance.staffStats.status.open' : 'ops.finance.staffStats.status.closed')}
                                        </Text>
                                    </View>
                                </View>
                                {shift.opened_at ? (
                                    <Text style={ui.muted}>
                                        {shortDateTime(shift.opened_at, params.tz)}{shift.closed_at ? ` — ${shortDateTime(shift.closed_at, params.tz)}` : ''}
                                    </Text>
                                ) : null}
                                <View style={[ui.tiles, { marginTop: colors.layout.space2 }]}>
                                    <StatTile label={t('ops.finance.servicesRevenue')} value={formatMoney(shift.total_amount, t)} />
                                    <StatTile label={t('ops.finance.staffStats.consumables')} value={formatMoney(shift.consumables_amount, t)} />
                                    <StatTile label={t('ops.finance.staffStats.toEmployee')} value={formatMoney(shift.master_share, t)} />
                                    <StatTile label={t('ops.finance.staffStats.toBusiness')} value={formatMoney(shift.salon_share, t)} />
                                    {shift.late_minutes > 0 ? <StatTile label={t('ops.finance.staffStats.late')} value={`${shift.late_minutes} ${t('ops.finance.minutes')}`} /> : null}
                                    {shift.hours_worked != null ? <StatTile label={t('ops.finance.staffStats.hours')} value={String(shift.hours_worked)} /> : null}
                                </View>
                                {shift.items.map((item) => (
                                    <View key={item.id} style={ui.listRow}>
                                        <View style={{ flex: 1 }}>
                                            <Text style={ui.text}>{item.client_name || '—'}</Text>
                                            <Text style={ui.muted}>{item.service_name || '—'}</Text>
                                            {item.note ? <Text style={ui.hint}>{item.note}</Text> : null}
                                        </View>
                                        <View style={{ alignItems: 'flex-end' }}>
                                            <Text style={ui.text}>{formatMoney(item.service_amount, t)}</Text>
                                            {item.consumables_amount > 0 ? <Text style={ui.muted}>+ {formatMoney(item.consumables_amount, t)}</Text> : null}
                                        </View>
                                    </View>
                                ))}
                            </Card>
                        ))}
                    </>
                )}
            </View>
        );
    };

    return (
        <ScrollView
            style={ui.screen}
            contentContainerStyle={ui.content}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} />}
            testID="manage-finance-staff-screen"
        >
            <Text style={ui.title}>{stats?.staffName || params.staffName || ''}</Text>
            <Text style={ui.subtitle}>{t('ops.finance.staffStats.subtitle')}</Text>
            <FinancePeriodPicker
                period={period}
                anchor={shownAnchor}
                loading={query.isFetching}
                onPeriodChange={setPeriod}
                onAnchorChange={setAnchor}
                onRefresh={() => void query.refetch()}
            />
            {body()}
        </ScrollView>
    );
}
