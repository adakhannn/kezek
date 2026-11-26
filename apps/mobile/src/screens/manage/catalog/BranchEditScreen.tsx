import { useState } from 'react';
import { KeyboardAvoidingView, Linking, Platform, ScrollView, Text, View } from 'react-native';
import * as Location from 'expo-location';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import Button from '../../../components/ui/Button';
import Card from '../../../components/ui/Card';
import FeedbackBanner from '../../../components/ui/FeedbackBanner';
import Input from '../../../components/ui/Input';
import { useConfirm } from '../../../contexts/ConfirmContext';
import { useToast } from '../../../contexts/ToastContext';
import { useLanguage } from '../../../i18n';
import type { RootStackParamList } from '../../../navigation/types';
import {
    branchFormFrom,
    buildBranchPayload,
    contactDisplayValue,
    contactHelperKey,
    formatGeocodedAddress,
    NEW_BRANCH_FORM,
    parseCoordinates,
    type BranchFormState,
    type ContactField,
} from './branchForm';
import { BranchRatingCard } from './BranchRatingCard';
import { catalogApi, catalogKeys, type BranchForEdit, type ContactFields } from './catalogApi';
import { catalogErrorText, hasBookingsMessage } from './catalogErrors';
import { CheckRow, QueryState, SectionTitle, ui } from './catalogUi';

type Props = NativeStackScreenProps<RootStackParamList, 'ManageBranchEdit'>;

/** The website's /dashboard/branches/new and /dashboard/branches/[id]. */
export default function BranchEditScreen({ navigation, route }: Props) {
    const { bizId, branchId } = route.params;
    const { t } = useLanguage();
    const overview = useQuery({
        queryKey: catalogKeys.branches(bizId),
        queryFn: () => catalogApi.branches(bizId),
        enabled: !branchId,
    });
    const detail = useQuery({
        queryKey: catalogKeys.branch(bizId, branchId ?? ''),
        queryFn: () => catalogApi.branch(bizId, branchId!),
        enabled: !!branchId,
    });

    if (!branchId) {
        return (
            <QueryState isLoading={overview.isLoading} error={overview.error} onRetry={() => void overview.refetch()}>
                {() => {
                    const data = overview.data!;
                    // The website's /dashboard/branches/new: owner or super admin, within the limit.
                    if (!data.canManageBranches) {
                        return (
                            <ScrollView style={ui.screen} contentContainerStyle={ui.content}>
                                <FeedbackBanner
                                    variant="danger"
                                    title={t('catalog.branches.new.noAccess.title')}
                                    message={t('catalog.branches.new.noAccess.description')}
                                />
                            </ScrollView>
                        );
                    }
                    if (data.branches.length >= data.branchLimit) {
                        return (
                            <ScrollView style={ui.screen} contentContainerStyle={ui.content}>
                                <FeedbackBanner
                                    variant="warning"
                                    title={t('catalog.branches.new.limit.title')}
                                    message={t('catalog.branches.new.limit.description', { limit: data.branchLimit })}
                                />
                            </ScrollView>
                        );
                    }
                    return (
                        <BranchEditor
                            bizId={bizId}
                            initial={NEW_BRANCH_FORM}
                            businessContacts={data.businessContacts}
                            onDone={() => navigation.goBack()}
                        />
                    );
                }}
            </QueryState>
        );
    }

    return (
        <QueryState isLoading={detail.isLoading} error={detail.error} onRetry={() => void detail.refetch()}>
            {() => (
                <BranchEditor
                    key={detail.data!.branch.id}
                    bizId={bizId}
                    detail={detail.data!}
                    initial={branchFormFrom(detail.data!.branch)}
                    businessContacts={detail.data!.businessContacts}
                    onDone={() => navigation.goBack()}
                    onOpenSchedule={() => navigation.navigate('ManageBranchSchedule', {
                        ...route.params, branchId, branchName: detail.data!.branch.name,
                    })}
                    onOpenPromotions={() => navigation.navigate('ManageBranchPromotions', {
                        ...route.params, branchId, branchName: detail.data!.branch.name, bizSlug: detail.data!.bizSlug,
                    })}
                />
            )}
        </QueryState>
    );
}

const CONTACT_INPUTS: { field: ContactField; label: 'catalog.branches.form.contacts.phone' | 'catalog.branches.form.contacts.whatsapp' | 'catalog.branches.form.contacts.email' | 'catalog.branches.form.contacts.website'; placeholder?: string; keyboard: 'phone-pad' | 'email-address' | 'url' }[] = [
    { field: 'contact_phone', label: 'catalog.branches.form.contacts.phone', placeholder: '+996555123456', keyboard: 'phone-pad' },
    { field: 'contact_whatsapp', label: 'catalog.branches.form.contacts.whatsapp', placeholder: '+996555123456', keyboard: 'phone-pad' },
    { field: 'contact_email', label: 'catalog.branches.form.contacts.email', keyboard: 'email-address' },
    { field: 'website_url', label: 'catalog.branches.form.contacts.website', placeholder: 'https://example.com', keyboard: 'url' },
];

function BranchEditor({ bizId, detail, initial, businessContacts, onDone, onOpenSchedule, onOpenPromotions }: {
    bizId: string;
    detail?: BranchForEdit;
    initial: BranchFormState;
    businessContacts: ContactFields;
    onDone: () => void;
    onOpenSchedule?: () => void;
    onOpenPromotions?: () => void;
}) {
    const { t } = useLanguage();
    const { confirm } = useConfirm();
    const { showToast } = useToast();
    const queryClient = useQueryClient();
    const [form, setForm] = useState<BranchFormState>(initial);
    const [nameError, setNameError] = useState<string | null>(null);
    const [coordsError, setCoordsError] = useState<string | null>(null);
    const [formError, setFormError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [locating, setLocating] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const branchId = detail?.branch.id;
    const update = (patch: Partial<BranchFormState>) => setForm((current) => ({ ...current, ...patch }));

    const locate = async () => {
        setLocating(true);
        setCoordsError(null);
        try {
            const permission = await Location.requestForegroundPermissionsAsync();
            if (permission.status !== 'granted') {
                setCoordsError(t('catalog.app.locationDenied'));
                return;
            }
            const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
            const { latitude, longitude } = position.coords;
            const places = await Location.reverseGeocodeAsync({ latitude, longitude }).catch(() => []);
            const address = formatGeocodedAddress(places[0]);
            update({
                lat: latitude.toFixed(6),
                lon: longitude.toFixed(6),
                ...(address ? { address } : {}),
            });
        } catch {
            setCoordsError(t('catalog.app.locationFailed'));
        } finally {
            setLocating(false);
        }
    };

    const coords = parseCoordinates(form.lat, form.lon);
    const openMap = () => {
        if (coords?.lat == null || coords.lon == null) return;
        void Linking.openURL(`https://yandex.ru/maps/?pt=${coords.lon},${coords.lat}&z=17&l=map`);
    };

    const save = async () => {
        setFormError(null);
        const payload = buildBranchPayload(form);
        const missingName = !form.name.trim();
        setNameError(missingName ? t('catalog.app.nameRequired') : null);
        setCoordsError(payload ? null : t('catalog.app.coordsInvalid'));
        if (!payload || missingName) return;
        setSaving(true);
        try {
            if (branchId) await catalogApi.updateBranch(bizId, branchId, payload);
            else await catalogApi.createBranch(bizId, payload);
            await queryClient.invalidateQueries({ queryKey: catalogKeys.all(bizId) });
            showToast(t('catalog.app.saved'), 'success');
            onDone();
        } catch (error) {
            setFormError(catalogErrorText(error, t('catalog.app.saveError'), t));
        } finally {
            setSaving(false);
        }
    };

    const remove = async () => {
        if (!branchId) return;
        const accepted = await confirm({
            title: t('catalog.branches.delete.confirmTitle'),
            message: t('catalog.branches.delete.confirm'),
            confirmLabel: t('catalog.branches.delete.button'),
            cancelLabel: t('catalog.common.cancel'),
            variant: 'danger',
        });
        if (!accepted) return;
        setDeleting(true);
        try {
            await catalogApi.deleteBranch(bizId, branchId);
            await queryClient.invalidateQueries({ queryKey: catalogKeys.all(bizId) });
            showToast(t('catalog.branches.delete.success'), 'success');
            onDone();
        } catch (error) {
            showToast(hasBookingsMessage(error, 'branch', t) ?? catalogErrorText(error, t('catalog.app.saveError'), t), 'error');
        } finally {
            setDeleting(false);
        }
    };

    return (
        <KeyboardAvoidingView style={ui.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <ScrollView contentContainerStyle={ui.content} keyboardShouldPersistTaps="handled" testID="manage-branch-edit-screen">
                <View style={ui.header}>
                    <Text style={ui.title} accessibilityRole="header">
                        {t(branchId ? 'catalog.branches.edit.title' : 'catalog.branches.new.title')}
                    </Text>
                    {detail ? (
                        <>
                            <Text style={ui.subtitle}>{t('catalog.branches.edit.subtitle')}</Text>
                            <Text style={ui.caption}>
                                {t('catalog.branches.edit.bizContext')}: {detail.bizName || t('catalog.branches.edit.bizDefaultName')}
                            </Text>
                        </>
                    ) : null}
                </View>
                {formError ? <FeedbackBanner variant="danger" message={formError} compact /> : null}

                <Card padding="md">
                    <Input
                        label={t('catalog.branches.form.name')}
                        value={form.name}
                        onChangeText={(name) => { update({ name }); setNameError(null); }}
                        error={nameError ?? undefined}
                        testID="branch-name"
                    />
                </Card>

                <Card padding="md">
                    <SectionTitle title={t('catalog.branches.form.addressLabel')} subtitle={t('catalog.app.locationHint')} />
                    <Button
                        title={locating ? t('catalog.app.locating') : t('catalog.app.useLocation')}
                        onPress={() => void locate()}
                        loading={locating}
                        variant="outline"
                        fullWidth
                    />
                    <View style={[ui.row, { marginTop: 12 }]}>
                        <Input
                            label={t('catalog.app.latitude')}
                            value={form.lat}
                            onChangeText={(lat) => { update({ lat }); setCoordsError(null); }}
                            keyboardType="numbers-and-punctuation"
                            containerStyle={{ flex: 1, width: undefined }}
                            testID="branch-lat"
                        />
                        <Input
                            label={t('catalog.app.longitude')}
                            value={form.lon}
                            onChangeText={(lon) => { update({ lon }); setCoordsError(null); }}
                            keyboardType="numbers-and-punctuation"
                            containerStyle={{ flex: 1, width: undefined }}
                            testID="branch-lon"
                        />
                    </View>
                    {coordsError ? <Text style={ui.error} accessibilityRole="alert">{coordsError}</Text> : null}
                    <Text style={ui.caption}>
                        {t('catalog.branches.form.coordinates')} {coords?.lat != null ? coords.lat.toFixed(6) : '—'}, {coords?.lon != null ? coords.lon.toFixed(6) : '—'}
                    </Text>
                    {coords?.lat != null ? (
                        <View style={ui.actions}>
                            <Button title={t('catalog.app.openMap')} onPress={openMap} variant="ghost" size="sm" style={ui.action} />
                            <Button
                                title={t('catalog.app.clearCoords')}
                                onPress={() => update({ lat: '', lon: '' })}
                                variant="ghost"
                                size="sm"
                                style={ui.action}
                            />
                        </View>
                    ) : null}
                    <View style={{ marginTop: 12 }}>
                        <Input
                            label={t('catalog.branches.form.address')}
                            value={form.address}
                            onChangeText={(address) => update({ address })}
                            placeholder={t('catalog.branches.form.addressPlaceholder')}
                            helperText={t('catalog.branches.form.addressManualHint')}
                            multiline
                            testID="branch-address"
                        />
                    </View>
                </Card>

                <Card padding="md">
                    <SectionTitle
                        title={t('catalog.branches.form.contacts.title')}
                        subtitle={t('catalog.branches.form.contacts.description')}
                    />
                    <CheckRow
                        label={t('catalog.branches.form.contacts.inherit')}
                        hint={t('catalog.branches.form.contacts.inheritHint')}
                        checked={form.inherit_business_contacts}
                        onChange={(inherit_business_contacts) => update({ inherit_business_contacts })}
                        testID="branch-inherit"
                    />
                    {CONTACT_INPUTS.map(({ field, label, placeholder, keyboard }) => {
                        const helper = contactHelperKey(form, field, businessContacts);
                        return (
                            <Input
                                key={field}
                                label={t(label)}
                                value={contactDisplayValue(form, field, businessContacts)}
                                onChangeText={(value) => update({ [field]: value } as Partial<BranchFormState>)}
                                placeholder={placeholder}
                                helperText={helper ? t(helper) : undefined}
                                keyboardType={keyboard}
                                autoCapitalize="none"
                                autoCorrect={false}
                            />
                        );
                    })}
                </Card>

                <Card padding="md">
                    <CheckRow
                        label={t('catalog.branches.form.active')}
                        checked={form.is_active}
                        onChange={(is_active) => update({ is_active })}
                        testID="branch-active"
                    />
                </Card>

                <Button
                    title={saving ? t('catalog.branches.form.saving') : t('catalog.branches.form.save')}
                    onPress={() => void save()}
                    loading={saving}
                    fullWidth
                />

                {detail ? (
                    <>
                        <Card padding="md">
                            <SectionTitle title={t('catalog.branches.schedule.title')} subtitle={t('catalog.scheduling.branchHint')} />
                            <Button
                                title={t('catalog.branches.schedule.title')}
                                onPress={() => onOpenSchedule?.()}
                                variant="outline"
                                fullWidth
                                accessibilityLabel={t('catalog.app.openSchedule')}
                            />
                        </Card>
                        {detail.ratingWeights ? (
                            <BranchRatingCard score={detail.branch.rating_score} weights={detail.ratingWeights} />
                        ) : null}
                        <Card padding="md">
                            <SectionTitle title={t('catalog.branches.promotions.title')} subtitle={t('catalog.branches.promotions.subtitle')} />
                            <Button
                                title={t('catalog.branches.promotions.title')}
                                onPress={() => onOpenPromotions?.()}
                                variant="outline"
                                fullWidth
                                accessibilityLabel={t('catalog.app.openPromotions')}
                            />
                        </Card>
                        {/* Danger zone: super admin only, as on the website. */}
                        {detail.isSuperAdmin ? (
                            <Card padding="md" variant="outlined">
                                <SectionTitle title={t('catalog.branches.danger.title')} subtitle={t('catalog.branches.danger.desc')} />
                                <Button
                                    title={deleting ? t('catalog.branches.delete.deleting') : t('catalog.branches.delete.button')}
                                    onPress={() => void remove()}
                                    loading={deleting}
                                    variant="danger"
                                    fullWidth
                                />
                            </Card>
                        ) : null}
                    </>
                ) : null}
            </ScrollView>
        </KeyboardAvoidingView>
    );
}
