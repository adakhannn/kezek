import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import ActionBar from '../../../components/ui/ActionBar';
import Card from '../../../components/ui/Card';
import FeedbackBanner from '../../../components/ui/FeedbackBanner';
import FormField, { FieldGroup, FieldRow } from '../../../components/ui/FormField';
import Screen from '../../../components/ui/Screen';
import Section from '../../../components/ui/Section';
import { CheckboxRow, SwitchRow } from '../../../components/ui/SelectionRow';
import { colors } from '../../../constants/colors';
import { space } from '../../../constants/theme';
import { useToast } from '../../../contexts/ToastContext';
import { useLanguage } from '../../../i18n';
import type { RootStackParamList } from '../../../navigation/types';
import { catalogApi, catalogKeys, type CatalogBranch } from './catalogApi';
import { catalogErrorText } from './catalogErrors';
import { QueryState, ui } from './catalogUi';
import { ServiceMastersSection } from './ServiceMastersSection';
import {
    buildServicePayload,
    NEW_SERVICE_FORM,
    normalizeDurationInput,
    serviceFormFrom,
    toggleAllIds,
    toggleId,
    validateServiceForm,
    type ServiceField,
    type ServiceFieldErrors,
    type ServiceFormState,
} from './serviceForm';

type Props = NativeStackScreenProps<RootStackParamList, 'ManageServiceEdit'>;

/** The website's /dashboard/services/new and /dashboard/services/[id]. */
export default function ServiceEditScreen({ navigation, route }: Props) {
    const { bizId, serviceId } = route.params;
    // A new service needs only the branches; the list's read has them.
    const query = useQuery({
        queryKey: serviceId ? catalogKeys.service(bizId, serviceId) : catalogKeys.services(bizId, ''),
        queryFn: async () => serviceId
            ? catalogApi.service(bizId, serviceId)
            : catalogApi.services(bizId, ''),
    });

    return (
        <QueryState isLoading={query.isLoading} error={query.error} onRetry={() => void query.refetch()}>
            {() => {
                const data = query.data!;
                const isEdit = 'service' in data;
                return (
                    <ServiceEditor
                        key={isEdit ? data.service.id : 'new'}
                        bizId={bizId}
                        serviceId={isEdit ? data.service.id : undefined}
                        serviceBranchId={isEdit ? data.service.branch_id : undefined}
                        branches={data.branches}
                        initial={isEdit ? serviceFormFrom(data) : NEW_SERVICE_FORM}
                        onDone={() => navigation.goBack()}
                    />
                );
            }}
        </QueryState>
    );
}

function ServiceEditor({ bizId, serviceId, serviceBranchId, branches, initial, onDone }: {
    bizId: string;
    serviceId?: string;
    serviceBranchId?: string;
    branches: CatalogBranch[];
    initial: ServiceFormState;
    onDone: () => void;
}) {
    const { t } = useLanguage();
    const { showToast } = useToast();
    const queryClient = useQueryClient();
    const [form, setForm] = useState<ServiceFormState>(initial);
    const [errors, setErrors] = useState<ServiceFieldErrors>({});
    const [formError, setFormError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const allIds = branches.map((b) => b.id);
    const allSelected = allIds.length > 0 && form.branch_ids.length === allIds.length;

    const update = (patch: Partial<ServiceFormState>, ...cleared: ServiceField[]) => {
        setForm((current) => ({ ...current, ...patch }));
        if (cleared.length) setErrors((current) => {
            const next = { ...current };
            for (const field of cleared) delete next[field];
            return next;
        });
    };

    const save = async () => {
        setFormError(null);
        const found = validateServiceForm(form, t);
        setErrors(found);
        if (Object.keys(found).length > 0) {
            setFormError(t('catalog.services.form.error.fixFields'));
            return;
        }
        setSaving(true);
        try {
            const payload = buildServicePayload(form, serviceId);
            if (serviceId) await catalogApi.updateService(bizId, serviceId, payload);
            else await catalogApi.createService(bizId, payload);
            await queryClient.invalidateQueries({ queryKey: catalogKeys.all(bizId) });
            showToast(t('catalog.app.saved'), 'success');
            onDone();
        } catch (error) {
            setFormError(catalogErrorText(error, t('catalog.app.saveError'), t));
        } finally {
            setSaving(false);
        }
    };

    return (
        <Screen
            keyboard
            testID="manage-service-edit-screen"
            footer={(
                <ActionBar
                    primary={{
                        title: saving ? t('catalog.services.form.saving') : t('catalog.services.form.save'),
                        onPress: () => void save(),
                        loading: saving,
                        testID: 'service-save',
                    }}
                />
            )}
        >
            {/* The header names the screen ("Новая услуга" / "Редактирование услуги"): no second title here. */}
            {formError ? <FeedbackBanner variant="danger" message={formError} compact /> : null}

            <FieldGroup title={t('catalog.services.form.group.name')}>
                <FormField
                    label={t('catalog.services.form.langRu')}
                    required
                    value={form.name_ru}
                    onChangeText={(name_ru) => update({ name_ru }, 'nameRu')}
                    placeholder={t('catalog.services.form.nameRuPlaceholder')}
                    error={errors.nameRu}
                    accessibilityLabel={t('catalog.services.form.nameRu')}
                    testID="service-name-ru"
                />
                <FormField
                    label={t('catalog.services.form.langKy')}
                    value={form.name_ky}
                    onChangeText={(name_ky) => update({ name_ky }, 'nameKy')}
                    placeholder={t('catalog.services.form.nameKyPlaceholder')}
                    error={errors.nameKy}
                    accessibilityLabel={t('catalog.services.form.nameKy')}
                />
                <FormField
                    label={t('catalog.services.form.langEn')}
                    value={form.name_en}
                    onChangeText={(name_en) => update({ name_en }, 'nameEn')}
                    placeholder={t('catalog.services.form.nameEnPlaceholder')}
                    error={errors.nameEn}
                    accessibilityLabel={t('catalog.services.form.nameEn')}
                    autoCapitalize="sentences"
                />
            </FieldGroup>

            <FieldGroup title={t('catalog.services.form.group.pricing')}>
                <FormField
                    label={t('catalog.services.form.durationLabel')}
                    suffix={t('catalog.services.form.unitMin')}
                    value={form.duration_min}
                    onChangeText={(value) => update({ duration_min: normalizeDurationInput(value) }, 'duration')}
                    keyboardType="number-pad"
                    error={errors.duration}
                    testID="service-duration"
                />
                <FieldRow>
                    <FormField
                        label={t('catalog.services.form.priceFrom')}
                        suffix={t('catalog.services.form.unitSom')}
                        value={form.price_from}
                        onChangeText={(price_from) => update({ price_from }, 'priceFrom', 'priceTo')}
                        keyboardType="decimal-pad"
                        placeholder="0"
                        error={errors.priceFrom}
                        testID="service-price-from"
                    />
                    <FormField
                        label={t('catalog.services.form.priceTo')}
                        suffix={t('catalog.services.form.unitSom')}
                        value={form.price_to}
                        onChangeText={(price_to) => update({ price_to }, 'priceFrom', 'priceTo')}
                        keyboardType="decimal-pad"
                        placeholder="0"
                        error={errors.priceTo}
                        testID="service-price-to"
                    />
                </FieldRow>
            </FieldGroup>

            <Section
                title={t('catalog.services.form.group.availability')}
                actionLabel={branches.length > 1
                    ? t(allSelected ? 'catalog.services.form.branchesClearAll' : 'catalog.services.form.branchesSelectAll')
                    : undefined}
                onAction={() => update({ branch_ids: toggleAllIds(form.branch_ids, allIds) }, 'branches')}
                gap={0}
            >
                <Card variant="plain" padding="md" style={styles.group}>
                    {branches.length === 0 ? <Text style={ui.muted}>{t('catalog.services.form.noBranches')}</Text> : null}
                    {branches.map((branch) => (
                        <CheckboxRow
                            key={branch.id}
                            label={branch.name}
                            checked={form.branch_ids.includes(branch.id)}
                            onChange={() => update({ branch_ids: toggleId(form.branch_ids, branch.id) }, 'branches')}
                            testID={`service-branch-${branch.id}`}
                        />
                    ))}
                    <View style={styles.divider} />
                    <SwitchRow
                        label={t('catalog.services.form.activeTitle')}
                        value={form.active}
                        onChange={(active) => update({ active })}
                        testID="service-active"
                    />
                </Card>
                {errors.branches ? <Text style={[ui.error, styles.groupError]} accessibilityRole="alert">{errors.branches}</Text> : null}
            </Section>

            {serviceId && serviceBranchId ? (
                <ServiceMastersSection bizId={bizId} serviceId={serviceId} branchId={serviceBranchId} />
            ) : null}
        </Screen>
    );
}

const styles = StyleSheet.create({
    group: { paddingVertical: space.xs },
    groupError: { marginTop: space.sm },
    divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border.subtle, marginVertical: space.xs },
});
