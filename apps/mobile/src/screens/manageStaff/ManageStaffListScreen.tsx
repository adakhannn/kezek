import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';

import Avatar from '../../components/ui/Avatar';
import Badge, { StatusPill } from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import ChipGroup from '../../components/ui/ChipGroup';
import EmptyState from '../../components/ui/EmptyState';
import ErrorState from '../../components/ui/ErrorState';
import Input from '../../components/ui/Input';
import ListRow, { ListGroup } from '../../components/ui/ListRow';
import Screen from '../../components/ui/Screen';
import ScreenIntro from '../../components/ui/ScreenIntro';
import Section from '../../components/ui/Section';
import { SkeletonList } from '../../components/ui/Skeleton';
import { colors } from '../../constants/colors';
import { radii, space, typeScale } from '../../constants/theme';
import { useConfirm } from '../../contexts/ConfirmContext';
import { useToast } from '../../contexts/ToastContext';
import { useLanguage } from '../../i18n';
import { openWebAsCurrentUser } from '../../lib/webLinks';
import type { RootStackParamList } from '../../navigation/types';
import { cancelStaffInvitation, fetchStaffList, runStaffAction } from './api';
import { staffErrorMessage } from './errors';
import { staffQueryKeys } from './queryKeys';
import { filterStaffRows, pageOf, staffCounts, type StaffStatusFilter } from './staffForm';
import type { StaffRow } from './types';

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

    if (list.isLoading) {
        return (
            <Screen>
                <SkeletonList rows={5} testID="manage-staff-loading" />
            </Screen>
        );
    }

    if (list.error && !list.data) {
        return (
            <Screen>
                <ErrorState
                    title={t('manageStaff.loadError')}
                    message={staffErrorMessage(list.error, t('staff.checkConnection'), t)}
                    onRetry={() => void list.refetch()}
                />
            </Screen>
        );
    }

    const business = list.data?.business;
    const filtering = query.trim() !== '' || status !== 'all';
    const applications = list.data?.staffApplications ?? null;
    const intro = [business?.name || params.bizName, business?.city].filter(Boolean).join(' · ');

    return (
        <Screen refreshing={refreshing} onRefresh={refresh} testID="manage-staff-list">
            {/* The header says "Сотрудники": the screen starts with the business and the one primary action. */}
            {intro ? <ScreenIntro>{intro}</ScreenIntro> : null}

            <Button
                title={t('manageStaff.staff.addStaff')}
                onPress={() => navigation.navigate('ManageStaffNew', { bizId: params.bizId, bizName: params.bizName, tz: params.tz })}
                leadingIcon={<Ionicons name="add" size={18} color={colors.text.light} />}
                fullWidth
            />

            {applications ? (
                <ListGroup>
                    <ListRow
                        icon="person-add-outline"
                        title={t('manageStaff.dashboard.applications.title')}
                        subtitle={applications.pending === null
                            ? t('manageStaff.dashboard.applications.unavailable')
                            : applications.pending > 0
                                ? t('manageStaff.dashboard.applications.pending')
                                : t('manageStaff.dashboard.applications.empty')}
                        trailing={applications.pending !== null && applications.pending > 0
                            ? <Badge label={String(applications.pending)} tone="accent" size="md" />
                            : undefined}
                        onPress={() => void openApplications()}
                        accessibilityHint={t('manageStaff.opensWebsite')}
                        numberOfLines={1}
                    />
                </ListGroup>
            ) : null}

            <Section gap={space.md}>
                <Input
                    value={query}
                    onChangeText={(value) => { setQuery(value); setPage(1); }}
                    placeholder={t('manageStaff.staff.search.placeholder')}
                    accessibilityLabel={t('manageStaff.staff.search.placeholder')}
                    leadingIcon={<Ionicons name="search" size={18} color={colors.text.secondary} />}
                    autoCorrect={false}
                    containerStyle={styles.search}
                    testID="manage-staff-search"
                />
                <ChipGroup
                    options={(['all', 'active', 'inactive'] as const).map((value) => ({
                        key: value,
                        label: t(`manageStaff.staff.filter.${value}`),
                        count: value === 'all' ? counts.total : value === 'active' ? counts.active : counts.inactive,
                    }))}
                    value={status}
                    onChange={(value) => { setStatus(value); setPage(1); }}
                    accessibilityLabel={t('manageStaff.staff.filter.all')}
                    testID="manage-staff-filter"
                />

                {filtered.length === 0 ? (
                    <EmptyState
                        icon="people-outline"
                        compact
                        title={t(filtering ? 'manageStaff.staff.empty.notFound' : 'manageStaff.staff.empty.noStaff')}
                        message={t(filtering ? 'manageStaff.staff.empty.notFoundDesc' : 'manageStaff.staff.empty.noStaffDesc')}
                    />
                ) : (
                    <View style={styles.list}>
                        {paged.items.map((row) => {
                            const invited = pending.has(row.id);
                            const busy = busyId === row.id;
                            const statusLabel = t(row.is_active ? 'manageStaff.staff.card.status.active' : 'manageStaff.staff.card.status.inactive');
                            return (
                                <View key={row.id} style={[styles.item, !row.is_active ? styles.itemInactive : null]} testID={`manage-staff-${row.id}`}>
                                    <ListRow
                                        leading={<Avatar name={row.full_name} uri={row.avatar_url} size={44} />}
                                        title={row.full_name}
                                        subtitle={row.branches?.name ?? t('manageStaff.staff.card.branchNotSet')}
                                        trailing={<StatusPill label={statusLabel} tone={row.is_active ? 'success' : 'neutral'} />}
                                        onPress={() => openCard(row)}
                                        accessibilityHint={t('manageStaff.staff.card.open')}
                                    />
                                    <View style={styles.actions}>
                                        {invited ? <Badge label={t('manageStaff.staff.card.invitationPending')} tone="warning" style={styles.invited} /> : <View style={styles.spacer} />}
                                        {invited ? (
                                            <Button
                                                title={t('manageStaff.staff.card.cancelInvitation')}
                                                onPress={() => void cancelInvitation(row)}
                                                variant="ghost"
                                                size="sm"
                                                disabled={!!busyId}
                                            />
                                        ) : null}
                                        <Button
                                            title={t(row.is_active ? 'manageStaff.staff.actions.dismiss' : 'manageStaff.staff.actions.restore')}
                                            onPress={() => void runAction(row, row.is_active ? 'dismiss' : 'restore')}
                                            variant="ghost"
                                            size="sm"
                                            loading={busy}
                                            disabled={!!busyId}
                                            textStyle={row.is_active ? styles.dangerText : undefined}
                                        />
                                    </View>
                                </View>
                            );
                        })}

                        {paged.totalPages > 1 ? (
                            <View style={styles.pagination}>
                                <Button title={t('manageStaff.staff.pagination.prev')} onPress={() => setPage(paged.page - 1)} disabled={paged.page === 1} variant="outline" size="sm" />
                                <Text style={styles.pageText}>
                                    {paged.from}–{paged.to} {t('manageStaff.staff.pagination.of')} {filtered.length}
                                </Text>
                                <Button title={t('manageStaff.staff.pagination.next')} onPress={() => setPage(paged.page + 1)} disabled={paged.page === paged.totalPages} variant="outline" size="sm" />
                            </View>
                        ) : null}
                    </View>
                )}
            </Section>
        </Screen>
    );
}

const styles = StyleSheet.create({
    search: { marginBottom: 0 },
    list: { gap: space.sm },
    item: {
        backgroundColor: colors.surface.card,
        borderRadius: radii.lg,
        paddingHorizontal: space.lg,
        paddingBottom: space.xs,
    },
    itemInactive: { opacity: 0.75 },
    actions: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-end',
        gap: space.xs,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: colors.border.subtle,
        paddingTop: space.xs,
    },
    invited: { alignSelf: 'center', marginRight: 'auto' },
    spacer: { flex: 1 },
    dangerText: { color: colors.tone.danger.fg },
    pagination: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm, marginTop: space.sm },
    pageText: { ...typeScale.caption, color: colors.text.secondary },
});
