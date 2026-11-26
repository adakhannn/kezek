import { Share, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { transliterate } from '@shared-client/i18n';

import Button from '../../../components/ui/Button';
import EmptyState from '../../../components/ui/EmptyState';
import FeedbackBanner from '../../../components/ui/FeedbackBanner';
import ListRow from '../../../components/ui/ListRow';
import Screen from '../../../components/ui/Screen';
import ScreenIntro from '../../../components/ui/ScreenIntro';
import { colors } from '../../../constants/colors';
import { useToast } from '../../../contexts/ToastContext';
import { useLanguage } from '../../../i18n';
import { getMobileApiUrl } from '../../../lib/apiUrl';
import type { RootStackParamList } from '../../../navigation/types';
import { branchBookingUrl } from './branchForm';
import { catalogApi, catalogKeys } from './catalogApi';
import { ItemCard, QueryState, StatusPill, ui } from './catalogUi';

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

    const add = () => navigation.navigate('ManageBranchEdit', { bizId, bizName, tz });

    return (
        <QueryState isLoading={query.isLoading} error={query.error} onRetry={() => void query.refetch()}>
            {() => {
                const data = query.data!;
                const limitReached = !data.canCreateBranch && data.branches.length >= data.branchLimit;
                return (
                    <Screen
                        refreshing={query.isRefetching}
                        onRefresh={() => void query.refetch()}
                        testID="manage-branches-screen"
                    >
                        {/* The header says "Филиалы": one muted line with the limit, then the primary action. */}
                        <ScreenIntro>{t('catalog.branches.usage', { used: data.branches.length, limit: data.branchLimit })}</ScreenIntro>
                        {data.canCreateBranch ? (
                            <Button
                                title={t('catalog.branches.addBranch')}
                                onPress={add}
                                leadingIcon={<Ionicons name="add" size={18} color={colors.text.light} />}
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
                            <EmptyState
                                icon="storefront-outline"
                                compact
                                title={t('catalog.branches.empty')}
                                action={data.canCreateBranch
                                    ? <Button title={t('catalog.branches.addBranch')} onPress={add} variant="outline" fullWidth />
                                    : undefined}
                            />
                        ) : (
                            <View style={ui.list}>
                                {data.branches.map((branch) => (
                                    <ItemCard
                                        key={branch.id}
                                        dimmed={!branch.is_active}
                                        testID={`branch-${branch.id}`}
                                        actions={data.businessSlug ? (
                                            <Button
                                                title={t('catalog.app.shareLink')}
                                                onPress={() => void share(branch, data.businessSlug)}
                                                variant="ghost"
                                                size="sm"
                                                leadingIcon={<Ionicons name="share-outline" size={16} color={colors.text.primary} />}
                                            />
                                        ) : undefined}
                                    >
                                        <ListRow
                                            icon="storefront-outline"
                                            title={text(branch.name)}
                                            subtitle={branch.address ? text(branch.address) : '—'}
                                            trailing={(
                                                <StatusPill
                                                    active={!!branch.is_active}
                                                    label={t(branch.is_active ? 'catalog.branches.status.active' : 'catalog.branches.status.hidden')}
                                                />
                                            )}
                                            onPress={() => navigation.navigate('ManageBranchEdit', { bizId, bizName, tz, branchId: branch.id })}
                                            accessibilityHint={t('catalog.app.editItem', { name: branch.name })}
                                        />
                                    </ItemCard>
                                ))}
                            </View>
                        )}
                    </Screen>
                );
            }}
        </QueryState>
    );
}
