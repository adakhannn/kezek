import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { StatusPill } from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import EmptyState from '../../components/ui/EmptyState';
import ListRow from '../../components/ui/ListRow';
import Screen from '../../components/ui/Screen';
import Section from '../../components/ui/Section';
import StatTile, { StatGrid } from '../../components/ui/StatTile';
import { colors } from '../../constants/colors';
import { useConfirm } from '../../contexts/ConfirmContext';
import { useToast } from '../../contexts/ToastContext';
import { translatePlural, useLanguage, type Translate } from '../../i18n';
import type { RootStackParamList } from '../../navigation/types';
import { adminApi, adminKeys, type AdminCategory } from './adminApi';
import { AdminQuery, adminErrorText, adminStyles } from './adminUi';

type Navigation = NativeStackNavigationProp<RootStackParamList>;

/** "3 бизнеса": the website's usage words, in the form the number needs in each language. */
export function usageLabel(count: number, t: Translate): string {
    return translatePlural(t, 'admin.app.usage', count);
}

/** The website's /admin/categories: the business categories, their usage, edit and delete. */
export default function AdminCategoriesScreen() {
    const { t } = useLanguage();
    const navigation = useNavigation<Navigation>();
    const { confirm } = useConfirm();
    const { showToast } = useToast();
    const queryClient = useQueryClient();
    const [refreshing, setRefreshing] = useState(false);
    const [busyId, setBusyId] = useState<string | null>(null);
    const list = useQuery({ queryKey: adminKeys.categories, queryFn: adminApi.categories });
    const items = useMemo(() => list.data ?? [], [list.data]);
    const active = items.filter((category) => category.is_active).length;
    const usage = items.reduce((sum, category) => sum + category.usage_count, 0);
    const mostUsed = items.reduce<AdminCategory | null>((max, category) => (!max || category.usage_count > max.usage_count ? category : max), null);

    const refresh = async () => {
        setRefreshing(true);
        try { await list.refetch(); } finally { setRefreshing(false); }
    };

    const remove = async (category: AdminCategory) => {
        const used = category.usage_count > 0;
        const accepted = await confirm({
            title: t('admin.deleteCategory.title'),
            message: [
                `${t('admin.deleteCategory.messageBefore')} «${category.name_ru}» ${t('admin.deleteCategory.messageAfter')}`,
                used ? t(category.usage_count === 1 ? 'admin.deleteCategory.removeFromOne' : 'admin.deleteCategory.removeFromMany', { count: category.usage_count }) : null,
                t('admin.deleteCategory.irreversible'),
            ].filter(Boolean).join('\n\n'),
            confirmLabel: t('admin.catalog.delete.delete'),
            cancelLabel: t('admin.catalog.delete.cancel'),
            variant: 'danger',
        });
        if (!accepted) return;
        setBusyId(category.id);
        try {
            // A used category is also removed from its businesses (the website's "Также убрать" option).
            await adminApi.deleteCategory(category.id, used);
            await queryClient.invalidateQueries({ queryKey: adminKeys.all });
            showToast(t('admin.deleteCategory.deleted'), 'success');
        } catch (error) {
            showToast(adminErrorText(error, t('admin.app.actionFailed'), t), 'error');
        } finally {
            setBusyId(null);
        }
    };

    return (
        <AdminQuery isLoading={list.isLoading} error={list.error} onRetry={() => void list.refetch()} testID="admin-categories">
            {() => (
                <Screen refreshing={refreshing} onRefresh={refresh} testID="admin-categories">
                    <Button
                        title={t('admin.categories.new')}
                        onPress={() => navigation.navigate('AdminCategoryEdit', {})}
                        leadingIcon={<Ionicons name="add" size={18} color={colors.text.light} />}
                        fullWidth
                        testID="admin-categories-create"
                    />
                    <StatGrid columns={3}>
                        <StatTile label={t('admin.categories.stats.total')} value={String(items.length)} tone="accent" />
                        <StatTile label={t('admin.categories.stats.active')} value={String(active)} tone="success" />
                        <StatTile label={t('admin.categories.stats.usage')} value={String(usage)} tone="info" />
                    </StatGrid>
                    <Section
                        title={t('admin.categories.list.title')}
                        caption={t('admin.categoryPages.counts', { total: items.length, active })}
                    >
                        {items.length === 0 ? (
                            <EmptyState icon="pricetags-outline" compact title={t('admin.categories.empty.title')} message={t('admin.categories.empty.description')} />
                        ) : (
                            <View style={adminStyles.list}>
                                {items.map((category) => (
                                    <View key={category.id} style={[adminStyles.item, !category.is_active ? adminStyles.itemDimmed : null]} testID={`admin-category-${category.slug}`}>
                                        <ListRow
                                            icon="pricetag-outline"
                                            title={category.name_ru}
                                            subtitle={`/b/${category.slug} · ${usageLabel(category.usage_count, t)}`}
                                            trailing={(
                                                <StatusPill
                                                    label={t(category.is_active ? 'admin.categories.status.active' : 'admin.categories.status.inactive')}
                                                    tone={category.is_active ? 'success' : 'neutral'}
                                                />
                                            )}
                                            onPress={() => navigation.navigate('AdminCategoryEdit', { categoryId: category.id })}
                                        />
                                        <View style={adminStyles.actions}>
                                            <Button
                                                title={t('admin.catalog.delete.delete')}
                                                onPress={() => void remove(category)}
                                                variant="ghost"
                                                size="sm"
                                                loading={busyId === category.id}
                                                disabled={!!busyId}
                                                textStyle={adminStyles.dangerText}
                                                testID={`admin-category-delete-${category.slug}`}
                                            />
                                        </View>
                                    </View>
                                ))}
                                {mostUsed && mostUsed.usage_count > 0 ? (
                                    <Text style={adminStyles.caption}>
                                        {`${t('admin.categories.mostPopular')}: ${mostUsed.name_ru} · ${usageLabel(mostUsed.usage_count, t)}`}
                                    </Text>
                                ) : null}
                            </View>
                        )}
                    </Section>
                </Screen>
            )}
        </AdminQuery>
    );
}
