import { useState, type ReactNode } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';

import Card from '../../../components/ui/Card';
import ChipGroup from '../../../components/ui/ChipGroup';
import { DateRangeField } from '../../../components/ui/DateTimeFields';
import ErrorState from '../../../components/ui/ErrorState';
import { KeyValueRow } from '../../../components/ui/ListRow';
import Section from '../../../components/ui/Section';
import { StatusPill } from '../../../components/ui/Badge';
import { colors } from '../../../constants/colors';
import { radii, space, typeScale, type Tone } from '../../../constants/theme';
import { useLanguage, type MobileI18nKey, type Translate } from '../../../i18n';
import { getErrorMessage } from '../../../lib/errors';
import { formatDateTime } from '../../../utils/format';
import { dayLabel } from '../../manage/opsKit/format';
import { todayInTz } from '../../manage/opsKit/dates';
import { ADMIN_TZ, PERIOD_PRESETS, presetPeriod, type PeriodPreset } from './adminOpsLogic';

/*
 * Pieces shared by the super-admin screens: the period filter of the website's admin analytics,
 * a status card (title, OK / problem pill, label-value lines), a JSON block for debug payloads and
 * the error state that shows the server's own message (a forbidden answer included).
 */

const PRESET_LABEL: Record<PeriodPreset, MobileI18nKey> = {
    '7': 'adminOps.period.days7',
    '30': 'adminOps.period.days30',
    '90': 'adminOps.period.days90',
    custom: 'adminOps.period.custom',
};

export type PeriodState = {
    preset: PeriodPreset | 'all';
    startDate: string;
    endDate: string;
    /** The dictionary key of why the period cannot be read, or null. */
    invalid: MobileI18nKey | null;
    choose: (preset: PeriodPreset | 'all') => void;
    setRange: (range: { from: string; to: string }) => void;
};

/** The admin analytics period: 30 days by default; `allTime` starts with no dates (the whole history). */
export function usePeriod({ allTime = false }: { allTime?: boolean } = {}): PeriodState {
    const [state, setState] = useState(() => (allTime
        ? { preset: 'all' as const, startDate: '', endDate: '' }
        : { preset: '30' as PeriodPreset | 'all', ...presetPeriod('30', todayInTz(ADMIN_TZ)) }));
    const invalid: MobileI18nKey | null = state.startDate && state.endDate && state.startDate > state.endDate ? 'adminOps.period.order' : null;
    return {
        ...state,
        invalid,
        choose: (preset) => {
            if (preset === 'all') setState({ preset, startDate: '', endDate: '' });
            else if (preset === 'custom') setState((prev) => ({ ...prev, preset }));
            else setState({ preset, ...presetPeriod(preset, todayInTz(ADMIN_TZ)) });
        },
        setRange: (range) => setState({ preset: 'custom', startDate: range.from, endDate: range.to }),
    };
}

/** Preset chips over the date range picker; the website's "Период / Дата начала / Дата окончания". */
export function PeriodFilter({ period, allTime = false, testID }: { period: PeriodState; allTime?: boolean; testID?: string }) {
    const { t } = useLanguage();
    const options = [
        ...(allTime ? [{ key: 'all' as const, label: t('adminOps.period.allTime') }] : []),
        ...PERIOD_PRESETS.map((key) => ({ key, label: t(PRESET_LABEL[key]) })),
    ];
    return (
        <View style={styles.filter} testID={testID}>
            <ChipGroup
                options={options}
                value={period.preset}
                onChange={period.choose}
                accessibilityLabel={t('adminOps.period.label')}
                testID={testID ? `${testID}-preset` : undefined}
            />
            {period.preset !== 'all' ? (
                <DateRangeField
                    from={period.startDate}
                    to={period.endDate}
                    onChange={period.setRange}
                    timeZone={ADMIN_TZ}
                    fromLabel={t('adminOps.period.start')}
                    toLabel={t('adminOps.period.end')}
                    error={period.invalid ? t(period.invalid) : undefined}
                    testID={testID ? `${testID}-range` : undefined}
                />
            ) : null}
        </View>
    );
}

/** OK / Проблема (or a custom label) as a status pill. */
export function OkPill({ ok, label, warning = false }: { ok: boolean; label?: string; warning?: boolean }) {
    const { t } = useLanguage();
    const tone: Tone = ok ? 'success' : warning ? 'warning' : 'danger';
    return <StatusPill label={label ?? (ok ? t('adminOps.common.ok') : warning ? t('adminOps.common.warning') : t('adminOps.common.problem'))} tone={tone} />;
}

/** One titled status block: a section title with its pill, then the lines in a plain card. */
export function StatusCard({ title, ok, warning, icon, children, testID }: {
    title: string;
    ok: boolean;
    warning?: boolean;
    icon?: keyof typeof Ionicons.glyphMap;
    children: ReactNode;
    testID?: string;
}) {
    const tone: Tone = ok ? 'success' : warning ? 'warning' : 'danger';
    return (
        <Card variant="plain" padding="md" testID={testID}>
            <View style={styles.cardHead}>
                {icon ? (
                    <View style={[styles.cardIcon, { backgroundColor: colors.tone[tone].bg }]}>
                        <Ionicons name={icon} size={18} color={colors.tone[tone].fg} />
                    </View>
                ) : null}
                <Text style={styles.cardTitle} numberOfLines={2} accessibilityRole="header">{title}</Text>
                <OkPill ok={ok} warning={warning} />
            </View>
            <View style={styles.cardBody}>{children}</View>
        </Card>
    );
}

/** A muted line inside a status card (a note or a sub-status). */
export function Note({ children, tone }: { children: ReactNode; tone?: Tone }) {
    return <Text style={[styles.note, tone ? { color: colors.tone[tone].fg } : null]}>{children}</Text>;
}

/** Pretty JSON of a debug value in a scrollable monospace block. */
export function JsonBlock({ value, testID }: { value: string; testID?: string }) {
    return (
        <ScrollView horizontal style={styles.json} contentContainerStyle={styles.jsonContent} testID={testID}>
            <Text style={styles.jsonText} selectable>{value}</Text>
        </ScrollView>
    );
}

/** A failed admin read: the server's message (403 "Доступ запрещен" included) with a retry. */
export function AdminError({ title, error, onRetry, compact }: { title: string; error: unknown; onRetry: () => void; compact?: boolean }) {
    const { t } = useLanguage();
    return <ErrorState title={title} message={getErrorMessage(error, t('staff.checkConnection'), t)} onRetry={onRetry} compact={compact} />;
}

/** A date (YYYY-MM-DD, as is) or an instant (in the platform time zone) in the app language, or the fallback. */
export function formatWhen(value: string | null | undefined, t: Translate, fallback?: string): string {
    if (!value) return fallback ?? t('adminOps.common.noData');
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return dayLabel(value, t.locale);
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return formatDateTime(date, true, t.locale, ADMIN_TZ);
}

/** The three last metric dates of a ratings check: staff, branch, business. */
export function MetricDates({ staff, branch, biz }: { staff: string | null; branch: string | null; biz: string | null }) {
    const { t } = useLanguage();
    return (
        <>
            <KeyValueRow label={t('adminOps.health.metricStaff')} value={formatWhen(staff, t)} />
            <KeyValueRow label={t('adminOps.health.metricBranch')} value={formatWhen(branch, t)} />
            <KeyValueRow label={t('adminOps.health.metricBiz')} value={formatWhen(biz, t)} />
        </>
    );
}

/** A section whose content is a plain card (the common shape of these screens). */
export function CardSection({ title, caption, right, children, testID }: {
    title: string;
    caption?: string;
    right?: ReactNode;
    children: ReactNode;
    testID?: string;
}) {
    return (
        <Section title={title} caption={caption} right={right} testID={testID}>
            <Card variant="plain" padding="md">{children}</Card>
        </Section>
    );
}

export const adminStyles = StyleSheet.create({
    separator: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border.subtle, marginVertical: space.sm },
    mono: { ...typeScale.caption, color: colors.text.secondary, fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }) },
    rowTitle: { ...typeScale.bodyStrong, color: colors.text.primary },
    rowMeta: { ...typeScale.caption, color: colors.text.secondary },
    rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
    gapSm: { gap: space.sm },
    gapMd: { gap: space.md },
});

const styles = StyleSheet.create({
    filter: { gap: space.md },
    cardHead: { flexDirection: 'row', alignItems: 'center', gap: space.md },
    cardIcon: { width: 36, height: 36, borderRadius: radii.md, alignItems: 'center', justifyContent: 'center' },
    cardTitle: { ...typeScale.headline, color: colors.text.primary, flex: 1 },
    cardBody: { marginTop: space.md, gap: space.xs },
    note: { ...typeScale.callout, color: colors.text.secondary },
    json: { maxHeight: 220, borderRadius: radii.md, backgroundColor: colors.fill.input },
    jsonContent: { padding: space.md },
    jsonText: { ...typeScale.caption, color: colors.text.secondary, fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }) },
});
