import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import Button from '../../../components/ui/Button';
import Card from '../../../components/ui/Card';
import ChipGroup from '../../../components/ui/ChipGroup';
import Screen from '../../../components/ui/Screen';
import ScreenIntro from '../../../components/ui/ScreenIntro';
import Section from '../../../components/ui/Section';
import { SkeletonCard } from '../../../components/ui/Skeleton';
import { colors } from '../../../constants/colors';
import { space, typeScale } from '../../../constants/theme';
import { useConfirm } from '../../../contexts/ConfirmContext';
import { useToast } from '../../../contexts/ToastContext';
import { useLanguage } from '../../../i18n';
import { getErrorMessage } from '../../../lib/errors';
import { Field } from '../../manage/opsKit/ui';
import { fetchRatingsDebug, recalculateRating, type DebugEntityType } from './adminOpsApi';
import { DEBUG_DAYS_OPTIONS } from './adminOpsLogic';
import { AdminError, adminStyles, formatWhen, Note } from './adminOpsUi';

type Entity = { id: string; name: string | null; meta: string; lastRating?: string | null };
type Group = { key: string; title: string; type: DebugEntityType; rows: Entity[]; count: number };

function EntityGroup({ group, recalc, busyId }: { group: Group; recalc?: (type: DebugEntityType, entity: Entity) => void; busyId: string | null }) {
    const { t } = useLanguage();
    if (group.rows.length === 0 && group.count === 0) return null;
    return (
        <View style={adminStyles.gapSm} testID={`admin-debug-${group.key}`}>
            <View style={adminStyles.rowBetween}>
                <Text style={styles.groupTitle}>{group.title}</Text>
                {group.count > group.rows.length ? (
                    <Text style={adminStyles.rowMeta}>{t('adminOps.ratingsDebug.shownOf', { shown: group.rows.length, count: group.count })}</Text>
                ) : (
                    <Text style={adminStyles.rowMeta}>{String(group.count)}</Text>
                )}
            </View>
            <Card variant="plain" padding="md">
                {group.rows.map((entity, index) => (
                    <View key={entity.id}>
                        {index > 0 ? <View style={adminStyles.separator} /> : null}
                        <View style={styles.entity}>
                            <View style={styles.flex}>
                                <Text style={adminStyles.rowTitle} numberOfLines={2}>{entity.name || t('adminOps.ratingsDebug.noName')}</Text>
                                <Text style={adminStyles.mono} selectable numberOfLines={2}>{entity.meta}</Text>
                                {entity.lastRating !== undefined ? (
                                    <Text style={adminStyles.rowMeta}>{t('adminOps.ratingsDebug.lastRating', { date: formatWhen(entity.lastRating, t, '—') })}</Text>
                                ) : null}
                            </View>
                            {recalc ? (
                                <Button
                                    title={t('adminOps.ratingsDebug.recalculate')}
                                    onPress={() => recalc(group.type, entity)}
                                    variant="outline"
                                    size="sm"
                                    loading={busyId === `${group.type}:${entity.id}`}
                                    disabled={busyId !== null}
                                    testID={`admin-debug-recalc-${entity.id}`}
                                />
                            ) : null}
                        </View>
                    </View>
                ))}
            </Card>
        </View>
    );
}

/**
 * The website's /admin/ratings-debug: staff, branches and businesses with a NULL rating (each can be
 * recalculated after a confirmation), those without metrics for the chosen days and the last
 * recalculation errors.
 */
export default function AdminRatingsDebugScreen() {
    const { t } = useLanguage();
    const { confirm } = useConfirm();
    const { showToast } = useToast();
    const queryClient = useQueryClient();
    const [days, setDays] = useState(7);
    const [refreshing, setRefreshing] = useState(false);
    const [busyId, setBusyId] = useState<string | null>(null);
    const query = useQuery({
        queryKey: ['admin-ops', 'ratings-debug', days],
        queryFn: () => fetchRatingsDebug(days),
        placeholderData: keepPreviousData,
    });
    const recalc = useMutation({
        mutationFn: ({ type, id }: { type: DebugEntityType; id: string }) => recalculateRating(type, id),
        onMutate: ({ type, id }) => setBusyId(`${type}:${id}`),
        onSuccess: async () => {
            showToast(t('adminOps.ratingsDebug.recalcDone'), 'success');
            await queryClient.invalidateQueries({ queryKey: ['admin-ops', 'ratings-debug'] });
        },
        onError: (cause) => showToast(getErrorMessage(cause, t('adminOps.ratingsDebug.recalculateFailed'), t), 'error'),
        onSettled: () => setBusyId(null),
    });
    const onRefresh = async () => {
        setRefreshing(true);
        try { await query.refetch(); } finally { setRefreshing(false); }
    };
    const askRecalc = async (type: DebugEntityType, entity: Entity) => {
        const accepted = await confirm({
            title: t('adminOps.ratingsDebug.recalcConfirmTitle'),
            message: t('adminOps.ratingsDebug.recalcConfirmMessage', { name: entity.name || entity.id }),
            confirmLabel: t('adminOps.ratingsDebug.recalculate'),
            cancelLabel: t('adminOps.common.cancel'),
        });
        if (accepted) recalc.mutate({ type, id: entity.id });
    };

    const data = query.data;
    const nullGroups: Group[] = data ? [
        { key: 'null-staff', title: t('adminOps.ratingsDebug.staff'), type: 'staff', count: data.with_null_rating.staff.length,
            rows: data.with_null_rating.staff.map((row) => ({ id: row.id, name: row.full_name, meta: `${row.id}\nbiz ${row.biz_id} · branch ${row.branch_id}`, lastRating: row.last_rating_recalculated_at })) },
        { key: 'null-branches', title: t('adminOps.ratingsDebug.branches'), type: 'branch', count: data.with_null_rating.branches.length,
            rows: data.with_null_rating.branches.map((row) => ({ id: row.id, name: row.name, meta: `${row.id}\nbiz ${row.biz_id}`, lastRating: row.last_rating_recalculated_at })) },
        { key: 'null-businesses', title: t('adminOps.ratingsDebug.businesses'), type: 'biz', count: data.with_null_rating.businesses.length,
            rows: data.with_null_rating.businesses.map((row) => ({ id: row.id, name: row.name, meta: `${row.id}${row.slug ? `\n${row.slug}` : ''}`, lastRating: row.last_rating_recalculated_at })) },
    ] : [];
    const staleGroups: Group[] = data ? [
        { key: 'stale-staff', title: t('adminOps.ratingsDebug.staff'), type: 'staff', count: data.without_metrics_since.total_count.staff,
            rows: data.without_metrics_since.staff.map((row) => ({ id: row.id, name: row.full_name, meta: `${row.id}\nbiz ${row.biz_id} · branch ${row.branch_id}` })) },
        { key: 'stale-branches', title: t('adminOps.ratingsDebug.branches'), type: 'branch', count: data.without_metrics_since.total_count.branches,
            rows: data.without_metrics_since.branches.map((row) => ({ id: row.id, name: row.name, meta: `${row.id}\nbiz ${row.biz_id}` })) },
        { key: 'stale-businesses', title: t('adminOps.ratingsDebug.businesses'), type: 'biz', count: data.without_metrics_since.total_count.businesses,
            rows: data.without_metrics_since.businesses.map((row) => ({ id: row.id, name: row.name, meta: `${row.id}${row.slug ? `\n${row.slug}` : ''}` })) },
    ] : [];
    const isEmpty = (groups: Group[]) => groups.every((group) => group.rows.length === 0 && group.count === 0);

    return (
        <Screen refreshing={refreshing} onRefresh={onRefresh} testID="admin-ratings-debug-screen">
            <ScreenIntro>{t('adminOps.ratingsDebug.intro')}</ScreenIntro>
            <Field label={t('adminOps.ratingsDebug.days')}>
                <ChipGroup
                    options={DEBUG_DAYS_OPTIONS.map((value) => ({ key: String(value), label: t('adminOps.ratingsDebug.daysValue', { days: value }) }))}
                    value={String(days)}
                    onChange={(value) => setDays(Number(value))}
                    accessibilityLabel={t('adminOps.ratingsDebug.days')}
                    testID="admin-debug-days"
                />
            </Field>

            {query.isLoading ? (
                <View style={adminStyles.gapMd}>
                    <SkeletonCard lines={3} />
                    <SkeletonCard lines={3} />
                </View>
            ) : !data ? (
                <AdminError title={t('adminOps.ratingsDebug.error')} error={query.error} onRetry={() => void query.refetch()} />
            ) : (
                <View style={{ gap: space.xxl, opacity: query.isPlaceholderData ? 0.6 : 1 }}>
                    <Section title={t('adminOps.ratingsDebug.withNullRating')}>
                        {isEmpty(nullGroups) ? <Note>{t('adminOps.ratingsDebug.noRecords')}</Note> : null}
                        {nullGroups.map((group) => (
                            <EntityGroup key={group.key} group={group} recalc={(type, entity) => void askRecalc(type, entity)} busyId={busyId} />
                        ))}
                    </Section>

                    <Section title={t('adminOps.ratingsDebug.withoutMetrics')} caption={t('adminOps.ratingsDebug.windowFrom', { date: formatWhen(data.window_since, t) })}>
                        {isEmpty(staleGroups) ? <Note>{t('adminOps.ratingsDebug.noRecords')}</Note> : null}
                        {staleGroups.map((group) => <EntityGroup key={group.key} group={group} busyId={busyId} />)}
                    </Section>

                    <Section title={t('adminOps.ratingsDebug.recentErrors')} testID="admin-debug-errors">
                        {data.recent_errors.length === 0 ? (
                            <Note>{t('adminOps.ratingsDebug.noRecords')}</Note>
                        ) : (
                            <Card variant="plain" padding="md">
                                {data.recent_errors.map((item, index) => (
                                    <View key={item.id}>
                                        {index > 0 ? <View style={adminStyles.separator} /> : null}
                                        <View style={styles.errorItem}>
                                            <Text style={adminStyles.rowTitle}>{`${item.entity_type} · ${item.metric_date}`}</Text>
                                            <Text style={styles.error}>{item.error_message}</Text>
                                            <Text style={adminStyles.mono} selectable>{item.entity_id}</Text>
                                            <Text style={adminStyles.rowMeta}>{formatWhen(item.created_at, t)}</Text>
                                        </View>
                                    </View>
                                ))}
                            </Card>
                        )}
                    </Section>
                </View>
            )}
        </Screen>
    );
}

const styles = StyleSheet.create({
    flex: { flex: 1 },
    groupTitle: { ...typeScale.overline, color: colors.text.tertiary },
    entity: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.xs },
    errorItem: { gap: space.xxs, paddingVertical: space.xs },
    error: { ...typeScale.callout, color: colors.tone.danger.fg },
});
