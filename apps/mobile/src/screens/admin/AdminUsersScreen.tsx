import { useState } from 'react';
import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { keepPreviousData, useQuery } from '@tanstack/react-query';

import Avatar from '../../components/ui/Avatar';
import { StatusPill } from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import ChipGroup from '../../components/ui/ChipGroup';
import EmptyState from '../../components/ui/EmptyState';
import ErrorState from '../../components/ui/ErrorState';
import Input from '../../components/ui/Input';
import ListRow, { ListGroup } from '../../components/ui/ListRow';
import Screen from '../../components/ui/Screen';
import Section from '../../components/ui/Section';
import { SkeletonList } from '../../components/ui/Skeleton';
import StatTile, { StatGrid } from '../../components/ui/StatTile';
import { colors } from '../../constants/colors';
import { space } from '../../constants/theme';
import { useLanguage } from '../../i18n';
import type { RootStackParamList } from '../../navigation/types';
import { formatDateTime } from '../../utils/format';
import { adminApi, adminKeys, type AdminUserListItem, type UserStatusFilter } from './adminApi';
import { pageCount, userContacts } from './adminLogic';
import { adminErrorText, adminStyles, useDebouncedValue } from './adminUi';

type Navigation = NativeStackNavigationProp<RootStackParamList>;

const PER_PAGE = 20;

function userStatus(user: AdminUserListItem) {
    if (user.is_blocked) return { key: 'admin.users.blocked' as const, tone: 'danger' as const };
    if (user.is_super) return { key: 'admin.users.superAdmin' as const, tone: 'accent' as const };
    return { key: 'admin.usersList.active' as const, tone: 'success' as const };
}

/** The website's /admin/users: the whole directory, searched and paged on the server, with its counters. */
export default function AdminUsersScreen() {
    const { t } = useLanguage();
    const navigation = useNavigation<Navigation>();
    const [query, setQuery] = useState('');
    const [status, setStatus] = useState<UserStatusFilter>('all');
    const [page, setPage] = useState(1);
    const [refreshing, setRefreshing] = useState(false);
    const q = useDebouncedValue(query.trim(), 250);
    const list = useQuery({
        queryKey: adminKeys.users(q, page, PER_PAGE, status),
        queryFn: () => adminApi.users({ q, page, perPage: PER_PAGE, status }),
        placeholderData: keepPreviousData,
    });
    const stats = useQuery({ queryKey: adminKeys.userStats, queryFn: adminApi.userStats });

    const refresh = async () => {
        setRefreshing(true);
        try { await Promise.all([list.refetch(), stats.refetch()]); } finally { setRefreshing(false); }
    };

    const total = list.data?.total ?? 0;
    const pages = pageCount(total, PER_PAGE);
    const items = list.data?.items ?? [];
    const value = (count: number | undefined) => (count === undefined ? '—' : String(count));

    return (
        <Screen refreshing={refreshing} onRefresh={refresh} testID="admin-users">
            <StatGrid columns={2}>
                <StatTile label={t('admin.usersList.stats.total')} value={value(stats.data?.total)} icon="people-outline" tone="accent" />
                <StatTile label={t('admin.usersList.stats.active')} value={value(stats.data?.active)} icon="checkmark-circle-outline" tone="success" />
                <StatTile label={t('admin.usersList.stats.blocked')} value={value(stats.data?.blocked)} icon="ban-outline" tone="danger" />
                <StatTile label={t('admin.users.superAdmin')} value={value(stats.data?.super)} icon="shield-checkmark-outline" tone="info" />
            </StatGrid>
            {stats.error ? <Text style={adminStyles.caption}>{t('admin.users.statsUnavailable')}</Text> : null}

            <Section gap={space.md}>
                <Input
                    value={query}
                    onChangeText={(next) => { setQuery(next); setPage(1); }}
                    placeholder={t('admin.usersList.filter.placeholder')}
                    accessibilityLabel={t('admin.usersList.filter.placeholder')}
                    leadingIcon={<Ionicons name="search" size={18} color={colors.text.secondary} />}
                    autoCapitalize="none"
                    autoCorrect={false}
                    containerStyle={adminStyles.search}
                    testID="admin-users-search"
                />
                <ChipGroup
                    options={[
                        { key: 'all' as const, label: t('admin.app.filter.all') },
                        { key: 'active' as const, label: t('admin.usersList.stats.active') },
                        { key: 'blocked' as const, label: t('admin.usersList.stats.blocked') },
                    ]}
                    value={status}
                    onChange={(next) => { setStatus(next); setPage(1); }}
                    accessibilityLabel={t('admin.usersList.filter.allStatuses')}
                    testID="admin-users-filter"
                />
                {list.isLoading ? <SkeletonList rows={6} /> : list.error && !list.data ? (
                    <ErrorState message={adminErrorText(list.error, t('staff.checkConnection'), t)} onRetry={() => void list.refetch()} />
                ) : items.length === 0 ? (
                    <EmptyState icon="people-outline" compact title={t('admin.app.nothingFound')} message={t('admin.usersList.empty')} />
                ) : (
                    <>
                        <ListGroup>
                            {items.map((user) => {
                                const name = user.full_name || t('admin.usersList.noName');
                                const pill = userStatus(user);
                                const last = user.last_sign_in_at ? `${t('admin.users.lastSignIn')}: ${formatDateTime(user.last_sign_in_at, true, t.locale)}` : null;
                                return (
                                    <ListRow
                                        key={user.id}
                                        leading={<Avatar name={name} size={40} />}
                                        title={name}
                                        subtitle={[userContacts(user), last, user.block_reason].filter(Boolean).join('\n') || user.id}
                                        numberOfLines={3}
                                        trailing={<StatusPill label={t(pill.key)} tone={pill.tone} />}
                                        onPress={() => navigation.navigate('AdminUser', { userId: user.id, userName: user.full_name ?? undefined })}
                                        testID={`admin-user-${user.id}`}
                                    />
                                );
                            })}
                        </ListGroup>
                        {pages > 1 ? (
                            <View style={adminStyles.pagination}>
                                <Button title={t('manageStaff.staff.pagination.prev')} onPress={() => setPage(page - 1)} disabled={page <= 1 || list.isFetching} variant="outline" size="sm" />
                                <Text style={adminStyles.pageText}>{t('admin.app.pageOf', { page, pages, total })}</Text>
                                <Button title={t('manageStaff.staff.pagination.next')} onPress={() => setPage(page + 1)} disabled={page >= pages || list.isFetching} variant="outline" size="sm" />
                            </View>
                        ) : null}
                    </>
                )}
            </Section>
        </Screen>
    );
}
