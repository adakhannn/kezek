import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';

import Badge, { StatusPill } from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import ChipGroup from '../../components/ui/ChipGroup';
import EmptyState from '../../components/ui/EmptyState';
import Input from '../../components/ui/Input';
import ListRow from '../../components/ui/ListRow';
import Screen from '../../components/ui/Screen';
import Section from '../../components/ui/Section';
import { colors } from '../../constants/colors';
import { space } from '../../constants/theme';
import { useLanguage } from '../../i18n';
import type { RootStackParamList } from '../../navigation/types';
import { adminApi, adminKeys } from './adminApi';
import { businessCounts, filterBusinesses, type BusinessStatusFilter } from './adminLogic';
import { AdminQuery, adminStyles } from './adminUi';

type Navigation = NativeStackNavigationProp<RootStackParamList>;

/** The website's /admin/businesses: every business with its status, owner and branch/staff counts. */
export default function AdminBusinessesScreen() {
    const { t } = useLanguage();
    const navigation = useNavigation<Navigation>();
    const [query, setQuery] = useState('');
    const [status, setStatus] = useState<BusinessStatusFilter>('all');
    const [refreshing, setRefreshing] = useState(false);
    const list = useQuery({ queryKey: adminKeys.businesses, queryFn: adminApi.businesses });

    const items = useMemo(() => list.data ?? [], [list.data]);
    const filtered = useMemo(() => filterBusinesses(items, query, status), [items, query, status]);
    const counts = useMemo(() => businessCounts(items), [items]);

    const refresh = async () => {
        setRefreshing(true);
        try { await list.refetch(); } finally { setRefreshing(false); }
    };

    return (
        <AdminQuery isLoading={list.isLoading} error={list.error} onRetry={() => void list.refetch()} testID="admin-businesses">
            {() => (
                <Screen refreshing={refreshing} onRefresh={refresh} testID="admin-businesses">
                    <Button
                        title={t('admin.home.createBusiness')}
                        onPress={() => navigation.navigate('AdminBusinessNew')}
                        leadingIcon={<Ionicons name="add" size={18} color={colors.text.light} />}
                        fullWidth
                        testID="admin-businesses-create"
                    />
                    <Section gap={space.md}>
                        <Input
                            value={query}
                            onChangeText={setQuery}
                            placeholder={t('admin.app.businesses.search')}
                            accessibilityLabel={t('admin.app.businesses.search')}
                            leadingIcon={<Ionicons name="search" size={18} color={colors.text.secondary} />}
                            autoCorrect={false}
                            autoCapitalize="none"
                            containerStyle={adminStyles.search}
                            testID="admin-businesses-search"
                        />
                        <ChipGroup
                            options={[
                                { key: 'all' as const, label: t('admin.app.filter.all'), count: counts.total },
                                { key: 'approved' as const, label: t('admin.businesses.status.approved'), count: counts.approved },
                                { key: 'moderation' as const, label: t('admin.businesses.status.moderation'), count: counts.moderation },
                            ]}
                            value={status}
                            onChange={setStatus}
                            accessibilityLabel={t('admin.app.filter.all')}
                            testID="admin-businesses-filter"
                        />
                        {filtered.length === 0 ? (
                            <EmptyState
                                icon="storefront-outline"
                                compact
                                title={items.length === 0 ? t('admin.businesses.empty.title') : t('admin.app.nothingFound')}
                                message={items.length === 0 ? t('admin.businesses.empty.description') : t('admin.app.changeFilters')}
                            />
                        ) : (
                            <View style={adminStyles.list}>
                                {filtered.map((business) => {
                                    const categories = business.categories ?? [];
                                    return (
                                        <View key={business.id} style={adminStyles.item} testID={`admin-business-${business.id}`}>
                                            <ListRow
                                                icon="storefront-outline"
                                                title={business.name}
                                                subtitle={`/b/${business.slug}`}
                                                trailing={(
                                                    <StatusPill
                                                        label={t(business.is_approved ? 'admin.businesses.status.approved' : 'admin.businesses.status.moderation')}
                                                        tone={business.is_approved ? 'success' : 'warning'}
                                                    />
                                                )}
                                                onPress={() => navigation.navigate('AdminBusiness', { bizId: business.id, bizName: business.name })}
                                            />
                                            <View style={[adminStyles.badges, adminStyles.itemFoot]}>
                                                <Badge label={`${business.branches_count} ${t('admin.businesses.stats.branches')}`} tone="neutral" icon="location-outline" />
                                                <Badge label={`${business.staff_count} ${t('admin.businesses.stats.staff')}`} tone="neutral" icon="people-outline" />
                                                {categories.slice(0, 2).map((category) => <Badge key={category} label={category} tone="accent" />)}
                                                {categories.length > 2 ? <Badge label={`+${categories.length - 2}`} tone="neutral" /> : null}
                                            </View>
                                            {business.owner_name || business.address ? (
                                                <Text style={[adminStyles.caption, adminStyles.itemFoot]} numberOfLines={2}>
                                                    {[business.owner_name ? `${t('admin.businesses.owner.label')}: ${business.owner_name}` : null, business.address]
                                                        .filter(Boolean)
                                                        .join(' · ')}
                                                </Text>
                                            ) : null}
                                        </View>
                                    );
                                })}
                            </View>
                        )}
                    </Section>
                </Screen>
            )}
        </AdminQuery>
    );
}
