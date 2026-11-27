import { useState } from 'react';
import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import Button from '../../../components/ui/Button';
import ChipGroup from '../../../components/ui/ChipGroup';
import EmptyState from '../../../components/ui/EmptyState';
import ListRow from '../../../components/ui/ListRow';
import Screen from '../../../components/ui/Screen';
import ScreenIntro from '../../../components/ui/ScreenIntro';
import Section from '../../../components/ui/Section';
import { colors } from '../../../constants/colors';
import { useConfirm } from '../../../contexts/ConfirmContext';
import { useToast } from '../../../contexts/ToastContext';
import { useLanguage } from '../../../i18n';
import type { RootStackParamList } from '../../../navigation/types';
import { formatNumber } from '../../../utils/format';
import { getServiceName } from '../../../utils/i18n';
import { catalogApi, catalogKeys, type ManagedService } from './catalogApi';
import { catalogErrorText, hasBookingsMessage } from './catalogErrors';
import { ItemCard, QueryState, StatusPill, ui } from './catalogUi';

type Props = NativeStackScreenProps<RootStackParamList, 'ManageServices'>;

const ALL = 'all';

/** The website's /dashboard/services: the business's services by branch, add, edit and delete. */
export default function ServicesScreen({ navigation, route }: Props) {
    const { bizId, bizName, tz } = route.params;
    const { t, locale } = useLanguage();
    const { confirm } = useConfirm();
    const { showToast } = useToast();
    const queryClient = useQueryClient();
    const [branchFilter, setBranchFilter] = useState('');
    const [deletingId, setDeletingId] = useState<string | null>(null);

    const query = useQuery({
        queryKey: catalogKeys.services(bizId, branchFilter),
        queryFn: () => catalogApi.services(bizId, branchFilter),
    });

    const formatPriceNumber = (n: number) => formatNumber(n, locale);

    const remove = async (service: ManagedService) => {
        const accepted = await confirm({
            title: t('catalog.services.delete.confirmTitle'),
            message: t('catalog.services.delete.confirm'),
            confirmLabel: t('catalog.services.delete.button'),
            cancelLabel: t('catalog.common.cancel'),
            variant: 'danger',
        });
        if (!accepted) return;
        setDeletingId(service.first_id);
        try {
            const archived = await catalogApi.deleteService(bizId, service.first_id);
            showToast(t(archived ? 'catalog.services.delete.archived' : 'catalog.services.delete.success'), 'success');
            await queryClient.invalidateQueries({ queryKey: catalogKeys.all(bizId) });
        } catch (error) {
            showToast(hasBookingsMessage(error, 'service', t) ?? catalogErrorText(error, t('catalog.app.saveError'), t), 'error');
        } finally {
            setDeletingId(null);
        }
    };

    const openEditor = (serviceId?: string) =>
        navigation.navigate('ManageServiceEdit', { bizId, bizName, tz, serviceId });

    return (
        <QueryState isLoading={query.isLoading} error={query.error} onRetry={() => void query.refetch()}>
            {() => {
                const data = query.data!;
                const branchName = (id: string) => data.branches.find((b) => b.id === id)?.name;
                const intro = [data.bizName || bizName || t('catalog.finance.biz.defaultName'), data.bizCity].filter(Boolean).join(' · ');
                return (
                    <Screen
                        refreshing={query.isRefetching}
                        onRefresh={() => void query.refetch()}
                        testID="manage-services-screen"
                    >
                        {/* The header says "Услуги": the screen starts with the business and the one primary action. */}
                        <ScreenIntro>{intro}</ScreenIntro>
                        <Button
                            title={t('catalog.services.addService')}
                            onPress={() => openEditor()}
                            leadingIcon={<Ionicons name="add" size={18} color={colors.text.light} />}
                            fullWidth
                        />

                        <Section>
                            {data.branches.length > 1 ? (
                                <ChipGroup
                                    options={[
                                        { key: ALL, label: t('catalog.services.filter.allBranches') },
                                        ...data.branches.map((branch) => ({ key: branch.id, label: branch.name })),
                                    ]}
                                    value={branchFilter || ALL}
                                    onChange={(key) => setBranchFilter(key === ALL ? '' : key)}
                                    accessibilityLabel={t('catalog.services.filter.branch')}
                                    testID="services-filter"
                                />
                            ) : null}

                            {data.services.length === 0 ? (
                                <EmptyState
                                    icon="cut-outline"
                                    compact
                                    title={t('catalog.services.empty')}
                                    action={(
                                        <Button
                                            title={t('catalog.services.addService')}
                                            onPress={() => openEditor()}
                                            variant="outline"
                                            fullWidth
                                        />
                                    )}
                                />
                            ) : (
                                <View style={ui.list}>
                                    {data.services.map((service) => {
                                        const name = getServiceName(service, locale);
                                        const names = service.branch_ids.map(branchName).filter(Boolean).join(', ');
                                        const deleting = deletingId === service.first_id;
                                        const price = service.price_from === service.price_to
                                            ? `${formatPriceNumber(service.price_from)} ${t('catalog.booking.currency')}`
                                            : `${formatPriceNumber(service.price_from)}–${formatPriceNumber(service.price_to)} ${t('catalog.booking.currency')}`;
                                        return (
                                            <ItemCard
                                                key={service.first_id}
                                                dimmed={!service.active}
                                                testID={`service-${service.first_id}`}
                                                actions={(
                                                    <Button
                                                        title={deleting ? t('catalog.services.delete.deleting') : t('catalog.services.delete.button')}
                                                        onPress={() => void remove(service)}
                                                        variant="ghost"
                                                        size="sm"
                                                        loading={deleting}
                                                        disabled={!!deletingId}
                                                        textStyle={ui.dangerText}
                                                        leadingIcon={<Ionicons name="trash-outline" size={16} color={colors.tone.danger.fg} />}
                                                        accessibilityLabel={t('catalog.app.deleteItem', { name })}
                                                    />
                                                )}
                                            >
                                                <ListRow
                                                    icon="cut-outline"
                                                    title={name}
                                                    subtitle={`${service.duration_min} ${t('catalog.services.unit.minutes')} · ${price}`}
                                                    numberOfLines={2}
                                                    trailing={(
                                                        <StatusPill
                                                            active={service.active}
                                                            label={t(service.active ? 'catalog.services.status.active' : 'catalog.services.status.hidden')}
                                                        />
                                                    )}
                                                    onPress={() => openEditor(service.first_id)}
                                                    accessibilityHint={t('catalog.app.editItem', { name })}
                                                />
                                                <View style={ui.itemMeta}>
                                                    <Ionicons name="storefront-outline" size={14} color={colors.text.tertiary} />
                                                    <Text style={ui.itemMetaText} numberOfLines={2}>
                                                        {names || '—'}
                                                    </Text>
                                                </View>
                                            </ItemCard>
                                        );
                                    })}
                                </View>
                            )}
                        </Section>
                    </Screen>
                );
            }}
        </QueryState>
    );
}
