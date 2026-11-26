import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import Button from '../../../components/ui/Button';
import Card from '../../../components/ui/Card';
import FeedbackBanner from '../../../components/ui/FeedbackBanner';
import Input from '../../../components/ui/Input';
import { useToast } from '../../../contexts/ToastContext';
import { useLanguage } from '../../../i18n';
import type { RootStackParamList } from '../../../navigation/types';
import { catalogApi, catalogKeys, type CatalogBranch } from './catalogApi';
import { catalogErrorText } from './catalogErrors';
import { CheckRow, QueryState, SectionTitle, ui } from './catalogUi';
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
        <KeyboardAvoidingView style={ui.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <ScrollView contentContainerStyle={ui.content} keyboardShouldPersistTaps="handled" testID="manage-service-edit-screen">
                <View style={ui.header}>
                    <Text style={ui.title} accessibilityRole="header">
                        {t(serviceId ? 'catalog.services.edit.title' : 'catalog.services.form.titleNew')}
                    </Text>
                    {serviceId ? <Text style={ui.subtitle}>{t('catalog.services.edit.subtitle')}</Text> : null}
                </View>
                {formError ? <FeedbackBanner variant="danger" message={formError} compact /> : null}

                <Card padding="md">
                    <Input
                        label={t('catalog.services.form.nameRu')}
                        value={form.name_ru}
                        onChangeText={(name_ru) => update({ name_ru }, 'nameRu')}
                        placeholder={t('catalog.services.form.nameRuPlaceholder')}
                        error={errors.nameRu}
                        testID="service-name-ru"
                    />
                    <Input
                        label={t('catalog.services.form.nameKy')}
                        value={form.name_ky}
                        onChangeText={(name_ky) => update({ name_ky }, 'nameKy')}
                        placeholder={t('catalog.services.form.nameKyPlaceholder')}
                        error={errors.nameKy}
                    />
                    <Input
                        label={t('catalog.services.form.nameEn')}
                        value={form.name_en}
                        onChangeText={(name_en) => update({ name_en }, 'nameEn')}
                        placeholder={t('catalog.services.form.nameEnPlaceholder')}
                        error={errors.nameEn}
                    />
                    <Input
                        label={t('catalog.services.form.duration')}
                        value={form.duration_min}
                        onChangeText={(value) => update({ duration_min: normalizeDurationInput(value) }, 'duration')}
                        keyboardType="number-pad"
                        error={errors.duration}
                        testID="service-duration"
                    />
                    <Input
                        label={t('catalog.services.form.priceFrom')}
                        value={form.price_from}
                        onChangeText={(price_from) => update({ price_from }, 'priceFrom', 'priceTo')}
                        keyboardType="decimal-pad"
                        error={errors.priceFrom}
                    />
                    <Input
                        label={t('catalog.services.form.priceTo')}
                        value={form.price_to}
                        onChangeText={(price_to) => update({ price_to }, 'priceFrom', 'priceTo')}
                        keyboardType="decimal-pad"
                        error={errors.priceTo}
                        testID="service-price-to"
                    />
                </Card>

                <Card padding="md">
                    <View style={ui.rowBetween}>
                        <SectionTitle title={t('catalog.services.form.branches')} />
                        {branches.length > 0 ? (
                            <Button
                                title={t(allSelected ? 'catalog.services.form.branchesClearAll' : 'catalog.services.form.branchesSelectAll')}
                                onPress={() => update({ branch_ids: toggleAllIds(form.branch_ids, allIds) }, 'branches')}
                                variant="ghost"
                                size="sm"
                            />
                        ) : null}
                    </View>
                    {branches.length === 0 ? <Text style={ui.muted}>{t('catalog.services.form.noBranches')}</Text> : null}
                    {branches.map((branch) => (
                        <CheckRow
                            key={branch.id}
                            label={branch.name}
                            checked={form.branch_ids.includes(branch.id)}
                            onChange={() => update({ branch_ids: toggleId(form.branch_ids, branch.id) }, 'branches')}
                            testID={`service-branch-${branch.id}`}
                        />
                    ))}
                    {errors.branches ? <Text style={ui.error} accessibilityRole="alert">{errors.branches}</Text> : null}
                </Card>

                <Card padding="md">
                    <CheckRow
                        label={t('catalog.services.form.activeLabel')}
                        checked={form.active}
                        onChange={(active) => update({ active })}
                        testID="service-active"
                    />
                </Card>

                <Button
                    title={saving ? t('catalog.services.form.saving') : t('catalog.services.form.save')}
                    onPress={() => void save()}
                    loading={saving}
                    fullWidth
                />

                {serviceId && serviceBranchId ? (
                    <ServiceMastersSection bizId={bizId} serviceId={serviceId} branchId={serviceBranchId} />
                ) : null}
            </ScrollView>
        </KeyboardAvoidingView>
    );
}
