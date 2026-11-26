import { useState } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import Button from '../../../components/ui/Button';
import Card from '../../../components/ui/Card';
import EmptyState from '../../../components/ui/EmptyState';
import { useConfirm } from '../../../contexts/ConfirmContext';
import { useToast } from '../../../contexts/ToastContext';
import { useLanguage } from '../../../i18n';
import type { RootStackParamList } from '../../../navigation/types';
import { getServiceName } from '../../../utils/i18n';
import { catalogApi, catalogKeys, type ManagedService } from './catalogApi';
import { catalogErrorText, hasBookingsMessage } from './catalogErrors';
import { Chip, QueryState, StatusPill, ui } from './catalogUi';

type Props = NativeStackScreenProps<RootStackParamList, 'ManageServices'>;

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

    const formatNumber = (n: number) => n.toLocaleString(locale === 'en' ? 'en-US' : 'ru-RU');

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
                return (
                    <ScrollView
                        style={ui.screen}
                        contentContainerStyle={ui.content}
                        refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={() => void query.refetch()} />}
                        testID="manage-services-screen"
                    >
                        <View style={ui.header}>
                            <Text style={ui.title} accessibilityRole="header">{t('catalog.services.title')}</Text>
                            <Text style={ui.subtitle}>{t('catalog.services.subtitle')}</Text>
                            <Text style={ui.caption}>
                                {t('catalog.services.biz.context')}: {data.bizName || bizName || t('catalog.finance.biz.defaultName')}
                                {data.bizCity ? ` · ${data.bizCity}` : ''}
                            </Text>
                        </View>
                        <Button
                            title={t('catalog.services.addService')}
                            onPress={() => openEditor()}
                            fullWidth
                        />

                        <View>
                            <Text style={ui.muted}>{t('catalog.services.filter.branch')}</Text>
                            <View style={[ui.wrap, { marginTop: 8 }]}>
                                <Chip label={t('catalog.services.filter.allBranches')} selected={!branchFilter} onPress={() => setBranchFilter('')} />
                                {data.branches.map((branch) => (
                                    <Chip
                                        key={branch.id}
                                        label={branch.name}
                                        selected={branchFilter === branch.id}
                                        onPress={() => setBranchFilter(branch.id)}
                                        testID={`services-filter-${branch.id}`}
                                    />
                                ))}
                            </View>
                        </View>

                        {data.services.length === 0 ? (
                            <EmptyState icon="list" title={t('catalog.services.empty')} compact />
                        ) : data.services.map((service) => {
                            const name = getServiceName(service, locale);
                            const names = service.branch_ids.map(branchName).filter(Boolean).join(', ');
                            return (
                                <Card key={service.first_id} padding="md" testID={`service-${service.first_id}`}>
                                    <View style={ui.rowBetween}>
                                        <Text style={ui.cardTitle}>{name}</Text>
                                        <StatusPill
                                            active={service.active}
                                            label={t(service.active ? 'catalog.services.status.active' : 'catalog.services.status.hidden')}
                                        />
                                    </View>
                                    <Text style={ui.meta}>
                                        {t('catalog.services.table.duration')}: {service.duration_min} {t('catalog.services.unit.minutes')}
                                    </Text>
                                    <Text style={ui.meta}>
                                        {t('catalog.services.table.price')}: {formatNumber(service.price_from)}–{formatNumber(service.price_to)} {t('catalog.booking.currency')}
                                    </Text>
                                    <Text style={ui.meta}>
                                        {t('catalog.services.table.branches')}: {names || '—'}
                                        {service.branch_ids.length > 1 ? ` (${service.branch_ids.length})` : ''}
                                    </Text>
                                    <View style={ui.actions}>
                                        <Button
                                            title={t('catalog.common.editShort')}
                                            onPress={() => openEditor(service.first_id)}
                                            variant="outline"
                                            size="sm"
                                            style={ui.action}
                                            accessibilityLabel={t('catalog.app.editItem', { name })}
                                        />
                                        <Button
                                            title={deletingId === service.first_id ? t('catalog.services.delete.deleting') : t('catalog.services.delete.button')}
                                            onPress={() => void remove(service)}
                                            variant="danger"
                                            size="sm"
                                            loading={deletingId === service.first_id}
                                            disabled={!!deletingId}
                                            style={ui.action}
                                            accessibilityLabel={t('catalog.app.deleteItem', { name })}
                                        />
                                    </View>
                                </Card>
                            );
                        })}
                    </ScrollView>
                );
            }}
        </QueryState>
    );
}
