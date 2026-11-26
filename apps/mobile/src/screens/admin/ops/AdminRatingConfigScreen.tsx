import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import ActionBar from '../../../components/ui/ActionBar';
import Button from '../../../components/ui/Button';
import Card from '../../../components/ui/Card';
import ChipGroup from '../../../components/ui/ChipGroup';
import FeedbackBanner from '../../../components/ui/FeedbackBanner';
import FormField, { FieldGroup } from '../../../components/ui/FormField';
import Screen from '../../../components/ui/Screen';
import ScreenIntro from '../../../components/ui/ScreenIntro';
import Section from '../../../components/ui/Section';
import { SkeletonCard } from '../../../components/ui/Skeleton';
import { colors } from '../../../constants/colors';
import { space, typeScale } from '../../../constants/theme';
import { useConfirm } from '../../../contexts/ConfirmContext';
import { useToast } from '../../../contexts/ToastContext';
import { useLanguage, type MobileI18nKey } from '../../../i18n';
import { getErrorMessage } from '../../../lib/errors';
import { fetchRatingConfig, initializeRatings, saveRatingConfig, type RatingWeights } from './adminOpsApi';
import {
    parseNumberInput,
    RECALC_DAYS_OPTIONS,
    weightsChanged,
    weightsFromConfig,
    weightsSum,
    weightsSumOk,
    weightsValid,
    windowDaysOk,
} from './adminOpsLogic';
import { AdminError, formatWhen } from './adminOpsUi';

type WeightKey = 'reviews' | 'productivity' | 'loyalty' | 'discipline';
type Draft = Record<WeightKey | 'windowDays', string>;

const WEIGHTS: { key: WeightKey; label: MobileI18nKey; hint: MobileI18nKey }[] = [
    { key: 'reviews', label: 'adminOps.ratingConfig.reviews', hint: 'adminOps.ratingConfig.reviewsHint' },
    { key: 'productivity', label: 'adminOps.ratingConfig.productivity', hint: 'adminOps.ratingConfig.productivityHint' },
    { key: 'loyalty', label: 'adminOps.ratingConfig.loyalty', hint: 'adminOps.ratingConfig.loyaltyHint' },
    { key: 'discipline', label: 'adminOps.ratingConfig.discipline', hint: 'adminOps.ratingConfig.disciplineHint' },
];

function toDraft(weights: RatingWeights): Draft {
    return {
        reviews: String(weights.reviews),
        productivity: String(weights.productivity),
        loyalty: String(weights.loyalty),
        discipline: String(weights.discipline),
        windowDays: String(weights.windowDays),
    };
}

function fromDraft(draft: Draft): RatingWeights {
    return {
        reviews: parseNumberInput(draft.reviews),
        productivity: parseNumberInput(draft.productivity),
        loyalty: parseNumberInput(draft.loyalty),
        discipline: parseNumberInput(draft.discipline),
        windowDays: parseNumberInput(draft.windowDays),
    };
}

/**
 * The website's /admin/rating-config: the four staff rating weights (adding up to 100%) and the
 * window in days, saved as a new active configuration after a confirmation; when the weights
 * changed, the history of the chosen number of days can then be recalculated (also confirmed).
 */
export default function AdminRatingConfigScreen() {
    const { t } = useLanguage();
    const { confirm } = useConfirm();
    const { showToast } = useToast();
    const queryClient = useQueryClient();
    const query = useQuery({ queryKey: ['admin-ops', 'rating-config'], queryFn: fetchRatingConfig });
    const initial = weightsFromConfig(query.data ?? null);
    const [draft, setDraft] = useState<Draft | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [recalcPrompt, setRecalcPrompt] = useState(false);
    const [recalcDays, setRecalcDays] = useState<number>(30);

    useEffect(() => {
        if (query.data !== undefined && draft === null) setDraft(toDraft(weightsFromConfig(query.data)));
    }, [query.data, draft]);

    const save = useMutation({
        mutationFn: saveRatingConfig,
        onSuccess: async (_result, weights) => {
            setError(null);
            showToast(t('adminOps.ratingConfig.saved'), 'success');
            const changed = weightsChanged(weights, initial);
            await queryClient.invalidateQueries({ queryKey: ['admin-ops', 'rating-config'] });
            setDraft(toDraft(weights));
            setRecalcPrompt(changed);
        },
        onError: (cause) => setError(getErrorMessage(cause, t('adminOps.ratingConfig.saveError'), t)),
    });
    const recalc = useMutation({
        mutationFn: initializeRatings,
        onSuccess: () => {
            setRecalcPrompt(false);
            showToast(t('adminOps.ratingConfig.recalcDone'), 'success');
            void queryClient.invalidateQueries({ queryKey: ['admin-ops'] });
        },
        onError: (cause) => showToast(getErrorMessage(cause, t('adminOps.ratingConfig.recalcError'), t), 'error'),
    });

    if (query.isLoading || (!query.error && draft === null)) {
        return (
            <Screen testID="admin-rating-config-screen">
                <SkeletonCard lines={5} />
            </Screen>
        );
    }
    if (query.error || !draft) {
        return (
            <Screen testID="admin-rating-config-screen">
                <AdminError title={t('adminOps.ratingConfig.error')} error={query.error} onRetry={() => void query.refetch()} />
            </Screen>
        );
    }

    const weights = fromDraft(draft);
    const sum = weightsSum(weights);
    const sumOk = weightsSumOk(weights);
    const valid = weightsValid(weights);
    const set = (key: keyof Draft, text: string) => setDraft((current) => (current ? { ...current, [key]: text.replace(/[^\d.,]/g, '') } : current));

    const onSave = async () => {
        if (!valid) return;
        const accepted = await confirm({
            title: t('adminOps.ratingConfig.saveConfirmTitle'),
            message: t('adminOps.ratingConfig.saveConfirmMessage'),
            confirmLabel: t('adminOps.ratingConfig.save'),
            cancelLabel: t('adminOps.common.cancel'),
        });
        if (accepted) save.mutate(weights);
    };
    const onRecalc = async () => {
        const accepted = await confirm({
            title: t('adminOps.ratingConfig.recalcConfirmTitle'),
            message: t('adminOps.ratingConfig.recalcConfirmMessage', { days: recalcDays }),
            confirmLabel: t('adminOps.ratingConfig.recalculate'),
            cancelLabel: t('adminOps.common.cancel'),
        });
        if (accepted) recalc.mutate(recalcDays);
    };
    const onReset = () => {
        setDraft(toDraft(initial));
        setError(null);
    };

    return (
        <Screen
            keyboard
            testID="admin-rating-config-screen"
            footer={(
                <ActionBar
                    primary={{ title: t('adminOps.ratingConfig.save'), onPress: () => void onSave(), loading: save.isPending, disabled: !valid || recalc.isPending, testID: 'admin-rating-save' }}
                    secondary={{ title: t('adminOps.ratingConfig.reset'), onPress: onReset, disabled: save.isPending, testID: 'admin-rating-reset' }}
                />
            )}
        >
            <ScreenIntro>
                {query.data
                    ? `${t('adminOps.ratingConfig.active')} · ${t('adminOps.ratingConfig.validFrom', { date: formatWhen(query.data.valid_from, t) })}`
                    : t('adminOps.ratingConfig.noConfig')}
            </ScreenIntro>

            {recalcPrompt ? (
                <Section title={t('adminOps.ratingConfig.recalcTitle')} testID="admin-rating-recalc">
                    <Card variant="accent" padding="md" style={styles.recalc}>
                        <Text style={styles.text}>{t('adminOps.ratingConfig.recalcPrompt')}</Text>
                        <ChipGroup
                            options={RECALC_DAYS_OPTIONS.map((days) => ({ key: String(days), label: String(days) }))}
                            value={String(recalcDays)}
                            onChange={(value) => setRecalcDays(Number(value))}
                            accessibilityLabel={t('adminOps.ratingConfig.recalcDays')}
                            disabled={recalc.isPending}
                            testID="admin-rating-recalc-days"
                        />
                        <View style={styles.buttons}>
                            <Button title={t('adminOps.ratingConfig.skip')} onPress={() => setRecalcPrompt(false)} variant="ghost" disabled={recalc.isPending} />
                            <Button title={t('adminOps.ratingConfig.recalculate')} onPress={() => void onRecalc()} variant="outline" loading={recalc.isPending} testID="admin-rating-recalc-run" />
                        </View>
                    </Card>
                </Section>
            ) : null}

            {error ? <FeedbackBanner variant="danger" message={error} compact /> : null}

            <FieldGroup title={t('adminOps.ratingConfig.weights')} caption={t('adminOps.ratingConfig.weightsHint')}>
                {WEIGHTS.map((item) => (
                    <FormField
                        key={item.key}
                        label={t(item.label)}
                        hint={t(item.hint)}
                        value={draft[item.key]}
                        onChangeText={(text) => set(item.key, text)}
                        keyboardType="decimal-pad"
                        suffix={t('adminOps.ratingConfig.unitPercent')}
                        testID={`admin-rating-${item.key}`}
                    />
                ))}
                <FeedbackBanner
                    variant={sumOk ? 'success' : 'danger'}
                    title={t('adminOps.ratingConfig.sum', { value: Number.isFinite(sum) ? sum.toFixed(2) : '—' })}
                    message={sumOk ? t('adminOps.ratingConfig.sumOk') : t('adminOps.ratingConfig.sumWrong')}
                    compact
                />
            </FieldGroup>

            <FieldGroup title={t('adminOps.ratingConfig.window')}>
                <FormField
                    label={t('adminOps.ratingConfig.windowDays')}
                    hint={t('adminOps.ratingConfig.windowHint')}
                    value={draft.windowDays}
                    onChangeText={(text) => set('windowDays', text.replace(/\D/g, ''))}
                    keyboardType="number-pad"
                    suffix={t('adminOps.ratingConfig.unitDays')}
                    error={windowDaysOk(weights.windowDays) ? undefined : t('adminOps.ratingConfig.windowError')}
                    testID="admin-rating-window"
                />
            </FieldGroup>
        </Screen>
    );
}

const styles = StyleSheet.create({
    recalc: { gap: space.md },
    text: { ...typeScale.body, color: colors.text.primary },
    buttons: { flexDirection: 'row', justifyContent: 'flex-end', gap: space.sm },
});
