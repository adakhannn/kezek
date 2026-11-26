import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { StatusPill } from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import EmptyState from '../../components/ui/EmptyState';
import Input from '../../components/ui/Input';
import ListRow from '../../components/ui/ListRow';
import Screen from '../../components/ui/Screen';
import Section from '../../components/ui/Section';
import StatTile, { StatGrid } from '../../components/ui/StatTile';
import { colors } from '../../constants/colors';
import { space } from '../../constants/theme';
import { useConfirm } from '../../contexts/ConfirmContext';
import { useToast } from '../../contexts/ToastContext';
import { useLanguage } from '../../i18n';
import type { RootStackParamList } from '../../navigation/types';
import { adminApi, adminKeys, type AdminRole } from './adminApi';
import { filterRoles } from './adminLogic';
import { AdminQuery, adminErrorText, adminStyles } from './adminUi';

type Navigation = NativeStackNavigationProp<RootStackParamList>;

/** The website's /admin/roles: the role catalog; custom roles can be edited and deleted. */
export default function AdminRolesScreen() {
    const { t } = useLanguage();
    const navigation = useNavigation<Navigation>();
    const { confirm } = useConfirm();
    const { showToast } = useToast();
    const queryClient = useQueryClient();
    const [query, setQuery] = useState('');
    const [refreshing, setRefreshing] = useState(false);
    const [busyId, setBusyId] = useState<string | null>(null);
    const list = useQuery({ queryKey: adminKeys.roles, queryFn: adminApi.roles });
    const items = useMemo(() => list.data ?? [], [list.data]);
    const filtered = useMemo(() => filterRoles(items, query), [items, query]);
    const system = items.filter((role) => role.is_system).length;

    const refresh = async () => {
        setRefreshing(true);
        try { await list.refetch(); } finally { setRefreshing(false); }
    };

    const remove = async (role: AdminRole) => {
        if (role.is_system) {
            showToast(t('admin.roles.systemCannotDelete'), 'error');
            return;
        }
        const accepted = await confirm({
            title: t('admin.roles.confirmDelete.title'),
            message: t('admin.roles.confirmDelete.message', { name: role.name }),
            confirmLabel: t('admin.roles.delete'),
            cancelLabel: t('admin.members.cancel'),
            variant: 'danger',
        });
        if (!accepted) return;
        setBusyId(role.id);
        try {
            await adminApi.deleteRole(role.id);
            await queryClient.invalidateQueries({ queryKey: adminKeys.roles });
            showToast(t('admin.app.deleted'), 'success');
        } catch (error) {
            showToast(adminErrorText(error, t('admin.app.actionFailed'), t), 'error');
        } finally {
            setBusyId(null);
        }
    };

    return (
        <AdminQuery isLoading={list.isLoading} error={list.error} onRetry={() => void list.refetch()} testID="admin-roles">
            {() => (
                <Screen refreshing={refreshing} onRefresh={refresh} testID="admin-roles">
                    <Button
                        title={t('admin.roles.newRole')}
                        onPress={() => navigation.navigate('AdminRoleEdit', {})}
                        leadingIcon={<Ionicons name="add" size={18} color={colors.text.light} />}
                        fullWidth
                        testID="admin-roles-create"
                    />
                    <StatGrid columns={3}>
                        <StatTile label={t('admin.roles.stats.total')} value={String(items.length)} tone="accent" />
                        <StatTile label={t('admin.roles.stats.system')} value={String(system)} tone="info" />
                        <StatTile label={t('admin.roles.stats.custom')} value={String(items.length - system)} tone="success" />
                    </StatGrid>
                    <Section gap={space.md}>
                        <Input
                            value={query}
                            onChangeText={setQuery}
                            placeholder={t('admin.roles.filter.placeholder')}
                            accessibilityLabel={t('admin.roles.filter.title')}
                            leadingIcon={<Ionicons name="search" size={18} color={colors.text.secondary} />}
                            autoCapitalize="none"
                            autoCorrect={false}
                            containerStyle={adminStyles.search}
                            testID="admin-roles-search"
                        />
                        {filtered.length === 0 ? (
                            <EmptyState icon="key-outline" compact title={t('admin.roles.empty')} />
                        ) : (
                            <View style={adminStyles.list}>
                                {filtered.map((role) => (
                                    <View key={role.id} style={adminStyles.item} testID={`admin-role-${role.key}`}>
                                        <ListRow
                                            icon={role.is_system ? 'lock-closed-outline' : 'key-outline'}
                                            iconTone={role.is_system ? 'info' : 'accent'}
                                            title={role.name}
                                            subtitle={[role.key, role.description].filter(Boolean).join(' · ')}
                                            numberOfLines={2}
                                            trailing={<StatusPill label={t(role.is_system ? 'admin.roles.system' : 'admin.roles.custom')} tone={role.is_system ? 'info' : 'neutral'} />}
                                            onPress={() => navigation.navigate('AdminRoleEdit', { roleId: role.id })}
                                        />
                                        {!role.is_system ? (
                                            <View style={adminStyles.actions}>
                                                <Button
                                                    title={t('admin.roles.delete')}
                                                    onPress={() => void remove(role)}
                                                    variant="ghost"
                                                    size="sm"
                                                    loading={busyId === role.id}
                                                    disabled={!!busyId}
                                                    textStyle={adminStyles.dangerText}
                                                    testID={`admin-role-delete-${role.key}`}
                                                />
                                            </View>
                                        ) : null}
                                    </View>
                                ))}
                            </View>
                        )}
                    </Section>
                </Screen>
            )}
        </AdminQuery>
    );
}
