import { useState } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import ActionBar from '../../components/ui/ActionBar';
import Card from '../../components/ui/Card';
import EmptyState from '../../components/ui/EmptyState';
import FeedbackBanner from '../../components/ui/FeedbackBanner';
import FormField, { FieldGroup } from '../../components/ui/FormField';
import Screen from '../../components/ui/Screen';
import { SwitchRow } from '../../components/ui/SelectionRow';
import { useToast } from '../../contexts/ToastContext';
import { useLanguage } from '../../i18n';
import type { RootStackParamList } from '../../navigation/types';
import { adminApi, adminKeys, type AdminCategory } from './adminApi';
import { isValidCategorySlug, makeCategorySlug } from './adminLogic';
import { AdminQuery, adminErrorText } from './adminUi';

type Props = NativeStackScreenProps<RootStackParamList, 'AdminCategoryEdit'>;

/** The website's /admin/categories/new (also from an application's proposed category) and /[id]. */
export default function AdminCategoryEditScreen({ navigation, route }: Props) {
    const { categoryId, proposedName } = route.params ?? {};
    const { t } = useLanguage();
    const list = useQuery({ queryKey: adminKeys.categories, queryFn: adminApi.categories, enabled: !!categoryId });
    if (!categoryId) return <CategoryForm proposedName={proposedName?.trim().slice(0, 120)} onDone={() => navigation.goBack()} />;
    return (
        <AdminQuery isLoading={list.isLoading} error={list.error} onRetry={() => void list.refetch()} skeleton="form" testID="admin-category-edit">
            {() => {
                const category = (list.data ?? []).find((item) => item.id === categoryId);
                if (!category) {
                    return (
                        <Screen>
                            <EmptyState icon="pricetag-outline" title={t('admin.categoryPages.notFound')} />
                        </Screen>
                    );
                }
                return <CategoryForm key={category.id} category={category} onDone={() => navigation.goBack()} />;
            }}
        </AdminQuery>
    );
}

function CategoryForm({ category, proposedName, onDone }: { category?: AdminCategory; proposedName?: string; onDone: () => void }) {
    const { t } = useLanguage();
    const { showToast } = useToast();
    const queryClient = useQueryClient();
    const [name, setName] = useState(category?.name_ru ?? proposedName ?? '');
    const [slug, setSlug] = useState(category?.slug ?? (proposedName ? makeCategorySlug(proposedName) : ''));
    const [slugDirty, setSlugDirty] = useState(!!category?.slug);
    const [active, setActive] = useState(category?.is_active ?? true);
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const changed = category
        ? name !== category.name_ru || slug !== category.slug || active !== category.is_active
        : !!(name || slug || !active);

    const save = async () => {
        setError(null);
        if (!name.trim()) { setError(t('admin.categoryForm.nameRequired')); return; }
        if (!isValidCategorySlug(slug)) { setError(t('admin.categoryForm.slugInvalid')); return; }
        const body = { name_ru: name.trim(), slug: slug.trim() ? makeCategorySlug(slug) : null, is_active: active };
        setSaving(true);
        try {
            if (category) await adminApi.updateCategory(category.id, body);
            else await adminApi.createCategory(body);
            await queryClient.invalidateQueries({ queryKey: adminKeys.all });
            showToast(t('admin.app.saved'), 'success');
            onDone();
        } catch (cause) {
            setError(adminErrorText(cause, t('admin.app.actionFailed'), t));
        } finally {
            setSaving(false);
        }
    };

    const slugChanged = !!category && slug !== category.slug;

    return (
        <Screen
            keyboard
            testID="admin-category-edit"
            footer={(
                <ActionBar
                    primary={{
                        title: changed ? t(category ? 'admin.categoryForm.saveChanges' : 'admin.categoryForm.create') : t('admin.categoryForm.noChanges'),
                        onPress: () => void save(),
                        loading: saving,
                        disabled: !changed,
                        testID: 'admin-category-save',
                    }}
                />
            )}
        >
            {proposedName && !category ? <FeedbackBanner variant="info" message={t('admin.categoryPages.nameFromApplication')} compact /> : null}
            {error ? <FeedbackBanner variant="danger" title={t('admin.categoryForm.error')} message={error} compact /> : null}
            <FieldGroup title={t('admin.categoryPages.params')} caption={category ? undefined : t('admin.categoryPages.paramsHint')}>
                <FormField
                    label={t('admin.categoryForm.name')}
                    required
                    value={name}
                    placeholder={t('admin.categoryForm.namePlaceholder')}
                    hint={t('admin.categoryForm.nameHelper')}
                    onChangeText={(next) => {
                        setName(next);
                        if (!slugDirty) setSlug(makeCategorySlug(next));
                    }}
                    testID="admin-category-name"
                />
                <FormField
                    label={t('admin.categoryForm.slug')}
                    value={slug}
                    prefix="/b/"
                    autoCapitalize="none"
                    autoCorrect={false}
                    hint={t(slugDirty ? 'admin.categoryForm.slugNormalized' : 'admin.categoryForm.slugAuto')}
                    onChangeText={(next) => { setSlug(next); setSlugDirty(true); }}
                    onBlur={() => setSlug(slug.trim() ? makeCategorySlug(slug) : '')}
                    testID="admin-category-slug"
                />
            </FieldGroup>
            {slugChanged ? (
                <FeedbackBanner variant="warning" title={t('admin.categoryForm.slugChangeTitle')} message={t('admin.categoryForm.slugChangeHint')} compact />
            ) : null}
            <Card variant="plain" padding="md">
                <SwitchRow
                    label={t('admin.categoryForm.available')}
                    hint={t('admin.categoryForm.availableHint')}
                    value={active}
                    onChange={setActive}
                    testID="admin-category-active"
                />
            </Card>
        </Screen>
    );
}
