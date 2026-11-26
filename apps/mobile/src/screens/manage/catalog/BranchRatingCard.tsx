import { StyleSheet, Text, View } from 'react-native';

import Card from '../../../components/ui/Card';
import { colors } from '../../../constants/colors';
import { useLanguage, type MobileI18nKey } from '../../../i18n';
import { ratingAdviceKey } from './branchForm';
import type { BranchRatingWeights } from './catalogApi';
import { ui } from './catalogUi';

const FACTORS: { key: keyof Omit<BranchRatingWeights, 'windowDays'>; label: MobileI18nKey; color: string }[] = [
    { key: 'reviews', label: 'catalog.branch.rating.factor.reviews', color: '#34d399' },
    { key: 'productivity', label: 'catalog.branch.rating.factor.productivity', color: '#a78bfa' },
    { key: 'loyalty', label: 'catalog.branch.rating.factor.loyalty', color: '#38bdf8' },
    { key: 'discipline', label: 'catalog.branch.rating.factor.discipline', color: '#fb7185' },
];

/** How the branch rating is made (the website's BranchRatingCard). */
export function BranchRatingCard({ score, weights }: { score: number | null; weights: BranchRatingWeights }) {
    const { t } = useLanguage();
    const days = { days: weights.windowDays };
    return (
        <Card padding="md" testID="branch-rating-card">
            <Text style={styles.eyebrow}>{t('catalog.branch.rating.eyebrow')}</Text>
            <Text style={ui.sectionTitle} accessibilityRole="header">{t('catalog.branch.rating.title')}</Text>
            <Text style={[ui.muted, styles.gap]}>{t('catalog.branch.rating.subtitle', days)}</Text>
            <Text style={ui.caption}>{t('catalog.branch.rating.period', days)} · {t('catalog.branch.rating.refresh')}</Text>

            <View style={styles.score}>
                <Text style={styles.scoreLabel}>
                    {t(score === null ? 'catalog.branch.rating.statusLabel' : 'catalog.branch.rating.scoreLabel')}
                </Text>
                {score === null ? (
                    <Text style={styles.noScore}>{t('catalog.branch.rating.noScore')}</Text>
                ) : (
                    <Text style={styles.value}>
                        {score.toFixed(1)} <Text style={ui.caption}>{t('catalog.branch.rating.outOf')}</Text>
                    </Text>
                )}
                <Text style={ui.muted}>{t(ratingAdviceKey(score))}</Text>
            </View>

            <Text style={[styles.scoreLabel, styles.gap]}>{t('catalog.branch.rating.factorsTitle')}</Text>
            {FACTORS.map((factor) => {
                const value = weights[factor.key];
                return (
                    <View key={factor.key} style={styles.factor} accessible accessibilityLabel={`${t(factor.label)}: ${value}%`}>
                        <View style={ui.rowBetween}>
                            <Text style={ui.body}>{t(factor.label)}</Text>
                            <Text style={ui.body}>{value}%</Text>
                        </View>
                        <View style={styles.track}>
                            <View style={[styles.bar, { width: `${Math.max(0, Math.min(100, value))}%`, backgroundColor: factor.color }]} />
                        </View>
                    </View>
                );
            })}
        </Card>
    );
}

const styles = StyleSheet.create({
    eyebrow: { fontSize: 12, fontWeight: '600', letterSpacing: 1, textTransform: 'uppercase', color: colors.status.warning },
    gap: { marginTop: colors.layout.space2, marginBottom: colors.layout.space2 },
    score: {
        marginTop: colors.layout.space3,
        padding: colors.layout.space4,
        borderRadius: colors.layout.radiusLg,
        borderWidth: 1,
        borderColor: colors.border.subtle,
        backgroundColor: colors.surface.elevated,
        gap: 6,
    },
    scoreLabel: { fontSize: 12, fontWeight: '600', letterSpacing: 0.8, textTransform: 'uppercase', color: colors.text.secondary },
    noScore: { fontSize: 17, fontWeight: '600', color: colors.text.primary },
    value: { fontSize: 34, fontWeight: '700', color: colors.text.primary },
    factor: { marginTop: colors.layout.space2, gap: 6 },
    track: { height: 6, borderRadius: 3, backgroundColor: colors.surface.elevated, overflow: 'hidden' },
    bar: { height: 6, borderRadius: 3 },
});
