import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import Avatar from '../../components/ui/Avatar';
import Badge, { StatusPill } from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import EmptyState from '../../components/ui/EmptyState';
import FormField from '../../components/ui/FormField';
import ListRow, { KeyValueRow, ListGroup } from '../../components/ui/ListRow';
import Screen from '../../components/ui/Screen';
import Section from '../../components/ui/Section';
import StatTile, { StatGrid } from '../../components/ui/StatTile';
import { colors } from '../../constants/colors';
import { radii, space, typeScale } from '../../constants/theme';
import { useConfirm } from '../../contexts/ConfirmContext';
import { useToast } from '../../contexts/ToastContext';
import { useLanguage } from '../../i18n';
import type { RootStackParamList } from '../../navigation/types';
import { formatDate } from '../../utils/format';
import { adminApi, adminKeys, type AdminBusinessDetail } from './adminApi';
import { businessSetup, clampBranchLimit, userContacts } from './adminLogic';
import { AdminQuery, adminErrorText, adminStyles } from './adminUi';

type Props = NativeStackScreenProps<RootStackParamList, 'AdminBusiness'>;

/** The website's /admin/businesses/[id]: the business card, its readiness, owner, branch limit and deletion. */
export default function AdminBusinessScreen({ navigation, route }: Props) {
    const { bizId } = route.params;
    const detail = useQuery({ queryKey: adminKeys.business(bizId), queryFn: () => adminApi.business(bizId) });
    return (
        <AdminQuery isLoading={detail.isLoading} error={detail.error} onRetry={() => void detail.refetch()} skeleton="hub" testID="admin-business">
            {() => <BusinessCard data={detail.data!} refetch={detail.refetch} navigation={navigation} />}
        </AdminQuery>
    );
}

function BusinessCard({ data, refetch, navigation }: {
    data: AdminBusinessDetail;
    refetch: () => Promise<unknown>;
    navigation: Props['navigation'];
}) {
    const { t } = useLanguage();
    const { confirm } = useConfirm();
    const { showToast } = useToast();
    const queryClient = useQueryClient();
    const [refreshing, setRefreshing] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const { business, counts, owner, categoryOptions } = data;
    const params = { bizId: business.id, bizName: business.name };
    const approved = business.is_approved === true;
    const setup = businessSetup({ approved, hasOwner: !!owner, branches: counts.branches, services: counts.services });
    const categoryName = (slug: string) => categoryOptions.find((option) => option.slug === slug)?.name ?? slug;
    const categories = business.categories ?? [];
    const notSpecified = t('admin.businessDetail.notSpecified');

    const refresh = async () => {
        setRefreshing(true);
        try { await refetch(); } finally { setRefreshing(false); }
    };

    const remove = async () => {
        const accepted = await confirm({
            title: t('admin.deleteBusiness.button'),
            message: t('admin.deleteBusiness.message', { name: business.name }),
            confirmLabel: t('admin.catalog.delete.delete'),
            cancelLabel: t('admin.catalog.delete.cancel'),
            variant: 'danger',
        });
        if (!accepted) return;
        setDeleting(true);
        try {
            await adminApi.deleteBusiness(business.id);
            await queryClient.invalidateQueries({ queryKey: adminKeys.all });
            showToast(t('admin.deleteBusiness.deleted'), 'success');
            navigation.goBack();
        } catch (error) {
            showToast(adminErrorText(error, t('admin.app.actionFailed'), t), 'error');
        } finally {
            setDeleting(false);
        }
    };

    const setupRoute = (key: string) => {
        if (key === 'owner') return () => navigation.navigate('AdminOwner', params);
        if (key === 'branch') return () => navigation.navigate('AdminBranches', params);
        return undefined;
    };

    return (
        <Screen refreshing={refreshing} onRefresh={refresh} testID="admin-business">
            <Card variant="accent" padding="md" style={styles.hero}>
                <View style={adminStyles.badges}>
                    <StatusPill
                        label={t(approved ? 'admin.businesses.status.approved' : 'admin.businesses.status.moderation')}
                        tone={approved ? 'success' : 'warning'}
                    />
                    {categories.slice(0, 2).map((slug) => <Badge key={slug} label={categoryName(slug)} tone="accent" />)}
                    {categories.length > 2 ? <Badge label={`+${categories.length - 2}`} tone="neutral" /> : null}
                </View>
                <Text style={styles.heroName} accessibilityRole="header">{business.name}</Text>
                <Text style={styles.heroSlug}>/b/{business.slug}</Text>
                <Text style={adminStyles.caption}>
                    {t('admin.businessDetail.created')} {business.created_at ? formatDate(business.created_at, t.locale) : '—'}
                </Text>
            </Card>

            <StatGrid columns={2}>
                <StatTile label={t('admin.businessDetail.stats.branches')} value={String(counts.branches)} icon="business-outline" tone="accent" onPress={() => navigation.navigate('AdminBranches', params)} />
                <StatTile label={t('admin.businessDetail.stats.staff')} value={String(counts.staff)} icon="people-outline" tone="info" />
                <StatTile label={t('admin.businessDetail.stats.services')} value={String(counts.services)} icon="cut-outline" tone="success" />
                <StatTile label={t('admin.businessDetail.stats.bookings')} value={String(counts.bookings)} icon="calendar-outline" tone="warning" />
            </StatGrid>

            <Section title={t('admin.businessDetail.setup.title')} right={<Badge label={`${setup.done}/${setup.items.length}`} tone={setup.done === setup.items.length ? 'success' : 'accent'} size="md" />}>
                <ListGroup inset>
                    {setup.items.map((item) => {
                        const open = item.complete ? undefined : setupRoute(item.key);
                        return (
                            <ListRow
                                key={item.key}
                                icon={item.complete ? 'checkmark-circle' : 'ellipse-outline'}
                                iconTone={item.complete ? 'success' : 'neutral'}
                                title={t(item.label)}
                                value={!item.complete && open ? t('admin.businessDetail.setup.open') : undefined}
                                onPress={open}
                                chevron={!!open}
                                testID={`admin-setup-${item.key}`}
                            />
                        );
                    })}
                </ListGroup>
            </Section>

            <Section title={t('admin.app.business.manage')}>
                <ListGroup inset>
                    <ListRow icon="business-outline" title={t('admin.businessDetail.branches')} value={String(counts.branches)} onPress={() => navigation.navigate('AdminBranches', params)} testID="admin-open-branches" />
                    <ListRow icon="people-outline" iconTone="info" title={t('admin.businessDetail.members')} onPress={() => navigation.navigate('AdminMembers', params)} testID="admin-open-members" />
                    <ListRow
                        icon="person-circle-outline"
                        iconTone="warning"
                        title={t(owner ? 'admin.businessDetail.owner.edit' : 'admin.businessDetail.owner.assign')}
                        onPress={() => navigation.navigate('AdminOwner', params)}
                        testID="admin-open-owner"
                    />
                    {approved ? (
                        <ListRow
                            icon="open-outline"
                            iconTone="neutral"
                            title={t('admin.businessDetail.openPublic')}
                            onPress={() => navigation.navigate('Business', { slug: business.slug, previewName: business.name })}
                        />
                    ) : null}
                </ListGroup>
            </Section>

            <Section
                title={t('admin.businessDetail.profile.title')}
                actionLabel={t('admin.businessDetail.edit')}
                onAction={() => navigation.navigate('AdminBusinessEdit', params)}
                testID="admin-business-profile"
            >
                <Card variant="plain" padding="md">
                    <KeyValueRow label={t('admin.businessDetail.address')} value={business.address || notSpecified} />
                    <KeyValueRow label={t('admin.businessDetail.phones')} value={(business.phones ?? []).join(', ') || notSpecified} />
                    <KeyValueRow label={t('admin.businessContacts.phone')} value={business.contact_phone || notSpecified} />
                    <KeyValueRow label={t('admin.businessContacts.whatsapp')} value={business.contact_whatsapp || notSpecified} />
                    <KeyValueRow label={t('admin.businessContacts.email')} value={business.contact_email || notSpecified} />
                    <KeyValueRow label={t('admin.businessContacts.website')} value={business.website_url || notSpecified} />
                    <KeyValueRow
                        label={t('admin.businessDetail.categories')}
                        value={categories.length ? categories.map(categoryName).join(', ') : t('admin.businessDetail.categories.empty')}
                    />
                </Card>
            </Section>

            <Section title={t('admin.businessDetail.owner.title')} caption={t('admin.businessDetail.owner.description')}>
                {owner ? (
                    <ListGroup>
                        <ListRow
                            leading={<Avatar name={owner.full_name || owner.email || owner.phone} size={44} />}
                            title={owner.full_name || owner.email || owner.phone || t('admin.businessDetail.owner.account')}
                            subtitle={userContacts(owner)}
                            trailing={<StatusPill label={t('admin.businessDetail.owner.assigned')} tone="success" />}
                            onPress={() => navigation.navigate('AdminUser', { userId: owner.id, userName: owner.full_name ?? undefined })}
                        />
                    </ListGroup>
                ) : (
                    <EmptyState
                        icon="person-outline"
                        compact
                        title={t('admin.businessDetail.owner.empty')}
                        message={t('admin.businessDetail.owner.empty.description')}
                        action={<Button title={t('admin.businessDetail.owner.assign')} onPress={() => navigation.navigate('AdminOwner', params)} variant="outline" size="sm" />}
                    />
                )}
            </Section>

            <BranchLimitCard key={business.branch_limit} bizId={business.id} limit={business.branch_limit} count={counts.branches} />

            <Section title={t('admin.businessDetail.danger.title')} caption={t('admin.businessDetail.danger.description')}>
                <ListGroup>
                    <ListRow
                        icon="trash-outline"
                        destructive
                        title={deleting ? t('admin.catalog.delete.deleting') : t('admin.deleteBusiness.button')}
                        onPress={() => void remove()}
                        disabled={deleting}
                        chevron={false}
                        testID="admin-business-delete"
                    />
                </ListGroup>
            </Section>
        </Screen>
    );
}

/** The website's BranchLimitEditor: how many branches the owner may create. */
function BranchLimitCard({ bizId, limit, count }: { bizId: string; limit: number; count: number }) {
    const { t } = useLanguage();
    const { showToast } = useToast();
    const queryClient = useQueryClient();
    const [value, setValue] = useState(String(limit));
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const used = Math.min(100, Math.round((count / Math.max(limit, 1)) * 100));

    const save = async () => {
        const next = clampBranchLimit(value, count);
        if (next === null) {
            setError(t('admin.app.branchLimit.invalid', { min: Math.max(1, count) }));
            return;
        }
        setError(null);
        setSaving(true);
        try {
            await adminApi.setBranchLimit(bizId, next);
            await queryClient.invalidateQueries({ queryKey: adminKeys.business(bizId) });
            await queryClient.invalidateQueries({ queryKey: adminKeys.branches(bizId) });
            showToast(t('admin.app.saved'), 'success');
        } catch (cause) {
            setError(adminErrorText(cause, t('admin.businessDetail.branchLimit.error'), t));
        } finally {
            setSaving(false);
        }
    };

    return (
        <Section
            title={t('admin.businessDetail.branchLimit.title')}
            caption={t('admin.businessDetail.branchLimit.description')}
            right={<Badge label={`${count} / ${limit}`} tone={count >= limit ? 'warning' : 'accent'} size="md" />}
        >
            <Card variant="plain" padding="md" style={styles.limitCard}>
                <View
                    style={styles.track}
                    accessibilityRole="progressbar"
                    accessibilityValue={{ min: 0, max: limit, now: count }}
                >
                    <View style={[styles.fill, { width: `${used}%` }]} />
                </View>
                <FormField
                    label={t('admin.businessDetail.branchLimit.allowed')}
                    value={value}
                    onChangeText={(next) => { setValue(next.replace(/\D/g, '')); setError(null); }}
                    keyboardType="number-pad"
                    error={error ?? undefined}
                    testID="admin-branch-limit"
                />
                <Button
                    title={t('admin.businessDetail.branchLimit.save')}
                    onPress={() => void save()}
                    loading={saving}
                    disabled={value === String(limit)}
                    variant="outline"
                    fullWidth
                    testID="admin-branch-limit-save"
                />
            </Card>
        </Section>
    );
}

const styles = StyleSheet.create({
    hero: { gap: space.sm },
    heroName: { ...typeScale.title, color: colors.text.primary },
    heroSlug: { ...typeScale.callout, color: colors.text.secondary, fontVariant: ['tabular-nums'] },
    limitCard: { gap: space.md },
    track: { height: 8, borderRadius: radii.pill, backgroundColor: colors.fill.track, overflow: 'hidden' },
    fill: { height: 8, borderRadius: radii.pill, backgroundColor: colors.accent.primary },
});
