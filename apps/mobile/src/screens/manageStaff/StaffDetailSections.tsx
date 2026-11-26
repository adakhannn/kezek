import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';

import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import FeedbackBanner from '../../components/ui/FeedbackBanner';
import Input from '../../components/ui/Input';
import MotionPressable from '../../components/ui/MotionPressable';
import { colors } from '../../constants/colors';
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
import { Badge, OptionList, SectionTitle, ToggleRow, ui } from './ui';

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
        <View style={ui.gap}>
            {error ? <FeedbackBanner variant="danger" message={error} /> : null}
            <Input
                label={`${t('manageStaff.staff.form.fullName.label')} *`}
                value={form.full_name}
                onChangeText={(value) => set('full_name', value)}
                placeholder={t('manageStaff.staff.form.fullName.placeholder')}
                testID="staff-form-name"
            />
            <ToggleRow label={t('manageStaff.staff.form.active.label')} value={form.is_active} onChange={(value) => set('is_active', value)} />
            <Badge
                label={t(form.is_active ? 'manageStaff.staff.form.active.working' : 'manageStaff.staff.form.active.inactive')}
                tone={form.is_active ? 'success' : 'muted'}
            />
            <Input
                label={t('manageStaff.staff.form.email.label')}
                value={form.email}
                onChangeText={(value) => set('email', value)}
                placeholder={t('manageStaff.staff.form.email.placeholder')}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
            />
            <Input
                label={t('manageStaff.staff.form.phone.label')}
                value={form.phone}
                onChangeText={(value) => set('phone', value)}
                placeholder={t('manageStaff.staff.form.phone.placeholder')}
                keyboardType="phone-pad"
            />
            <View style={ui.divider} />
            <SectionTitle title={t('manageStaff.staff.form.income.title')} description={t('manageStaff.staff.form.income.desc')} />
            <View style={styles.twoColumns}>
                <Input
                    label={t('manageStaff.staff.form.income.master.label')}
                    value={form.percent_master}
                    onChangeText={(value) => setForm((current) => withMasterPercent(current, value))}
                    keyboardType="numeric"
                    containerStyle={styles.column}
                    testID="staff-form-master"
                />
                <Input
                    label={t('manageStaff.staff.form.income.salon.label')}
                    value={form.percent_salon}
                    onChangeText={(value) => setForm((current) => withSalonPercent(current, value))}
                    keyboardType="numeric"
                    containerStyle={styles.column}
                    testID="staff-form-salon"
                />
            </View>
            <View style={ui.divider} />
            <SectionTitle title={t('manageStaff.staff.form.hourly.title')} description={t('manageStaff.staff.form.hourly.desc')} />
            <Input
                label={t('manageStaff.staff.form.hourly.rate.label')}
                value={form.hourly_rate}
                onChangeText={(value) => set('hourly_rate', value)}
                placeholder={t('manageStaff.staff.form.hourly.rate.placeholder')}
                keyboardType="decimal-pad"
            />
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

    if (query.isLoading) return <Text style={ui.muted}>{t('manageStaff.staff.services.loading')}</Text>;
    if (query.error) {
        return (
            <FeedbackBanner
                variant="danger"
                title={t('manageStaff.staff.services.error')}
                message={staffErrorMessage(query.error, t('manageStaff.loadError'), t)}
                action={<Button title={t('staff.retry')} onPress={() => void query.refetch()} size="sm" variant="outline" />}
            />
        );
    }
    const services = query.data?.services ?? [];
    const allowed = query.data?.allowed ?? new Set<string>();
    if (services.length === 0) {
        return <FeedbackBanner variant="warning" title={t('manageStaff.staff.services.empty.title')} message={t('manageStaff.staff.services.empty.desc')} />;
    }
    return (
        <View style={ui.gap}>
            <Text style={ui.muted}>{t('manageStaff.staff.services.hint')}</Text>
            {services.map((service) => {
                const checked = allowed.has(service.id);
                return (
                    <MotionPressable
                        key={service.id}
                        onPress={() => void toggle(service.id)}
                        disabled={!!pendingId}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked, disabled: !!pendingId }}
                        accessibilityLabel={`${serviceName(service, locale)}, ${service.duration_min} ${t('manageStaff.staff.cabinet.services.duration')}`}
                        style={[styles.service, checked ? styles.serviceChecked : null]}
                        testID={`staff-service-${service.id}`}
                    >
                        <Ionicons name={checked ? 'checkbox' : 'square-outline'} size={22} color={checked ? colors.accent.indigo : colors.text.secondary} />
                        <Text style={styles.serviceName}>{serviceName(service, locale)}</Text>
                        <Text style={ui.muted}>{service.duration_min} {t('manageStaff.staff.cabinet.services.duration')}</Text>
                    </MotionPressable>
                );
            })}
            {allowed.size > 0 ? (
                <Text style={ui.muted}>
                    {t('manageStaff.staff.services.selected')} {allowed.size} {t('manageStaff.staff.services.selectedOf')} {services.length}
                </Text>
            ) : null}
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
        <Card variant="outlined" style={ui.gap}>
            <SectionTitle title={t('manageStaff.staff.transfer.title')} description={t('manageStaff.staff.transfer.subtitle')} />
            <Text style={ui.label}>{t('manageStaff.staff.transfer.current')}</Text>
            <Text style={ui.text}>{current?.name ?? '—'}</Text>
            <Text style={ui.label}>{t('manageStaff.staff.transfer.target.label')}</Text>
            <OptionList options={others.map((branch) => ({ value: branch.id, label: branch.name }))} value={target} onChange={setTarget} disabled={loading} />
            {explicitScheduling ? <FeedbackBanner variant="info" message={t('manageStaff.scheduling.transferHint')} /> : null}
            <FeedbackBanner
                variant="warning"
                title={t('manageStaff.staff.transfer.warning.title')}
                message={[
                    t('manageStaff.staff.transfer.warning.permanent'),
                    t('manageStaff.staff.transfer.warning.bookings'),
                    t('manageStaff.staff.transfer.warning.history'),
                ].join(' ')}
            />
            {error ? <FeedbackBanner variant="danger" message={error} /> : null}
            <Button title={t('manageStaff.staff.transfer.submit')} onPress={() => void submit()} loading={loading} disabled={!target} fullWidth />
            <Button title={t('manageStaff.staff.transfer.cancel')} onPress={() => setOpen(false)} variant="ghost" disabled={loading} fullWidth />
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

    return (
        <Card style={styles.danger}>
            <View style={ui.row}>
                <Ionicons name="warning" size={22} color={colors.status.danger} />
                <Text style={styles.dangerTitle}>{t('manageStaff.staff.danger.title')}</Text>
            </View>
            {error ? <FeedbackBanner variant="danger" message={error} /> : null}
            <Button
                title={t(busy === 'dismiss' ? 'manageStaff.staff.danger.dismiss.processing' : 'manageStaff.staff.danger.dismiss.button')}
                onPress={() => void run('dismiss')}
                variant="danger"
                loading={busy === 'dismiss'}
                disabled={!!busy}
                fullWidth
            />
            <Text style={styles.dangerText}>{t('manageStaff.staff.danger.dismiss.desc')}</Text>
            {allowPermanentDelete ? (
                <>
                    <View style={ui.divider} />
                    <Button
                        title={t(busy === 'delete' ? 'manageStaff.staff.danger.delete.processing' : 'manageStaff.staff.danger.delete.button')}
                        onPress={() => void run('delete')}
                        variant="danger"
                        loading={busy === 'delete'}
                        disabled={!!busy}
                        fullWidth
                    />
                    <Text style={styles.dangerText}>{t('manageStaff.staff.danger.delete.desc')}</Text>
                </>
            ) : null}
        </Card>
    );
}

const styles = StyleSheet.create({
    twoColumns: { flexDirection: 'row', gap: colors.layout.space3 },
    column: { flex: 1 },
    service: {
        minHeight: 48,
        flexDirection: 'row',
        alignItems: 'center',
        gap: colors.layout.space3,
        paddingHorizontal: colors.layout.space3,
        borderRadius: colors.layout.radiusMd,
        borderWidth: 1,
        borderColor: colors.border.subtle,
        backgroundColor: colors.surface.card,
    },
    serviceChecked: { borderColor: colors.accent.primary, backgroundColor: colors.surface.emphasis },
    serviceName: { flex: 1, fontSize: 15, color: colors.text.primary },
    danger: { gap: colors.layout.space3, borderColor: colors.status.danger, borderWidth: 1 },
    dangerTitle: { fontSize: 18, fontWeight: '700', color: colors.status.danger },
    dangerText: { fontSize: 13, color: colors.status.danger },
});
