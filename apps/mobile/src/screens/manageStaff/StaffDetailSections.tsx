import { Fragment, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';

import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import EmptyState from '../../components/ui/EmptyState';
import ErrorState from '../../components/ui/ErrorState';
import FeedbackBanner from '../../components/ui/FeedbackBanner';
import FormField, { FieldGroup, FieldRow } from '../../components/ui/FormField';
import { KeyValueRow } from '../../components/ui/ListRow';
import { CheckboxRow } from '../../components/ui/SelectionRow';
import { SkeletonList } from '../../components/ui/Skeleton';
import { MIN_TOUCH_TARGET } from '../../constants/accessibility';
import { colors } from '../../constants/colors';
import { radii, space, typeScale } from '../../constants/theme';
import { useConfirm } from '../../contexts/ConfirmContext';
import { useToast } from '../../contexts/ToastContext';
import { useLanguage, type MobileI18nKey } from '../../i18n';
import { supabase } from '../../lib/supabase';
import { ensureCurrentBusiness } from '../manage/currentBusiness';
import { runStaffAction, transferStaff, updateStaff } from './api';
import { staffErrorMessage } from './errors';
import { staffQueryKeys } from './queryKeys';
import { validateStaffForm, withMasterPercent, withSalonPercent, type StaffFormState } from './staffForm';
import type { StaffService } from './types';
import { OptionList, SectionTitle, ToggleRow, ui } from './ui';

/** The website's StaffForm: contacts, activity and pay terms of the card. */
export function StaffProfileForm({ bizId, initial, onSaved }: { bizId: string; initial: StaffFormState; onSaved: () => void }) {
    const { t } = useLanguage();
    const { showToast } = useToast();
    const queryClient = useQueryClient();
    const [form, setForm] = useState(initial);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    useEffect(() => setForm(initial), [initial]);

    const set = <K extends keyof StaffFormState>(key: K, value: StaffFormState[K]) => setForm((current) => ({ ...current, [key]: value }));

    const save = async () => {
        const result = validateStaffForm(form);
        if (!result.ok) { setError(t(result.error)); return; }
        setSaving(true);
        setError(null);
        try {
            await updateStaff(bizId, result.body);
            await queryClient.invalidateQueries({ queryKey: staffQueryKeys.business(bizId) });
            showToast(t('manageStaff.saved'), 'success');
            onSaved();
        } catch (cause) {
            setError(staffErrorMessage(cause, t('manageStaff.saveFailed'), t));
        } finally {
            setSaving(false);
        }
    };

    return (
        <View style={styles.form}>
            {error ? <FeedbackBanner variant="danger" message={error} compact /> : null}
            <FieldGroup title={t('manageStaff.form.contacts')}>
                <FormField
                    label={t('manageStaff.staff.form.fullName.label')}
                    required
                    value={form.full_name}
                    onChangeText={(value) => set('full_name', value)}
                    placeholder={t('manageStaff.staff.form.fullName.placeholder')}
                    testID="staff-form-name"
                />
                <FormField
                    label={t('manageStaff.staff.form.email.label')}
                    value={form.email}
                    onChangeText={(value) => set('email', value)}
                    placeholder={t('manageStaff.staff.form.email.placeholder')}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                />
                <FormField
                    label={t('manageStaff.staff.form.phone.label')}
                    value={form.phone}
                    onChangeText={(value) => set('phone', value)}
                    placeholder={t('manageStaff.staff.form.phone.placeholder')}
                    keyboardType="phone-pad"
                />
            </FieldGroup>

            <Card variant="plain" padding="md" style={styles.switchCard}>
                <ToggleRow
                    label={t('manageStaff.staff.form.active.label')}
                    hint={t(form.is_active ? 'manageStaff.staff.form.active.working' : 'manageStaff.staff.form.active.inactive')}
                    value={form.is_active}
                    onChange={(value) => set('is_active', value)}
                    testID="staff-form-active"
                />
            </Card>

            <FieldGroup title={t('manageStaff.staff.form.income.title')} caption={t('manageStaff.staff.form.income.desc')}>
                <FieldRow>
                    <FormField
                        label={t('manageStaff.form.masterShare')}
                        value={form.percent_master}
                        onChangeText={(value) => setForm((current) => withMasterPercent(current, value))}
                        keyboardType="numeric"
                        suffix="%"
                        testID="staff-form-master"
                    />
                    <FormField
                        label={t('manageStaff.form.salonShare')}
                        value={form.percent_salon}
                        onChangeText={(value) => setForm((current) => withSalonPercent(current, value))}
                        keyboardType="numeric"
                        suffix="%"
                        testID="staff-form-salon"
                    />
                </FieldRow>
            </FieldGroup>

            <FieldGroup title={t('manageStaff.staff.form.hourly.title')} caption={t('manageStaff.staff.form.hourly.desc')}>
                <FormField
                    label={t('manageStaff.form.hourlyRate')}
                    value={form.hourly_rate}
                    onChangeText={(value) => set('hourly_rate', value)}
                    placeholder={t('manageStaff.form.hourlyNone')}
                    keyboardType="decimal-pad"
                    suffix={t('manageStaff.form.perHour')}
                />
            </FieldGroup>

            <Button
                title={t(saving ? 'manageStaff.staff.form.save.saving' : 'manageStaff.staff.form.save.button')}
                onPress={() => void save()}
                loading={saving}
                fullWidth
            />
        </View>
    );
}

const serviceName = (service: StaffService, locale: string) =>
    (locale === 'ky' && service.name_ky) || (locale === 'en' && service.name_en) || service.name_ru;

/** The website's StaffServicesEditor: the services of the staff's branch the person performs. */
export function StaffServicesEditor({ bizId, staffId, branchId }: { bizId: string; staffId: string; branchId: string }) {
    const { t, locale } = useLanguage();
    const { showToast } = useToast();
    const [pendingId, setPendingId] = useState<string | null>(null);
    const query = useQuery({
        queryKey: staffQueryKeys.services(bizId, staffId, branchId),
        queryFn: async () => {
            await ensureCurrentBusiness(bizId);
            const [services, links] = await Promise.all([
                supabase.from('services').select('id,name_ru,name_ky,name_en,duration_min,branch_id,active')
                    .eq('branch_id', branchId).eq('active', true).order('name_ru'),
                supabase.from('service_staff').select('service_id').eq('staff_id', staffId),
            ]);
            if (services.error) throw services.error;
            if (links.error) throw links.error;
            return {
                services: (services.data ?? []) as StaffService[],
                allowed: new Set((links.data ?? []).map((row) => String((row as { service_id: string }).service_id))),
            };
        },
    });

    const toggle = async (serviceId: string) => {
        if (!query.data || pendingId) return;
        const has = query.data.allowed.has(serviceId);
        setPendingId(serviceId);
        try {
            const { error } = has
                ? await supabase.from('service_staff').delete().eq('service_id', serviceId).eq('staff_id', staffId)
                : await supabase.from('service_staff').insert({ service_id: serviceId, staff_id: staffId, is_active: true });
            if (error) throw error;
            await query.refetch();
        } catch (error) {
            showToast(staffErrorMessage(error, t('manageStaff.saveFailed'), t), 'error');
        } finally {
            setPendingId(null);
        }
    };

    if (query.isLoading) return <SkeletonList rows={3} avatar={false} />;
    if (query.error) {
        return (
            <ErrorState
                compact
                title={t('manageStaff.loadError')}
                message={staffErrorMessage(query.error, t('manageStaff.loadError'), t)}
                onRetry={() => void query.refetch()}
            />
        );
    }
    const services = query.data?.services ?? [];
    const allowed = query.data?.allowed ?? new Set<string>();
    if (services.length === 0) {
        return (
            <EmptyState
                icon="cut-outline"
                compact
                title={t('manageStaff.staff.services.empty.title')}
                message={t('manageStaff.staff.services.empty.desc')}
            />
        );
    }
    return (
        <View style={ui.gap}>
            <Card variant="plain" padding="md" style={styles.list}>
                {services.map((service) => (
                    <CheckboxRow
                        key={service.id}
                        label={serviceName(service, locale)}
                        hint={`${service.duration_min} ${t('manageStaff.staff.cabinet.services.duration')}`}
                        checked={allowed.has(service.id)}
                        onChange={() => void toggle(service.id)}
                        disabled={!!pendingId}
                        testID={`staff-service-${service.id}`}
                    />
                ))}
            </Card>
            <Text style={ui.muted}>
                {t('manageStaff.staff.services.selected')} {allowed.size} {t('manageStaff.staff.services.selectedOf')} {services.length}
            </Text>
        </View>
    );
}

/** The website's TransferStaffDialog: a permanent move to another active branch. */
export function StaffTransferPanel({ bizId, staffId, currentBranchId, branches, explicitScheduling }: {
    bizId: string;
    staffId: string;
    currentBranchId: string;
    branches: { id: string; name: string }[];
    explicitScheduling: boolean;
}) {
    const { t } = useLanguage();
    const { showToast } = useToast();
    const queryClient = useQueryClient();
    const [open, setOpen] = useState(false);
    const [target, setTarget] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const others = branches.filter((branch) => branch.id !== currentBranchId);
    const current = branches.find((branch) => branch.id === currentBranchId);

    const submit = async () => {
        if (!target) { setError(t('manageStaff.staff.transfer.errors.selectBranch')); return; }
        setLoading(true);
        setError(null);
        try {
            await transferStaff(bizId, staffId, target, currentBranchId);
            setOpen(false);
            showToast(t('manageStaff.transferDone'), 'success');
            await queryClient.invalidateQueries({ queryKey: staffQueryKeys.business(bizId) });
        } catch (cause) {
            setError(staffErrorMessage(cause, t('manageStaff.saveFailed'), t));
        } finally {
            setLoading(false);
        }
    };

    if (!open) {
        return (
            <Button
                title={t('manageStaff.staff.transfer.button')}
                onPress={() => { setOpen(true); setTarget(''); setError(null); }}
                variant="outline"
                leadingIcon={<Ionicons name="swap-horizontal" size={18} color={colors.text.primary} />}
                fullWidth
            />
        );
    }

    return (
        <Card variant="plain" padding="md" style={ui.gap}>
            <SectionTitle title={t('manageStaff.staff.transfer.title')} description={t('manageStaff.staff.transfer.subtitle')} />
            <KeyValueRow label={t('manageStaff.staff.transfer.current').replace(/:\s*$/, '')} value={current?.name ?? '—'} />
            <Text style={ui.label}>{t('manageStaff.staff.transfer.target.label')}</Text>
            <OptionList options={others.map((branch) => ({ value: branch.id, label: branch.name }))} value={target} onChange={setTarget} disabled={loading} />
            {explicitScheduling ? <FeedbackBanner variant="info" message={t('manageStaff.scheduling.transferHint')} compact /> : null}
            <FeedbackBanner
                variant="warning"
                title={t('manageStaff.staff.transfer.warning.title')}
                message={[
                    t('manageStaff.staff.transfer.warning.permanent'),
                    t('manageStaff.staff.transfer.warning.bookings'),
                    t('manageStaff.staff.transfer.warning.history'),
                ].join(' ')}
                compact
            />
            {error ? <FeedbackBanner variant="danger" message={error} compact /> : null}
            <View style={styles.actions}>
                <Button title={t('manageStaff.staff.transfer.cancel')} onPress={() => setOpen(false)} variant="ghost" disabled={loading} style={styles.secondary} />
                <Button title={t('manageStaff.staff.transfer.submit')} onPress={() => void submit()} loading={loading} disabled={!target} style={styles.primary} />
            </View>
        </Card>
    );
}

/** The website's DangerActions: dismiss (data kept) and permanent delete, both confirmed. */
export function StaffDangerZone({ bizId, staffId, allowPermanentDelete, onDone }: {
    bizId: string;
    staffId: string;
    allowPermanentDelete: boolean;
    onDone: (action: 'dismiss' | 'delete') => void;
}) {
    const { t } = useLanguage();
    const { confirm } = useConfirm();
    const queryClient = useQueryClient();
    const [busy, setBusy] = useState<'dismiss' | 'delete' | null>(null);
    const [error, setError] = useState<string | null>(null);

    const run = async (action: 'dismiss' | 'delete') => {
        const keys: Record<'dismiss' | 'delete', { title: MobileI18nKey; message: MobileI18nKey; button: MobileI18nKey }> = {
            dismiss: { title: 'manageStaff.staff.danger.dismiss.title', message: 'manageStaff.staff.danger.dismiss.confirm', button: 'manageStaff.staff.danger.dismiss.button' },
            delete: { title: 'manageStaff.staff.danger.delete.title', message: 'manageStaff.staff.danger.delete.confirm', button: 'manageStaff.staff.danger.delete.button' },
        };
        const accepted = await confirm({
            title: t(keys[action].title),
            message: t(keys[action].message),
            confirmLabel: t(keys[action].button),
            cancelLabel: t('manageStaff.common.cancel'),
            variant: 'danger',
        });
        if (!accepted) return;
        setBusy(action);
        setError(null);
        try {
            await runStaffAction(bizId, staffId, action);
            await queryClient.invalidateQueries({ queryKey: staffQueryKeys.business(bizId) });
            onDone(action);
        } catch (cause) {
            setError(staffErrorMessage(cause, t('manageStaff.actionFailed'), t));
        } finally {
            setBusy(null);
        }
    };

    const rows: { action: 'dismiss' | 'delete'; icon: 'person-remove-outline' | 'trash-outline'; title: MobileI18nKey; busyTitle: MobileI18nKey; desc: MobileI18nKey }[] = [
        { action: 'dismiss', icon: 'person-remove-outline', title: 'manageStaff.staff.danger.dismiss.button', busyTitle: 'manageStaff.staff.danger.dismiss.processing', desc: 'manageStaff.staff.danger.dismiss.desc' },
        ...(allowPermanentDelete
            ? [{ action: 'delete' as const, icon: 'trash-outline' as const, title: 'manageStaff.staff.danger.delete.button' as MobileI18nKey, busyTitle: 'manageStaff.staff.danger.delete.processing' as MobileI18nKey, desc: 'manageStaff.staff.danger.delete.desc' as MobileI18nKey }]
            : []),
    ];

    return (
        <View style={ui.gap}>
            {error ? <FeedbackBanner variant="danger" message={error} compact /> : null}
            <View style={styles.dangerCard}>
                {rows.map((row, index) => (
                    <Fragment key={row.action}>
                        {index > 0 ? <View style={ui.hairline} /> : null}
                        <Pressable
                            onPress={() => void run(row.action)}
                            disabled={!!busy}
                            accessibilityRole="button"
                            accessibilityLabel={t(row.title)}
                            accessibilityHint={t(row.desc)}
                            accessibilityState={{ disabled: !!busy, busy: busy === row.action }}
                            style={({ pressed }) => [styles.dangerRow, pressed ? ui.pressed : null, busy && busy !== row.action ? ui.disabled : null]}
                        >
                            <View style={styles.dangerIcon}>
                                <Ionicons name={row.icon} size={18} color={colors.tone.danger.fg} />
                            </View>
                            <View style={styles.dangerBody}>
                                <Text style={styles.dangerTitle}>{t(busy === row.action ? row.busyTitle : row.title)}</Text>
                                <Text style={styles.dangerText}>{t(row.desc)}</Text>
                            </View>
                        </Pressable>
                    </Fragment>
                ))}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    form: { gap: space.lg },
    switchCard: { paddingVertical: space.xs },
    list: { paddingVertical: space.xs },
    actions: { flexDirection: 'row', gap: space.md },
    secondary: { flex: 1 },
    primary: { flex: 2 },
    dangerCard: {
        backgroundColor: colors.surface.card,
        borderRadius: radii.lg,
        paddingHorizontal: space.lg,
        borderWidth: 1,
        borderColor: colors.tone.danger.border,
    },
    dangerRow: { minHeight: MIN_TOUCH_TARGET + 12, flexDirection: 'row', alignItems: 'flex-start', gap: space.md, paddingVertical: space.md },
    dangerIcon: {
        width: 36,
        height: 36,
        borderRadius: radii.md,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.tone.danger.bg,
    },
    dangerBody: { flex: 1, gap: space.xxs },
    dangerTitle: { ...typeScale.bodyStrong, color: colors.tone.danger.fg },
    dangerText: { ...typeScale.caption, color: colors.text.secondary },
});
