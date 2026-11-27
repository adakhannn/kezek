import { StyleSheet, Text, View } from 'react-native';

import Card from '../../../components/ui/Card';
import Section from '../../../components/ui/Section';
import { colors } from '../../../constants/colors';
import { space, typeScale } from '../../../constants/theme';
import { translatePlural, useLanguage, type MobileI18nKey } from '../../../i18n';
import { ratingAdviceKey } from './branchForm';
import type { BranchRatingWeights } from './catalogApi';

const FACTORS: { key: keyof Omit<BranchRatingWeights, 'windowDays'>; label: MobileI18nKey; color: string }[] = [
    { key: 'reviews', label: 'catalog.branch.rating.factor.reviews', color: colors.tone.success.fg },
    { key: 'productivity', label: 'catalog.branch.rating.factor.productivity', color: colors.tone.accent.fg },
    { key: 'loyalty', label: 'catalog.branch.rating.factor.loyalty', color: colors.tone.info.fg },
    { key: 'discipline', label: 'catalog.branch.rating.factor.discipline', color: colors.tone.danger.fg },
];

/** How the branch rating is made (the website's BranchRatingCard): the score, then the weights. */
export function BranchRatingCard({ score, weights }: { score: number | null; weights: BranchRatingWeights }) {
    const { t } = useLanguage();
    const period = { period: translatePlural(t, 'common.days', weights.windowDays) };
    return (
        <Section
            title={t('catalog.branch.rating.title')}
            caption={`${t('catalog.branch.rating.period', period)} · ${t('catalog.branch.rating.refresh')}`}
            testID="branch-rating-card"
        >
            <Card variant="plain" padding="md" style={styles.card}>
                <View style={styles.score} accessible>
                    <Text style={styles.scoreLabel}>
                        {t(score === null ? 'catalog.branch.rating.statusLabel' : 'catalog.branch.rating.scoreLabel')}
                    </Text>
                    {score === null ? (
                        <Text style={styles.noScore}>{t('catalog.branch.rating.noScore')}</Text>
                    ) : (
                        <Text style={styles.value}>
                            {score.toFixed(1)} <Text style={styles.outOf}>{t('catalog.branch.rating.outOf')}</Text>
                        </Text>
                    )}
                    <Text style={styles.advice}>{t(ratingAdviceKey(score))}</Text>
                </View>

                <View style={styles.divider} />
                <Text style={styles.scoreLabel}>{t('catalog.branch.rating.factorsTitle')}</Text>
                {FACTORS.map((factor) => {
                    const value = weights[factor.key];
                    return (
                        <View key={factor.key} style={styles.factor} accessible accessibilityLabel={`${t(factor.label)}: ${value}%`}>
                            <View style={styles.factorRow}>
                                <Text style={styles.factorLabel}>{t(factor.label)}</Text>
                                <Text style={styles.factorValue}>{value}%</Text>
                            </View>
                            <View style={styles.track}>
                                <View style={[styles.bar, { width: `${Math.max(0, Math.min(100, value))}%`, backgroundColor: factor.color }]} />
                            </View>
                        </View>
                    );
                })}
            </Card>
        </Section>
    );
}

const styles = StyleSheet.create({
    card: { gap: space.md },
    score: { gap: space.xs },
    scoreLabel: { ...typeScale.overline, color: colors.text.tertiary },
    noScore: { ...typeScale.headline, color: colors.text.primary },
    value: { ...typeScale.display, color: colors.text.primary },
    outOf: { ...typeScale.caption, color: colors.text.secondary },
    advice: { ...typeScale.callout, fontWeight: '400', color: colors.text.secondary },
    divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border.subtle },
    factor: { gap: space.xs },
    factorRow: { flexDirection: 'row', justifyContent: 'space-between', gap: space.md },
    factorLabel: { ...typeScale.callout, fontWeight: '400', color: colors.text.primary, flex: 1 },
    factorValue: { ...typeScale.callout, color: colors.text.primary },
    track: { height: 6, borderRadius: 3, backgroundColor: colors.fill.track, overflow: 'hidden' },
    bar: { height: 6, borderRadius: 3 },
});
