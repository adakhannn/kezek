import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import EmptyState from '../../components/ui/EmptyState';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import RatingBadge from '../../components/ui/RatingBadge';
import { colors } from '../../constants/colors';
import { typography } from '../../constants/typography';
import { useLanguage } from '../../i18n';
import type { RootStackParamList } from '../../navigation/types';
import { formatStaffName } from '../../utils/i18n';
import { promotionDescription, promotionTitle } from './businessPageModel';
import { groupPromotionsByBranch, promotionDetail, promotionPeriod, promotionTone, type PromotionTone } from './promotionsModel';
import { useBusinessPageData } from './useBusinessPageData';

type PromotionsRoute = RouteProp<RootStackParamList, 'Promotions'>;

const TONES: Record<PromotionTone, { icon: keyof typeof Ionicons.glyphMap; color: string }> = {
    visits: { icon: 'gift-outline', color: '#10b981' },
    referral: { icon: 'people-outline', color: '#a855f7' },
    discount: { icon: 'pricetag-outline', color: '#f59e0b' },
    other: { icon: 'sparkles-outline', color: colors.accent.indigo },
};

/** The website's /b/<slug>/promotions: the active promotions of every branch, with their dates. */
export default function PromotionsScreen() {
    const { params } = useRoute<PromotionsRoute>();
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
    const { t, locale } = useLanguage();
    const query = useBusinessPageData(params?.slug);

    if (query.isLoading) return <LoadingSpinner message={t('discovery.business.loading')} />;

    if (query.isError) {
        return (
            <EmptyState
                icon="alert-circle"
                title={t('discovery.business.errorTitle')}
                message={t('discovery.business.errorMessage')}
                action={<Button title={t('discovery.business.retry')} onPress={() => void query.refetch()} variant="outline" fullWidth />}
            />
        );
    }

    if (!query.data) {
        return <EmptyState icon="search" title={t('discovery.business.notFoundTitle')} message={t('discovery.business.notFoundMessage')} />;
    }

    const { business, branches, promotions } = query.data;
    const groups = groupPromotionsByBranch(promotions, branches);

    return (
        <ScrollView
            style={styles.container}
            contentContainerStyle={styles.content}
            testID="promotions-screen"
            refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={() => void query.refetch()} />}
        >
            <View style={styles.header}>
                <Text style={styles.title} accessibilityRole="header">{t('parity.promotions.title')}</Text>
                <Text style={styles.business}>{business.name}</Text>
                <View style={styles.meta}>
                    <RatingBadge rating={business.rating_score ?? null} />
                    {business.address ? <Text style={styles.metaText}>{business.address}</Text> : null}
                </View>
            </View>

            {groups.length === 0 ? (
                <EmptyState
                    icon="gift-outline"
                    title={t('parity.promotions.empty')}
                    message={t('parity.promotions.emptyHint')}
                />
            ) : (
                groups.map((group) => (
                    <View key={group.branchId} style={styles.group} testID={`promotions-branch-${group.branchId}`}>
                        {group.branch ? (
                            <View>
                                <Text style={styles.branchName}>{formatStaffName(group.branch.name, locale)}</Text>
                                {group.branch.address ? <Text style={styles.metaText}>{group.branch.address}</Text> : null}
                            </View>
                        ) : null}
                        {group.promotions.map((promotion) => {
                            const tone = TONES[promotionTone(promotion.promotion_type)];
                            const detail = promotionDetail(promotion, t);
                            const description = promotionDescription(promotion, locale);
                            const period = promotionPeriod(promotion, t);
                            return (
                                <Card key={promotion.id} style={[styles.card, { borderLeftColor: tone.color }]}>
                                    <View style={styles.cardHeader}>
                                        <View style={[styles.icon, { backgroundColor: `${tone.color}26` }]}>
                                            <Ionicons name={tone.icon} size={22} color={tone.color} />
                                        </View>
                                        <View style={styles.flex}>
                                            <Text style={styles.cardTitle}>{promotionTitle(promotion, t)}</Text>
                                            {detail ? <Text style={styles.detail}>{detail}</Text> : null}
                                        </View>
                                    </View>
                                    {description ? <Text style={styles.description}>{description}</Text> : null}
                                    {period ? <Text style={styles.period}>{period}</Text> : null}
                                </Card>
                            );
                        })}
                    </View>
                ))
            )}

            {branches.length > 0 ? (
                <Button
                    title={t('parity.promotions.book')}
                    onPress={() => navigation.navigate('Booking', { slug: business.slug, previewName: business.name })}
                    fullWidth
                />
            ) : null}
            <Button
                title={t('parity.promotions.backToBusiness')}
                onPress={() => navigation.navigate('Business', { slug: business.slug, previewName: business.name })}
                variant="outline"
                fullWidth
            />
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.surface.page },
    content: { padding: colors.layout.space5, paddingBottom: colors.layout.space8, gap: colors.layout.space4 },
    header: { alignItems: 'center', gap: colors.layout.space2 },
    title: { ...typography.pageTitle, color: colors.text.primary, textAlign: 'center' },
    business: { ...typography.sectionTitle, color: colors.text.secondary, textAlign: 'center' },
    meta: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: colors.layout.space2 },
    metaText: { ...typography.caption, color: colors.text.secondary },
    group: { gap: colors.layout.space3 },
    branchName: { ...typography.sectionTitle, color: colors.text.primary },
    card: { borderLeftWidth: 4, gap: colors.layout.space2 },
    cardHeader: { flexDirection: 'row', alignItems: 'center', gap: colors.layout.space3 },
    icon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
    flex: { flex: 1 },
    cardTitle: { ...typography.body, fontWeight: '700', color: colors.text.primary },
    detail: { ...typography.caption, color: colors.text.secondary, marginTop: 2 },
    description: { ...typography.body, color: colors.text.secondary },
    period: { ...typography.caption, color: colors.text.tertiary, borderTopWidth: 1, borderTopColor: colors.border.subtle, paddingTop: colors.layout.space2 },
});
