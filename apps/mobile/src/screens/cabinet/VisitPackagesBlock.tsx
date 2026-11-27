import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';

import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import { ListGroup } from '../../components/ui/ListRow';
import Section from '../../components/ui/Section';
import OfflineBanner from '../../components/ui/OfflineBanner';
import { colors } from '../../constants/colors';
import { radii, space, typeScale } from '../../constants/theme';
import { useLanguage, type Locale } from '../../i18n';
import { apiRequest } from '../../lib/api';
import { formatYmd } from '../../utils/format';

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
                style={styles.banner}
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
            <View style={[styles.icon, !item.is_active && styles.iconInactive]}>
                <Ionicons name="ticket-outline" size={18} color={item.is_active ? colors.tone.success.fg : colors.text.secondary} />
            </View>
            <View style={styles.itemBody}>
                <View style={styles.itemHeader}>
                    <Text style={styles.itemTitle}>{planName(item, locale)}</Text>
                    {!item.is_active ? <Badge label={t('cabinet.packages.inactive')} /> : null}
                </View>
                <Text style={styles.itemText}>
                    {item.plan_visit_count
                        ? t('cabinet.packages.remaining', { remaining: item.remaining_visits, total: item.plan_visit_count })
                        : t('cabinet.packages.remainingNoTotal', { remaining: item.remaining_visits })}
                </Text>
                <Text style={styles.itemHint}>
                    {t('cabinet.packages.validUntil', { date: formatYmd(item.valid_until, locale) })}
                </Text>
            </View>
        </View>
    );

    return (
        <Section title={t('cabinet.packages.title')} caption={t('cabinet.packages.subtitle')} testID="visit-packages-block">
            {active.length > 0 ? (
                <ListGroup>{active.map(renderItem)}</ListGroup>
            ) : (
                <Text style={styles.itemHint}>{t('cabinet.packages.noActive')}</Text>
            )}
            {expired.length > 0 ? (
                <>
                    <Button
                        title={t(expiredOpen ? 'cabinet.packages.hideExpired' : 'cabinet.packages.showExpired')}
                        onPress={() => setExpiredOpen((open) => !open)}
                        variant="ghost"
                        size="sm"
                    />
                    {expiredOpen ? <ListGroup>{expired.map(renderItem)}</ListGroup> : null}
                </>
            ) : null}
        </Section>
    );
}

const styles = StyleSheet.create({
    banner: { marginBottom: 0 },
    item: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md, paddingVertical: space.md },
    itemInactive: { opacity: 0.7 },
    icon: {
        width: 36,
        height: 36,
        borderRadius: radii.md,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.tone.success.bg,
    },
    iconInactive: { backgroundColor: colors.tone.neutral.bg },
    itemBody: { flex: 1, minWidth: 0, gap: space.xxs },
    itemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.sm },
    itemTitle: { ...typeScale.bodyStrong, color: colors.text.primary, flexShrink: 1 },
    itemText: { ...typeScale.callout, color: colors.text.primary },
    itemHint: { ...typeScale.caption, color: colors.text.secondary },
});
