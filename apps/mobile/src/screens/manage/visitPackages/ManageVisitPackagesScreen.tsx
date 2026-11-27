import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import SegmentedTabs from '../../../components/SegmentedTabs';
import Avatar from '../../../components/ui/Avatar';
import Badge, { StatusPill } from '../../../components/ui/Badge';
import Button from '../../../components/ui/Button';
import ChipGroup from '../../../components/ui/ChipGroup';
import EmptyState from '../../../components/ui/EmptyState';
import ListRow, { ListGroup } from '../../../components/ui/ListRow';
import Screen from '../../../components/ui/Screen';
import Section from '../../../components/ui/Section';
import { SkeletonList } from '../../../components/ui/Skeleton';
import { colors } from '../../../constants/colors';
import { radii, space } from '../../../constants/theme';
import { useConfirm } from '../../../contexts/ConfirmContext';
import { useToast } from '../../../contexts/ToastContext';
import { translatePlural, useLanguage, type MobileI18nKey } from '../../../i18n';
import type { RootStackParamList } from '../../../navigation/types';
import { shortDate, useCurrentBusinessReady } from '../opsKit/format';
import { LoadError, ScreenSkeleton, ui } from '../opsKit/ui';
import {
    deactivatePlan,
    fetchDashboardBranches,
    fetchPlans,
    fetchSoldPackages,
    formatBinding,
    formatDiscount,
    planName,
    type SoldStatusFilter,
} from './visitPackagesData';

type Tab = 'plans' | 'sold';

const SOLD_STATUS: Record<SoldStatusFilter, MobileI18nKey> = {
    active: 'ops.packages.sold.statusActive',
    expired: 'ops.packages.sold.statusExpired',
    all: 'ops.packages.sold.statusAll',
};

/** The website's /dashboard/visit-packages: the package types (create, edit, deactivate) and the sold packages. */
export default function ManageVisitPackagesScreen() {
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
    const { params } = useRoute<RouteProp<RootStackParamList, 'ManageVisitPackages'>>();
    const { t, locale } = useLanguage();
    const { confirm } = useConfirm();
    const { showToast } = useToast();
    const queryClient = useQueryClient();
    const business = useCurrentBusinessReady(params.bizId);
    const [tab, setTab] = useState<Tab>('plans');
    const [soldStatus, setSoldStatus] = useState<SoldStatusFilter>('active');
    const [soldBranch, setSoldBranch] = useState('');
    const [refreshing, setRefreshing] = useState(false);

    const plans = useQuery({ queryKey: ['manage-visit-plans', params.bizId], queryFn: fetchPlans, enabled: business.ready && tab === 'plans' });
    const branches = useQuery({ queryKey: ['manage-branches-list', params.bizId], queryFn: fetchDashboardBranches, enabled: business.ready && tab === 'sold' });
    const sold = useQuery({
        queryKey: ['manage-visit-sold', params.bizId, soldStatus, soldBranch],
        queryFn: () => fetchSoldPackages(soldStatus, soldBranch),
        enabled: business.ready && tab === 'sold',
    });
    const deactivate = useMutation({
        mutationFn: deactivatePlan,
        onSuccess: () => showToast(t('ops.packages.deactivateSuccess'), 'success'),
        onError: () => showToast(t('ops.packages.deactivateError'), 'error'),
        onSettled: () => queryClient.invalidateQueries({ queryKey: ['manage-visit-plans'] }),
    });

    if (business.error) return <LoadError screen title={t('manager.manage.selectError')} onRetry={business.retry} />;
    if (!business.ready) return <ScreenSkeleton />;

    const routeParams = { bizId: params.bizId, bizName: params.bizName, tz: params.tz ?? null };
    const askDeactivate = async (planId: string) => {
        const accepted = await confirm({
            title: t('ops.packages.deactivateTitle'),
            message: t('ops.packages.deactivateConfirm'),
            confirmLabel: t('ops.packages.deactivate'),
            cancelLabel: t('ops.common.cancel'),
            variant: 'danger',
        });
        if (accepted) deactivate.mutate(planId);
    };
    const onRefresh = async () => {
        setRefreshing(true);
        try { await (tab === 'plans' ? plans.refetch() : sold.refetch()); } finally { setRefreshing(false); }
    };


    const createButton = (
        <Button
            title={t('ops.packages.create')}
            onPress={() => navigation.navigate('ManageVisitPackagePlan', routeParams)}
            leadingIcon={<Ionicons name="add" size={18} color={colors.text.light} />}
            fullWidth
        />
    );
    const planList = plans.data ?? [];
    const soldList = sold.data ?? [];

    return (
        <Screen refreshing={refreshing} onRefresh={onRefresh} testID="manage-visit-packages-screen">
            <SegmentedTabs
                tabs={[{ key: 'plans', label: t('ops.packages.tabPlans') }, { key: 'sold', label: t('ops.packages.tabSold') }]}
                value={tab}
                onChange={setTab}
                testID="visit-packages-tabs"
            />
            {tab === 'plans' ? (
                plans.isLoading ? <SkeletonList rows={3} avatar={false} testID="visit-plans-loading" /> : plans.error ? (
                    <LoadError title={t('ops.packages.loadError')} onRetry={() => void plans.refetch()} />
                ) : planList.length === 0 ? (
                    <EmptyState icon="pricetags-outline" title={t('ops.packages.empty')} message={t('ops.packages.emptyHint')} action={createButton} />
                ) : (
                    <>
                        {createButton}
                        <Section gap={space.md}>
                            {planList.map((plan) => (
                                <View key={plan.id} style={[styles.item, !plan.is_active ? styles.inactive : null]} testID={`visit-plan-${plan.id}`}>
                                    <ListRow
                                        icon="pricetags-outline"
                                        iconTone={plan.is_active ? 'accent' : 'neutral'}
                                        title={planName(plan, locale)}
                                        subtitle={`${translatePlural(t, 'ops.packages.visitCount', plan.visit_count)} · ${t('ops.packages.validFor', { days: translatePlural(t, 'common.days', plan.validity_days) })}`}
                                        trailing={<StatusPill label={t(plan.is_active ? 'ops.packages.active' : 'ops.packages.inactive')} tone={plan.is_active ? 'success' : 'neutral'} />}
                                        onPress={() => navigation.navigate('ManageVisitPackagePlan', { ...routeParams, planId: plan.id })}
                                        accessibilityHint={t('ops.packages.edit')}
                                        numberOfLines={2}
                                    />
                                    <View style={styles.terms}>
                                        <Text style={ui.muted}>
                                            {plan.discount_value > 0 ? `${t('ops.packages.discount')}: ${formatDiscount(plan, t)}` : t('ops.packages.noDiscount')}
                                        </Text>
                                        <Text style={ui.muted}>{t('ops.packages.binding')}: {formatBinding(plan, t)}</Text>
                                    </View>
                                    {plan.is_active ? (
                                        <View style={styles.actions}>
                                            <Button
                                                title={t('ops.packages.deactivate')}
                                                onPress={() => void askDeactivate(plan.id)}
                                                variant="ghost"
                                                size="sm"
                                                textStyle={styles.dangerText}
                                                loading={deactivate.isPending && deactivate.variables === plan.id}
                                            />
                                        </View>
                                    ) : null}
                                </View>
                            ))}
                        </Section>
                    </>
                )
            ) : (
                <Section gap={space.md}>
                    <ChipGroup
                        options={(['active', 'expired', 'all'] as const).map((key) => ({ key, label: t(SOLD_STATUS[key]) }))}
                        value={soldStatus}
                        onChange={setSoldStatus}
                        accessibilityLabel={t('ops.packages.sold.filterStatus')}
                        testID="sold-status"
                    />
                    {(branches.data ?? []).length > 0 ? (
                        <ChipGroup
                            options={[{ key: '', label: t('ops.packages.sold.branchAll') }, ...(branches.data ?? []).map((branch) => ({ key: branch.id, label: branch.name }))]}
                            value={soldBranch}
                            onChange={setSoldBranch}
                            accessibilityLabel={t('ops.packages.sold.filterBranch')}
                            testID="sold-branch"
                        />
                    ) : null}
                    {sold.isLoading ? <SkeletonList rows={4} testID="visit-sold-loading" /> : sold.error ? (
                        <LoadError title={t('ops.packages.loadError')} onRetry={() => void sold.refetch()} />
                    ) : soldList.length === 0 ? (
                        <EmptyState compact icon="pricetags-outline" title={t('ops.packages.sold.empty')} />
                    ) : (
                        <ListGroup>
                            {soldList.map((pkg) => {
                                const client = pkg.client_name ?? `${pkg.client_id.slice(0, 8)}…`;
                                const plan = pkg.plan_name_ru ? planName({ name_ru: pkg.plan_name_ru, name_ky: pkg.plan_name_ky, name_en: pkg.plan_name_en }, locale) : '—';
                                const remaining = `${pkg.remaining_visits}${pkg.plan_visit_count != null ? ` / ${pkg.plan_visit_count}` : ''}`;
                                return (
                                    <ListRow
                                        key={pkg.id}
                                        leading={<Avatar name={client} size={40} />}
                                        title={client}
                                        subtitle={`${t('ops.packages.sold.colPlan')}: ${plan}\n${t('ops.packages.sold.colValidUntil')}: ${shortDate(pkg.valid_until, params.tz)} · ${t('ops.packages.sold.colPurchased')}: ${shortDate(pkg.purchased_at, params.tz)}`}
                                        trailing={(
                                            <View style={styles.remaining} accessible accessibilityLabel={`${t('ops.packages.sold.colRemaining')}: ${remaining}`}>
                                                <Badge label={remaining} tone={pkg.remaining_visits > 0 ? 'accent' : 'neutral'} size="md" />
                                            </View>
                                        )}
                                        testID={`sold-package-${pkg.id}`}
                                    />
                                );
                            })}
                        </ListGroup>
                    )}
                </Section>
            )}
        </Screen>
    );
}

const styles = StyleSheet.create({
    item: {
        backgroundColor: colors.surface.card,
        borderRadius: radii.lg,
        paddingHorizontal: space.lg,
        paddingBottom: space.md,
        gap: space.sm,
    },
    inactive: { opacity: 0.75 },
    terms: { gap: space.xxs },
    actions: {
        alignItems: 'flex-end',
        paddingTop: space.xs,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: colors.border.subtle,
    },
    dangerText: { color: colors.tone.danger.fg },
    remaining: { alignItems: 'flex-end' },
});
