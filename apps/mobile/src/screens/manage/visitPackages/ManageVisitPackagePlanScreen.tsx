import { useEffect, useState } from 'react';
import { ScrollView, Switch, Text, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import Button from '../../../components/ui/Button';
import EmptyState from '../../../components/ui/EmptyState';
import FeedbackBanner from '../../../components/ui/FeedbackBanner';
import Input from '../../../components/ui/Input';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';
import { colors } from '../../../constants/colors';
import { useToast } from '../../../contexts/ToastContext';
import { useLanguage } from '../../../i18n';
import { getErrorMessage } from '../../../lib/errors';
import type { RootStackParamList } from '../../../navigation/types';
import { useCurrentBusinessReady } from '../opsKit/format';
import { ChipGroup, Field, LoadError, ui } from '../opsKit/ui';
import { fetchPlanFormOptions, NEW_PLAN_FORM, planFormError, savePlan, toggleBranch, type PlanForm } from './visitPackagesData';

/** A number typed in a field: digits only (and one decimal mark when allowed); empty is 0, as on the website. */
export function parseFormNumber(value: string, decimal: boolean): number {
    const normalized = value.replace(',', '.');
    const parsed = decimal ? parseFloat(normalized) : parseInt(normalized, 10);
    return Math.max(0, Number.isFinite(parsed) ? parsed : 0);
}

/** The website's /dashboard/visit-packages/new and /[id]: the package type form. */
export default function ManageVisitPackagePlanScreen() {
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
    const { params } = useRoute<RouteProp<RootStackParamList, 'ManageVisitPackagePlan'>>();
    const { t } = useLanguage();
    const { showToast } = useToast();
    const queryClient = useQueryClient();
    const business = useCurrentBusinessReady(params.bizId);
    const isEdit = !!params.planId;
    const options = useQuery({
        queryKey: ['manage-visit-plan-form', params.bizId, params.planId ?? 'new'],
        queryFn: () => fetchPlanFormOptions(params.bizId, params.planId),
        enabled: business.ready,
    });
    const [form, setForm] = useState<PlanForm | null>(isEdit ? null : NEW_PLAN_FORM);
    const [texts, setTexts] = useState({ visit_count: '5', validity_days: '30', discount_value: '10' });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const plan = options.data?.plan;
        if (!isEdit || !plan || form) return;
        setForm({
            name_ru: plan.name_ru,
            name_ky: plan.name_ky,
            name_en: plan.name_en,
            visit_count: plan.visit_count,
            validity_days: plan.validity_days,
            discount_type: plan.discount_type,
            discount_value: plan.discount_value,
            service_id: plan.service_id,
            branch_ids: plan.branch_ids,
            is_active: plan.is_active,
        });
        setTexts({ visit_count: String(plan.visit_count), validity_days: String(plan.validity_days), discount_value: String(plan.discount_value) });
    }, [isEdit, options.data, form]);

    if (business.error) return <LoadError title={t('manager.manage.selectError')} onRetry={business.retry} />;
    if (!business.ready || options.isLoading) return <LoadingSpinner message={t('common.loading')} />;
    if (options.error || !options.data) return <LoadError title={t('ops.packages.loadError')} onRetry={() => void options.refetch()} />;
    if (isEdit && !options.data.plan) return <EmptyState icon="alert-circle" title={t('ops.packages.form.notFound')} />;
    if (!form) return <LoadingSpinner message={t('common.loading')} />;

    const { branches, services } = options.data;
    const update = (patch: Partial<PlanForm>) => setForm((current) => (current ? { ...current, ...patch } : current));
    const allBranchesSelected = branches.length > 0 && (form.branch_ids ?? []).length === branches.length;
    const serviceLabel = (service: { name_ru: string; branch_id: string }) => {
        const branch = branches.find((item) => item.id === service.branch_id);
        return branch ? `${service.name_ru} (${branch.name})` : service.name_ru;
    };

    const submit = async () => {
        setError(null);
        const problem = planFormError(form, t);
        if (problem) { setError(problem); return; }
        setSaving(true);
        try {
            await savePlan(form, params.planId);
            void queryClient.invalidateQueries({ queryKey: ['manage-visit-plans'] });
            void queryClient.invalidateQueries({ queryKey: ['manage-visit-plan-form'] });
            showToast(t('ops.packages.form.saved'), 'success');
            navigation.goBack();
        } catch (saveError) {
            setError(getErrorMessage(saveError, t('ops.packages.form.error.save'), t));
        } finally {
            setSaving(false);
        }
    };

    return (
        <ScrollView style={ui.screen} contentContainerStyle={ui.content} keyboardShouldPersistTaps="handled" testID="visit-plan-form">
            <Text style={ui.title}>{t(isEdit ? 'ops.packages.form.editTitle' : 'ops.packages.form.createTitle')}</Text>
            <Text style={ui.subtitle}>{isEdit ? options.data.plan?.name_ru : t('ops.packages.form.createSubtitle')}</Text>
            {error ? <FeedbackBanner variant="danger" message={error} onClose={() => setError(null)} /> : null}

            <Input
                label={t('ops.packages.form.nameRu')}
                value={form.name_ru}
                onChangeText={(value) => update({ name_ru: value })}
                placeholder={t('ops.packages.form.namePlaceholder')}
                testID="visit-plan-name-ru"
            />
            <Input label={t('ops.packages.form.nameKy')} value={form.name_ky ?? ''} onChangeText={(value) => update({ name_ky: value || null })} />
            <Input label={t('ops.packages.form.nameEn')} value={form.name_en ?? ''} onChangeText={(value) => update({ name_en: value || null })} />
            <View style={ui.row}>
                <Input
                    label={t('ops.packages.form.visitCount')}
                    value={texts.visit_count}
                    onChangeText={(value) => { setTexts((current) => ({ ...current, visit_count: value })); update({ visit_count: parseFormNumber(value, false) }); }}
                    keyboardType="number-pad"
                    containerStyle={{ flex: 1 }}
                    testID="visit-plan-visits"
                />
                <Input
                    label={t('ops.packages.form.validityDays')}
                    value={texts.validity_days}
                    onChangeText={(value) => { setTexts((current) => ({ ...current, validity_days: value })); update({ validity_days: parseFormNumber(value, false) }); }}
                    keyboardType="number-pad"
                    containerStyle={{ flex: 1 }}
                    testID="visit-plan-days"
                />
            </View>
            <Field label={t('ops.packages.form.discountType')}>
                <ChipGroup
                    options={[
                        { key: 'percent', label: t('ops.packages.form.discountPercent') },
                        { key: 'fixed_price', label: t('ops.packages.form.discountFixed') },
                    ]}
                    value={form.discount_type}
                    onChange={(value) => update({ discount_type: value })}
                    testID="visit-plan-discount-type"
                />
            </Field>
            <Input
                label={t('ops.packages.form.discountValue')}
                value={texts.discount_value}
                onChangeText={(value) => {
                    setTexts((current) => ({ ...current, discount_value: value }));
                    update({ discount_value: parseFormNumber(value, form.discount_type !== 'percent') });
                }}
                keyboardType={form.discount_type === 'percent' ? 'number-pad' : 'decimal-pad'}
                testID="visit-plan-discount"
            />
            <Field label={t('ops.packages.form.service')}>
                <ChipGroup
                    options={[{ key: '', label: t('ops.packages.form.serviceAny') }, ...services.map((service) => ({ key: service.id, label: serviceLabel(service) }))]}
                    value={form.service_id ?? ''}
                    onChange={(value) => update({ service_id: value || null })}
                    testID="visit-plan-service"
                />
            </Field>
            <Field label={t('ops.packages.form.branches')} hint={t('ops.packages.form.branchesHint')}>
                {branches.length === 0 ? <Text style={ui.muted}>{t('ops.packages.form.noBranches')}</Text> : (
                    <>
                        <Button
                            title={t(allBranchesSelected ? 'ops.packages.form.branchesClearAll' : 'ops.packages.form.branchesAll')}
                            onPress={() => update({ branch_ids: allBranchesSelected ? null : branches.map((branch) => branch.id) })}
                            variant="ghost"
                            size="sm"
                        />
                        <View style={ui.chips}>
                            {branches.map((branch) => {
                                const checked = (form.branch_ids ?? []).includes(branch.id);
                                return (
                                    <Button
                                        key={branch.id}
                                        title={`${checked ? '✓ ' : ''}${branch.name}`}
                                        onPress={() => update({ branch_ids: toggleBranch(form.branch_ids, branch.id) })}
                                        variant={checked ? 'secondary' : 'outline'}
                                        size="sm"
                                        accessibilityLabel={branch.name}
                                        accessibilityHint={t(checked ? 'ops.common.selected' : 'ops.common.notSelected')}
                                    />
                                );
                            })}
                        </View>
                    </>
                )}
            </Field>
            {isEdit ? (
                <View style={[ui.rowBetween, { minHeight: 44 }]}>
                    <Text style={[ui.text, { flex: 1 }]}>{t('ops.packages.form.active')}</Text>
                    <Switch
                        value={form.is_active !== false}
                        onValueChange={(value) => update({ is_active: value })}
                        accessibilityLabel={t('ops.packages.form.active')}
                        trackColor={{ true: colors.accent.primary, false: colors.border.light }}
                    />
                </View>
            ) : null}
            <Button
                title={saving ? t('ops.packages.form.saving') : t('ops.packages.form.save')}
                onPress={() => void submit()}
                loading={saving}
                disabled={saving}
                fullWidth
            />
            <Button title={t('ops.packages.form.back')} onPress={() => navigation.goBack()} variant="ghost" fullWidth />
        </ScrollView>
    );
}
