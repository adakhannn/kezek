import { useState } from 'react';
import { Linking, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import Badge, { StatusPill } from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import ChipGroup from '../../components/ui/ChipGroup';
import EmptyState from '../../components/ui/EmptyState';
import ErrorState from '../../components/ui/ErrorState';
import FeedbackBanner from '../../components/ui/FeedbackBanner';
import Screen from '../../components/ui/Screen';
import Section from '../../components/ui/Section';
import { SkeletonList } from '../../components/ui/Skeleton';
import { colors } from '../../constants/colors';
import { space } from '../../constants/theme';
import { useConfirm } from '../../contexts/ConfirmContext';
import { useToast } from '../../contexts/ToastContext';
import { useLanguage } from '../../i18n';
import { formatDateTime } from '../../utils/format';
import { adminApi, adminKeys, type AdminRoleApplication, type RoleApplicationFilter } from './adminApi';
import {
    ROLE_APPLICATION_FILTERS,
    ROLE_APPLICATION_ROLE_LABELS,
    ROLE_APPLICATION_STATE_LABELS,
    ROLE_APPLICATION_STATUS_LABELS,
} from './adminLogic';
import { adminErrorText, adminStyles, MetaLine, ReasonPanel, ReviewHistoryNote } from './adminUi';

function stateTone(status: AdminRoleApplication['status']) {
    if (status === 'approved') return 'success' as const;
    if (status === 'rejected') return 'danger' as const;
    if (status === 'cancelled') return 'neutral' as const;
    return 'warning' as const;
}

/**
 * The website's /admin/role-applications: owner/admin/manager requests to existing businesses.
 * Staff requests are decided by the business owner (they choose the branch); the admin unblocks.
 */
export default function AdminRoleApplicationsScreen() {
    const { t } = useLanguage();
    const { confirm } = useConfirm();
    const { showToast } = useToast();
    const queryClient = useQueryClient();
    const [status, setStatus] = useState<RoleApplicationFilter>('pending');
    const [refreshing, setRefreshing] = useState(false);
    const [rejecting, setRejecting] = useState<string | null>(null);
    const [note, setNote] = useState('');
    const [busy, setBusy] = useState<string | null>(null);
    const list = useQuery({ queryKey: adminKeys.roleApplications(status), queryFn: () => adminApi.roleApplications(status) });

    const refresh = async () => {
        setRefreshing(true);
        try { await list.refetch(); } finally { setRefreshing(false); }
    };

    const decide = async (application: AdminRoleApplication, action: 'approve' | 'reject' | 'unblock', blockDays = 0) => {
        const key = `${application.id}:${action}${blockDays ? ':block' : ''}`;
        setBusy(key);
        try {
            await adminApi.decideRoleApplication(application.id, {
                action,
                note,
                block_days: blockDays,
                block_id: action === 'unblock' ? application.active_block_id ?? undefined : undefined,
            });
            await queryClient.invalidateQueries({ queryKey: ['admin', 'roleApplications'] });
            setRejecting(null);
            setNote('');
            showToast(t('admin.app.saved'), 'success');
        } catch (error) {
            showToast(adminErrorText(error, t('admin.roleApplications.error.action'), t), 'error');
        } finally {
            setBusy(null);
        }
    };

    const approve = async (application: AdminRoleApplication) => {
        const accepted = await confirm({
            title: t('admin.roleApplications.approve'),
            message: t('admin.app.roleApplications.approveConfirm', {
                name: application.applicant_name || t('admin.roleApplications.userFallback'),
                role: t(ROLE_APPLICATION_ROLE_LABELS[application.requested_role]),
            }),
            confirmLabel: t('admin.roleApplications.approve'),
            cancelLabel: t('admin.roleApplications.cancel'),
        });
        if (accepted) await decide(application, 'approve');
    };

    const items = list.data ?? [];

    return (
        <Screen refreshing={refreshing} onRefresh={refresh} keyboard testID="admin-role-applications">
            <Section gap={space.md}>
                <ChipGroup
                    options={ROLE_APPLICATION_FILTERS.map((key) => ({ key, label: t(ROLE_APPLICATION_STATUS_LABELS[key]) }))}
                    value={status}
                    onChange={setStatus}
                    accessibilityLabel={t('admin.roleApplications.status.all')}
                    testID="admin-role-applications-filter"
                />
                {list.isLoading ? <SkeletonList rows={4} /> : list.error ? (
                    <ErrorState message={adminErrorText(list.error, t('admin.roleApplications.error.load'), t)} onRetry={() => void list.refetch()} />
                ) : items.length === 0 ? (
                    <EmptyState icon="person-add-outline" compact title={t('admin.roleApplications.empty.title')} message={t('admin.roleApplications.empty.description')} />
                ) : (
                    <View style={adminStyles.list}>
                        {items.map((application) => {
                            const business = Array.isArray(application.businesses) ? application.businesses[0] ?? null : application.businesses;
                            const pending = application.status === 'pending';
                            const staff = application.requested_role === 'staff';
                            const links = Object.entries(application.evidence_links ?? {}).filter(([, value]) => !!value);
                            return (
                                <View key={application.id} style={adminStyles.itemPadded} testID={`admin-role-application-${application.id}`}>
                                    <View style={adminStyles.rowBetween}>
                                        <View style={adminStyles.flex}>
                                            <Text style={adminStyles.headline} numberOfLines={1}>{application.applicant_name || t('admin.roleApplications.userFallback')}</Text>
                                            <Text style={adminStyles.caption} numberOfLines={1}>{application.applicant_email || application.applicant_phone || application.applicant_user_id}</Text>
                                        </View>
                                        <StatusPill label={t(ROLE_APPLICATION_STATE_LABELS[application.status])} tone={stateTone(application.status)} />
                                    </View>
                                    <View style={adminStyles.badges}>
                                        <Badge label={t(ROLE_APPLICATION_ROLE_LABELS[application.requested_role])} tone="accent" size="md" />
                                    </View>
                                    <View>
                                        <MetaLine
                                            label={t('admin.roleApplications.business')}
                                            value={`${business?.name || application.biz_id}${business?.slug ? ` / ${business.slug}` : ''}`}
                                        />
                                        <MetaLine label={t('admin.roleApplications.created')} value={formatDateTime(application.created_at, true, t.locale)} />
                                    </View>
                                    {application.message ? <Text style={adminStyles.muted}>{application.message}</Text> : null}
                                    {links.length > 0 ? (
                                        <View style={adminStyles.badges}>
                                            {links.map(([key, value]) => (
                                                <Button
                                                    key={key}
                                                    title={key}
                                                    onPress={() => void Linking.openURL(String(value))}
                                                    variant="ghost"
                                                    size="sm"
                                                    leadingIcon={<Ionicons name="open-outline" size={14} color={colors.tone.accent.fg} />}
                                                    textStyle={adminStyles.accentText}
                                                />
                                            ))}
                                        </View>
                                    ) : null}
                                    <ReviewHistoryNote count={application.prior_submission_count} flags={application.risk_flags ?? []} />
                                    {pending && staff ? <FeedbackBanner variant="info" message={t('admin.roleApplications.staffNotice')} compact /> : null}

                                    {pending && !staff && rejecting === application.id ? (
                                        <ReasonPanel
                                            value={note}
                                            onChange={setNote}
                                            placeholder={t('admin.roleApplications.rejectReason')}
                                            busy={busy}
                                            cancelLabel={t('admin.roleApplications.cancel')}
                                            onCancel={() => { setRejecting(null); setNote(''); }}
                                            actions={[
                                                { key: `${application.id}:reject`, title: t('admin.roleApplications.reject'), onPress: () => void decide(application, 'reject') },
                                                { key: `${application.id}:reject:block`, title: t('admin.roleApplications.rejectAndBlock'), onPress: () => void decide(application, 'reject', 30), danger: true },
                                            ]}
                                        />
                                    ) : pending && !staff ? (
                                        <View style={adminStyles.actionsPadded}>
                                            <Button
                                                title={t('admin.roleApplications.approve')}
                                                onPress={() => void approve(application)}
                                                variant="secondary"
                                                size="sm"
                                                loading={busy === `${application.id}:approve`}
                                                disabled={!!busy}
                                                testID={`admin-role-approve-${application.id}`}
                                            />
                                            <Button
                                                title={t('admin.roleApplications.reject')}
                                                onPress={() => { setRejecting(application.id); setNote(''); }}
                                                variant="outline"
                                                size="sm"
                                                disabled={!!busy}
                                                testID={`admin-role-reject-${application.id}`}
                                            />
                                        </View>
                                    ) : null}

                                    {application.active_block_id ? (
                                        <View style={adminStyles.actionsPadded}>
                                            <Text style={[adminStyles.caption, adminStyles.dangerText, adminStyles.flex]}>{t('admin.roleApplications.blocked')}</Text>
                                            <Button
                                                title={t('admin.roleApplications.unblock')}
                                                onPress={() => void decide(application, 'unblock')}
                                                variant="outline"
                                                size="sm"
                                                loading={busy === `${application.id}:unblock`}
                                                disabled={!!busy}
                                            />
                                        </View>
                                    ) : null}
                                </View>
                            );
                        })}
                    </View>
                )}
            </Section>
        </Screen>
    );
}
