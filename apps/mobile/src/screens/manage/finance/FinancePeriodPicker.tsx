import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import SegmentedTabs from '../../../components/SegmentedTabs';
import { MIN_TOUCH_TARGET } from '../../../constants/accessibility';
import { colors } from '../../../constants/colors';
import { radii, space } from '../../../constants/theme';
import { useLanguage, type MobileI18nKey } from '../../../i18n';
import { dayLabel, monthLabel } from '../opsKit/format';
import { Stepper } from '../opsKit/ui';
import { FINANCE_PERIODS, shiftFinanceAnchor, type FinancePeriod } from './financeData';

const PERIOD_LABEL: Record<FinancePeriod, MobileI18nKey> = {
    day: 'ops.finance.period.day',
    month: 'ops.finance.period.month',
    year: 'ops.finance.period.year',
};

/** The period of a finance report (day, month or year) and the day, month or year itself. */
export function financePeriodLabel(period: FinancePeriod, anchor: string, locale: 'ru' | 'ky' | 'en'): string {
    if (!anchor) return '';
    if (period === 'day') return dayLabel(anchor.slice(0, 10), locale);
    if (period === 'month') return monthLabel(anchor, locale);
    return anchor.split('-')[0];
}

/** Day / month / year tabs, the stepper of the shown period and a reload button next to it. */
export default function FinancePeriodPicker({
    period,
    anchor,
    loading,
    onPeriodChange,
    onAnchorChange,
    onRefresh,
}: {
    period: FinancePeriod;
    /** The shown day anchor (YYYY-MM-DD); empty until the server named today's date. */
    anchor: string;
    loading: boolean;
    onPeriodChange: (period: FinancePeriod) => void;
    onAnchorChange: (anchor: string) => void;
    onRefresh: () => void;
}) {
    const { t, locale } = useLanguage();
    const refresh = (
        <Pressable
            onPress={onRefresh}
            disabled={loading}
            accessibilityRole="button"
            accessibilityLabel={loading ? t('ops.finance.loading') : t('ops.finance.update')}
            accessibilityState={{ busy: loading, disabled: loading }}
            style={({ pressed }) => [styles.refresh, pressed ? styles.pressed : null]}
            testID="finance-refresh"
        >
            {loading
                ? <ActivityIndicator size="small" color={colors.tone.accent.fg} />
                : <Ionicons name="refresh" size={20} color={colors.text.primary} />}
        </Pressable>
    );
    return (
        <View style={styles.wrap}>
            <SegmentedTabs
                tabs={FINANCE_PERIODS.map((key) => ({ key, label: t(PERIOD_LABEL[key]) }))}
                value={period}
                onChange={onPeriodChange}
                testID="finance-period"
            />
            {anchor ? (
                <Stepper
                    label={financePeriodLabel(period, anchor, locale)}
                    onPrev={() => onAnchorChange(shiftFinanceAnchor(period, anchor, -1))}
                    onNext={() => onAnchorChange(shiftFinanceAnchor(period, anchor, 1))}
                    prevLabel={t('ops.common.prev')}
                    nextLabel={t('ops.common.next')}
                    disabled={loading}
                    // Any day of the wanted month or year anchors it, so the calendar serves all periods.
                    pickDate={{ value: anchor.slice(0, 10), onPick: onAnchorChange }}
                    extra={refresh}
                    testID="finance-anchor"
                />
            ) : <View style={styles.refreshOnly}>{refresh}</View>}
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: { gap: space.md },
    refresh: {
        width: MIN_TOUCH_TARGET,
        height: MIN_TOUCH_TARGET,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: radii.md,
        backgroundColor: colors.surface.card,
    },
    refreshOnly: { alignItems: 'flex-end' },
    pressed: { opacity: colors.interactive.pressedOpacity },
});
