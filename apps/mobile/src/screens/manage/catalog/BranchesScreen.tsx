import { RefreshControl, ScrollView, Share, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { transliterate } from '@shared-client/i18n';

import Button from '../../../components/ui/Button';
import Card from '../../../components/ui/Card';
import EmptyState from '../../../components/ui/EmptyState';
import FeedbackBanner from '../../../components/ui/FeedbackBanner';
import { useToast } from '../../../contexts/ToastContext';
import { useLanguage } from '../../../i18n';
import { getMobileApiUrl } from '../../../lib/apiUrl';
import type { RootStackParamList } from '../../../navigation/types';
import { branchBookingUrl } from './branchForm';
import { catalogApi, catalogKeys } from './catalogApi';
import { QueryState, StatusPill, ui } from './catalogUi';

type Props = NativeStackScreenProps<RootStackParamList, 'ManageBranches'>;

/** The website's /dashboard/branches: the branches, the branch limit, add, edit and the booking link. */
export default function BranchesScreen({ navigation, route }: Props) {
    const { bizId, bizName, tz } = route.params;
    const { t, locale } = useLanguage();
    const { showToast } = useToast();
    const query = useQuery({
        queryKey: catalogKeys.branches(bizId),
        queryFn: () => catalogApi.branches(bizId),
    });

    // The website transliterates branch names and addresses for English.
    const text = (value: string) => (locale === 'en' ? transliterate(value) : value);

    // The website's QR code encodes this link; the app shares it.
    const share = async (branch: { id: string; name: string }, slug: string | null) => {
        if (!slug) {
            showToast(t('catalog.branches.qr.businessInfoError'), 'error');
            return;
        }
        const url = branchBookingUrl(getMobileApiUrl(), slug, branch.id);
        try {
            await Share.share({ message: t('catalog.app.shareMessage', { branch: branch.name, url }), url });
        } catch {
            // Closing the share sheet is not an error.
        }
    };

    return (
        <QueryState isLoading={query.isLoading} error={query.error} onRetry={() => void query.refetch()}>
            {() => {
                const data = query.data!;
                const limitReached = !data.canCreateBranch && data.branches.length >= data.branchLimit;
                return (
                    <ScrollView
                        style={ui.screen}
                        contentContainerStyle={ui.content}
                        refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={() => void query.refetch()} />}
                        testID="manage-branches-screen"
                    >
                        <View style={ui.header}>
                            <Text style={ui.title} accessibilityRole="header">{t('catalog.branches.title')}</Text>
                            <Text style={ui.subtitle}>{t('catalog.branches.subtitle')}</Text>
                            <Text style={ui.caption}>
                                {t('catalog.branches.usage', { used: data.branches.length, limit: data.branchLimit })}
                            </Text>
                        </View>
                        {data.canCreateBranch ? (
                            <Button
                                title={t('catalog.branches.addBranch')}
                                onPress={() => navigation.navigate('ManageBranchEdit', { bizId, bizName, tz })}
                                fullWidth
                            />
                        ) : null}
                        {limitReached ? (
                            <FeedbackBanner
                                variant="warning"
                                title={t('catalog.branches.new.limit.title')}
                                message={t('catalog.branches.new.limit.description', { limit: data.branchLimit })}
                                compact
                            />
                        ) : null}

                        {data.branches.length === 0 ? (
                            <EmptyState icon="business" title={t('catalog.branches.empty')} compact />
                        ) : data.branches.map((branch) => (
                            <Card key={branch.id} padding="md" testID={`branch-${branch.id}`}>
                                <View style={ui.rowBetween}>
                                    <Text style={ui.cardTitle}>{text(branch.name)}</Text>
                                    <StatusPill
                                        active={!!branch.is_active}
                                        label={t(branch.is_active ? 'catalog.branches.status.active' : 'catalog.branches.status.hidden')}
                                    />
                                </View>
                                <Text style={ui.meta}>
                                    {t('catalog.branches.table.address')}: {branch.address ? text(branch.address) : '—'}
                                </Text>
                                <View style={ui.actions}>
                                    <Button
                                        title={t('catalog.common.editShort')}
                                        onPress={() => navigation.navigate('ManageBranchEdit', { bizId, bizName, tz, branchId: branch.id })}
                                        variant="outline"
                                        size="sm"
                                        style={ui.action}
                                        accessibilityLabel={t('catalog.app.editItem', { name: branch.name })}
                                    />
                                    {data.businessSlug ? (
                                        <Button
                                            title={t('catalog.app.shareLink')}
                                            onPress={() => void share(branch, data.businessSlug)}
                                            variant="ghost"
                                            size="sm"
                                            style={ui.action}
                                        />
                                    ) : null}
                                </View>
                            </Card>
                        ))}
                    </ScrollView>
                );
            }}
        </QueryState>
    );
}
