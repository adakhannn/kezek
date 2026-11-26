import { useEffect, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import ActionBar from '../../../components/ui/ActionBar';
import Button from '../../../components/ui/Button';
import Card from '../../../components/ui/Card';
import ChipGroup from '../../../components/ui/ChipGroup';
import EmptyState from '../../../components/ui/EmptyState';
import FeedbackBanner from '../../../components/ui/FeedbackBanner';
import FormField, { FieldGroup, FieldRow } from '../../../components/ui/FormField';
import Screen from '../../../components/ui/Screen';
import ScreenIntro from '../../../components/ui/ScreenIntro';
import Section from '../../../components/ui/Section';
import { CheckboxRow, SwitchRow } from '../../../components/ui/SelectionRow';
import { SkeletonCard } from '../../../components/ui/Skeleton';
import { space } from '../../../constants/theme';
import { useToast } from '../../../contexts/ToastContext';
import { useLanguage } from '../../../i18n';
import { getErrorMessage } from '../../../lib/errors';
import type { RootStackParamList } from '../../../navigation/types';
import { useCurrentBusinessReady } from '../opsKit/format';
import { Field, LoadError, ui } from '../opsKit/ui';
import { fetchPlanFormOptions, NEW_PLAN_FORM, planFormError, savePlan, toggleBranch, type PlanForm } from './visitPackagesData';

/** A number typed in a field: digits only (and one decimal mark when allowed); empty is 0, as on the website. */
export function parseFormNumber(value: string, decimal: boolean): number {
    const normalized = value.replace(',', '.');
    const parsed = decimal ? parseFloat(normalized) : parseInt(normalized, 10);
    return Math.max(0, Number.isFinite(parsed) ? parsed : 0);
}

function FormSkeleton() {
    return (
        <Screen>
            <SkeletonCard lines={3} />
            <SkeletonCard lines={2} />
        </Screen>
    );
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

    if (business.error) return <LoadError screen title={t('manager.manage.selectError')} onRetry={business.retry} />;
    if (!business.ready || options.isLoading) return <FormSkeleton />;
    if (options.error || !options.data) return <LoadError screen title={t('ops.packages.loadError')} onRetry={() => void options.refetch()} />;
    if (isEdit && !options.data.plan) {
        return (
            <Screen>
                <EmptyState
                    icon="alert-circle-outline"
                    title={t('ops.packages.form.notFound')}
                    action={<Button title={t('ops.packages.form.back')} onPress={() => navigation.goBack()} variant="outline" fullWidth />}
                />
            </Screen>
        );
    }
    if (!form) return <FormSkeleton />;

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
        <Screen
            keyboard
            testID="visit-plan-form"
            footer={(
                <ActionBar
                    secondary={{ title: t('ops.common.cancel'), onPress: () => navigation.goBack(), disabled: saving }}
                    primary={{
                        title: saving ? t('ops.packages.form.saving') : t('ops.packages.form.save'),
                        onPress: () => void submit(),
                        loading: saving,
                        disabled: saving,
                        testID: 'visit-plan-save',
                    }}
                />
            )}
        >
            {isEdit && options.data.plan?.name_ru ? <ScreenIntro>{options.data.plan.name_ru}</ScreenIntro> : null}
            {error ? <FeedbackBanner variant="danger" message={error} onClose={() => setError(null)} compact /> : null}

            <FieldGroup title={t('ops.packages.form.group.name')}>
                <FormField
                    label={t('ops.packages.form.langRu')}
                    required
                    value={form.name_ru}
                    onChangeText={(value) => update({ name_ru: value })}
                    placeholder={t('ops.packages.form.namePlaceholder')}
                    testID="visit-plan-name-ru"
                />
                <FormField label={t('ops.packages.form.langKy')} value={form.name_ky ?? ''} onChangeText={(value) => update({ name_ky: value || null })} />
                <FormField label={t('ops.packages.form.langEn')} value={form.name_en ?? ''} onChangeText={(value) => update({ name_en: value || null })} />
            </FieldGroup>

            <FieldGroup title={t('ops.packages.form.group.terms')}>
                <FieldRow>
                    <FormField
                        label={t('ops.packages.visits')}
                        value={texts.visit_count}
                        onChangeText={(value) => { setTexts((current) => ({ ...current, visit_count: value })); update({ visit_count: parseFormNumber(value, false) }); }}
                        keyboardType="number-pad"
                        testID="visit-plan-visits"
                    />
                    <FormField
                        label={t('ops.packages.form.validity')}
                        suffix={t('ops.packages.form.unitDays')}
                        value={texts.validity_days}
                        onChangeText={(value) => { setTexts((current) => ({ ...current, validity_days: value })); update({ validity_days: parseFormNumber(value, false) }); }}
                        keyboardType="number-pad"
                        testID="visit-plan-days"
                    />
                </FieldRow>
            </FieldGroup>

            <Section title={t('ops.packages.discount')} gap={space.md}>
                <ChipGroup
                    layout="wrap"
                    options={[
                        { key: 'percent', label: t('ops.packages.form.discountPercent') },
                        { key: 'fixed_price', label: t('ops.packages.form.discountFixed') },
                    ]}
                    value={form.discount_type}
                    onChange={(value) => update({ discount_type: value })}
                    accessibilityLabel={t('ops.packages.form.discountType')}
                    testID="visit-plan-discount-type"
                />
                <FormField
                    label={t('ops.packages.form.discountValue')}
                    suffix={form.discount_type === 'percent' ? '%' : t('ops.packages.form.unitSom')}
                    value={texts.discount_value}
                    onChangeText={(value) => {
                        setTexts((current) => ({ ...current, discount_value: value }));
                        update({ discount_value: parseFormNumber(value, form.discount_type !== 'percent') });
                    }}
                    keyboardType={form.discount_type === 'percent' ? 'number-pad' : 'decimal-pad'}
                    containerStyle={styles.flush}
                    testID="visit-plan-discount"
                />
            </Section>

            <Field label={t('ops.packages.form.service')}>
                <ChipGroup
                    options={[{ key: '', label: t('ops.packages.form.serviceAny') }, ...services.map((service) => ({ key: service.id, label: serviceLabel(service) }))]}
                    value={form.service_id ?? ''}
                    onChange={(value) => update({ service_id: value || null })}
                    accessibilityLabel={t('ops.packages.form.service')}
                    testID="visit-plan-service"
                />
            </Field>

            <Section
                title={t('ops.packages.form.branches')}
                caption={t('ops.packages.form.branchesHint')}
                actionLabel={branches.length > 0 ? t(allBranchesSelected ? 'ops.packages.form.branchesClearAll' : 'ops.packages.form.branchesAll') : undefined}
                onAction={branches.length > 0 ? () => update({ branch_ids: allBranchesSelected ? null : branches.map((branch) => branch.id) }) : undefined}
                gap={0}
            >
                {branches.length === 0 ? <Text style={ui.muted}>{t('ops.packages.form.noBranches')}</Text> : (
                    <Card variant="plain" padding="md">
                        {branches.map((branch) => (
                            <CheckboxRow
                                key={branch.id}
                                label={branch.name}
                                checked={(form.branch_ids ?? []).includes(branch.id)}
                                onChange={() => update({ branch_ids: toggleBranch(form.branch_ids, branch.id) })}
                                testID={`visit-plan-branch-${branch.id}`}
                            />
                        ))}
                    </Card>
                )}
            </Section>

            {isEdit ? (
                <Card variant="plain" padding="md">
                    <SwitchRow
                        label={t('ops.packages.form.active')}
                        value={form.is_active !== false}
                        onChange={(value) => update({ is_active: value })}
                    />
                </Card>
            ) : null}
        </Screen>
    );
}

const styles = StyleSheet.create({
    flush: { marginBottom: 0 },
});
