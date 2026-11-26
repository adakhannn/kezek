import { useState } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import SegmentedTabs from '../../../components/SegmentedTabs';
import Button from '../../../components/ui/Button';
import Card from '../../../components/ui/Card';
import EmptyState from '../../../components/ui/EmptyState';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';
import { colors } from '../../../constants/colors';
import { useConfirm } from '../../../contexts/ConfirmContext';
import { useToast } from '../../../contexts/ToastContext';
import { useLanguage, type MobileI18nKey } from '../../../i18n';
import type { RootStackParamList } from '../../../navigation/types';
import { shortDate, useCurrentBusinessReady } from '../opsKit/format';
import { ChipGroup, Field, LoadError, ui } from '../opsKit/ui';
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

    if (business.error) return <LoadError title={t('manager.manage.selectError')} onRetry={business.retry} />;
    if (!business.ready) return <LoadingSpinner message={t('common.loading')} />;

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

    return (
        <ScrollView
            style={ui.screen}
            contentContainerStyle={ui.content}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} />}
            testID="manage-visit-packages-screen"
        >
            <SegmentedTabs
                tabs={[{ key: 'plans', label: t('ops.packages.tabPlans') }, { key: 'sold', label: t('ops.packages.tabSold') }]}
                value={tab}
                onChange={setTab}
                testID="visit-packages-tabs"
            />
            {tab === 'plans' ? (
                <>
                    <Text style={ui.title}>{t('ops.packages.title')}</Text>
                    <Text style={ui.subtitle}>{t('ops.packages.subtitle')}</Text>
                    <Button
                        title={t('ops.packages.create')}
                        onPress={() => navigation.navigate('ManageVisitPackagePlan', routeParams)}
                        fullWidth
                    />
                    {plans.isLoading ? <LoadingSpinner message={t('common.loading')} /> : plans.error ? (
                        <LoadError title={t('ops.packages.loadError')} onRetry={() => void plans.refetch()} />
                    ) : (plans.data ?? []).length === 0 ? (
                        <EmptyState icon="pricetags" title={t('ops.packages.empty')} />
                    ) : (
                        (plans.data ?? []).map((plan) => (
                            <Card key={plan.id} padding="md" testID={`visit-plan-${plan.id}`}>
                                <View style={ui.rowBetween}>
                                    <Text style={[ui.text, { fontWeight: '700', flexShrink: 1 }]}>{planName(plan, locale)}</Text>
                                    <View style={ui.badge}>
                                        <Text style={[ui.badgeText, plan.is_active ? ui.successText : null]}>
                                            {t(plan.is_active ? 'ops.packages.active' : 'ops.packages.inactive')}
                                        </Text>
                                    </View>
                                </View>
                                <Text style={ui.muted}>{t('ops.packages.visits')}: {plan.visit_count} · {t('ops.packages.validityDays')}: {plan.validity_days}</Text>
                                <Text style={ui.muted}>{t('ops.packages.discount')}: {formatDiscount(plan)}</Text>
                                <Text style={ui.muted}>{t('ops.packages.binding')}: {formatBinding(plan, t)}</Text>
                                <View style={[ui.wrap, { marginTop: colors.layout.space2 }]}>
                                    <Button
                                        title={t('ops.packages.edit')}
                                        onPress={() => navigation.navigate('ManageVisitPackagePlan', { ...routeParams, planId: plan.id })}
                                        variant="outline"
                                        size="sm"
                                    />
                                    {plan.is_active ? (
                                        <Button
                                            title={t('ops.packages.deactivate')}
                                            onPress={() => void askDeactivate(plan.id)}
                                            variant="ghost"
                                            size="sm"
                                            loading={deactivate.isPending && deactivate.variables === plan.id}
                                        />
                                    ) : null}
                                </View>
                            </Card>
                        ))
                    )}
                </>
            ) : (
                <>
                    <Text style={ui.title}>{t('ops.packages.sold.title')}</Text>
                    <Text style={ui.subtitle}>{t('ops.packages.sold.subtitle')}</Text>
                    <Field label={t('ops.packages.sold.filterStatus')}>
                        <ChipGroup
                            options={(['active', 'expired', 'all'] as const).map((key) => ({ key, label: t(SOLD_STATUS[key]) }))}
                            value={soldStatus}
                            onChange={setSoldStatus}
                            testID="sold-status"
                        />
                    </Field>
                    {(branches.data ?? []).length > 0 ? (
                        <Field label={t('ops.packages.sold.filterBranch')}>
                            <ChipGroup
                                options={[{ key: '', label: t('ops.packages.sold.branchAll') }, ...(branches.data ?? []).map((branch) => ({ key: branch.id, label: branch.name }))]}
                                value={soldBranch}
                                onChange={setSoldBranch}
                                testID="sold-branch"
                            />
                        </Field>
                    ) : null}
                    {sold.isLoading ? <LoadingSpinner message={t('common.loading')} /> : sold.error ? (
                        <LoadError title={t('ops.packages.loadError')} onRetry={() => void sold.refetch()} />
                    ) : (sold.data ?? []).length === 0 ? (
                        <EmptyState icon="pricetags" title={t('ops.packages.sold.empty')} />
                    ) : (
                        (sold.data ?? []).map((pkg) => (
                            <Card key={pkg.id} padding="md" testID={`sold-package-${pkg.id}`}>
                                <Text style={[ui.text, { fontWeight: '700' }]}>{pkg.client_name ?? `${pkg.client_id.slice(0, 8)}…`}</Text>
                                <Text style={ui.muted}>{t('ops.packages.sold.colPlan')}: {pkg.plan_name_ru ? planName({ name_ru: pkg.plan_name_ru, name_ky: pkg.plan_name_ky, name_en: pkg.plan_name_en }, locale) : '—'}</Text>
                                <Text style={ui.muted}>
                                    {t('ops.packages.sold.colRemaining')}: {pkg.remaining_visits}{pkg.plan_visit_count != null ? ` / ${pkg.plan_visit_count}` : ''}
                                </Text>
                                <Text style={ui.muted}>{t('ops.packages.sold.colValidUntil')}: {shortDate(pkg.valid_until, params.tz)}</Text>
                                <Text style={ui.muted}>{t('ops.packages.sold.colPurchased')}: {shortDate(pkg.purchased_at, params.tz)}</Text>
                            </Card>
                        ))
                    )}
                </>
            )}
        </ScrollView>
    );
}
