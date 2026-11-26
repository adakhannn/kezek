import { useState } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { keepPreviousData, useQuery } from '@tanstack/react-query';

import Card from '../../../components/ui/Card';
import EmptyState from '../../../components/ui/EmptyState';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';
import MotionPressable from '../../../components/ui/MotionPressable';
import { colors } from '../../../constants/colors';
import { useLanguage } from '../../../i18n';
import type { RootStackParamList } from '../../../navigation/types';
import { useCurrentBusinessReady } from '../opsKit/format';
import { formatMoney, formatShare } from '../opsKit/money';
import { ChipGroup, Field, LoadError, SectionTitle, StatTile, ui } from '../opsKit/ui';
import { fetchAllStaffFinance, totalWithConsumables, type FinancePeriod, type StaffStat } from './financeData';
import FinancePeriodPicker, { financePeriodLabel } from './FinancePeriodPicker';

function StaffStatus({ period, stat }: { period: FinancePeriod; stat: StaffStat }) {
    const { t } = useLanguage();
    if (period === 'day') {
        const [key, style] = stat.openShiftsCount > 0
            ? (['ops.finance.staffStats.status.open', ui.successText] as const)
            : stat.closedShiftsCount > 0
              ? (['ops.finance.staffStats.status.closed', ui.muted] as const)
              : (['ops.finance.staffStats.status.noShift', ui.warningText] as const);
        return <Text style={[ui.muted, style]}>{t(key)}</Text>;
    }
    return <Text style={[ui.muted, stat.isActive ? ui.successText : null]}>{t(stat.isActive ? 'ops.finance.staffStats.status.active' : 'ops.finance.staffStats.status.inactive')}</Text>;
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

    if (business.error) return <LoadError title={t('manager.manage.selectError')} onRetry={business.retry} />;
    if (!business.ready || (query.isLoading && !query.data)) return <LoadingSpinner message={t('ops.finance.loading')} />;

    const data = query.data;
    const shownAnchor = anchor ?? data?.dateFrom ?? '';
    const totals = data?.totalStats ?? null;
    const turnover = totals ? totalWithConsumables(totals) : 0;
    const onRefresh = async () => {
        setRefreshing(true);
        try { await query.refetch(); } finally { setRefreshing(false); }
    };

    return (
        <ScrollView
            style={ui.screen}
            contentContainerStyle={ui.content}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} />}
            testID="manage-finance-screen"
        >
            <Text style={ui.title}>{t('ops.finance.title')}</Text>
            <Text style={ui.subtitle}>{t('ops.finance.subtitle')}</Text>
            <Text style={ui.hint}>{t('ops.finance.bizContext')}: {params.bizName || t('ops.home.defaultBizName')}</Text>

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
                <Field label={t('ops.finance.branch')}>
                    <ChipGroup
                        options={[{ key: 'all', label: t('ops.finance.branch.all') }, ...(data?.branches ?? []).map((branch) => ({ key: branch.id, label: branch.name }))]}
                        value={branchId}
                        onChange={setBranchId}
                        testID="finance-branch"
                    />
                </Field>
            ) : null}

            {query.error && !query.isFetching ? (
                <LoadError title={t('ops.finance.error.title')} onRetry={() => void query.refetch()} />
            ) : !totals && (data?.staffStats ?? []).length === 0 ? (
                <EmptyState icon="wallet" title={t('ops.finance.empty.title')} message={t('ops.finance.empty.description')} />
            ) : (
                <View style={{ gap: colors.layout.space3, opacity: query.isPlaceholderData ? 0.6 : 1 }}>
                    {totals ? (
                        <View style={ui.tiles} testID="finance-totals">
                            <StatTile
                                label={t('ops.finance.totalWithConsumables')}
                                value={formatMoney(turnover, t)}
                                hint={`${t('ops.finance.servicesRevenue')}: ${formatMoney(totals.totalAmount, t)} · ${t('ops.finance.consumablesRevenue')}: ${formatMoney(totals.totalConsumables, t)} · ${financePeriodLabel(period, shownAnchor, locale)}`}
                                style={{ flexBasis: '100%' }}
                            />
                            <StatTile label={t('ops.finance.toEmployees')} value={formatMoney(totals.totalMaster, t)} hint={`${formatShare(totals.totalMaster, turnover)} ${t('ops.finance.ofTotal')}`} />
                            <StatTile label={t('ops.finance.toBusiness')} value={formatMoney(totals.totalSalon, t)} hint={`${formatShare(totals.totalSalon, turnover)} ${t('ops.finance.ofTotal')}`} />
                            <StatTile
                                label={t('ops.finance.shifts')}
                                value={String(totals.totalShifts)}
                                hint={[
                                    totals.totalOpenShifts > 0 ? t('ops.finance.shifts.openCount', { count: totals.totalOpenShifts }) : null,
                                    totals.totalClosedShifts > 0 ? t('ops.finance.shifts.closedCount', { count: totals.totalClosedShifts }) : null,
                                ].filter(Boolean).join(' • ') || undefined}
                                style={{ flexBasis: '100%' }}
                            />
                        </View>
                    ) : null}

                    <SectionTitle>{t('ops.finance.staffStats.title')}</SectionTitle>
                    {(data?.staffStats ?? []).length === 0 ? (
                        <Text style={ui.muted}>{t('ops.finance.staffStats.noData')}</Text>
                    ) : (
                        (data?.staffStats ?? []).map((stat) => (
                            <MotionPressable
                                key={stat.staffId}
                                onPress={() => navigation.navigate('ManageFinanceStaff', {
                                    bizId: params.bizId, bizName: params.bizName, tz: params.tz ?? null, staffId: stat.staffId, staffName: stat.staffName,
                                })}
                                accessibilityRole="button"
                                accessibilityLabel={`${stat.staffName}, ${t('ops.finance.servicesRevenue')} ${formatMoney(stat.totalAmount, t)}. ${t('ops.finance.staffStats.details')}`}
                                testID={`finance-staff-${stat.staffId}`}
                            >
                                <Card padding="md">
                                    <View style={ui.rowBetween}>
                                        <View style={{ flexShrink: 1 }}>
                                            <Text style={[ui.text, { fontWeight: '700' }]}>{stat.staffName}</Text>
                                            <StaffStatus period={period} stat={stat} />
                                        </View>
                                        <Ionicons name="chevron-forward" size={18} color={colors.text.secondary} />
                                    </View>
                                    <View style={[ui.tiles, { marginTop: colors.layout.space2 }]}>
                                        <StatTile label={t('ops.finance.servicesRevenue')} value={formatMoney(stat.totalAmount, t)} />
                                        <StatTile
                                            label={t('ops.finance.staffStats.shifts')}
                                            value={String(stat.shiftsCount)}
                                            hint={stat.openShiftsCount > 0 ? t('ops.finance.shifts.openCount', { count: stat.openShiftsCount }) : undefined}
                                        />
                                        <StatTile label={t('ops.finance.staffStats.toEmployee')} value={formatMoney(stat.totalMaster, t)} />
                                        <StatTile label={t('ops.finance.staffStats.toBusiness')} value={formatMoney(stat.totalSalon, t)} />
                                    </View>
                                </Card>
                            </MotionPressable>
                        ))
                    )}
                </View>
            )}
        </ScrollView>
    );
}
