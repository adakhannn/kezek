import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useMutation } from '@tanstack/react-query';

import { StatusPill } from '../../../components/ui/Badge';
import Button from '../../../components/ui/Button';
import Card from '../../../components/ui/Card';
import EmptyState from '../../../components/ui/EmptyState';
import FeedbackBanner from '../../../components/ui/FeedbackBanner';
import FormField, { FieldGroup } from '../../../components/ui/FormField';
import { KeyValueRow } from '../../../components/ui/ListRow';
import Screen from '../../../components/ui/Screen';
import ScreenIntro from '../../../components/ui/ScreenIntro';
import Section from '../../../components/ui/Section';
import { space } from '../../../constants/theme';
import { useLanguage } from '../../../i18n';
import { getErrorMessage } from '../../../lib/errors';
import { fetchPromotionsDebug, type PromotionsDebug, type PromotionsDebugIds } from './adminOpsApi';
import { isUuid, prettyJson } from './adminOpsLogic';
import { adminStyles, formatWhen, JsonBlock } from './adminOpsUi';

const FIELDS: { key: keyof PromotionsDebugIds; label: 'adminOps.promoDebug.clientId' | 'adminOps.promoDebug.branchId' | 'adminOps.promoDebug.bizId' }[] = [
    { key: 'clientId', label: 'adminOps.promoDebug.clientId' },
    { key: 'branchId', label: 'adminOps.promoDebug.branchId' },
    { key: 'bizId', label: 'adminOps.promoDebug.bizId' },
];

function Json({ value }: { value: unknown }) {
    const text = prettyJson(value);
    return text ? <JsonBlock value={text} /> : null;
}

function Results({ data }: { data: PromotionsDebug }) {
    const { t } = useLanguage();
    const nothing = data.promotionUsage.length === 0 && data.referrals.length === 0 && data.bookings.length === 0 && data.activePromotions.length === 0;
    return (
        <View style={styles.results} testID="admin-promo-debug-results">
            {data.client || data.branch || data.biz ? (
                <Section title={t('adminOps.promoDebug.info')}>
                    <Card variant="plain" padding="md" style={adminStyles.gapSm}>
                        {data.client ? (
                            <KeyValueRow
                                label={t('adminOps.promoDebug.client')}
                                value={`${data.client.name || data.client.email || data.client.phone || t('adminOps.promoDebug.na')} (${data.client.id})`}
                            />
                        ) : null}
                        {data.branch ? <KeyValueRow label={t('adminOps.promoDebug.branch')} value={`${data.branch.name} (${data.branch.id})`} /> : null}
                        {data.biz ? <KeyValueRow label={t('adminOps.promoDebug.business')} value={`${data.biz.name} (${data.biz.slug})`} /> : null}
                    </Card>
                </Section>
            ) : null}

            {data.anomalies.length > 0 ? (
                <Section title={`${t('adminOps.promoDebug.anomalies')} (${data.anomalies.length})`} testID="admin-promo-debug-anomalies">
                    {data.anomalies.map((anomaly, index) => (
                        <View key={index} style={adminStyles.gapSm}>
                            <FeedbackBanner
                                variant={anomaly.severity === 'error' ? 'danger' : 'warning'}
                                title={`[${anomaly.severity === 'error' ? t('adminOps.promoDebug.severityError') : t('adminOps.promoDebug.severityWarning')}] ${anomaly.type}`}
                                message={anomaly.message}
                                compact
                            />
                            <Json value={anomaly.data} />
                        </View>
                    ))}
                </Section>
            ) : null}

            {data.promotionUsage.length > 0 ? (
                <Section title={`${t('adminOps.promoDebug.usage')} (${data.promotionUsage.length})`}>
                    <Card variant="plain" padding="md">
                        {data.promotionUsage.map((usage, index) => (
                            <View key={usage.id}>
                                {index > 0 ? <View style={adminStyles.separator} /> : null}
                                <View style={styles.item}>
                                    <View style={adminStyles.rowBetween}>
                                        <Text style={[adminStyles.rowTitle, styles.flex]} numberOfLines={2}>{usage.promotion?.title_ru || usage.promotion_id}</Text>
                                        <Text style={adminStyles.mono}>{usage.promotion_type}</Text>
                                    </View>
                                    <Text style={adminStyles.rowMeta}>{formatWhen(usage.used_at, t)}</Text>
                                    <View style={adminStyles.rowBetween}>
                                        <Text style={adminStyles.mono}>{`${t('adminOps.promoDebug.booking')}: ${usage.booking_id ? `${usage.booking_id.slice(0, 8)}…` : '—'}`}</Text>
                                        {usage.booking?.status ? <StatusPill label={usage.booking.status} tone={usage.booking.status === 'paid' ? 'success' : 'neutral'} /> : null}
                                    </View>
                                    <Json value={usage.usage_data} />
                                </View>
                            </View>
                        ))}
                    </Card>
                </Section>
            ) : null}

            {data.referrals.length > 0 ? (
                <Section title={`${t('adminOps.promoDebug.referrals')} (${data.referrals.length})`}>
                    <Card variant="plain" padding="md">
                        {data.referrals.map((ref, index) => (
                            <View key={ref.id}>
                                {index > 0 ? <View style={adminStyles.separator} /> : null}
                                <View style={styles.item}>
                                    <KeyValueRow label={t('adminOps.promoDebug.referrer')} value={ref.referrer?.email || ref.referrer?.phone || ref.referrer_id} />
                                    <KeyValueRow label={t('adminOps.promoDebug.referred')} value={ref.referred?.email || ref.referred?.phone || ref.referred_id} />
                                    <KeyValueRow
                                        label={t('adminOps.promoDebug.bonusUsed')}
                                        value={ref.referrer_bonus_used ? t('adminOps.common.yes') : t('adminOps.common.no')}
                                        tone={ref.referrer_bonus_used ? 'success' : 'warning'}
                                    />
                                    <KeyValueRow label={t('adminOps.promoDebug.created')} value={formatWhen(ref.created_at, t)} />
                                </View>
                            </View>
                        ))}
                    </Card>
                </Section>
            ) : null}

            {data.bookings.length > 0 ? (
                <Section title={`${t('adminOps.promoDebug.bookings')} (${data.bookings.length})`}>
                    <Card variant="plain" padding="md">
                        {data.bookings.map((booking, index) => (
                            <View key={booking.id}>
                                {index > 0 ? <View style={adminStyles.separator} /> : null}
                                <View style={styles.item}>
                                    <View style={adminStyles.rowBetween}>
                                        <Text style={[adminStyles.rowTitle, styles.flex]} numberOfLines={2}>{booking.service?.name_ru || t('adminOps.promoDebug.na')}</Text>
                                        <StatusPill label={booking.status} tone={booking.status === 'paid' ? 'success' : 'neutral'} />
                                    </View>
                                    <Text style={adminStyles.rowMeta}>{`${formatWhen(booking.start_at, t)} · ${booking.id.slice(0, 8)}…`}</Text>
                                    <Text style={adminStyles.rowMeta}>{t('adminOps.promoDebug.applied')}</Text>
                                    <Json value={booking.promotion_applied} />
                                </View>
                            </View>
                        ))}
                    </Card>
                </Section>
            ) : null}

            {data.activePromotions.length > 0 ? (
                <Section title={`${t('adminOps.promoDebug.activePromotions')} (${data.activePromotions.length})`}>
                    <Card variant="plain" padding="md">
                        {data.activePromotions.map((promo, index) => (
                            <View key={promo.id}>
                                {index > 0 ? <View style={adminStyles.separator} /> : null}
                                <View style={styles.item}>
                                    <View style={adminStyles.rowBetween}>
                                        <Text style={[adminStyles.rowTitle, styles.flex]} numberOfLines={2}>{promo.title_ru}</Text>
                                        <StatusPill
                                            label={`${t('adminOps.promoDebug.active')}: ${promo.is_active ? t('adminOps.common.yes') : t('adminOps.common.no')}`}
                                            tone={promo.is_active ? 'success' : 'neutral'}
                                        />
                                    </View>
                                    <Text style={adminStyles.mono}>{promo.promotion_type}</Text>
                                    <Text style={adminStyles.rowMeta}>{t('adminOps.promoDebug.params')}</Text>
                                    <Json value={promo.params} />
                                </View>
                            </View>
                        ))}
                    </Card>
                </Section>
            ) : null}

            {nothing ? <EmptyState compact icon="search-outline" title={t('adminOps.promoDebug.emptyTitle')} message={t('adminOps.promoDebug.emptyDescription')} /> : null}
        </View>
    );
}

/**
 * The website's /admin/promotions-debug: a client, branch or business id (UUID) opens its promotion
 * usage, referrals, bookings with promotions, the branch's active promotions and the anomalies.
 */
export default function AdminPromotionsDebugScreen() {
    const { t } = useLanguage();
    const [ids, setIds] = useState<PromotionsDebugIds>({ clientId: '', branchId: '', bizId: '' });
    const [formError, setFormError] = useState<string | null>(null);
    const load = useMutation({ mutationFn: fetchPromotionsDebug });
    const invalid = (value: string) => value.trim() !== '' && !isUuid(value);

    const submit = () => {
        if (!ids.clientId.trim() && !ids.branchId.trim() && !ids.bizId.trim()) {
            setFormError(t('adminOps.promoDebug.idRequired'));
            return;
        }
        if (FIELDS.some((field) => invalid(ids[field.key]))) {
            setFormError(null);
            return;
        }
        setFormError(null);
        load.mutate(ids);
    };

    return (
        <Screen keyboard testID="admin-promotions-debug-screen">
            <ScreenIntro>{t('adminOps.promoDebug.intro')}</ScreenIntro>
            <FieldGroup>
                {FIELDS.map((field) => (
                    <FormField
                        key={field.key}
                        label={t(field.label)}
                        value={ids[field.key]}
                        onChangeText={(text) => setIds((current) => ({ ...current, [field.key]: text }))}
                        placeholder="00000000-0000-0000-0000-000000000000"
                        autoCapitalize="none"
                        autoCorrect={false}
                        error={invalid(ids[field.key]) ? t('adminOps.promoDebug.invalidId') : undefined}
                        testID={`admin-promo-debug-${field.key}`}
                    />
                ))}
                {formError ? <FeedbackBanner variant="warning" message={formError} compact /> : null}
                <Button title={t('adminOps.promoDebug.load')} onPress={submit} loading={load.isPending} fullWidth testID="admin-promo-debug-load" />
            </FieldGroup>

            {load.error ? (
                <FeedbackBanner variant="danger" title={t('adminOps.promoDebug.error')} message={getErrorMessage(load.error, t('adminOps.promoDebug.error'), t)} compact />
            ) : null}
            {load.data ? <Results data={load.data} /> : null}
        </Screen>
    );
}

const styles = StyleSheet.create({
    flex: { flex: 1 },
    results: { gap: space.xxl },
    item: { gap: space.xs, paddingVertical: space.xs },
});
