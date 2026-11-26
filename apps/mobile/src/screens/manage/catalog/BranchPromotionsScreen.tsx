import { useState } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import ActionBar from '../../../components/ui/ActionBar';
import Button from '../../../components/ui/Button';
import Card from '../../../components/ui/Card';
import { DateField } from '../../../components/ui/DateTimeFields';
import EmptyState from '../../../components/ui/EmptyState';
import FormField, { FieldGroup, FieldRow } from '../../../components/ui/FormField';
import ListRow, { ListGroup } from '../../../components/ui/ListRow';
import Screen from '../../../components/ui/Screen';
import ScreenIntro from '../../../components/ui/ScreenIntro';
import { RadioRow, SwitchRow } from '../../../components/ui/SelectionRow';
import { colors } from '../../../constants/colors';
import { space } from '../../../constants/theme';
import { useConfirm } from '../../../contexts/ConfirmContext';
import { useToast } from '../../../contexts/ToastContext';
import { useLanguage } from '../../../i18n';
import { getMobileApiUrl } from '../../../lib/apiUrl';
import type { RootStackParamList } from '../../../navigation/types';
import { catalogApi, catalogKeys, type Promotion } from './catalogApi';
import { catalogErrorText } from './catalogErrors';
import { ItemCard, QueryState, StatusPill, ui } from './catalogUi';
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
    const { bizId, branchId, bizSlug, branchName } = route.params;
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
                <Screen
                    refreshing={query.isRefetching}
                    onRefresh={() => void query.refetch()}
                    testID="manage-branch-promotions-screen"
                >
                    {/* The header says "Акции филиала": one muted line names the branch. */}
                    {branchName ? <ScreenIntro>{branchName}</ScreenIntro> : null}
                    <Button
                        title={t('catalog.branches.promotions.add')}
                        onPress={startCreate}
                        leadingIcon={<Ionicons name="add" size={18} color={colors.text.light} />}
                        fullWidth
                    />
                    {bizSlug ? (
                        <ListGroup>
                            <ListRow
                                icon="eye-outline"
                                iconTone="info"
                                title={t('catalog.branches.promotions.viewAsClient')}
                                onPress={() => void Linking.openURL(`${getMobileApiUrl()}/b/${encodeURIComponent(bizSlug)}/promotions`)}
                                trailing={<Ionicons name="open-outline" size={16} color={colors.text.tertiary} />}
                                chevron={false}
                            />
                        </ListGroup>
                    ) : null}

                    {query.data!.length === 0 ? (
                        <EmptyState
                            icon="gift-outline"
                            title={t('catalog.branches.promotions.emptyTitle')}
                            message={t('catalog.branches.promotions.emptyDescription')}
                            action={<Button title={t('catalog.branches.promotions.emptyAction')} onPress={startCreate} variant="outline" fullWidth />}
                        />
                    ) : (
                        <View style={ui.list}>
                            {query.data!.map((promotion) => {
                                const typeKey = promotionTypeLabel(promotion.promotion_type);
                                const paramsText = promotionParamsText(promotion, t);
                                const busy = busyId === promotion.id;
                                const meta = [
                                    promotion.valid_from || promotion.valid_to
                                        ? t('catalog.branches.promotions.validPeriod', {
                                            from: promotion.valid_from || t('catalog.branches.promotions.validPeriod.from'),
                                            to: promotion.valid_to || t('catalog.branches.promotions.validPeriod.to'),
                                        })
                                        : null,
                                    typeof promotion.usage_count === 'number'
                                        ? t('catalog.branches.promotions.usageCount', { count: promotion.usage_count })
                                        : null,
                                ].filter(Boolean).join(' · ');
                                return (
                                    <ItemCard
                                        key={promotion.id}
                                        dimmed={!promotion.is_active}
                                        testID={`promotion-${promotion.id}`}
                                        actions={(
                                            <>
                                                <Button
                                                    title={t(promotion.is_active ? 'catalog.branches.promotions.deactivate' : 'catalog.branches.promotions.activate')}
                                                    onPress={() => void toggleActive(promotion)}
                                                    variant="ghost"
                                                    size="sm"
                                                    disabled={!!busyId}
                                                    loading={busy}
                                                />
                                                <Button
                                                    title={t('catalog.branches.promotions.delete')}
                                                    onPress={() => void remove(promotion)}
                                                    variant="ghost"
                                                    size="sm"
                                                    disabled={!!busyId}
                                                    textStyle={ui.dangerText}
                                                    leadingIcon={<Ionicons name="trash-outline" size={16} color={colors.tone.danger.fg} />}
                                                    accessibilityLabel={t('catalog.app.deleteItem', { name: promotion.title_ru })}
                                                />
                                            </>
                                        )}
                                    >
                                        <ListRow
                                            icon="gift-outline"
                                            iconTone="warning"
                                            title={promotion.title_ru}
                                            subtitle={[typeKey ? t(typeKey) : promotion.promotion_type, paramsText].filter(Boolean).join(' · ')}
                                            numberOfLines={2}
                                            trailing={(
                                                <StatusPill
                                                    active={promotion.is_active}
                                                    label={t(promotion.is_active ? 'catalog.branches.promotions.status.active' : 'catalog.branches.promotions.status.inactive')}
                                                />
                                            )}
                                            onPress={() => setEditing({ id: promotion.id, form: promotionFormFrom(promotion) })}
                                            disabled={!!busyId}
                                            accessibilityHint={t('catalog.app.editItem', { name: promotion.title_ru })}
                                        />
                                        {meta ? (
                                            <View style={ui.itemMeta}>
                                                <Ionicons name="calendar-outline" size={14} color={colors.text.tertiary} />
                                                <Text style={ui.itemMetaText}>{meta}</Text>
                                            </View>
                                        ) : null}
                                    </ItemCard>
                                );
                            })}
                        </View>
                    )}
                </Screen>
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
        <Screen
            keyboard
            testID="promotion-form"
            footer={(
                <ActionBar
                    secondary={{ title: t('catalog.branches.promotions.cancel'), onPress: onCancel, disabled: saving }}
                    primary={{
                        title: t(promotionId ? 'catalog.branches.promotions.save' : 'catalog.branches.promotions.create'),
                        onPress: () => void save(),
                        loading: saving,
                        testID: 'promotion-save',
                    }}
                />
            )}
        >
            {/* The header stays "Акции филиала"; this line says which form is open. */}
            <ScreenIntro>{t(promotionId ? 'catalog.branches.promotions.edit.title' : 'catalog.branches.promotions.create.title')}</ScreenIntro>

            <FieldGroup title={t('catalog.app.group.promotionType')}>
                <Card variant="plain" padding="md" style={[ui.group, styles.types]} accessibilityRole="radiogroup">
                    {PROMOTION_TYPES.map((type) => (
                        <RadioRow
                            key={type.value}
                            label={t(type.label)}
                            hint={t(type.description)}
                            selected={form.promotion_type === type.value}
                            onSelect={() => setForm((current) => changePromotionType(current, type.value))}
                            testID={`promotion-type-${type.value}`}
                        />
                    ))}
                </Card>
            </FieldGroup>

            <FieldGroup title={t('catalog.app.group.promotionTerms')}>
                {form.promotion_type === 'free_after_n_visits' ? (
                    <FormField
                        label={t('catalog.branches.promotions.visitCount.label')}
                        value={form.visit_count}
                        onChangeText={(value) => update({ visit_count: value.replace(/\D/g, '') })}
                        keyboardType="number-pad"
                        placeholder="7"
                        hint={t('catalog.branches.promotions.visitCount.help')}
                        testID="promotion-visit-count"
                    />
                ) : null}
                {hasDiscount(form.promotion_type) ? (
                    <FormField
                        label={t('catalog.branches.promotions.discountPercent.label')}
                        value={form.discount_percent}
                        onChangeText={(value) => update({ discount_percent: value.replace(/\D/g, '') })}
                        keyboardType="number-pad"
                        maxLength={3}
                        suffix="%"
                        placeholder="10"
                        hint={t('catalog.branches.promotions.discountPercent.help')}
                        testID="promotion-discount"
                    />
                ) : null}
                <FormField
                    label={t('catalog.branches.promotions.titleRu.label')}
                    value={form.title_ru}
                    onChangeText={(title_ru) => update({ title_ru })}
                    placeholder={t('catalog.branches.promotions.titleRu.placeholder')}
                    testID="promotion-title"
                />
            </FieldGroup>

            <FieldGroup title={t('catalog.app.group.period')} caption={t('catalog.app.optional')}>
                <FieldRow>
                    <DateField
                        label={t('ui.dateRange.from')}
                        value={form.valid_from.trim()}
                        onChange={(valid_from) => { update({ valid_from }); setDateError(false); }}
                        maxDate={form.valid_to.trim() || undefined}
                        clearable
                        weekday={false}
                        error={dateError && !isOptionalDate(form.valid_from.trim()) ? t('catalog.app.dateInvalid') : undefined}
                        testID="promotion-valid-from"
                    />
                    <DateField
                        label={t('ui.dateRange.to')}
                        value={form.valid_to.trim()}
                        onChange={(valid_to) => { update({ valid_to }); setDateError(false); }}
                        minDate={form.valid_from.trim() || undefined}
                        clearable
                        weekday={false}
                        error={dateError && !isOptionalDate(form.valid_to.trim()) ? t('catalog.app.dateInvalid') : undefined}
                        testID="promotion-valid-to"
                    />
                </FieldRow>
            </FieldGroup>

            <Card variant="plain" padding="md" style={ui.group}>
                <SwitchRow
                    label={t('catalog.branches.promotions.isActive.label')}
                    value={form.is_active}
                    onChange={(is_active) => update({ is_active })}
                    testID="promotion-active"
                />
            </Card>
        </Screen>
    );
}

const styles = StyleSheet.create({
    types: { marginBottom: space.lg },
});
