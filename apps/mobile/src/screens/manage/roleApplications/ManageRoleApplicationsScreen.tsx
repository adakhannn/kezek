import { useState } from 'react';
import { RefreshControl, ScrollView, Switch, Text, View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRoute, type RouteProp } from '@react-navigation/native';

import Button from '../../../components/ui/Button';
import Card from '../../../components/ui/Card';
import EmptyState from '../../../components/ui/EmptyState';
import FeedbackBanner from '../../../components/ui/FeedbackBanner';
import Input from '../../../components/ui/Input';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';
import { colors } from '../../../constants/colors';
import { translatePlural, useLanguage, type MobileI18nKey } from '../../../i18n';
import { getErrorMessage } from '../../../lib/errors';
import type { RootStackParamList } from '../../../navigation/types';
import { shortDateTime, useCurrentBusinessReady } from '../opsKit/format';
import { ChipGroup, Field, LoadError, ui } from '../opsKit/ui';
import {
    decideApplication,
    decisionBody,
    fetchRoleApplications,
    historyNotice,
    type ApplicationAction,
    type ApplicationStatus,
    type RoleApplication,
} from './roleApplicationsData';

const STATUS_LABEL: Record<ApplicationStatus, MobileI18nKey> = {
    pending: 'ops.applications.status.pending',
    approved: 'ops.applications.status.approved',
    rejected: 'ops.applications.status.rejected',
    cancelled: 'ops.applications.status.cancelled',
};

function HistoryNotice({ application }: { application: RoleApplication }) {
    const { t } = useLanguage();
    const [open, setOpen] = useState(false);
    const notice = historyNotice(application.prior_submission_count, application.risk_flags ?? []);
    if (!notice) return null;
    const count = application.prior_submission_count > 0 ? ` · ${t('ops.applications.history.count', { count: application.prior_submission_count })}` : '';
    return (
        <View style={{ marginTop: colors.layout.space2 }}>
            <Button
                title={`${t(notice.titleKey)}${count}`}
                onPress={() => setOpen((value) => !value)}
                variant="ghost"
                size="sm"
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

    if (business.error) return <LoadError title={t('manager.manage.selectError')} onRetry={business.retry} />;
    if (!business.ready || query.isLoading) return <LoadingSpinner message={t('ops.applications.loading')} />;
    if (query.error || !query.data) return <LoadError title={t('ops.applications.loadError')} onRetry={() => void query.refetch()} />;

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
        <ScrollView
            style={ui.screen}
            contentContainerStyle={ui.content}
            keyboardShouldPersistTaps="handled"
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} />}
            testID="manage-role-applications-screen"
        >
            <Text style={ui.title}>{t('ops.applications.title')}</Text>
            <Text style={ui.subtitle}>{t('ops.applications.description')}</Text>
            {error ? <FeedbackBanner variant="danger" message={error} onClose={() => setError(null)} /> : null}
            {notice ? <FeedbackBanner variant="success" message={notice} onClose={() => setNotice(null)} /> : null}
            {branches.length === 0 ? (
                <FeedbackBanner variant="warning" title={t('ops.applications.noBranch.title')} message={t('ops.applications.noBranch.message')} />
            ) : null}
            {items.length === 0 ? (
                <EmptyState icon="person-add" title={t('ops.applications.empty.title')} message={t('ops.applications.empty.description')} />
            ) : null}

            {items.map((application) => {
                const pending = application.status === 'pending';
                const editing = editingId === application.id;
                const rejecting = rejectingId === application.id;
                const busy = actionId !== null;
                const contact = [application.applicant_email, application.applicant_phone].filter(Boolean).join(' · ') || application.applicant_user_id;
                return (
                    <Card key={application.id} padding="md" testID={`application-${application.id}`}>
                        <View style={ui.rowBetween}>
                            <View style={{ flexShrink: 1 }}>
                                <Text style={[ui.text, { fontWeight: '700' }]}>{application.applicant_name || t('ops.applications.userFallback')}</Text>
                                <Text style={ui.muted}>{contact}</Text>
                            </View>
                            <View style={{ alignItems: 'flex-end', gap: 4 }}>
                                <View style={ui.badge}><Text style={ui.badgeText}>{t('ops.applications.role.staff')}</Text></View>
                                <View style={ui.badge}>
                                    <Text style={[ui.badgeText, application.status === 'approved' ? ui.successText : application.status === 'rejected' ? ui.dangerText : null]}>
                                        {t(STATUS_LABEL[application.status])}
                                    </Text>
                                </View>
                            </View>
                        </View>
                        {application.message ? <Text style={[ui.text, { marginTop: colors.layout.space2 }]}>{application.message}</Text> : null}
                        <Text style={[ui.hint, { marginTop: colors.layout.space2 }]}>
                            {t('ops.applications.createdAt', { date: shortDateTime(application.created_at, params.tz) })}
                            {application.reviewed_at ? ` · ${t('ops.applications.reviewedAt', { date: shortDateTime(application.reviewed_at, params.tz) })}` : ''}
                        </Text>
                        {application.review_note ? <Text style={ui.muted}>{application.review_note}</Text> : null}
                        <HistoryNotice application={application} />

                        {pending && !editing && !rejecting ? (
                            <View style={[ui.wrap, { marginTop: colors.layout.space2 }]}>
                                <Button title={t('ops.applications.approveSetup')} onPress={() => startApproval(application.id)} size="sm" disabled={!branches.length || busy} />
                                <Button
                                    title={t('ops.applications.reject')}
                                    onPress={() => { setRejectingId(application.id); setEditingId(null); setRejectNote(''); }}
                                    size="sm"
                                    variant="outline"
                                    disabled={busy}
                                />
                            </View>
                        ) : null}

                        {pending && rejecting ? (
                            <View style={{ marginTop: colors.layout.space2, gap: colors.layout.space2 }}>
                                <Input
                                    value={rejectNote}
                                    onChangeText={setRejectNote}
                                    maxLength={1000}
                                    multiline
                                    placeholder={t('ops.applications.rejectReason')}
                                    accessibilityLabel={t('ops.applications.rejectReason')}
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
                            <View style={{ marginTop: colors.layout.space2, gap: colors.layout.space2 }}>
                                <Field label={t('ops.applications.branchLabel')} hint={branches.find((branch) => branch.id === branchId)?.address ?? undefined}>
                                    <ChipGroup
                                        options={branches.map((branch) => ({ key: branch.id, label: branch.name }))}
                                        value={branchId || null}
                                        onChange={setBranchId}
                                        disabled={busy}
                                        testID="application-branch"
                                    />
                                </Field>
                                <View style={[ui.rowBetween, { minHeight: 44 }]}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={[ui.text, { fontWeight: '600' }]}>{t('ops.applications.activateNow')}</Text>
                                        <Text style={ui.hint}>{t('ops.applications.activateNowHint')}</Text>
                                    </View>
                                    <Switch
                                        value={isActive}
                                        onValueChange={setIsActive}
                                        disabled={busy}
                                        accessibilityLabel={t('ops.applications.activateNow')}
                                        trackColor={{ true: colors.accent.primary, false: colors.border.light }}
                                    />
                                </View>
                                <View style={ui.wrap}>
                                    <Button
                                        title={t('ops.applications.approve')}
                                        onPress={() => void decide(application, 'approve')}
                                        size="sm"
                                        disabled={busy || !branchId}
                                        loading={actionId === `${application.id}:approve`}
                                    />
                                    <Button title={t('ops.common.cancel')} onPress={() => setEditingId(null)} size="sm" variant="ghost" disabled={busy} />
                                </View>
                            </View>
                        ) : null}

                        {application.active_block_id ? (
                            <View style={{ marginTop: colors.layout.space2, gap: colors.layout.space2 }}>
                                <Text style={[ui.muted, ui.warningText]}>{t('ops.applications.blocked')}</Text>
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
                    </Card>
                );
            })}
        </ScrollView>
    );
}
