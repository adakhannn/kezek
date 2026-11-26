import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';

import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import OfflineBanner from '../../components/ui/OfflineBanner';
import { colors } from '../../constants/colors';
import { useLanguage, type Locale } from '../../i18n';
import { apiRequest } from '../../lib/api';
import { formatDate } from '../../utils/format';

/** GET /api/me/visit-packages item; `is_active` is computed by the server in the business time zone. */
export type VisitPackageItem = {
    id: string;
    plan_id: string;
    plan_name_ru: string | null;
    plan_name_ky: string | null;
    plan_name_en: string | null;
    remaining_visits: number;
    plan_visit_count: number | null;
    valid_until: string;
    purchased_at: string;
    created_at: string;
    is_active: boolean;
};

type Envelope = { ok?: boolean; data?: { packages?: VisitPackageItem[] } };

export function planName(item: VisitPackageItem, locale: Locale): string {
    const localized = locale === 'ky' ? item.plan_name_ky : locale === 'en' ? item.plan_name_en : item.plan_name_ru;
    return localized || item.plan_name_ru || item.plan_name_ky || item.plan_name_en || '—';
}

export async function loadVisitPackages(): Promise<VisitPackageItem[]> {
    const response = await apiRequest<Envelope>('/me/visit-packages?status=all');
    return Array.isArray(response?.data?.packages) ? response.data.packages : [];
}

/** The client's visit packages (C10), like the web MyVisitPackagesBlock: active first, expired folded. */
export function VisitPackagesBlock({ userId }: { userId: string }) {
    const { t, locale } = useLanguage();
    const [expiredOpen, setExpiredOpen] = useState(false);
    const query = useQuery({
        queryKey: ['visit-packages', userId],
        queryFn: loadVisitPackages,
    });

    if (query.isLoading) return null;

    if (query.isError) {
        // FE-08: the paid packages must not just vanish on a failed read.
        return (
            <OfflineBanner
                title={t('cabinet.packages.loadError')}
                onRetry={() => void query.refetch()}
                style={styles.block}
                compact
            />
        );
    }

    const packages = query.data ?? [];
    if (packages.length === 0) return null;

    const active = packages.filter((item) => item.is_active);
    const expired = packages.filter((item) => !item.is_active);

    const renderItem = (item: VisitPackageItem) => (
        <View key={item.id} style={[styles.item, !item.is_active && styles.itemInactive]} testID={`visit-package-${item.id}`}>
            <View style={styles.itemHeader}>
                <Text style={styles.itemTitle}>{planName(item, locale)}</Text>
                {!item.is_active ? <Text style={styles.badge}>{t('cabinet.packages.inactive')}</Text> : null}
            </View>
            <Text style={styles.itemText}>
                {item.plan_visit_count
                    ? t('cabinet.packages.remaining', { remaining: item.remaining_visits, total: item.plan_visit_count })
                    : t('cabinet.packages.remainingNoTotal', { remaining: item.remaining_visits })}
            </Text>
            <Text style={styles.itemHint}>
                {t('cabinet.packages.validUntil', { date: formatDate(`${item.valid_until}T12:00:00`, locale) })}
            </Text>
        </View>
    );

    return (
        <Card style={styles.block} testID="visit-packages-block">
            <Text style={styles.title}>{t('cabinet.packages.title')}</Text>
            <Text style={styles.subtitle}>{t('cabinet.packages.subtitle')}</Text>
            {active.length > 0 ? active.map(renderItem) : <Text style={styles.itemHint}>{t('cabinet.packages.noActive')}</Text>}
            {expired.length > 0 ? (
                <>
                    <Button
                        title={t(expiredOpen ? 'cabinet.packages.hideExpired' : 'cabinet.packages.showExpired')}
                        onPress={() => setExpiredOpen((open) => !open)}
                        variant="ghost"
                        size="sm"
                    />
                    {expiredOpen ? expired.map(renderItem) : null}
                </>
            ) : null}
        </Card>
    );
}

const styles = StyleSheet.create({
    block: { marginHorizontal: colors.layout.space6, marginBottom: colors.layout.space4 },
    title: { fontSize: 18, fontWeight: '700', color: colors.text.primary },
    subtitle: { fontSize: 13, color: colors.text.secondary, marginBottom: 8 },
    item: {
        borderWidth: 1,
        borderColor: colors.border.light,
        borderRadius: 12,
        padding: 12,
        marginTop: 8,
        gap: 2,
    },
    itemInactive: { opacity: 0.6 },
    itemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
    itemTitle: { fontSize: 15, fontWeight: '600', color: colors.text.primary, flexShrink: 1 },
    badge: { fontSize: 12, color: colors.text.secondary },
    itemText: { fontSize: 14, color: colors.text.primary },
    itemHint: { fontSize: 13, color: colors.text.secondary },
});
