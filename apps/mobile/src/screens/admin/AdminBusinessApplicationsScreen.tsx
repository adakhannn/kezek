import { useMemo, useState } from 'react';
import { Linking, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import Badge, { StatusPill } from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import ChipGroup from '../../components/ui/ChipGroup';
import EmptyState from '../../components/ui/EmptyState';
import Input from '../../components/ui/Input';
import ListRow, { ListGroup } from '../../components/ui/ListRow';
import Screen from '../../components/ui/Screen';
import Section from '../../components/ui/Section';
import { colors } from '../../constants/colors';
import { space } from '../../constants/theme';
import { useConfirm } from '../../contexts/ConfirmContext';
import { useToast } from '../../contexts/ToastContext';
import { useLanguage, type MobileI18nKey } from '../../i18n';
import type { RootStackParamList } from '../../navigation/types';
import { formatDateTime } from '../../utils/format';
import { adminApi, adminKeys, type AdminBusinessApplication } from './adminApi';
import {
    applicationCategory,
    BUSINESS_APPLICATION_STATUS,
    canModerateBusinessApplication,
    filterBusinessApplications,
    type BusinessApplicationFilter,
} from './adminLogic';
import { AdminQuery, adminErrorText, adminStyles, MetaLine, ReasonPanel, ReviewHistoryNote } from './adminUi';

type Navigation = NativeStackNavigationProp<RootStackParamList>;

const FILTERS: BusinessApplicationFilter[] = ['all', 'new', 'contacted', 'approved', 'rejected'];

const LINKS: { key: string; label: MobileI18nKey | null }[] = [
    { key: 'instagram', label: null },
    { key: 'two_gis', label: 'admin.catalog.directory.twoGis' },
    { key: 'google_maps', label: 'admin.businessApplications.googleMaps' },
    { key: 'yandex_maps', label: 'admin.businessApplications.yandexMaps' },
];

function statusTone(status: string | null) {
    if (status === 'approved') return 'success' as const;
    if (status === 'rejected') return 'danger' as const;
    if (status === 'contacted') return 'info' as const;
    return 'warning' as const;
}

/**
 * The website's /admin/business-applications: approve (creates the business), reject with a reason,
 * or reject and block the applicant for 30 days.
 */
export default function AdminBusinessApplicationsScreen() {
    const { t } = useLanguage();
    const navigation = useNavigation<Navigation>();
    const { confirm } = useConfirm();
    const { showToast } = useToast();
    const queryClient = useQueryClient();
    const [status, setStatus] = useState<BusinessApplicationFilter>('new');
    const [query, setQuery] = useState('');
    const [refreshing, setRefreshing] = useState(false);
    const [rejecting, setRejecting] = useState<string | null>(null);
    const [note, setNote] = useState('');
    const [busy, setBusy] = useState<string | null>(null);
    const list = useQuery({ queryKey: adminKeys.businessApplications, queryFn: adminApi.businessApplications });

    const items = useMemo(() => list.data?.applications ?? [], [list.data]);
    const filtered = useMemo(() => filterBusinessApplications(items, status, query), [items, status, query]);
    const counts = useMemo(() => Object.fromEntries(FILTERS.map((key) => [key, key === 'all' ? items.length : items.filter((item) => item.status === key).length])), [items]);

    const refresh = async () => {
        setRefreshing(true);
        try { await list.refetch(); } finally { setRefreshing(false); }
    };

    const update = async (application: AdminBusinessApplication, key: string, body: Parameters<typeof adminApi.setBusinessApplicationStatus>[1]) => {
        setBusy(key);
        try {
            await adminApi.setBusinessApplicationStatus(application.id, body);
            await queryClient.invalidateQueries({ queryKey: adminKeys.all });
            setRejecting(null);
            setNote('');
            showToast(t('admin.app.saved'), 'success');
        } catch (error) {
            showToast(adminErrorText(error, t('admin.businessApplications.error.update'), t), 'error');
        } finally {
            setBusy(null);
        }
    };

    const approve = async (application: AdminBusinessApplication) => {
        const accepted = await confirm({
            title: t('admin.businessApplications.actions.approve.title'),
            message: t('admin.businessApplications.actions.approve.description'),
            confirmLabel: t('admin.businessApplications.confirm'),
            cancelLabel: t('admin.businessApplications.cancel'),
        });
        if (accepted) await update(application, `${application.id}:approve`, { status: 'approved' });
    };

    const rejectWithBlock = async (application: AdminBusinessApplication) => {
        const accepted = await confirm({
            title: t('admin.businessApplications.actions.block.title'),
            message: t('admin.businessApplications.actions.block.description'),
            confirmLabel: t('admin.businessApplications.confirm'),
            cancelLabel: t('admin.businessApplications.cancel'),
            variant: 'danger',
        });
        if (accepted) await update(application, `${application.id}:block`, { status: 'rejected', note, block_days: 30 });
    };

    return (
        <AdminQuery isLoading={list.isLoading} error={list.error} onRetry={() => void list.refetch()} testID="admin-business-applications">
            {() => (
                <Screen refreshing={refreshing} onRefresh={refresh} keyboard testID="admin-business-applications">
                    <Section gap={space.md}>
                        <Input
                            value={query}
                            onChangeText={setQuery}
                            placeholder={t('admin.app.applications.search')}
                            accessibilityLabel={t('admin.app.applications.search')}
                            leadingIcon={<Ionicons name="search" size={18} color={colors.text.secondary} />}
                            autoCorrect={false}
                            containerStyle={adminStyles.search}
                        />
                        <ChipGroup
                            options={FILTERS.map((key) => ({
                                key,
                                label: key === 'all' ? t('admin.app.filter.all') : t(BUSINESS_APPLICATION_STATUS[key]),
                                count: counts[key],
                            }))}
                            value={status}
                            onChange={setStatus}
                            accessibilityLabel={t('admin.app.filter.all')}
                            testID="admin-business-applications-filter"
                        />
                        {filtered.length === 0 ? (
                            <EmptyState icon="document-text-outline" compact title={t('admin.businessApplications.empty')} />
                        ) : (
                            <View style={adminStyles.list}>
                                {filtered.map((application) => {
                                    const category = applicationCategory(application, list.data!.categoryNames);
                                    const moderate = canModerateBusinessApplication(application.status);
                                    const links = LINKS.filter((link) => application.directory_links?.[link.key]);
                                    return (
                                        <View key={application.id} style={adminStyles.itemPadded} testID={`admin-business-application-${application.id}`}>
                                            <View style={adminStyles.rowBetween}>
                                                <Text style={adminStyles.headline} numberOfLines={2}>{application.business_name || '—'}</Text>
                                                <StatusPill
                                                    label={application.status && BUSINESS_APPLICATION_STATUS[application.status] ? t(BUSINESS_APPLICATION_STATUS[application.status]) : application.status || '—'}
                                                    tone={statusTone(application.status)}
                                                />
                                            </View>
                                            <View style={adminStyles.badges}>
                                                <Badge label={category.known || category.raw || t('admin.businessApplications.categoryMissing')} tone={category.proposed ? 'warning' : 'accent'} />
                                                {category.proposed ? <Badge label={t('admin.businessApplications.proposedCategory')} tone="warning" icon="alert-circle-outline" /> : null}
                                            </View>
                                            <View>
                                                <MetaLine label={t('admin.businessApplications.contact')} value={application.contact_name || '—'} />
                                                <MetaLine label={t('admin.businessApplications.phone')} value={application.phone || '—'} />
                                                <MetaLine label="Email" value={application.email || '—'} />
                                                <MetaLine
                                                    label={t('admin.businessApplications.account')}
                                                    value={t(application.applicant_user_id ? 'admin.businessApplications.account.authenticated' : 'admin.businessApplications.account.guest')}
                                                />
                                            </View>
                                            {application.comment ? <Text style={adminStyles.muted}>{application.comment}</Text> : null}
                                            {links.length > 0 ? (
                                                <View style={adminStyles.badges}>
                                                    {links.map((link) => (
                                                        <Button
                                                            key={link.key}
                                                            title={link.label ? t(link.label) : 'Instagram'}
                                                            onPress={() => void Linking.openURL(String(application.directory_links?.[link.key]))}
                                                            variant="ghost"
                                                            size="sm"
                                                            leadingIcon={<Ionicons name="open-outline" size={14} color={colors.tone.accent.fg} />}
                                                            textStyle={adminStyles.accentText}
                                                        />
                                                    ))}
                                                </View>
                                            ) : null}
                                            <Text style={adminStyles.caption}>{formatDateTime(application.created_at, true, t.locale)}</Text>
                                            <ReviewHistoryNote count={application.prior_submission_count} flags={application.risk_flags ?? []} />

                                            {application.created_business_id || (category.proposed && moderate) ? (
                                                <ListGroup>
                                                    {application.created_business_id ? (
                                                        <ListRow
                                                            icon="storefront-outline"
                                                            title={t('admin.businessApplications.openBusiness')}
                                                            onPress={() => navigation.navigate('AdminBusiness', { bizId: application.created_business_id!, bizName: application.business_name ?? undefined })}
                                                        />
                                                    ) : null}
                                                    {category.proposed && moderate ? (
                                                        <ListRow
                                                            icon="pricetag-outline"
                                                            iconTone="warning"
                                                            title={t('admin.businessApplications.createCategory')}
                                                            subtitle={t('admin.businessApplications.approvalBlockedByCategory')}
                                                            numberOfLines={2}
                                                            onPress={() => navigation.navigate('AdminCategoryEdit', { proposedName: category.raw })}
                                                        />
                                                    ) : null}
                                                </ListGroup>
                                            ) : null}

                                            {moderate && rejecting === application.id ? (
                                                <ReasonPanel
                                                    value={note}
                                                    onChange={setNote}
                                                    placeholder={t('admin.businessApplications.rejectionReason')}
                                                    busy={busy}
                                                    cancelLabel={t('admin.businessApplications.cancel')}
                                                    onCancel={() => { setRejecting(null); setNote(''); }}
                                                    actions={[
                                                        {
                                                            key: `${application.id}:reject`,
                                                            title: t('admin.businessApplications.button.reject'),
                                                            onPress: () => void update(application, `${application.id}:reject`, { status: 'rejected', note, block_days: 0 }),
                                                        },
                                                        {
                                                            key: `${application.id}:block`,
                                                            title: t('admin.businessApplications.button.rejectBlock'),
                                                            onPress: () => void rejectWithBlock(application),
                                                            danger: true,
                                                        },
                                                    ]}
                                                />
                                            ) : moderate ? (
                                                <View style={adminStyles.actionsPadded}>
                                                    <Button
                                                        title={t('admin.businessApplications.button.approve')}
                                                        onPress={() => void approve(application)}
                                                        variant="secondary"
                                                        size="sm"
                                                        loading={busy === `${application.id}:approve`}
                                                        disabled={category.proposed || !!busy}
                                                        testID={`admin-application-approve-${application.id}`}
                                                    />
                                                    <Button
                                                        title={t('admin.businessApplications.button.reject')}
                                                        onPress={() => { setRejecting(application.id); setNote(''); }}
                                                        variant="outline"
                                                        size="sm"
                                                        disabled={!!busy}
                                                        testID={`admin-application-reject-${application.id}`}
                                                    />
                                                </View>
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
