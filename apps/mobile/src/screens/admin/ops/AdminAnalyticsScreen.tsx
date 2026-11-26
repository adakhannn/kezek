import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import ChipGroup from '../../../components/ui/ChipGroup';
import Screen from '../../../components/ui/Screen';
import ScreenIntro from '../../../components/ui/ScreenIntro';
import Section from '../../../components/ui/Section';
import SegmentedTabs from '../../../components/SegmentedTabs';
import { space } from '../../../constants/theme';
import { useLanguage } from '../../../i18n';
import { Field } from '../../manage/opsKit/ui';
import { fetchCurrentBusiness, type FunnelChannel } from './adminOpsApi';
import type { HeatmapMode } from './adminOpsLogic';
import { PeriodFilter, usePeriod } from './adminOpsUi';
import { FunnelTab, LoadTab, OverviewTab, PromotionsTab } from './AdminAnalyticsTabs';

type Tab = 'overview' | 'funnel' | 'load' | 'promotions';

/**
 * The website's /admin/analytics/{overview,funnel,load,promotions}: one period for every tab (the
 * website keeps it across the tabs too), the overview of all businesses, then the funnel, the
 * hourly occupancy and the promotions of the admin's current business with its branch filter.
 */
export default function AdminAnalyticsScreen() {
    const { t } = useLanguage();
    const queryClient = useQueryClient();
    const [tab, setTab] = useState<Tab>('overview');
    const [channel, setChannel] = useState<FunnelChannel>('all');
    const [branchId, setBranchId] = useState('all');
    const [mode, setMode] = useState<HeatmapMode>('byDate');
    const [refreshing, setRefreshing] = useState(false);
    const period = usePeriod();
    const business = useQuery({
        queryKey: ['admin-ops', 'current-business'],
        queryFn: fetchCurrentBusiness,
        enabled: tab !== 'overview',
        staleTime: 60_000,
    });
    const branches = business.data?.branches ?? [];
    const range = { startDate: period.startDate, endDate: period.endDate };

    const onRefresh = async () => {
        setRefreshing(true);
        try { await queryClient.refetchQueries({ queryKey: ['admin-ops'], type: 'active' }); } finally { setRefreshing(false); }
    };

    const intro = tab === 'overview'
        ? t('adminOps.analytics.overviewHint')
        : business.data?.name ? t('adminOps.analytics.currentBusiness', { name: business.data.name }) : null;

    return (
        <Screen refreshing={refreshing} onRefresh={onRefresh} testID="admin-analytics-screen">
            <SegmentedTabs
                tabs={[
                    { key: 'overview', label: t('adminOps.analytics.tab.overview') },
                    { key: 'funnel', label: t('adminOps.analytics.tab.funnel') },
                    { key: 'load', label: t('adminOps.analytics.tab.load') },
                    { key: 'promotions', label: t('adminOps.analytics.tab.promotions') },
                ]}
                value={tab}
                onChange={setTab}
                testID="admin-analytics-tabs"
            />
            {intro ? <ScreenIntro>{intro}</ScreenIntro> : null}

            <Section gap={space.md}>
                <PeriodFilter period={period} testID="admin-analytics-period" />
                {tab === 'funnel' ? (
                    <Field label={t('adminOps.analytics.funnel.channel')}>
                        <ChipGroup
                            options={[
                                { key: 'all', label: t('adminOps.analytics.funnel.channelAll') },
                                { key: 'web', label: t('adminOps.analytics.funnel.channelWeb') },
                                { key: 'mobile', label: t('adminOps.analytics.funnel.channelMobile') },
                            ]}
                            value={channel}
                            onChange={setChannel}
                            accessibilityLabel={t('adminOps.analytics.funnel.channel')}
                            testID="admin-funnel-channel"
                        />
                    </Field>
                ) : null}
                {(tab === 'load' || tab === 'promotions') && branches.length > 0 ? (
                    <Field label={t('adminOps.analytics.branch')}>
                        <ChipGroup
                            options={[{ key: 'all', label: t('adminOps.analytics.allBranches') }, ...branches.map((branch) => ({ key: branch.id, label: branch.name }))]}
                            value={branchId}
                            onChange={setBranchId}
                            accessibilityLabel={t('adminOps.analytics.branch')}
                            testID="admin-analytics-branch"
                        />
                    </Field>
                ) : null}
                {tab === 'load' ? (
                    <Field label={t('adminOps.analytics.load.mode')}>
                        <ChipGroup
                            options={[
                                { key: 'byDate', label: t('adminOps.analytics.load.byDate') },
                                { key: 'byWeekday', label: t('adminOps.analytics.load.byWeekday') },
                            ]}
                            value={mode}
                            onChange={setMode}
                            accessibilityLabel={t('adminOps.analytics.load.mode')}
                            testID="admin-load-mode"
                        />
                    </Field>
                ) : null}
            </Section>

            {period.invalid ? null : tab === 'overview' ? (
                <OverviewTab period={range} />
            ) : tab === 'funnel' ? (
                <FunnelTab period={range} channel={channel} />
            ) : tab === 'load' ? (
                <LoadTab period={range} branchId={branchId} mode={mode} />
            ) : (
                <PromotionsTab period={range} branchId={branchId} />
            )}
        </Screen>
    );
}
