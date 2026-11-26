import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';

import { StatusPill } from '../../../components/ui/Badge';
import Card from '../../../components/ui/Card';
import ListRow, { KeyValueRow, ListGroup } from '../../../components/ui/ListRow';
import Screen from '../../../components/ui/Screen';
import ScreenIntro from '../../../components/ui/ScreenIntro';
import Section from '../../../components/ui/Section';
import { SkeletonCard } from '../../../components/ui/Skeleton';
import { colors } from '../../../constants/colors';
import { space, typeScale } from '../../../constants/theme';
import { useLanguage, type MobileI18nKey } from '../../../i18n';
import type { RootStackParamList } from '../../../navigation/types';
import { fetchRatingsStatus } from './adminOpsApi';
import { isStale, jobTone } from './adminOpsLogic';
import { AdminError, adminStyles, formatWhen, Note, OkPill, StatusCard } from './adminOpsUi';

type Navigation = NativeStackNavigationProp<RootStackParamList>;

const JOB_STATUS: Record<string, MobileI18nKey> = {
    queued: 'adminOps.ratingsStatus.job.queued',
    running: 'adminOps.ratingsStatus.job.running',
    success: 'adminOps.ratingsStatus.job.success',
    error: 'adminOps.ratingsStatus.job.error',
};

/**
 * The website's /admin/ratings-status: the last metric date and rating recalculation of staff,
 * branches and businesses (red when older than two days), the entities without a rating, the
 * recent recalculation errors and the recalculation jobs, with the way to the debug page.
 */
export default function AdminRatingsStatusScreen() {
    const { t } = useLanguage();
    const navigation = useNavigation<Navigation>();
    const [refreshing, setRefreshing] = useState(false);
    const query = useQuery({ queryKey: ['admin-ops', 'ratings-status'], queryFn: fetchRatingsStatus });
    const onRefresh = async () => {
        setRefreshing(true);
        try { await query.refetch(); } finally { setRefreshing(false); }
    };

    if (query.isLoading) {
        return (
            <Screen testID="admin-ratings-status-screen">
                <SkeletonCard lines={3} />
                <SkeletonCard lines={3} />
            </Screen>
        );
    }
    if (!query.data) {
        return (
            <Screen testID="admin-ratings-status-screen">
                <AdminError title={t('adminOps.ratingsStatus.error')} error={query.error} onRetry={() => void query.refetch()} />
            </Screen>
        );
    }
    const { status, jobs } = query.data;
    const levels = [
        { key: 'staff', title: t('adminOps.ratingsStatus.staff'), metric: status.staff_last_metric_date, rating: status.staff_last_rating_recalculated_at, without: status.staff_without_rating, icon: 'person-outline' as const },
        { key: 'branches', title: t('adminOps.ratingsStatus.branches'), metric: status.branch_last_metric_date, rating: status.branch_last_rating_recalculated_at, without: status.branches_without_rating, icon: 'business-outline' as const },
        { key: 'businesses', title: t('adminOps.ratingsStatus.businesses'), metric: status.biz_last_metric_date, rating: status.biz_last_rating_recalculated_at, without: status.businesses_without_rating, icon: 'storefront-outline' as const },
    ];
    const errorsTotal = status.recent_errors_total ?? 0;
    const errorsDays = status.recent_errors_days ?? 7;
    const hasErrors = status.has_recent_errors ?? errorsTotal > 0;

    return (
        <Screen refreshing={refreshing} onRefresh={onRefresh} testID="admin-ratings-status-screen">
            <ScreenIntro>{t('adminOps.ratingsStatus.intro')}</ScreenIntro>

            <View style={adminStyles.gapMd}>
                {levels.map((level) => (
                    <StatusCard key={level.key} title={level.title} ok={!isStale(level.metric)} icon={level.icon} testID={`admin-ratings-${level.key}`}>
                        <KeyValueRow label={t('adminOps.ratingsStatus.lastDate')} value={formatWhen(level.metric, t)} />
                        <KeyValueRow label={t('adminOps.ratingsStatus.lastRating')} value={formatWhen(level.rating, t)} />
                        <KeyValueRow
                            label={t('adminOps.ratingsStatus.withoutRating')}
                            value={level.without === null || level.without === undefined ? '—' : String(level.without)}
                            tone={level.without ? 'warning' : undefined}
                            emphasis
                        />
                    </StatusCard>
                ))}
            </View>

            <Section title={t('adminOps.ratingsStatus.recentErrors')} right={<OkPill ok={!hasErrors} />}>
                <Card variant="plain" padding="md" style={adminStyles.gapSm}>
                    <Text style={[styles.metric, { color: colors.tone[errorsTotal > 0 ? 'danger' : 'success'].fg }]} testID="admin-ratings-errors">
                        {t('adminOps.ratingsStatus.recentErrorsValue', { count: errorsTotal, days: errorsDays })}
                    </Text>
                    <Note>{t('adminOps.ratingsStatus.info')}</Note>
                </Card>
                <ListGroup>
                    <ListRow icon="bug-outline" title={t('adminOps.ratingsStatus.debugLink')} onPress={() => navigation.navigate('AdminRatingsDebug')} testID="admin-ratings-debug-link" />
                </ListGroup>
            </Section>

            {jobs && jobs.length > 0 ? (
                <Section title={t('adminOps.ratingsStatus.jobs')} caption={t('adminOps.ratingsStatus.jobsCaption')} testID="admin-ratings-jobs">
                    <Card variant="plain" padding="md">
                        {jobs.map((job, index) => (
                            <View key={job.id}>
                                {index > 0 ? <View style={adminStyles.separator} /> : null}
                                <View style={styles.job}>
                                    <View style={adminStyles.rowBetween}>
                                        <Text style={adminStyles.rowTitle} numberOfLines={1}>{`${job.date_from} → ${job.date_to}`}</Text>
                                        <StatusPill label={JOB_STATUS[job.status] ? t(JOB_STATUS[job.status]) : job.status} tone={jobTone(job.status)} />
                                    </View>
                                    <Text style={adminStyles.rowMeta}>
                                        {[
                                            `${t('adminOps.ratingsStatus.jobScope')}: ${job.scope}`,
                                            `${t('adminOps.ratingsStatus.jobProgress')}: ${job.total_days > 0 ? `${job.processed_days}/${job.total_days}` : '-'}`,
                                        ].join(' · ')}
                                    </Text>
                                    <Text style={adminStyles.rowMeta}>{`${t('adminOps.ratingsStatus.jobCreated')}: ${formatWhen(job.created_at, t)} · ${job.id.slice(0, 8)}`}</Text>
                                    {job.error_message ? <Text style={styles.error}>{job.error_message}</Text> : null}
                                </View>
                            </View>
                        ))}
                    </Card>
                </Section>
            ) : null}
        </Screen>
    );
}

const styles = StyleSheet.create({
    job: { gap: space.xxs, paddingVertical: space.xs },
    metric: { ...typeScale.headline },
    error: { ...typeScale.callout, color: colors.tone.danger.fg },
});
