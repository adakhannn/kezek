import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRoute, type RouteProp } from '@react-navigation/native';

import Avatar from '../../../components/ui/Avatar';
import Badge, { StatusPill } from '../../../components/ui/Badge';
import Button from '../../../components/ui/Button';
import ChipGroup from '../../../components/ui/ChipGroup';
import EmptyState from '../../../components/ui/EmptyState';
import FeedbackBanner from '../../../components/ui/FeedbackBanner';
import FormField from '../../../components/ui/FormField';
import ListRow from '../../../components/ui/ListRow';
import Screen from '../../../components/ui/Screen';
import { SwitchRow } from '../../../components/ui/SelectionRow';
import { SkeletonList } from '../../../components/ui/Skeleton';
import { colors } from '../../../constants/colors';
import { radii, space, type Tone } from '../../../constants/theme';
import { translatePlural, useLanguage, type MobileI18nKey } from '../../../i18n';
import { getErrorMessage } from '../../../lib/errors';
import type { RootStackParamList } from '../../../navigation/types';
import { shortDateTime, useCurrentBusinessReady } from '../opsKit/format';
import { Field, LoadError, ui } from '../opsKit/ui';
import {
    decideApplication,
    decisionBody,
    fetchRoleApplications,
    historyNotice,
    type ApplicationAction,
    type ApplicationStatus,
    type RoleApplication,
} from './roleApplicationsData';

const STATUS: Record<ApplicationStatus, { key: MobileI18nKey; tone: Tone }> = {
    pending: { key: 'ops.applications.status.pending', tone: 'warning' },
    approved: { key: 'ops.applications.status.approved', tone: 'success' },
    rejected: { key: 'ops.applications.status.rejected', tone: 'danger' },
    cancelled: { key: 'ops.applications.status.cancelled', tone: 'neutral' },
};

function HistoryNotice({ application }: { application: RoleApplication }) {
    const { t } = useLanguage();
    const [open, setOpen] = useState(false);
    const notice = historyNotice(application.prior_submission_count, application.risk_flags ?? []);
    if (!notice) return null;
    const count = application.prior_submission_count > 0 ? ` · ${t('ops.applications.history.count', { count: application.prior_submission_count })}` : '';
    return (
        <View style={styles.history}>
            <ListRow
                icon="time-outline"
                iconTone="info"
                title={`${t(notice.titleKey)}${count}`}
                numberOfLines={2}
                trailing={<Badge label={t(open ? 'ops.common.collapse' : 'ops.common.expand')} tone="neutral" />}
                chevron={false}
                onPress={() => setOpen((value) => !value)}
                accessibilityHint={t(open ? 'ops.common.collapse' : 'ops.common.expand')}
            />
            {open ? notice.lines.map((line) => <Text key={line} style={ui.muted}>{t(line)}</Text>) : null}
        </View>
    );
}

/** The website's /dashboard/role-applications: accept a staff applicant into a branch, reject (and block), or unblock. */
export default function ManageRoleApplicationsScreen() {
    const { params } = useRoute<RouteProp<RootStackParamList, 'ManageRoleApplications'>>();
    const { t } = useLanguage();
    const queryClient = useQueryClient();
    const business = useCurrentBusinessReady(params.bizId);
    const [refreshing, setRefreshing] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [rejectingId, setRejectingId] = useState<string | null>(null);
    const [rejectNote, setRejectNote] = useState('');
    const [branchId, setBranchId] = useState('');
    const [isActive, setIsActive] = useState(true);
    const [actionId, setActionId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const query = useQuery({
        queryKey: ['manage-role-applications', params.bizId],
        queryFn: fetchRoleApplications,
        enabled: business.ready,
    });

    if (business.error) return <LoadError screen title={t('manager.manage.selectError')} onRetry={business.retry} />;
    if (!business.ready || query.isLoading) return <Screen><SkeletonList rows={3} testID="applications-loading" /></Screen>;
    if (query.error || !query.data) return <LoadError screen title={t('ops.applications.loadError')} onRetry={() => void query.refetch()} />;

    const { items, branches } = query.data;
    const startApproval = (id: string) => {
        setError(null);
        setNotice(null);
        setEditingId(id);
        setRejectingId(null);
        setBranchId(branches[0]?.id ?? '');
        setIsActive(true);
    };

    const decide = async (application: RoleApplication, action: ApplicationAction, blockDays = 0) => {
        if (action === 'approve' && !branchId) {
            setError(t('ops.applications.branchRequired'));
            return;
        }
        setActionId(`${application.id}:${action}`);
        setError(null);
        setNotice(null);
        try {
            const result = await decideApplication(application.id, decisionBody({
                action,
                note: rejectNote,
                blockDays,
                blockId: action === 'unblock' ? application.active_block_id ?? undefined : undefined,
                branchId,
                isActive,
            }));
            if (action === 'approve') {
                const days = result.schedule_days_created ?? 0;
                setNotice(result.schedule_initialized
                    ? translatePlural(t, 'ops.applications.approved.scheduled', days)
                    : t('ops.applications.approved.unscheduled'));
            } else {
                setNotice(t(action === 'reject' ? 'ops.applications.rejectedDone' : 'ops.applications.unblocked'));
            }
            setEditingId(null);
            setRejectingId(null);
            setRejectNote('');
            await query.refetch();
            void queryClient.invalidateQueries({ queryKey: ['manage-overview'] });
        } catch (decisionError) {
            setError(getErrorMessage(decisionError, t('ops.applications.actionError'), t));
        } finally {
            setActionId(null);
        }
    };

    const onRefresh = async () => {
        setRefreshing(true);
        try { await query.refetch(); } finally { setRefreshing(false); }
    };

    return (
        <Screen refreshing={refreshing} onRefresh={onRefresh} keyboard testID="manage-role-applications-screen">
            {error ? <FeedbackBanner variant="danger" message={error} onClose={() => setError(null)} /> : null}
            {notice ? <FeedbackBanner variant="success" message={notice} onClose={() => setNotice(null)} /> : null}
            {branches.length === 0 ? (
                <FeedbackBanner variant="warning" title={t('ops.applications.noBranch.title')} message={t('ops.applications.noBranch.message')} />
            ) : null}
            {items.length === 0 ? (
                <EmptyState
                    icon="person-add-outline"
                    title={t('ops.applications.empty.title')}
                    message={t('ops.applications.empty.description')}
                    action={<Button title={t('ops.bookings.refresh')} onPress={() => void onRefresh()} variant="outline" fullWidth />}
                />
            ) : null}

            {items.map((application) => {
                const pending = application.status === 'pending';
                const editing = editingId === application.id;
                const rejecting = rejectingId === application.id;
                const busy = actionId !== null;
                const contact = [application.applicant_email, application.applicant_phone].filter(Boolean).join(' · ') || undefined;
                const name = application.applicant_name || t('ops.applications.userFallback');
                const status = STATUS[application.status];
                return (
                    <View key={application.id} style={styles.card} testID={`application-${application.id}`}>
                        <ListRow
                            leading={<Avatar name={name} size={44} />}
                            title={name}
                            subtitle={contact}
                            trailing={<StatusPill label={t(status.key)} tone={status.tone} />}
                        />
                        <View style={styles.meta}>
                            <Badge label={t('ops.applications.role.staff')} tone="accent" icon="cut-outline" />
                            <Text style={ui.hint}>
                                {t('ops.applications.createdAt', { date: shortDateTime(application.created_at, params.tz) })}
                                {application.reviewed_at ? ` · ${t('ops.applications.reviewedAt', { date: shortDateTime(application.reviewed_at, params.tz) })}` : ''}
                            </Text>
                        </View>
                        {application.message ? <Text style={[ui.text, styles.quote]}>{application.message}</Text> : null}
                        {application.review_note ? <Text style={ui.muted}>{application.review_note}</Text> : null}
                        <HistoryNotice application={application} />

                        {pending && !editing && !rejecting ? (
                            <View style={styles.actions}>
                                <Button
                                    title={t('ops.applications.approveSetup')}
                                    onPress={() => startApproval(application.id)}
                                    size="sm"
                                    variant="secondary"
                                    disabled={!branches.length || busy}
                                    style={styles.grow}
                                />
                                <Button
                                    title={t('ops.applications.reject')}
                                    onPress={() => { setRejectingId(application.id); setEditingId(null); setRejectNote(''); }}
                                    size="sm"
                                    variant="ghost"
                                    textStyle={styles.dangerText}
                                    disabled={busy}
                                />
                            </View>
                        ) : null}

                        {pending && rejecting ? (
                            <View style={styles.form}>
                                <FormField
                                    label={t('ops.applications.rejectReason')}
                                    required
                                    value={rejectNote}
                                    onChangeText={setRejectNote}
                                    maxLength={1000}
                                    multiline
                                    testID="application-reject-note"
                                />
                                <View style={ui.wrap}>
                                    <Button
                                        title={t('ops.applications.reject')}
                                        onPress={() => void decide(application, 'reject')}
                                        size="sm"
                                        variant="outline"
                                        disabled={!rejectNote.trim() || busy}
                                        loading={actionId === `${application.id}:reject`}
                                    />
                                    <Button
                                        title={t('ops.applications.rejectAndBlock')}
                                        onPress={() => void decide(application, 'reject', 30)}
                                        size="sm"
                                        variant="danger"
                                        disabled={!rejectNote.trim() || busy}
                                    />
                                    <Button title={t('ops.common.cancel')} onPress={() => setRejectingId(null)} size="sm" variant="ghost" disabled={busy} />
                                </View>
                            </View>
                        ) : null}

                        {pending && editing ? (
                            <View style={styles.form}>
                                <Field label={t('ops.applications.branchLabel')} hint={branches.find((branch) => branch.id === branchId)?.address ?? undefined}>
                                    <ChipGroup
                                        options={branches.map((branch) => ({ key: branch.id, label: branch.name }))}
                                        value={branchId || null}
                                        onChange={setBranchId}
                                        disabled={busy}
                                        accessibilityLabel={t('ops.applications.branchLabel')}
                                        testID="application-branch"
                                    />
                                </Field>
                                <SwitchRow
                                    label={t('ops.applications.activateNow')}
                                    hint={t('ops.applications.activateNowHint')}
                                    value={isActive}
                                    onChange={setIsActive}
                                    disabled={busy}
                                />
                                <View style={styles.actions}>
                                    <Button
                                        title={t('ops.applications.approve')}
                                        onPress={() => void decide(application, 'approve')}
                                        size="sm"
                                        disabled={busy || !branchId}
                                        loading={actionId === `${application.id}:approve`}
                                        style={styles.grow}
                                    />
                                    <Button title={t('ops.common.cancel')} onPress={() => setEditingId(null)} size="sm" variant="ghost" disabled={busy} />
                                </View>
                            </View>
                        ) : null}

                        {application.active_block_id ? (
                            <View style={styles.blocked}>
                                <View style={styles.blockedText}>
                                    <Ionicons name="lock-closed-outline" size={16} color={colors.tone.warning.fg} />
                                    <Text style={[ui.muted, styles.warningText]}>{t('ops.applications.blocked')}</Text>
                                </View>
                                <Button
                                    title={t('ops.applications.unblock')}
                                    onPress={() => void decide(application, 'unblock')}
                                    size="sm"
                                    variant="outline"
                                    disabled={busy}
                                    loading={actionId === `${application.id}:unblock`}
                                />
                            </View>
                        ) : null}
                    </View>
                );
            })}
        </Screen>
    );
}

const styles = StyleSheet.create({
    card: {
        backgroundColor: colors.surface.card,
        borderRadius: radii.lg,
        paddingHorizontal: space.lg,
        paddingBottom: space.lg,
        gap: space.md,
    },
    meta: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.sm },
    quote: {
        padding: space.md,
        borderRadius: radii.md,
        backgroundColor: colors.fill.input,
        borderLeftWidth: 3,
        borderLeftColor: colors.tone.accent.border,
    },
    history: { gap: space.xs },
    actions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.sm,
        paddingTop: space.md,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: colors.border.subtle,
    },
    grow: { flex: 1 },
    dangerText: { color: colors.tone.danger.fg },
    form: {
        gap: space.md,
        paddingTop: space.md,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: colors.border.subtle,
    },
    blocked: {
        gap: space.sm,
        paddingTop: space.md,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: colors.border.subtle,
    },
    blockedText: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
    warningText: { flex: 1, color: colors.tone.warning.fg },
});
