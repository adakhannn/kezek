import { useState } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import ActionBar from '../../components/ui/ActionBar';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import FeedbackBanner from '../../components/ui/FeedbackBanner';
import FormField, { FieldGroup, FieldRow } from '../../components/ui/FormField';
import ListRow, { ListGroup } from '../../components/ui/ListRow';
import Screen from '../../components/ui/Screen';
import ScreenIntro from '../../components/ui/ScreenIntro';
import Section from '../../components/ui/Section';
import { SwitchRow } from '../../components/ui/SelectionRow';
import { colors } from '../../constants/colors';
import { space, typeScale } from '../../constants/theme';
import { useConfirm } from '../../contexts/ConfirmContext';
import { useToast } from '../../contexts/ToastContext';
import { useLanguage, type MobileI18nKey } from '../../i18n';
import type { RootStackParamList } from '../../navigation/types';
import { formatGeocodedAddress } from '../manage/catalog/branchForm';
import { hasBookingsMessage } from '../manage/catalog/catalogErrors';
import { adminApi, adminKeys } from './adminApi';
import {
    adminBranchFormFrom,
    buildAdminBranchPayload,
    DIRECTORY_LINKS,
    NEW_ADMIN_BRANCH,
    type AdminBranchForm,
    type DirectoryLink,
} from './adminLogic';
import { AdminQuery, adminErrorText } from './adminUi';

type Props = NativeStackScreenProps<RootStackParamList, 'AdminBranchEdit'>;

const LINK_LABELS: Record<DirectoryLink, { label: MobileI18nKey | null; placeholder: string }> = {
    instagram: { label: null, placeholder: 'https://instagram.com/...' },
    two_gis: { label: 'admin.catalog.directory.twoGis', placeholder: 'https://2gis.ru/...' },
    google_maps: { label: 'admin.branchForm.googleMaps', placeholder: 'https://maps.google.com/...' },
    yandex_maps: { label: 'admin.branchForm.yandexMaps', placeholder: 'https://yandex.ru/maps/...' },
};

/** The website's /admin/businesses/[id]/branches/new and /[branchId] (the admin BranchForm). */
export default function AdminBranchEditScreen({ navigation, route }: Props) {
    const { bizId, branchId, bizName } = route.params;
    const detail = useQuery({
        queryKey: adminKeys.branch(bizId, branchId ?? ''),
        queryFn: () => adminApi.branch(bizId, branchId!),
        enabled: !!branchId,
    });
    if (!branchId) {
        return <BranchEditor bizId={bizId} bizName={bizName ?? null} initial={NEW_ADMIN_BRANCH} onDone={() => navigation.goBack()} />;
    }
    return (
        <AdminQuery isLoading={detail.isLoading} error={detail.error} onRetry={() => void detail.refetch()} skeleton="form" testID="admin-branch-edit">
            {() => (
                <BranchEditor
                    key={detail.data!.branch.id}
                    bizId={bizId}
                    bizName={detail.data!.bizName ?? bizName ?? null}
                    branchId={branchId}
                    branchName={detail.data!.branch.name}
                    initial={adminBranchFormFrom(detail.data!.branch)}
                    onDone={() => navigation.goBack()}
                    onOpenSchedule={() => navigation.navigate('AdminBranchSchedule', { bizId, bizName, branchId, branchName: detail.data!.branch.name })}
                />
            )}
        </AdminQuery>
    );
}

function BranchEditor({ bizId, bizName, branchId, branchName, initial, onDone, onOpenSchedule }: {
    bizId: string;
    bizName: string | null;
    branchId?: string;
    branchName?: string;
    initial: AdminBranchForm;
    onDone: () => void;
    onOpenSchedule?: () => void;
}) {
    const { t } = useLanguage();
    const { confirm } = useConfirm();
    const { showToast } = useToast();
    const queryClient = useQueryClient();
    const [form, setForm] = useState<AdminBranchForm>(initial);
    const [nameError, setNameError] = useState<string | null>(null);
    const [coordsError, setCoordsError] = useState<string | null>(null);
    const [formError, setFormError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [locating, setLocating] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const update = (patch: Partial<AdminBranchForm>) => setForm((current) => ({ ...current, ...patch }));
    const setLink = (key: DirectoryLink, value: string) => setForm((current) => ({ ...current, links: { ...current.links, [key]: value } }));

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
            update({ lat: latitude.toFixed(6), lon: longitude.toFixed(6), ...(address ? { address } : {}) });
        } catch {
            setCoordsError(t('catalog.app.locationFailed'));
        } finally {
            setLocating(false);
        }
    };

    const payload = buildAdminBranchPayload(form);
    const hasCoords = payload?.lat != null && payload.lon != null;

    const save = async () => {
        setFormError(null);
        const missingName = !form.name.trim();
        setNameError(missingName ? t('admin.branchForm.nameRequired') : null);
        setCoordsError(payload ? null : t('catalog.app.coordsInvalid'));
        if (!payload || missingName) return;
        setSaving(true);
        try {
            if (branchId) await adminApi.updateBranch(bizId, branchId, payload);
            else await adminApi.createBranch(bizId, payload);
            await queryClient.invalidateQueries({ queryKey: adminKeys.business(bizId) });
            showToast(t('admin.app.saved'), 'success');
            onDone();
        } catch (error) {
            setFormError(adminErrorText(error, t('admin.app.actionFailed'), t));
        } finally {
            setSaving(false);
        }
    };

    const remove = async () => {
        if (!branchId) return;
        const accepted = await confirm({
            title: t('admin.deleteBranch.title'),
            message: t('admin.deleteBranch.message', { name: branchName ?? form.name }),
            confirmLabel: t('admin.catalog.delete.delete'),
            cancelLabel: t('admin.catalog.delete.cancel'),
            variant: 'danger',
        });
        if (!accepted) return;
        setDeleting(true);
        try {
            await adminApi.deleteBranch(bizId, branchId);
            await queryClient.invalidateQueries({ queryKey: adminKeys.business(bizId) });
            showToast(t('admin.deleteBranch.deleted'), 'success');
            onDone();
        } catch (error) {
            showToast(hasBookingsMessage(error, 'branch', t) ?? adminErrorText(error, t('admin.app.actionFailed'), t), 'error');
        } finally {
            setDeleting(false);
        }
    };

    return (
        <Screen
            keyboard
            testID="admin-branch-edit"
            footer={(
                <ActionBar
                    primary={{
                        title: t(branchId ? 'admin.branchForm.saveChanges' : 'admin.branchForm.create'),
                        onPress: () => void save(),
                        loading: saving,
                        testID: 'admin-branch-save',
                    }}
                />
            )}
        >
            {bizName ? <ScreenIntro>{bizName}</ScreenIntro> : null}
            {formError ? <FeedbackBanner variant="danger" message={formError} compact /> : null}

            <FieldGroup title={t('admin.app.group.main')}>
                <FormField
                    label={t('admin.branchForm.name')}
                    placeholder={t('admin.branchForm.namePlaceholder')}
                    required
                    value={form.name}
                    onChangeText={(name) => { update({ name }); setNameError(null); }}
                    error={nameError ?? undefined}
                    testID="admin-branch-name"
                />
            </FieldGroup>

            <FieldGroup title={t('admin.branchForm.mapLocation')} caption={t('admin.branchForm.addressHelper')}>
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
                        testID="admin-branch-lat"
                    />
                    <FormField
                        label={t('catalog.app.longitude')}
                        value={form.lon}
                        onChangeText={(lon) => { update({ lon }); setCoordsError(null); }}
                        keyboardType="numbers-and-punctuation"
                        placeholder="74.569800"
                        testID="admin-branch-lon"
                    />
                </FieldRow>
                {coordsError ? <Text style={styles.error} accessibilityRole="alert">{coordsError}</Text> : null}
                {hasCoords ? (
                    <View style={styles.coordsActions}>
                        <Button
                            title={t('catalog.app.openMap')}
                            onPress={() => void Linking.openURL(`https://yandex.ru/maps/?pt=${payload!.lon},${payload!.lat}&z=17&l=map`)}
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
                    label={t('admin.branchForm.address')}
                    placeholder={t('admin.branchForm.addressPlaceholder')}
                    value={form.address}
                    onChangeText={(address) => update({ address })}
                    multiline
                    testID="admin-branch-address"
                />
            </FieldGroup>

            <FieldGroup title={t('admin.branchForm.linksTitle')} caption={t('admin.branchForm.linksHint')}>
                {DIRECTORY_LINKS.map((key) => (
                    <FormField
                        key={key}
                        label={LINK_LABELS[key].label ? t(LINK_LABELS[key].label!) : 'Instagram'}
                        placeholder={LINK_LABELS[key].placeholder}
                        value={form.links[key]}
                        onChangeText={(value) => setLink(key, value)}
                        keyboardType="url"
                        autoCapitalize="none"
                        autoCorrect={false}
                        testID={`admin-branch-link-${key}`}
                    />
                ))}
            </FieldGroup>

            <FieldGroup title={t('admin.branchForm.contactsTitle')} caption={t('admin.branchForm.contactsHint')}>
                <Card variant="plain" padding="md" style={styles.inherit}>
                    <SwitchRow
                        label={t('admin.branchForm.inheritContacts')}
                        hint={t('admin.branchForm.inheritHint')}
                        value={form.inherit_business_contacts}
                        onChange={(inherit_business_contacts) => update({ inherit_business_contacts })}
                    />
                </Card>
                <FormField label={t('admin.branchForm.phone')} placeholder="+996..." value={form.contact_phone} onChangeText={(contact_phone) => update({ contact_phone })} keyboardType="phone-pad" />
                <FormField label={t('admin.businessContacts.whatsapp')} placeholder="+996..." value={form.contact_whatsapp} onChangeText={(contact_whatsapp) => update({ contact_whatsapp })} keyboardType="phone-pad" />
                <FormField label={t('admin.branchForm.email')} placeholder="hello@business.kg" value={form.contact_email} onChangeText={(contact_email) => update({ contact_email })} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />
                <FormField label={t('admin.branchForm.website')} placeholder="https://..." value={form.website_url} onChangeText={(website_url) => update({ website_url })} keyboardType="url" autoCapitalize="none" autoCorrect={false} />
            </FieldGroup>

            <Card variant="plain" padding="md">
                <SwitchRow
                    label={t('admin.branchForm.active')}
                    hint={t(form.is_active ? 'admin.branchForm.activeHint' : 'admin.branchForm.hiddenHint')}
                    value={form.is_active}
                    onChange={(is_active) => update({ is_active })}
                    testID="admin-branch-active"
                />
            </Card>

            {branchId ? (
                <>
                    <Section title={t('admin.app.group.more')}>
                        <ListGroup inset>
                            <ListRow icon="time-outline" title={t('catalog.branches.schedule.title')} onPress={() => onOpenSchedule?.()} testID="admin-branch-open-schedule" />
                        </ListGroup>
                    </Section>
                    <Section title={t('admin.deleteBranch.title')} caption={t('admin.app.branches.deleteHint')}>
                        <ListGroup>
                            <ListRow
                                icon="trash-outline"
                                destructive
                                title={deleting ? t('admin.catalog.delete.deleting') : t('admin.deleteBranch.title')}
                                onPress={() => void remove()}
                                disabled={deleting}
                                chevron={false}
                                testID="admin-branch-delete"
                            />
                        </ListGroup>
                    </Section>
                </>
            ) : null}
        </Screen>
    );
}

const styles = StyleSheet.create({
    locate: { marginBottom: space.lg },
    error: { ...typeScale.caption, color: colors.tone.danger.fg, marginTop: -space.sm, marginBottom: space.md },
    coordsActions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs, marginTop: -space.sm, marginBottom: space.sm },
    mutedAction: { color: colors.text.secondary },
    inherit: { marginBottom: space.lg },
});
