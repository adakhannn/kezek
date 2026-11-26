import { useContext, useEffect, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';

import Button from '../../../components/ui/Button';
import EmptyState from '../../../components/ui/EmptyState';
import FeedbackBanner from '../../../components/ui/FeedbackBanner';
import { RadioRow } from '../../../components/ui/SelectionRow';
import { SkeletonList } from '../../../components/ui/Skeleton';
import { colors } from '../../../constants/colors';
import { layout, radii, space, typeScale } from '../../../constants/theme';
import { useToast } from '../../../contexts/ToastContext';
import { useLanguage } from '../../../i18n';
import { getErrorMessage } from '../../../lib/errors';
import { ui } from '../opsKit/ui';
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

    const insets = useContext(SafeAreaInsetsContext);

    return (
        <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
            <View style={styles.backdrop}>
                <Pressable style={StyleSheet.absoluteFill} onPress={selling ? undefined : onClose} accessibilityRole="button" accessibilityLabel={t('ops.packages.sell.cancel')} />
                <View style={[styles.sheet, { paddingBottom: space.lg + (insets?.bottom ?? 0) }]}>
                    <View style={styles.handle} />
                    <ScrollView contentContainerStyle={styles.content} testID="sell-package-modal">
                        <View style={styles.head}>
                            <Text style={styles.title} accessibilityRole="header">{t('ops.packages.sell.title')}</Text>
                            <Text style={ui.muted}>{t('ops.packages.sell.clientLabel')}: {clientName}</Text>
                        </View>
                        {plans.isLoading ? <SkeletonList rows={2} avatar={false} /> : null}
                        {plans.error ? <FeedbackBanner variant="danger" message={t('ops.packages.loadError')} compact /> : null}
                        {error ? <FeedbackBanner variant="danger" message={error} compact /> : null}
                        {!plans.isLoading && !plans.error && active.length === 0 ? (
                            <EmptyState compact icon="pricetags-outline" title={t('ops.packages.sell.noPlansTitle')} message={t('ops.packages.sell.noPlans')} />
                        ) : null}
                        {active.length > 0 ? (
                            <View style={styles.choices} accessibilityRole="radiogroup" accessibilityLabel={t('ops.packages.sell.choosePlan')} testID="sell-plan">
                                <Text style={ui.overline}>{t('ops.packages.sell.choosePlan')}</Text>
                                {active.map((plan) => (
                                    <RadioRow
                                        key={plan.id}
                                        label={planName(plan, locale)}
                                        hint={planTerms(plan, t)}
                                        selected={plan.id === planId}
                                        onSelect={() => setPlanId(plan.id)}
                                        disabled={selling}
                                        testID={`sell-plan-${plan.id}`}
                                    />
                                ))}
                            </View>
                        ) : null}
                    </ScrollView>
                    <View style={styles.buttons}>
                        <Button title={t('ops.packages.sell.cancel')} onPress={onClose} variant="outline" size="lg" disabled={selling} style={styles.cancel} />
                        <View style={styles.confirm}>
                            <Button
                                title={selling ? t('ops.packages.sell.selling') : t('ops.packages.sell.confirm')}
                                onPress={() => void submit()}
                                size="lg"
                                loading={selling}
                                disabled={plans.isLoading || selling || active.length === 0}
                                fullWidth
                            />
                        </View>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.surface.overlay },
    sheet: {
        maxHeight: '85%',
        backgroundColor: colors.surface.card,
        borderTopLeftRadius: radii.xxl,
        borderTopRightRadius: radii.xxl,
        paddingHorizontal: layout.gutter,
        paddingTop: space.sm,
        gap: space.lg,
    },
    handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: radii.pill, backgroundColor: colors.fill.track },
    content: { gap: space.lg },
    head: { gap: space.xs },
    title: { ...typeScale.headline, color: colors.text.primary },
    choices: { gap: space.xs },
    buttons: { flexDirection: 'row', gap: space.md },
    cancel: { flex: 1 },
    confirm: { flex: 2 },
});
