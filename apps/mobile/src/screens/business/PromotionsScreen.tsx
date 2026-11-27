import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { StyleSheet, Text, View } from 'react-native';

import ActionBar from '../../components/ui/ActionBar';
import Button from '../../components/ui/Button';
import EmptyState from '../../components/ui/EmptyState';
import ErrorState from '../../components/ui/ErrorState';
import { ListGroup } from '../../components/ui/ListRow';
import RatingBadge from '../../components/ui/RatingBadge';
import Screen from '../../components/ui/Screen';
import Section from '../../components/ui/Section';
import { SkeletonCard } from '../../components/ui/Skeleton';
import { colors } from '../../constants/colors';
import { layout, radii, space, typeScale, type Tone } from '../../constants/theme';
import { useLanguage } from '../../i18n';
import type { RootStackParamList } from '../../navigation/types';
import { formatStaffName } from '../../utils/i18n';
import { promotionDescription, promotionTitle } from './businessPageModel';
import { groupPromotionsByBranch, promotionDetail, promotionPeriod, promotionTone, type PromotionTone } from './promotionsModel';
import { useBusinessPageData } from './useBusinessPageData';

type PromotionsRoute = RouteProp<RootStackParamList, 'Promotions'>;

const TONES: Record<PromotionTone, { icon: keyof typeof Ionicons.glyphMap; tone: Tone }> = {
    visits: { icon: 'gift-outline', tone: 'success' },
    referral: { icon: 'people-outline', tone: 'accent' },
    discount: { icon: 'pricetag-outline', tone: 'warning' },
    other: { icon: 'sparkles-outline', tone: 'info' },
};

/**
 * The website's /b/<slug>/promotions: the active promotions of every branch, with their dates.
 * The header says "Акции"; the page opens with the business, then one section per branch.
 */
export default function PromotionsScreen() {
    const { params } = useRoute<PromotionsRoute>();
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
    const { t, locale } = useLanguage();
    const query = useBusinessPageData(params?.slug);

    if (query.isLoading) {
        return (
            <Screen>
                <View style={styles.loading} accessibilityLabel={t('discovery.business.loading')}>
                    <SkeletonCard lines={1} />
                    <SkeletonCard lines={3} />
                    <SkeletonCard lines={3} />
                </View>
            </Screen>
        );
    }

    if (query.isError) {
        return (
            <Screen>
                <ErrorState
                    title={t('discovery.business.errorTitle')}
                    message={t('discovery.business.errorMessage')}
                    retryLabel={t('discovery.business.retry')}
                    onRetry={() => void query.refetch()}
                />
            </Screen>
        );
    }

    if (!query.data) {
        return (
            <Screen>
                <EmptyState icon="search" title={t('discovery.business.notFoundTitle')} message={t('discovery.business.notFoundMessage')} />
            </Screen>
        );
    }

    const { business, branches, promotions } = query.data;
    const groups = groupPromotionsByBranch(promotions, branches);
    const openBusiness = () => navigation.navigate('Business', { slug: business.slug, previewName: business.name });

    return (
        <Screen
            testID="promotions-screen"
            refreshing={query.isRefetching}
            onRefresh={() => void query.refetch()}
            footer={branches.length > 0 ? (
                <ActionBar
                    primary={{
                        title: t('parity.promotions.book'),
                        onPress: () => navigation.navigate('Booking', { slug: business.slug, previewName: business.name }),
                    }}
                    secondary={{ title: t('parity.promotions.backToBusiness'), onPress: openBusiness }}
                />
            ) : undefined}
        >
            <View style={styles.header}>
                <Text style={styles.business} accessibilityRole="header" numberOfLines={2}>{business.name}</Text>
                <View style={styles.meta}>
                    <RatingBadge rating={business.rating_score ?? null} size="small" />
                    {business.address ? <Text style={styles.metaText} numberOfLines={2}>{business.address}</Text> : null}
                </View>
            </View>

            {groups.length === 0 ? (
                <EmptyState
                    icon="gift-outline"
                    title={t('parity.promotions.empty')}
                    message={t('parity.promotions.emptyHint')}
                    action={branches.length > 0 ? undefined : (
                        <Button title={t('parity.promotions.backToBusiness')} onPress={openBusiness} variant="outline" fullWidth />
                    )}
                />
            ) : (
                groups.map((group) => (
                    <Section
                        key={group.branchId}
                        testID={`promotions-branch-${group.branchId}`}
                        title={group.branch ? formatStaffName(group.branch.name, locale) : undefined}
                        caption={group.branch?.address ?? undefined}
                    >
                        <ListGroup inset>
                            {group.promotions.map((promotion) => {
                                const tone = TONES[promotionTone(promotion.promotion_type)];
                                const palette = colors.tone[tone.tone];
                                const title = promotionTitle(promotion, t);
                                // An untitled promotion is named by its detail: the same line is not shown twice.
                                const rawDetail = promotionDetail(promotion, t);
                                const detail = rawDetail && rawDetail !== title ? rawDetail : null;
                                const description = promotionDescription(promotion, locale);
                                const period = promotionPeriod(promotion, t);
                                return (
                                    <View key={promotion.id} style={styles.row}>
                                        <View style={[styles.icon, { backgroundColor: palette.bg }]}>
                                            <Ionicons name={tone.icon} size={18} color={palette.fg} />
                                        </View>
                                        <View style={styles.flex}>
                                            <Text style={styles.cardTitle}>{title}</Text>
                                            {detail ? <Text style={[styles.detail, { color: palette.fg }]}>{detail}</Text> : null}
                                            {description ? <Text style={styles.description}>{description}</Text> : null}
                                            {period ? <Text style={styles.period}>{period}</Text> : null}
                                        </View>
                                    </View>
                                );
                            })}
                        </ListGroup>
                    </Section>
                ))
            )}
        </Screen>
    );
}

const styles = StyleSheet.create({
    loading: { gap: layout.itemGap },
    header: { gap: space.xs },
    business: { ...typeScale.headline, color: colors.text.primary },
    meta: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.sm },
    metaText: { ...typeScale.caption, color: colors.text.secondary, flexShrink: 1 },
    row: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md, paddingVertical: space.md },
    icon: { width: 36, height: 36, borderRadius: radii.md, alignItems: 'center', justifyContent: 'center' },
    flex: { flex: 1, minWidth: 0, gap: space.xxs },
    cardTitle: { ...typeScale.bodyStrong, color: colors.text.primary },
    detail: { ...typeScale.callout },
    description: { ...typeScale.callout, fontWeight: '400', color: colors.text.secondary },
    period: { ...typeScale.caption, color: colors.text.tertiary, marginTop: space.xxs },
});
