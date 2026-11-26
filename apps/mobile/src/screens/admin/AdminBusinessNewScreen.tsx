import { useMemo, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import ActionBar from '../../components/ui/ActionBar';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import EmptyState from '../../components/ui/EmptyState';
import FeedbackBanner from '../../components/ui/FeedbackBanner';
import FormField, { FieldGroup } from '../../components/ui/FormField';
import Input from '../../components/ui/Input';
import ListRow, { ListGroup } from '../../components/ui/ListRow';
import Screen from '../../components/ui/Screen';
import Section from '../../components/ui/Section';
import { CheckboxRow } from '../../components/ui/SelectionRow';
import { colors } from '../../constants/colors';
import { useLanguage } from '../../i18n';
import { getApiErrorStatus } from '../../lib/errors';
import type { RootStackParamList } from '../../navigation/types';
import { apiErrorBody } from '../manage/catalog/catalogErrors';
import { adminApi, adminKeys, type BusinessDuplicate } from './adminApi';
import { canSubmitManualBusiness, MANUAL_BUSINESS_ERRORS, slugifyBusinessName } from './adminLogic';
import { AdminQuery, adminErrorText, adminStyles } from './adminUi';

type Props = NativeStackScreenProps<RootStackParamList, 'AdminBusinessNew'>;

/** The website's /admin/businesses/new: the service path that skips the public application. */
export default function AdminBusinessNewScreen({ navigation }: Props) {
    const { t } = useLanguage();
    const queryClient = useQueryClient();
    const categoriesQuery = useQuery({ queryKey: adminKeys.categories, queryFn: adminApi.categories });
    const [name, setName] = useState('');
    const [slug, setSlug] = useState('');
    const [slugEdited, setSlugEdited] = useState(false);
    const [phone, setPhone] = useState('');
    const [branchLimit, setBranchLimit] = useState('1');
    const [selected, setSelected] = useState<string[]>([]);
    const [search, setSearch] = useState('');
    const [reason, setReason] = useState('');
    const [acknowledged, setAcknowledged] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [duplicates, setDuplicates] = useState<BusinessDuplicate[]>([]);

    const active = useMemo(() => (categoriesQuery.data ?? []).filter((category) => category.is_active !== false), [categoriesQuery.data]);
    const visible = useMemo(() => {
        const q = search.trim().toLowerCase();
        return q ? active.filter((category) => category.name_ru.toLowerCase().includes(q) || category.slug.toLowerCase().includes(q)) : active;
    }, [active, search]);

    const limit = Math.max(1, Math.min(1000, Number.parseInt(branchLimit || '1', 10) || 1));
    const canSubmit = canSubmitManualBusiness({ name, slug, categories: selected, reason, acknowledged });

    const updateName = (next: string) => {
        setName(next);
        if (!slugEdited) setSlug(next.trim() ? slugifyBusinessName(next) : '');
        setDuplicates([]);
    };

    const toggle = (value: string) =>
        setSelected((current) => (current.includes(value) ? current.filter((item) => item !== value) : [...current, value]));

    const submit = async (duplicateOverride: boolean) => {
        setSaving(true);
        setError(null);
        if (!duplicateOverride) setDuplicates([]);
        try {
            const id = await adminApi.createBusiness({
                name,
                slug,
                phone,
                categories: selected,
                branch_limit: limit,
                reason,
                acknowledge_manual: acknowledged,
                duplicate_override: duplicateOverride,
            });
            await queryClient.invalidateQueries({ queryKey: adminKeys.all });
            navigation.replace('AdminBusiness', { bizId: id, bizName: name.trim() });
        } catch (cause) {
            const body = apiErrorBody(cause) as { code?: unknown; duplicates?: BusinessDuplicate[] } | null;
            const code = typeof body?.code === 'string' ? body.code : undefined;
            if (getApiErrorStatus(cause) === 409 && code === 'possible_duplicate') setDuplicates(body?.duplicates ?? []);
            const key = code ? MANUAL_BUSINESS_ERRORS[code] : undefined;
            setError(key ? t(key) : adminErrorText(cause, t('admin.manualBusiness.error.generic'), t));
        } finally {
            setSaving(false);
        }
    };

    return (
        <AdminQuery isLoading={categoriesQuery.isLoading} error={categoriesQuery.error} onRetry={() => void categoriesQuery.refetch()} skeleton="form" testID="admin-business-new">
            {() => (
                <Screen
                    keyboard
                    testID="admin-business-new"
                    footer={(
                        <ActionBar
                            primary={{
                                title: t('admin.manualBusiness.submit'),
                                onPress: () => void submit(false),
                                loading: saving && duplicates.length === 0,
                                disabled: !canSubmit || saving,
                                testID: 'admin-business-new-submit',
                            }}
                        />
                    )}
                >
                    <FeedbackBanner
                        variant="warning"
                        title={t('admin.manualBusiness.warning.title')}
                        message={t('admin.manualBusiness.warning.description')}
                    />

                    <FieldGroup title={t('admin.manualBusiness.details.title')} caption={t('admin.manualBusiness.details.description')}>
                        <FormField label={t('admin.manualBusiness.name')} required value={name} onChangeText={updateName} maxLength={160} testID="admin-new-name" />
                        <FormField
                            label={t('admin.manualBusiness.phone')}
                            value={phone}
                            onChangeText={(next) => { setPhone(next); setDuplicates([]); }}
                            placeholder="+996..."
                            hint={t('admin.manualBusiness.phone.helper')}
                            keyboardType="phone-pad"
                        />
                        <FormField
                            label={t('admin.manualBusiness.slug')}
                            required
                            value={slug}
                            prefix="/b/"
                            maxLength={80}
                            autoCapitalize="none"
                            autoCorrect={false}
                            onChangeText={(next) => { setSlug(next); setSlugEdited(true); }}
                            onBlur={() => setSlug(slugifyBusinessName(slug || name))}
                            testID="admin-new-slug"
                        />
                        <FormField
                            label={t('admin.manualBusiness.branchLimit')}
                            required
                            value={branchLimit}
                            onChangeText={(next) => setBranchLimit(next.replace(/\D/g, ''))}
                            onBlur={() => setBranchLimit(String(limit))}
                            keyboardType="number-pad"
                        />
                    </FieldGroup>

                    <Section title={t('admin.manualBusiness.categories.title')} caption={t('admin.manualBusiness.categories.description')}>
                        <Input
                            value={search}
                            onChangeText={setSearch}
                            placeholder={t('admin.manualBusiness.categories.search')}
                            accessibilityLabel={t('admin.manualBusiness.categories.search')}
                            leadingIcon={<Ionicons name="search" size={18} color={colors.text.secondary} />}
                            containerStyle={adminStyles.search}
                        />
                        {visible.length === 0 ? (
                            <EmptyState icon="pricetags-outline" compact title={t('admin.manualBusiness.categories.empty')} />
                        ) : (
                            <Card variant="plain" padding="md">
                                {visible.map((category) => (
                                    <CheckboxRow
                                        key={category.id}
                                        label={category.name_ru}
                                        hint={category.slug}
                                        checked={selected.includes(category.slug)}
                                        onChange={() => toggle(category.slug)}
                                        testID={`admin-new-category-${category.slug}`}
                                    />
                                ))}
                            </Card>
                        )}
                    </Section>

                    <FieldGroup title={t('admin.manualBusiness.reason')}>
                        <FormField
                            label={t('admin.manualBusiness.reason')}
                            required
                            value={reason}
                            onChangeText={setReason}
                            placeholder={t('admin.manualBusiness.reason.placeholder')}
                            hint={t('admin.manualBusiness.reason.helper')}
                            maxLength={1000}
                            multiline
                            testID="admin-new-reason"
                        />
                    </FieldGroup>
                    <Card variant="plain" padding="md">
                        <CheckboxRow
                            label={t('admin.manualBusiness.acknowledgement')}
                            checked={acknowledged}
                            onChange={setAcknowledged}
                            testID="admin-new-ack"
                        />
                    </Card>

                    {error ? (
                        <FeedbackBanner
                            variant={duplicates.length > 0 ? 'warning' : 'danger'}
                            title={t('admin.manualBusiness.error.title')}
                            message={error}
                        />
                    ) : null}

                    {duplicates.length > 0 ? (
                        <Section title={t('admin.manualBusiness.duplicates.title')} caption={t('admin.manualBusiness.duplicates.description')}>
                            <ListGroup inset>
                                {duplicates.map((duplicate) => (
                                    <ListRow
                                        key={duplicate.id}
                                        icon="copy-outline"
                                        iconTone="warning"
                                        title={duplicate.name}
                                        subtitle={[`/b/${duplicate.slug}`, duplicate.matchedBy.join(', ')].join(' · ')}
                                        onPress={() => navigation.navigate('AdminBusiness', { bizId: duplicate.id, bizName: duplicate.name })}
                                    />
                                ))}
                            </ListGroup>
                            <Button
                                title={t('admin.manualBusiness.duplicates.override')}
                                onPress={() => void submit(true)}
                                loading={saving}
                                variant="outline"
                                fullWidth
                                testID="admin-new-override"
                            />
                        </Section>
                    ) : null}
                </Screen>
            )}
        </AdminQuery>
    );
}
