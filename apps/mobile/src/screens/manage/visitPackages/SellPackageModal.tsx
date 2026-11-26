import { useEffect, useRef, useState } from 'react';
import { Modal, ScrollView, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';

import Button from '../../../components/ui/Button';
import Card from '../../../components/ui/Card';
import EmptyState from '../../../components/ui/EmptyState';
import FeedbackBanner from '../../../components/ui/FeedbackBanner';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';
import { colors } from '../../../constants/colors';
import { useToast } from '../../../contexts/ToastContext';
import { useLanguage } from '../../../i18n';
import { getErrorMessage } from '../../../lib/errors';
import { ChipGroup, ui } from '../opsKit/ui';
import { fetchPlans, newSaleKey, planName, planTerms, sellPackage } from './visitPackagesData';

/** The website's "Sell a package" dialog (QuickDesk, an existing client): one active package type for this client. */
export default function SellPackageModal({
    bizId,
    visible,
    clientId,
    clientName,
    onClose,
}: {
    bizId: string;
    visible: boolean;
    clientId: string;
    clientName: string;
    onClose: () => void;
}) {
    const { t, locale } = useLanguage();
    const { showToast } = useToast();
    const [planId, setPlanId] = useState('');
    const [selling, setSelling] = useState(false);
    const [error, setError] = useState<string | null>(null);
    // One key per sale attempt (API-11): a retry after a lost answer cannot sell a second package.
    const saleKey = useRef<{ planId: string; key: string } | null>(null);
    const plans = useQuery({
        queryKey: ['manage-visit-plans', bizId],
        queryFn: fetchPlans,
        enabled: visible,
    });
    const active = (plans.data ?? []).filter((plan) => plan.is_active);

    useEffect(() => {
        if (!visible) return;
        setError(null);
        setSelling(false);
        saleKey.current = null;
    }, [visible]);
    useEffect(() => {
        if (!planId && active[0]) setPlanId(active[0].id);
    }, [active, planId]);

    const selected = active.find((plan) => plan.id === planId);
    const submit = async () => {
        if (!planId) {
            showToast(t('ops.packages.sell.selectPlan'), 'error');
            return;
        }
        if (saleKey.current?.planId !== planId) saleKey.current = { planId, key: newSaleKey() };
        setSelling(true);
        setError(null);
        try {
            await sellPackage(clientId, planId, saleKey.current.key);
            saleKey.current = null;
            showToast(t('ops.packages.sell.success'), 'success');
            onClose();
        } catch (sellError) {
            setError(getErrorMessage(sellError, t('ops.packages.sell.error'), t));
        } finally {
            setSelling(false);
        }
    };

    return (
        <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
            <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: colors.surface.overlay }}>
                <Card style={{ maxHeight: '85%', borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }}>
                    <ScrollView contentContainerStyle={{ gap: colors.layout.space3 }} testID="sell-package-modal">
                        <Text style={ui.sectionTitle} accessibilityRole="header">{t('ops.packages.sell.title')}</Text>
                        <Text style={ui.muted}>{t('ops.packages.sell.clientLabel')}: {clientName}</Text>
                        {plans.isLoading ? <LoadingSpinner size="small" message={t('common.loading')} /> : null}
                        {plans.error ? <FeedbackBanner variant="danger" message={t('ops.packages.loadError')} /> : null}
                        {error ? <FeedbackBanner variant="danger" message={error} /> : null}
                        {!plans.isLoading && !plans.error && active.length === 0 ? (
                            <EmptyState compact title={t('ops.packages.sell.noPlansTitle')} message={t('ops.packages.sell.noPlans')} />
                        ) : null}
                        {active.length > 0 ? (
                            <>
                                <Text style={ui.fieldLabel}>{t('ops.packages.sell.choosePlan')}</Text>
                                <ChipGroup
                                    options={active.map((plan) => ({ key: plan.id, label: planName(plan, locale) }))}
                                    value={planId}
                                    onChange={setPlanId}
                                    disabled={selling}
                                    testID="sell-plan"
                                />
                                {selected ? <Text style={ui.muted}>{planName(selected, locale)}: {planTerms(selected, t)}</Text> : null}
                            </>
                        ) : null}
                        <View style={ui.wrap}>
                            <Button title={t('ops.packages.sell.cancel')} onPress={onClose} variant="outline" disabled={selling} />
                            <Button
                                title={selling ? t('ops.packages.sell.selling') : t('ops.packages.sell.confirm')}
                                onPress={() => void submit()}
                                loading={selling}
                                disabled={plans.isLoading || selling || active.length === 0}
                            />
                        </View>
                    </ScrollView>
                </Card>
            </View>
        </Modal>
    );
}
