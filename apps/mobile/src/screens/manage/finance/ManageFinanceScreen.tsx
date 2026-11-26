import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { keepPreviousData, useQuery } from '@tanstack/react-query';

import Avatar from '../../../components/ui/Avatar';
import { StatusPill } from '../../../components/ui/Badge';
import ChipGroup from '../../../components/ui/ChipGroup';
import EmptyState from '../../../components/ui/EmptyState';
import ListRow from '../../../components/ui/ListRow';
import Screen from '../../../components/ui/Screen';
import ScreenIntro from '../../../components/ui/ScreenIntro';
import Section from '../../../components/ui/Section';
import StatTile, { StatGrid } from '../../../components/ui/StatTile';
import { colors } from '../../../constants/colors';
import { radii, space, typeScale, type Tone } from '../../../constants/theme';
import { useLanguage, type MobileI18nKey } from '../../../i18n';
import type { RootStackParamList } from '../../../navigation/types';
import { useCurrentBusinessReady } from '../opsKit/format';
import { formatMoney, formatShare } from '../opsKit/money';
import { LoadError, ScreenSkeleton } from '../opsKit/ui';
import { fetchAllStaffFinance, totalWithConsumables, type FinancePeriod, type StaffStat } from './financeData';
import FinancePeriodPicker, { financePeriodLabel } from './FinancePeriodPicker';

/** The state of a master in the report: the day's shift, or (month, year) whether they still work. */
function staffStatus(period: FinancePeriod, stat: StaffStat): { key: MobileI18nKey; tone: Tone } {
    if (period === 'day') {
        if (stat.openShiftsCount > 0) return { key: 'ops.finance.staffStats.status.open', tone: 'success' };
        if (stat.closedShiftsCount > 0) return { key: 'ops.finance.staffStats.status.closed', tone: 'neutral' };
        return { key: 'ops.finance.staffStats.status.noShift', tone: 'warning' };
    }
    return stat.isActive
        ? { key: 'ops.finance.staffStats.status.active', tone: 'success' }
        : { key: 'ops.finance.staffStats.status.inactive', tone: 'neutral' };
}

/** Three small figures in a line under a row: what a master brought and how it splits. */
export function MiniStats({ items }: { items: { label: string; value: string }[] }) {
    return (
        <View style={styles.mini}>
            {items.map((item) => (
                <View key={item.label} style={styles.miniCell} accessible accessibilityLabel={`${item.label}: ${item.value}`}>
                    <Text style={styles.miniLabel} numberOfLines={1}>{item.label}</Text>
                    <Text style={styles.miniValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>{item.value}</Text>
                </View>
            ))}
        </View>
    );
}

/** The website's /dashboard/finance: the business's money of a day, month or year, split by master. */
export default function ManageFinanceScreen() {
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
    const { params } = useRoute<RouteProp<RootStackParamList, 'ManageFinance'>>();
    const { t, locale } = useLanguage();
    const business = useCurrentBusinessReady(params.bizId);
    const [period, setPeriod] = useState<FinancePeriod>('day');
    const [anchor, setAnchor] = useState<string | null>(null);
    const [branchId, setBranchId] = useState('all');
    const [refreshing, setRefreshing] = useState(false);
    const query = useQuery({
        queryKey: ['manage-finance-all', params.bizId, period, anchor, branchId],
        queryFn: () => fetchAllStaffFinance(period, anchor, branchId),
        enabled: business.ready,
        placeholderData: keepPreviousData,
        // Today's shifts change while the screen is open, as the website reloads them every minute.
        refetchInterval: period === 'day' ? 60_000 : false,
    });

    if (business.error) return <LoadError screen title={t('manager.manage.selectError')} onRetry={business.retry} />;
    if (!business.ready || (query.isLoading && !query.data)) return <ScreenSkeleton testID="manage-finance-loading" />;

    const data = query.data;
    const shownAnchor = anchor ?? data?.dateFrom ?? '';
    const totals = data?.totalStats ?? null;
    const turnover = totals ? totalWithConsumables(totals) : 0;
    const staffStats = data?.staffStats ?? [];
    const onRefresh = async () => {
        setRefreshing(true);
        try { await query.refetch(); } finally { setRefreshing(false); }
    };

    return (
        <Screen refreshing={refreshing} onRefresh={onRefresh} testID="manage-finance-screen">
            <ScreenIntro>{params.bizName || t('ops.home.defaultBizName')}</ScreenIntro>

            <Section gap={space.md}>
                <FinancePeriodPicker
                    period={period}
                    anchor={shownAnchor}
                    loading={query.isFetching}
                    // A chosen day stays the anchor of the month or year; without a choice the server takes today.
                    onPeriodChange={setPeriod}
                    onAnchorChange={setAnchor}
                    onRefresh={() => void query.refetch()}
                />
                {(data?.branches ?? []).length > 0 ? (
                    <ChipGroup
                        options={[{ key: 'all', label: t('ops.finance.branch.all') }, ...(data?.branches ?? []).map((branch) => ({ key: branch.id, label: branch.name }))]}
                        value={branchId}
                        onChange={setBranchId}
                        accessibilityLabel={t('ops.finance.branch')}
                        testID="finance-branch"
                    />
                ) : null}
            </Section>

            {query.error && !query.isFetching ? (
                <LoadError title={t('ops.finance.error.title')} onRetry={() => void query.refetch()} />
            ) : !totals && staffStats.length === 0 ? (
                <EmptyState icon="wallet-outline" title={t('ops.finance.empty.title')} message={t('ops.finance.empty.description')} />
            ) : (
                <View style={[styles.body, { opacity: query.isPlaceholderData ? 0.6 : 1 }]}>
                    {totals ? (
                        <View style={styles.totals} testID="finance-totals">
                            <StatTile
                                icon="cash-outline"
                                tone="success"
                                label={t('ops.finance.totalWithConsumables')}
                                value={formatMoney(turnover, t)}
                                hint={`${t('ops.finance.servicesRevenue')}: ${formatMoney(totals.totalAmount, t)} · ${t('ops.finance.consumablesRevenue')}: ${formatMoney(totals.totalConsumables, t)} · ${financePeriodLabel(period, shownAnchor, locale)}`}
                            />
                            <StatGrid>
                                <StatTile label={t('ops.finance.toEmployees')} value={formatMoney(totals.totalMaster, t)} hint={`${formatShare(totals.totalMaster, turnover)} ${t('ops.finance.ofTotal')}`} />
                                <StatTile label={t('ops.finance.toBusiness')} value={formatMoney(totals.totalSalon, t)} hint={`${formatShare(totals.totalSalon, turnover)} ${t('ops.finance.ofTotal')}`} />
                                <StatTile
                                    icon="time-outline"
                                    label={t('ops.finance.shifts')}
                                    value={String(totals.totalShifts)}
                                    hint={[
                                        totals.totalOpenShifts > 0 ? t('ops.finance.shifts.openCount', { count: totals.totalOpenShifts }) : null,
                                        totals.totalClosedShifts > 0 ? t('ops.finance.shifts.closedCount', { count: totals.totalClosedShifts }) : null,
                                    ].filter(Boolean).join(' • ') || undefined}
                                />
                            </StatGrid>
                        </View>
                    ) : null}

                    <Section title={t('ops.finance.staffStats.title')}>
                        {staffStats.length === 0 ? (
                            <EmptyState compact icon="people-outline" title={t('ops.finance.staffStats.noData')} />
                        ) : (
                            staffStats.map((stat) => {
                                const status = staffStatus(period, stat);
                                return (
                                    <View key={stat.staffId} style={styles.item}>
                                        <ListRow
                                            leading={<Avatar name={stat.staffName} size={44} />}
                                            title={stat.staffName}
                                            subtitle={[
                                                `${t('ops.finance.staffStats.shifts')}: ${stat.shiftsCount}`,
                                                stat.openShiftsCount > 0 ? t('ops.finance.shifts.openCount', { count: stat.openShiftsCount }) : null,
                                            ].filter(Boolean).join(' · ')}
                                            trailing={<StatusPill label={t(status.key)} tone={status.tone} />}
                                            onPress={() => navigation.navigate('ManageFinanceStaff', {
                                                bizId: params.bizId, bizName: params.bizName, tz: params.tz ?? null, staffId: stat.staffId, staffName: stat.staffName,
                                            })}
                                            accessibilityHint={t('ops.finance.staffStats.details')}
                                            testID={`finance-staff-${stat.staffId}`}
                                        />
                                        <MiniStats
                                            items={[
                                                { label: t('ops.finance.servicesRevenue'), value: formatMoney(stat.totalAmount, t) },
                                                { label: t('ops.finance.staffStats.toEmployee'), value: formatMoney(stat.totalMaster, t) },
                                                { label: t('ops.finance.staffStats.toBusiness'), value: formatMoney(stat.totalSalon, t) },
                                            ]}
                                        />
                                    </View>
                                );
                            })
                        )}
                    </Section>
                </View>
            )}
        </Screen>
    );
}

const styles = StyleSheet.create({
    body: { gap: space.xxl },
    totals: { gap: space.sm },
    item: {
        backgroundColor: colors.surface.card,
        borderRadius: radii.lg,
        paddingHorizontal: space.lg,
        paddingBottom: space.md,
    },
    mini: {
        flexDirection: 'row',
        gap: space.sm,
        paddingTop: space.md,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: colors.border.subtle,
    },
    miniCell: { flex: 1, minWidth: 0, gap: space.xxs },
    miniLabel: { ...typeScale.caption, color: colors.text.secondary },
    miniValue: { ...typeScale.bodyStrong, color: colors.text.primary, fontVariant: ['tabular-nums'] },
});

