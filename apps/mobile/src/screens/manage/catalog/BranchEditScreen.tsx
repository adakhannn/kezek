import { useState } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import ActionBar from '../../../components/ui/ActionBar';
import Button from '../../../components/ui/Button';
import Card from '../../../components/ui/Card';
import FeedbackBanner from '../../../components/ui/FeedbackBanner';
import FormField, { FieldGroup, FieldRow } from '../../../components/ui/FormField';
import ListRow, { ListGroup } from '../../../components/ui/ListRow';
import Screen from '../../../components/ui/Screen';
import ScreenIntro from '../../../components/ui/ScreenIntro';
import Section from '../../../components/ui/Section';
import { SwitchRow } from '../../../components/ui/SelectionRow';
import { colors } from '../../../constants/colors';
import { space } from '../../../constants/theme';
import { useConfirm } from '../../../contexts/ConfirmContext';
import { useToast } from '../../../contexts/ToastContext';
import { useLanguage } from '../../../i18n';
import type { RootStackParamList } from '../../../navigation/types';
import {
    applyMapPick,
    branchFormFrom,
    buildBranchPayload,
    contactDisplayValue,
    contactHelperKey,
    formatGeocodedAddress,
    mapPickerPointFrom,
    NEW_BRANCH_FORM,
    parseCoordinates,
    type BranchFormState,
    type ContactField,
} from './branchForm';
import { BranchRatingCard } from './BranchRatingCard';
import { catalogApi, catalogKeys, type BranchForEdit, type ContactFields, type ServicesOverview } from './catalogApi';
import { catalogErrorText, hasBookingsMessage } from './catalogErrors';
import { QueryState, ui } from './catalogUi';
import BranchMapPicker, { type MapPick } from './mapPicker/BranchMapPicker';

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
            <QueryState isLoading={overview.isLoading} error={overview.error} onRetry={() => void overview.refetch()} skeleton="form">
                {() => {
                    const data = overview.data!;
                    // The website's /dashboard/branches/new: owner or super admin, within the limit.
                    if (!data.canManageBranches) {
                        return (
                            <Screen>
                                <FeedbackBanner
                                    variant="danger"
                                    title={t('catalog.branches.new.noAccess.title')}
                                    message={t('catalog.branches.new.noAccess.description')}
                                />
                            </Screen>
                        );
                    }
                    if (data.branches.length >= data.branchLimit) {
                        return (
                            <Screen>
                                <FeedbackBanner
                                    variant="warning"
                                    title={t('catalog.branches.new.limit.title')}
                                    message={t('catalog.branches.new.limit.description', { limit: data.branchLimit })}
                                />
                            </Screen>
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
        <QueryState isLoading={detail.isLoading} error={detail.error} onRetry={() => void detail.refetch()} skeleton="form">
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
    const [mapOpen, setMapOpen] = useState(false);
    const branchId = detail?.branch.id;
    const update = (patch: Partial<BranchFormState>) => setForm((current) => ({ ...current, ...patch }));

    // The business city (from the services list, when it was opened) centres a map without a point.
    const businessCity = queryClient
        .getQueriesData<ServicesOverview>({ queryKey: ['manage', bizId, 'services'] })
        .map(([, data]) => data?.bizCity?.trim())
        .find(Boolean) ?? null;

    const applyPick = (pick: MapPick) => {
        setForm((current) => applyMapPick(current, pick));
        setCoordsError(null);
        setMapOpen(false);
    };

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

    const hasCoords = coords?.lat != null && coords.lon != null;

    return (
        <Screen
            keyboard
            testID="manage-branch-edit-screen"
            footer={(
                <ActionBar
                    primary={{
                        title: saving ? t('catalog.branches.form.saving') : t('catalog.branches.form.save'),
                        onPress: () => void save(),
                        loading: saving,
                        testID: 'branch-save',
                    }}
                />
            )}
        >
            {/* The header names the screen ("Новый филиал" / the branch): no second title here. */}
            {detail?.bizName ? <ScreenIntro>{detail.bizName}</ScreenIntro> : null}
            {formError ? <FeedbackBanner variant="danger" message={formError} compact /> : null}

            <FieldGroup title={t('catalog.app.group.main')}>
                <FormField
                    label={t('catalog.branches.form.name')}
                    required
                    value={form.name}
                    onChangeText={(name) => { update({ name }); setNameError(null); }}
                    error={nameError ?? undefined}
                    testID="branch-name"
                />
            </FieldGroup>

            <FieldGroup title={t('catalog.branches.form.addressLabel')} caption={t('catalog.app.locationHintMap')}>
                <Button
                    title={t('catalog.app.pickOnMap')}
                    onPress={() => setMapOpen(true)}
                    variant="outline"
                    leadingIcon={<Ionicons name="map-outline" size={18} color={colors.text.primary} />}
                    fullWidth
                    style={styles.pickOnMap}
                    testID="branch-pick-on-map"
                />
                <Button
                    title={locating ? t('catalog.app.locating') : t('catalog.app.useLocation')}
                    onPress={() => void locate()}
                    loading={locating}
                    variant="outline"
                    leadingIcon={<Ionicons name="locate-outline" size={18} color={colors.text.primary} />}
                    fullWidth
                    style={styles.locate}
                />
                <FieldRow>
                    <FormField
                        label={t('catalog.app.latitude')}
                        value={form.lat}
                        onChangeText={(lat) => { update({ lat }); setCoordsError(null); }}
                        keyboardType="numbers-and-punctuation"
                        placeholder="42.874600"
                        testID="branch-lat"
                    />
                    <FormField
                        label={t('catalog.app.longitude')}
                        value={form.lon}
                        onChangeText={(lon) => { update({ lon }); setCoordsError(null); }}
                        keyboardType="numbers-and-punctuation"
                        placeholder="74.569800"
                        testID="branch-lon"
                    />
                </FieldRow>
                {coordsError ? <Text style={[ui.error, styles.coordsError]} accessibilityRole="alert">{coordsError}</Text> : null}
                {hasCoords ? (
                    <View style={styles.coordsActions}>
                        <Button
                            title={t('catalog.app.openMap')}
                            onPress={openMap}
                            variant="ghost"
                            size="sm"
                            leadingIcon={<Ionicons name="map-outline" size={16} color={colors.text.primary} />}
                        />
                        <Button
                            title={t('catalog.app.clearCoords')}
                            onPress={() => update({ lat: '', lon: '' })}
                            variant="ghost"
                            size="sm"
                            textStyle={styles.mutedAction}
                        />
                    </View>
                ) : null}
                <FormField
                    label={t('catalog.branches.form.address')}
                    value={form.address}
                    onChangeText={(address) => update({ address })}
                    multiline
                    testID="branch-address"
                />
                <BranchMapPicker
                    visible={mapOpen}
                    initialPoint={mapPickerPointFrom(form)}
                    initialAddress={form.address}
                    city={businessCity}
                    onClose={() => setMapOpen(false)}
                    onConfirm={applyPick}
                />
            </FieldGroup>

            <FieldGroup title={t('catalog.branches.form.contacts.title')}>
                <Card variant="plain" padding="md" style={[ui.group, styles.inherit]}>
                    <SwitchRow
                        label={t('catalog.branches.form.contacts.inherit')}
                        hint={t('catalog.branches.form.contacts.inheritHint')}
                        value={form.inherit_business_contacts}
                        onChange={(inherit_business_contacts) => update({ inherit_business_contacts })}
                        testID="branch-inherit"
                    />
                </Card>
                {CONTACT_INPUTS.map(({ field, label, placeholder, keyboard }) => {
                    const helper = contactHelperKey(form, field, businessContacts);
                    return (
                        <FormField
                            key={field}
                            label={t(label)}
                            value={contactDisplayValue(form, field, businessContacts)}
                            onChangeText={(value) => update({ [field]: value } as Partial<BranchFormState>)}
                            placeholder={placeholder}
                            hint={helper ? t(helper) : undefined}
                            keyboardType={keyboard}
                            autoCapitalize="none"
                            autoCorrect={false}
                        />
                    );
                })}
            </FieldGroup>

            <Card variant="plain" padding="md" style={ui.group}>
                <SwitchRow
                    label={t('catalog.branches.form.active')}
                    value={form.is_active}
                    onChange={(is_active) => update({ is_active })}
                    testID="branch-active"
                />
            </Card>

            {detail ? (
                <>
                    <Section title={t('catalog.app.group.more')}>
                        <ListGroup inset>
                            <ListRow
                                icon="time-outline"
                                title={t('catalog.branches.schedule.title')}
                                onPress={() => onOpenSchedule?.()}
                                accessibilityHint={t('catalog.app.openSchedule')}
                                testID="branch-open-schedule"
                            />
                            <ListRow
                                icon="gift-outline"
                                iconTone="warning"
                                title={t('catalog.branches.promotions.title')}
                                onPress={() => onOpenPromotions?.()}
                                accessibilityHint={t('catalog.app.openPromotions')}
                                testID="branch-open-promotions"
                            />
                        </ListGroup>
                    </Section>
                    {detail.ratingWeights ? (
                        <BranchRatingCard score={detail.branch.rating_score} weights={detail.ratingWeights} />
                    ) : null}
                    {/* Danger zone: super admin only, as on the website; set apart at the very end. */}
                    {detail.isSuperAdmin ? (
                        <Section title={t('catalog.branches.danger.title')} caption={t('catalog.branches.danger.desc')}>
                            <ListGroup>
                                <ListRow
                                    icon="trash-outline"
                                    destructive
                                    title={deleting ? t('catalog.branches.delete.deleting') : t('catalog.branches.delete.button')}
                                    onPress={() => void remove()}
                                    disabled={deleting}
                                    chevron={false}
                                    testID="branch-delete"
                                />
                            </ListGroup>
                        </Section>
                    ) : null}
                </>
            ) : null}
        </Screen>
    );
}

const styles = StyleSheet.create({
    pickOnMap: { marginBottom: space.sm },
    locate: { marginBottom: space.lg },
    coordsError: { marginTop: -space.sm, marginBottom: space.md },
    coordsActions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs, marginTop: -space.sm, marginBottom: space.sm },
    mutedAction: { color: colors.text.secondary },
    inherit: { marginBottom: space.lg },
});
