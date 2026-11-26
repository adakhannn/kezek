import { useState } from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { StatusPill } from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import EmptyState from '../../components/ui/EmptyState';
import FeedbackBanner from '../../components/ui/FeedbackBanner';
import ListRow from '../../components/ui/ListRow';
import Screen from '../../components/ui/Screen';
import ScreenIntro from '../../components/ui/ScreenIntro';
import Section from '../../components/ui/Section';
import { colors } from '../../constants/colors';
import { useConfirm } from '../../contexts/ConfirmContext';
import { useToast } from '../../contexts/ToastContext';
import { useLanguage } from '../../i18n';
import type { RootStackParamList } from '../../navigation/types';
import { formatDate } from '../../utils/format';
import { hasBookingsMessage } from '../manage/catalog/catalogErrors';
import { adminApi, adminKeys, type AdminBranchListItem } from './adminApi';
import { AdminQuery, adminErrorText, adminStyles } from './adminUi';

type Props = NativeStackScreenProps<RootStackParamList, 'AdminBranches'>;

/** The website's /admin/businesses/[id]/branches: the branches of a business within its limit. */
export default function AdminBranchesScreen({ navigation, route }: Props) {
    const { bizId } = route.params;
    const { t } = useLanguage();
    const { confirm } = useConfirm();
    const { showToast } = useToast();
    const queryClient = useQueryClient();
    const [refreshing, setRefreshing] = useState(false);
    const [busyId, setBusyId] = useState<string | null>(null);
    const list = useQuery({ queryKey: adminKeys.branches(bizId), queryFn: () => adminApi.branches(bizId) });

    const refresh = async () => {
        setRefreshing(true);
        try { await list.refetch(); } finally { setRefreshing(false); }
    };

    const remove = async (branch: AdminBranchListItem) => {
        const accepted = await confirm({
            title: t('admin.deleteBranch.title'),
            message: t('admin.deleteBranch.message', { name: branch.name }),
            confirmLabel: t('admin.catalog.delete.delete'),
            cancelLabel: t('admin.catalog.delete.cancel'),
            variant: 'danger',
        });
        if (!accepted) return;
        setBusyId(branch.id);
        try {
            await adminApi.deleteBranch(bizId, branch.id);
            await queryClient.invalidateQueries({ queryKey: adminKeys.business(bizId) });
            showToast(t('admin.deleteBranch.deleted'), 'success');
        } catch (error) {
            showToast(hasBookingsMessage(error, 'branch', t) ?? adminErrorText(error, t('admin.app.actionFailed'), t), 'error');
        } finally {
            setBusyId(null);
        }
    };

    return (
        <AdminQuery isLoading={list.isLoading} error={list.error} onRetry={() => void list.refetch()} testID="admin-branches">
            {() => {
                const { business, branches } = list.data!;
                const canCreate = branches.length < business.branch_limit;
                const params = { bizId, bizName: business.name };
                return (
                    <Screen refreshing={refreshing} onRefresh={refresh} testID="admin-branches">
                        <ScreenIntro>
                            {`${business.name} · ${t('admin.branchesPage.used', { count: branches.length, limit: business.branch_limit })}`}
                        </ScreenIntro>
                        {canCreate ? (
                            <Button
                                title={t('admin.branchesPage.newTitle')}
                                onPress={() => navigation.navigate('AdminBranchEdit', params)}
                                leadingIcon={<Ionicons name="add" size={18} color={colors.text.light} />}
                                fullWidth
                                testID="admin-branches-create"
                            />
                        ) : (
                            <FeedbackBanner variant="warning" message={t('admin.branchesPage.limitReached')} compact />
                        )}
                        <Section>
                            {branches.length === 0 ? (
                                <EmptyState
                                    icon="business-outline"
                                    compact
                                    title={t('admin.branchesPage.emptyTitle')}
                                    message={t('admin.branchesPage.emptyDescription', { name: business.name })}
                                />
                            ) : (
                                <View style={adminStyles.list}>
                                    {branches.map((branch) => (
                                        <View key={branch.id} style={[adminStyles.item, !branch.is_active ? adminStyles.itemDimmed : null]} testID={`admin-branch-${branch.id}`}>
                                            <ListRow
                                                icon="location-outline"
                                                title={branch.name}
                                                subtitle={[branch.address, branch.created_at ? t('admin.branchesPage.created', { date: formatDate(branch.created_at, t.locale) }) : null]
                                                    .filter(Boolean)
                                                    .join(' · ') || undefined}
                                                numberOfLines={2}
                                                trailing={(
                                                    <StatusPill
                                                        label={t(branch.is_active ? 'admin.branchesPage.active' : 'admin.branchesPage.inactive')}
                                                        tone={branch.is_active ? 'success' : 'neutral'}
                                                    />
                                                )}
                                                onPress={() => navigation.navigate('AdminBranchEdit', { ...params, branchId: branch.id })}
                                            />
                                            <View style={adminStyles.actions}>
                                                <Button
                                                    title={t('admin.app.branches.schedule')}
                                                    onPress={() => navigation.navigate('AdminBranchSchedule', { ...params, branchId: branch.id, branchName: branch.name })}
                                                    variant="ghost"
                                                    size="sm"
                                                    disabled={!!busyId}
                                                />
                                                <Button
                                                    title={t('admin.catalog.delete.delete')}
                                                    onPress={() => void remove(branch)}
                                                    variant="ghost"
                                                    size="sm"
                                                    loading={busyId === branch.id}
                                                    disabled={!!busyId}
                                                    textStyle={adminStyles.dangerText}
                                                    testID={`admin-branch-delete-${branch.id}`}
                                                />
                                            </View>
                                        </View>
                                    ))}
                                </View>
                            )}
                        </Section>
                    </Screen>
                );
            }}
        </AdminQuery>
    );
}
