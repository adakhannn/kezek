import { View } from 'react-native';

import Button from '../../../components/ui/Button';
import { useLanguage, type MobileI18nKey } from '../../../i18n';
import { dayLabel, monthLabel } from '../opsKit/format';
import { ChipGroup, Stepper, ui } from '../opsKit/ui';
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
    return (
        <View style={{ gap: 8 }}>
            <ChipGroup
                options={FINANCE_PERIODS.map((key) => ({ key, label: t(PERIOD_LABEL[key]) }))}
                value={period}
                onChange={onPeriodChange}
                accessibilityLabel={t('ops.finance.period.label')}
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
                    testID="finance-anchor"
                />
            ) : null}
            <View style={ui.wrap}>
                <Button title={loading ? t('ops.finance.loading') : t('ops.finance.update')} onPress={onRefresh} variant="outline" size="sm" disabled={loading} />
            </View>
        </View>
    );
}
