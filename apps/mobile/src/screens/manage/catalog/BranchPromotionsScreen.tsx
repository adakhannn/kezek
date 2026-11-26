import { useState } from 'react';
import { KeyboardAvoidingView, Linking, Platform, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import Button from '../../../components/ui/Button';
import Card from '../../../components/ui/Card';
import { DateField } from '../../../components/ui/DateTimeFields';
import EmptyState from '../../../components/ui/EmptyState';
import Input from '../../../components/ui/Input';
import { useConfirm } from '../../../contexts/ConfirmContext';
import { useToast } from '../../../contexts/ToastContext';
import { useLanguage } from '../../../i18n';
import { getMobileApiUrl } from '../../../lib/apiUrl';
import type { RootStackParamList } from '../../../navigation/types';
import { catalogApi, catalogKeys, type Promotion } from './catalogApi';
import { catalogErrorText } from './catalogErrors';
import { CheckRow, Chip, QueryState, SectionTitle, StatusPill, ui } from './catalogUi';
import {
    buildPromotionPayload,
    changePromotionType,
    hasDiscount,
    isOptionalDate,
    newPromotionForm,
    promotionFormFrom,
    promotionParamsText,
    promotionSaveErrorKey,
    promotionTypeLabel,
    PROMOTION_TYPES,
    type PromotionFormState,
} from './promotions';

type Props = NativeStackScreenProps<RootStackParamList, 'ManageBranchPromotions'>;

/** The website's BranchPromotionsPanel (/dashboard/branches/[id]): list, create, edit, switch, delete. */
export default function BranchPromotionsScreen({ route }: Props) {
    const { bizId, branchId, bizSlug } = route.params;
    const { t } = useLanguage();
    const { confirm } = useConfirm();
    const { showToast } = useToast();
    const queryClient = useQueryClient();
    const [editing, setEditing] = useState<{ id: string | null; form: PromotionFormState } | null>(null);
    const [busyId, setBusyId] = useState<string | null>(null);
    const key = catalogKeys.promotions(bizId, branchId);
    const query = useQuery({ queryKey: key, queryFn: () => catalogApi.promotions(bizId, branchId) });
    const refresh = () => queryClient.invalidateQueries({ queryKey: key });

    const toggleActive = async (promotion: Promotion) => {
        setBusyId(promotion.id);
        try {
            await catalogApi.updatePromotion(bizId, branchId, promotion.id, { is_active: !promotion.is_active });
            await refresh();
        } catch (error) {
            showToast(catalogErrorText(error, t('catalog.branches.promotions.error.update'), t), 'error');
        } finally {
            setBusyId(null);
        }
    };

    const remove = async (promotion: Promotion) => {
        const accepted = await confirm({
            title: t('catalog.branches.promotions.delete.title'),
            message: t('catalog.branches.promotions.delete.confirm'),
            confirmLabel: t('catalog.branches.promotions.delete.action'),
            cancelLabel: t('catalog.common.cancel'),
            variant: 'danger',
        });
        if (!accepted) return;
        setBusyId(promotion.id);
        try {
            const archived = await catalogApi.deletePromotion(bizId, branchId, promotion.id);
            showToast(t(archived ? 'catalog.branches.promotions.delete.archived' : 'catalog.branches.promotions.delete.success'), 'success');
            await refresh();
        } catch (error) {
            showToast(catalogErrorText(error, t('catalog.branches.promotions.error.delete'), t), 'error');
        } finally {
            setBusyId(null);
        }
    };

    if (editing) {
        return (
            <PromotionForm
                bizId={bizId}
                branchId={branchId}
                promotionId={editing.id}
                initial={editing.form}
                onCancel={() => setEditing(null)}
                onSaved={async () => {
                    setEditing(null);
                    await refresh();
                }}
            />
        );
    }

    const startCreate = () => setEditing({ id: null, form: newPromotionForm() });

    return (
        <QueryState isLoading={query.isLoading} error={query.error} onRetry={() => void query.refetch()}>
            {() => (
                <ScrollView
                    style={ui.screen}
                    contentContainerStyle={ui.content}
                    refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={() => void query.refetch()} />}
                    testID="manage-branch-promotions-screen"
                >
                    <View style={ui.header}>
                        <Text style={ui.title} accessibilityRole="header">{t('catalog.branches.promotions.title')}</Text>
                        <Text style={ui.subtitle}>{t('catalog.branches.promotions.subtitle')}</Text>
                    </View>
                    <Button title={t('catalog.branches.promotions.add')} onPress={startCreate} fullWidth />
                    {bizSlug ? (
                        <Button
                            title={t('catalog.branches.promotions.viewAsClient')}
                            onPress={() => void Linking.openURL(`${getMobileApiUrl()}/b/${encodeURIComponent(bizSlug)}/promotions`)}
                            variant="outline"
                            fullWidth
                        />
                    ) : null}

                    {query.data!.length === 0 ? (
                        <EmptyState
                            icon="gift"
                            title={t('catalog.branches.promotions.emptyTitle')}
                            message={t('catalog.branches.promotions.emptyDescription')}
                            action={<Button title={t('catalog.branches.promotions.emptyAction')} onPress={startCreate} variant="outline" fullWidth />}
                        />
                    ) : query.data!.map((promotion) => {
                        const typeKey = promotionTypeLabel(promotion.promotion_type);
                        const paramsText = promotionParamsText(promotion, t);
                        const busy = busyId === promotion.id;
                        return (
                            <Card key={promotion.id} padding="md" testID={`promotion-${promotion.id}`}>
                                <View style={ui.rowBetween}>
                                    <Text style={ui.cardTitle}>{promotion.title_ru}</Text>
                                    <StatusPill
                                        active={promotion.is_active}
                                        label={t(promotion.is_active ? 'catalog.branches.promotions.status.active' : 'catalog.branches.promotions.status.inactive')}
                                    />
                                </View>
                                <Text style={ui.meta}>{typeKey ? t(typeKey) : promotion.promotion_type}</Text>
                                {paramsText ? <Text style={ui.caption}>{paramsText}</Text> : null}
                                {promotion.valid_from || promotion.valid_to ? (
                                    <Text style={ui.caption}>
                                        {t('catalog.branches.promotions.validPeriod', {
                                            from: promotion.valid_from || t('catalog.branches.promotions.validPeriod.from'),
                                            to: promotion.valid_to || t('catalog.branches.promotions.validPeriod.to'),
                                        })}
                                    </Text>
                                ) : null}
                                {typeof promotion.usage_count === 'number' ? (
                                    <Text style={ui.caption}>
                                        {t('catalog.branches.promotions.usageCount', { count: promotion.usage_count })}
                                    </Text>
                                ) : null}
                                <View style={ui.actions}>
                                    <Button
                                        title={t(promotion.is_active ? 'catalog.branches.promotions.deactivate' : 'catalog.branches.promotions.activate')}
                                        onPress={() => void toggleActive(promotion)}
                                        variant="outline"
                                        size="sm"
                                        disabled={!!busyId}
                                        loading={busy}
                                        style={ui.action}
                                    />
                                    <Button
                                        title={t('catalog.branches.promotions.edit')}
                                        onPress={() => setEditing({ id: promotion.id, form: promotionFormFrom(promotion) })}
                                        variant="outline"
                                        size="sm"
                                        disabled={!!busyId}
                                        style={ui.action}
                                        accessibilityLabel={t('catalog.app.editItem', { name: promotion.title_ru })}
                                    />
                                    <Button
                                        title={t('catalog.branches.promotions.delete')}
                                        onPress={() => void remove(promotion)}
                                        variant="danger"
                                        size="sm"
                                        disabled={!!busyId}
                                        style={ui.action}
                                        accessibilityLabel={t('catalog.app.deleteItem', { name: promotion.title_ru })}
                                    />
                                </View>
                            </Card>
                        );
                    })}
                </ScrollView>
            )}
        </QueryState>
    );
}

function PromotionForm({ bizId, branchId, promotionId, initial, onCancel, onSaved }: {
    bizId: string;
    branchId: string;
    promotionId: string | null;
    initial: PromotionFormState;
    onCancel: () => void;
    onSaved: () => Promise<void>;
}) {
    const { t } = useLanguage();
    const { showToast } = useToast();
    const [form, setForm] = useState(initial);
    const [saving, setSaving] = useState(false);
    const [dateError, setDateError] = useState(false);
    const update = (patch: Partial<PromotionFormState>) => setForm((current) => ({ ...current, ...patch }));
    const selected = PROMOTION_TYPES.find((type) => type.value === form.promotion_type);

    const save = async () => {
        const datesOk = isOptionalDate(form.valid_from.trim()) && isOptionalDate(form.valid_to.trim());
        setDateError(!datesOk);
        if (!datesOk) return;
        setSaving(true);
        try {
            const payload = buildPromotionPayload({ ...form, valid_from: form.valid_from.trim(), valid_to: form.valid_to.trim() }, t);
            if (promotionId) await catalogApi.updatePromotion(bizId, branchId, promotionId, payload);
            else await catalogApi.createPromotion(bizId, branchId, payload);
            showToast(t(promotionId ? 'catalog.branches.promotions.save.success' : 'catalog.branches.promotions.create.success'), 'success');
            await onSaved();
        } catch (error) {
            showToast(t(promotionSaveErrorKey(error)), 'error');
        } finally {
            setSaving(false);
        }
    };

    return (
        <KeyboardAvoidingView style={ui.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <ScrollView contentContainerStyle={ui.content} keyboardShouldPersistTaps="handled" testID="promotion-form">
                <Text style={ui.title} accessibilityRole="header">
                    {t(promotionId ? 'catalog.branches.promotions.edit.title' : 'catalog.branches.promotions.create.title')}
                </Text>
                <Card padding="md">
                    <SectionTitle title={t('catalog.branches.promotions.type.label')} />
                    <View style={ui.wrap}>
                        {PROMOTION_TYPES.map((type) => (
                            <Chip
                                key={type.value}
                                label={t(type.label)}
                                selected={form.promotion_type === type.value}
                                onPress={() => setForm((current) => changePromotionType(current, type.value))}
                                testID={`promotion-type-${type.value}`}
                            />
                        ))}
                    </View>
                    {selected ? <Text style={[ui.muted, { marginTop: 8 }]}>{t(selected.description)}</Text> : null}
                </Card>
                <Card padding="md">
                    {form.promotion_type === 'free_after_n_visits' ? (
                        <Input
                            label={t('catalog.branches.promotions.visitCount.label')}
                            value={form.visit_count}
                            onChangeText={(value) => update({ visit_count: value.replace(/\D/g, '') })}
                            keyboardType="number-pad"
                            helperText={t('catalog.branches.promotions.visitCount.help')}
                            testID="promotion-visit-count"
                        />
                    ) : null}
                    {hasDiscount(form.promotion_type) ? (
                        <Input
                            label={t('catalog.branches.promotions.discountPercent.label')}
                            value={form.discount_percent}
                            onChangeText={(value) => update({ discount_percent: value.replace(/\D/g, '') })}
                            keyboardType="number-pad"
                            maxLength={3}
                            helperText={t('catalog.branches.promotions.discountPercent.help')}
                            testID="promotion-discount"
                        />
                    ) : null}
                    <Input
                        label={t('catalog.branches.promotions.titleRu.label')}
                        value={form.title_ru}
                        onChangeText={(title_ru) => update({ title_ru })}
                        placeholder={t('catalog.branches.promotions.titleRu.placeholder')}
                        testID="promotion-title"
                    />
                    <DateField
                        label={t('catalog.branches.promotions.validFrom.label')}
                        value={form.valid_from.trim()}
                        onChange={(valid_from) => { update({ valid_from }); setDateError(false); }}
                        maxDate={form.valid_to.trim() || undefined}
                        clearable
                        weekday={false}
                        error={dateError && !isOptionalDate(form.valid_from.trim()) ? t('catalog.app.dateInvalid') : undefined}
                        testID="promotion-valid-from"
                    />
                    <DateField
                        label={t('catalog.branches.promotions.validTo.label')}
                        value={form.valid_to.trim()}
                        onChange={(valid_to) => { update({ valid_to }); setDateError(false); }}
                        minDate={form.valid_from.trim() || undefined}
                        clearable
                        weekday={false}
                        error={dateError && !isOptionalDate(form.valid_to.trim()) ? t('catalog.app.dateInvalid') : undefined}
                        testID="promotion-valid-to"
                    />
                    <CheckRow
                        label={t('catalog.branches.promotions.isActive.label')}
                        checked={form.is_active}
                        onChange={(is_active) => update({ is_active })}
                    />
                </Card>
                <Button
                    title={t(promotionId ? 'catalog.branches.promotions.save' : 'catalog.branches.promotions.create')}
                    onPress={() => void save()}
                    loading={saving}
                    fullWidth
                />
                <Button title={t('catalog.branches.promotions.cancel')} onPress={onCancel} variant="secondary" disabled={saving} fullWidth />
            </ScrollView>
        </KeyboardAvoidingView>
    );
}
