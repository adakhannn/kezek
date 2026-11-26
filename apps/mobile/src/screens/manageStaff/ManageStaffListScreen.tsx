import { useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';

import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import EmptyState from '../../components/ui/EmptyState';
import Input from '../../components/ui/Input';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import MotionPressable from '../../components/ui/MotionPressable';
import { colors } from '../../constants/colors';
import { useConfirm } from '../../contexts/ConfirmContext';
import { useToast } from '../../contexts/ToastContext';
import { useLanguage } from '../../i18n';
import { openWebAsCurrentUser } from '../../lib/webLinks';
import type { RootStackParamList } from '../../navigation/types';
import { cancelStaffInvitation, fetchStaffList, runStaffAction } from './api';
import { staffErrorMessage } from './errors';
import { staffQueryKeys } from './queryKeys';
import { filterStaffRows, pageOf, staffCounts, staffInitials, type StaffStatusFilter } from './staffForm';
import type { StaffRow } from './types';
import { Badge, Chip, StatTile, ui } from './ui';

type Navigation = NativeStackNavigationProp<RootStackParamList, 'ManageStaff'>;

/** /dashboard/staff: the business's staff cards, their status, invitations and quick actions. */
export default function ManageStaffListScreen() {
    const navigation = useNavigation<Navigation>();
    const { params } = useRoute<RouteProp<RootStackParamList, 'ManageStaff'>>();
    const { t } = useLanguage();
    const { confirm } = useConfirm();
    const { showToast } = useToast();
    const queryClient = useQueryClient();
    const [query, setQuery] = useState('');
    const [status, setStatus] = useState<StaffStatusFilter>('all');
    const [page, setPage] = useState(1);
    const [busyId, setBusyId] = useState<string | null>(null);
    const [refreshing, setRefreshing] = useState(false);

    const list = useQuery({
        queryKey: staffQueryKeys.list(params.bizId),
        queryFn: () => fetchStaffList(params.bizId),
    });

    const rows = useMemo(() => list.data?.rows ?? [], [list.data]);
    const pending = useMemo(() => new Set(list.data?.pendingInvitationStaffIds ?? []), [list.data]);
    const filtered = useMemo(() => filterStaffRows(rows, query, status), [rows, query, status]);
    const counts = useMemo(() => staffCounts(rows), [rows]);
    const paged = pageOf(filtered, page);

    const refresh = async () => {
        setRefreshing(true);
        try { await list.refetch(); } finally { setRefreshing(false); }
    };

    const openCard = (row: StaffRow) => navigation.navigate('ManageStaffDetail', {
        bizId: params.bizId, bizName: params.bizName, tz: params.tz, staffId: row.id, staffName: row.full_name,
    });

    const runAction = async (row: StaffRow, action: 'dismiss' | 'restore') => {
        if (action === 'dismiss') {
            const accepted = await confirm({
                title: t('manageStaff.staff.danger.dismiss.title'),
                message: t('manageStaff.staff.danger.dismiss.confirm'),
                confirmLabel: t('manageStaff.staff.danger.dismiss.button'),
                cancelLabel: t('manageStaff.common.cancel'),
                variant: 'danger',
            });
            if (!accepted) return;
        }
        setBusyId(row.id);
        try {
            await runStaffAction(params.bizId, row.id, action);
            showToast(t(action === 'dismiss' ? 'manageStaff.staff.dismissed' : 'manageStaff.restored'), 'success');
            await queryClient.invalidateQueries({ queryKey: staffQueryKeys.business(params.bizId) });
        } catch (error) {
            showToast(staffErrorMessage(error, t('manageStaff.actionFailed'), t), 'error');
        } finally {
            setBusyId(null);
        }
    };

    const cancelInvitation = async (row: StaffRow) => {
        const accepted = await confirm({
            title: t('manageStaff.staff.card.cancelInvitation'),
            message: t('manageStaff.invitationCancelConfirm', { name: row.full_name }),
            confirmLabel: t('manageStaff.staff.card.cancelInvitation'),
            cancelLabel: t('manageStaff.common.cancel'),
            variant: 'danger',
        });
        if (!accepted) return;
        setBusyId(row.id);
        try {
            await cancelStaffInvitation(params.bizId, row.id);
            showToast(t('manageStaff.invitationCancelled'), 'success');
            await queryClient.invalidateQueries({ queryKey: staffQueryKeys.business(params.bizId) });
        } catch (error) {
            showToast(staffErrorMessage(error, t('manageStaff.staff.card.invitationCancelFailed'), t), 'error');
        } finally {
            setBusyId(null);
        }
    };

    const openApplications = async () => {
        try {
            await openWebAsCurrentUser('/dashboard/role-applications');
        } catch {
            showToast(t('staff.dashboard.webErrorMessage'), 'error');
        }
    };

    if (list.isLoading) return <LoadingSpinner message={t('common.loading')} />;

    if (list.error && !list.data) {
        return (
            <ScrollView style={ui.container} contentContainerStyle={ui.content}>
                <EmptyState
                    icon="alert-circle"
                    title={t('manageStaff.loadError')}
                    message={staffErrorMessage(list.error, t('staff.checkConnection'), t)}
                    action={<Button title={t('staff.retry')} onPress={() => void list.refetch()} variant="outline" fullWidth />}
                />
            </ScrollView>
        );
    }

    const business = list.data?.business;
    const filtering = query.trim() !== '' || status !== 'all';
    const applications = list.data?.staffApplications ?? null;

    return (
        <ScrollView
            style={ui.container}
            contentContainerStyle={ui.content}
            keyboardShouldPersistTaps="handled"
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} />}
            testID="manage-staff-list"
        >
            <View>
                <Text style={ui.title} accessibilityRole="header">{t('manageStaff.staff.title')}</Text>
                <Text style={ui.subtitle}>{t('manageStaff.staff.subtitle')}</Text>
                <Text style={ui.muted}>
                    {t('manageStaff.staff.biz.context')}: {business?.name || params.bizName || t('manageStaff.finance.biz.defaultName')}
                    {business?.city ? ` · ${business.city}` : ''}
                </Text>
            </View>

            <Button
                title={t('manageStaff.staff.addStaff')}
                onPress={() => navigation.navigate('ManageStaffNew', { bizId: params.bizId, bizName: params.bizName, tz: params.tz })}
                leadingIcon={<Ionicons name="add" size={18} color={colors.text.light} />}
                fullWidth
            />

            {applications ? (
                <MotionPressable
                    onPress={() => void openApplications()}
                    accessibilityRole="link"
                    accessibilityLabel={t('manageStaff.dashboard.applications.title')}
                    accessibilityHint={t('manageStaff.opensWebsite')}
                    style={styles.applications}
                >
                    <View style={ui.row}>
                        <Text style={styles.applicationsTitle}>{t('manageStaff.dashboard.applications.title')}</Text>
                        {applications.pending !== null && applications.pending > 0 ? (
                            <Badge label={String(applications.pending)} tone="accent" />
                        ) : null}
                    </View>
                    <Text style={ui.muted}>
                        {applications.pending === null
                            ? t('manageStaff.dashboard.applications.unavailable')
                            : applications.pending > 0
                                ? t('manageStaff.dashboard.applications.pending')
                                : t('manageStaff.dashboard.applications.empty')}
                    </Text>
                    <Text style={styles.applicationsLink}>{t('manageStaff.dashboard.applications.open')} →</Text>
                </MotionPressable>
            ) : null}

            <View style={ui.wrap}>
                <StatTile label={t('manageStaff.staff.stats.active')} value={String(counts.active)} tone="success" />
                <StatTile label={t('manageStaff.staff.stats.total')} value={String(counts.total)} />
                {counts.inactive > 0 ? <StatTile label={t('manageStaff.staff.stats.inactive')} value={String(counts.inactive)} tone="warning" /> : null}
            </View>

            <Input
                value={query}
                onChangeText={(value) => { setQuery(value); setPage(1); }}
                placeholder={t('manageStaff.staff.search.placeholder')}
                accessibilityLabel={t('manageStaff.staff.search.placeholder')}
                leadingIcon={<Ionicons name="search" size={18} color={colors.text.secondary} />}
                autoCorrect={false}
                testID="manage-staff-search"
            />
            <View style={ui.wrap} accessibilityRole="tablist">
                {(['all', 'active', 'inactive'] as const).map((value) => (
                    <Chip
                        key={value}
                        label={t(`manageStaff.staff.filter.${value}`)}
                        selected={status === value}
                        onPress={() => { setStatus(value); setPage(1); }}
                        testID={`manage-staff-filter-${value}`}
                    />
                ))}
            </View>

            {filtered.length === 0 ? (
                <EmptyState
                    icon="people"
                    title={t(filtering ? 'manageStaff.staff.empty.notFound' : 'manageStaff.staff.empty.noStaff')}
                    message={t(filtering ? 'manageStaff.staff.empty.notFoundDesc' : 'manageStaff.staff.empty.noStaffDesc')}
                />
            ) : (
                <View style={ui.gap}>
                    {paged.items.map((row) => {
                        const invited = pending.has(row.id);
                        const busy = busyId === row.id;
                        return (
                            <Card key={row.id} style={[styles.card, row.is_active ? styles.cardActive : styles.cardInactive]} testID={`manage-staff-${row.id}`}>
                                <MotionPressable
                                    onPress={() => openCard(row)}
                                    accessibilityRole="button"
                                    accessibilityLabel={`${row.full_name}, ${t(row.is_active ? 'manageStaff.staff.card.status.active' : 'manageStaff.staff.card.status.inactive')}`}
                                    accessibilityHint={t('manageStaff.staff.card.open')}
                                    style={styles.cardHeader}
                                    scale="firm"
                                >
                                    <View style={styles.avatar}><Text style={styles.avatarText}>{staffInitials(row.full_name)}</Text></View>
                                    <View style={styles.cardBody}>
                                        <Text style={styles.name} numberOfLines={1}>{row.full_name}</Text>
                                        <Text style={ui.muted} numberOfLines={1}>{row.branches?.name ?? t('manageStaff.staff.card.branchNotSet')}</Text>
                                        {invited ? <View style={styles.badgeRow}><Badge label={t('manageStaff.staff.card.invitationPending')} tone="warning" /></View> : null}
                                    </View>
                                    <Badge
                                        label={t(row.is_active ? 'manageStaff.staff.card.status.active' : 'manageStaff.staff.card.status.inactive')}
                                        tone={row.is_active ? 'success' : 'muted'}
                                    />
                                </MotionPressable>
                                <View style={styles.actions}>
                                    <Button title={t('manageStaff.staff.card.open')} onPress={() => openCard(row)} variant="outline" size="sm" style={styles.action} />
                                    <Button
                                        title={t(row.is_active ? 'manageStaff.staff.actions.dismiss' : 'manageStaff.staff.actions.restore')}
                                        onPress={() => void runAction(row, row.is_active ? 'dismiss' : 'restore')}
                                        variant={row.is_active ? 'danger' : 'secondary'}
                                        size="sm"
                                        loading={busy}
                                        disabled={!!busyId}
                                        style={styles.action}
                                    />
                                </View>
                                {invited ? (
                                    <Button
                                        title={t('manageStaff.staff.card.cancelInvitation')}
                                        onPress={() => void cancelInvitation(row)}
                                        variant="ghost"
                                        size="sm"
                                        disabled={!!busyId}
                                        fullWidth
                                    />
                                ) : null}
                            </Card>
                        );
                    })}

                    {paged.totalPages > 1 ? (
                        <View style={styles.pagination}>
                            <Text style={ui.muted}>
                                {t('manageStaff.staff.pagination.showing')} {paged.from} - {paged.to} {t('manageStaff.staff.pagination.of')} {filtered.length}
                            </Text>
                            <View style={ui.row}>
                                <Button title={t('manageStaff.staff.pagination.prev')} onPress={() => setPage(paged.page - 1)} disabled={paged.page === 1} variant="outline" size="sm" />
                                <Text style={ui.text}>{paged.page} / {paged.totalPages}</Text>
                                <Button title={t('manageStaff.staff.pagination.next')} onPress={() => setPage(paged.page + 1)} disabled={paged.page === paged.totalPages} variant="outline" size="sm" />
                            </View>
                        </View>
                    ) : null}
                </View>
            )}
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    applications: {
        padding: colors.layout.space4,
        borderRadius: colors.layout.radiusLg,
        borderWidth: 1,
        borderColor: colors.accent.primary,
        backgroundColor: colors.surface.emphasis,
        gap: colors.layout.space1,
    },
    applicationsTitle: { fontSize: 16, fontWeight: '700', color: colors.text.primary },
    applicationsLink: { fontSize: 14, fontWeight: '600', color: colors.accent.indigo, marginTop: colors.layout.space2 },
    card: { gap: colors.layout.space3 },
    cardActive: { borderColor: colors.status.success },
    cardInactive: { opacity: 0.8 },
    cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: colors.layout.space3 },
    avatar: {
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.accent.primary,
    },
    avatarText: { color: colors.text.light, fontWeight: '700', fontSize: 15 },
    cardBody: { flex: 1, minWidth: 0 },
    name: { fontSize: 16, fontWeight: '700', color: colors.text.primary },
    badgeRow: { marginTop: colors.layout.space1 },
    actions: { flexDirection: 'row', gap: colors.layout.space2 },
    action: { flex: 1 },
    pagination: { gap: colors.layout.space2, alignItems: 'center' },
});
