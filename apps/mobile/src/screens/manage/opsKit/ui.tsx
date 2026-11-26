import type { ReactNode } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import ErrorState from '../../../components/ui/ErrorState';
import Screen from '../../../components/ui/Screen';
import { SkeletonCard, SkeletonList } from '../../../components/ui/Skeleton';
import { useNativePicker } from '../../../components/ui/DateTimeFields';
import { MIN_TOUCH_TARGET } from '../../../constants/accessibility';
import { colors } from '../../../constants/colors';
import { radii, space, typeScale } from '../../../constants/theme';
import { useLanguage } from '../../../i18n';
import { clampYmd, isYmd, pickerDateToYmd, ymdToPickerDate } from '../../../utils/pickerValues';

/*
 * Small pieces shared by the business management screens (overview, bookings, analytics, finance,
 * packages, applications). Chips, KPIs, sections and lists come from the UI kit (components/ui);
 * this file only adds what the kit does not have: a labelled filter, the period stepper, the
 * bar chart made of views and the screen-level loading / error states.
 */

/** A quiet overline label over a control that is not a text field (a chip row, a stepper). */
export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
    return (
        <View style={ui.field}>
            <Text style={ui.overline} accessibilityRole="header">{label}</Text>
            {children}
            {hint ? <Text style={ui.hint}>{hint}</Text> : null}
        </View>
    );
}

/**
 * Previous / next stepper around a value (a day, a month, a year). With `pickDate` the label itself
 * opens the native calendar, so a far date is one tap away instead of many steps.
 */
export function Stepper({
    label,
    onPrev,
    onNext,
    prevLabel,
    nextLabel,
    extra,
    disabled,
    testID,
    pickDate,
}: {
    label: string;
    onPrev: () => void;
    onNext: () => void;
    prevLabel: string;
    nextLabel: string;
    extra?: ReactNode;
    disabled?: boolean;
    testID?: string;
    /** The date (YYYY-MM-DD) the label opens in the calendar, and what a picked date does. */
    pickDate?: { value: string; onPick: (value: string) => void; minDate?: string; maxDate?: string };
}) {
    const { t } = useLanguage();
    const picker = useNativePicker();
    const openPicker = pickDate && isYmd(pickDate.value) ? () => picker.open({
        mode: 'date',
        value: ymdToPickerDate(pickDate.value),
        minimumDate: pickDate.minDate ? ymdToPickerDate(pickDate.minDate) : undefined,
        maximumDate: pickDate.maxDate ? ymdToPickerDate(pickDate.maxDate) : undefined,
        onPick: (date) => pickDate.onPick(clampYmd(pickerDateToYmd(date), pickDate.minDate, pickDate.maxDate)),
    }) : undefined;
    return (
        <View style={[ui.stepper, disabled ? ui.disabled : null]} testID={testID}>
            <Pressable
                onPress={onPrev}
                disabled={disabled}
                accessibilityRole="button"
                accessibilityLabel={prevLabel}
                hitSlop={4}
                style={({ pressed }) => [ui.stepperButton, pressed ? ui.pressed : null]}
                testID={testID ? `${testID}-prev` : undefined}
            >
                <Ionicons name="chevron-back" size={20} color={colors.text.primary} />
            </Pressable>
            {openPicker ? (
                <Pressable
                    onPress={openPicker}
                    disabled={disabled}
                    accessibilityRole="button"
                    accessibilityLabel={label}
                    accessibilityHint={t('ui.date.openHint')}
                    accessibilityLiveRegion="polite"
                    style={({ pressed }) => [ui.stepperPick, pressed ? ui.pressed : null]}
                    testID={testID ? `${testID}-open` : undefined}
                >
                    <Ionicons name="calendar-outline" size={16} color={colors.tone.accent.fg} />
                    <Text style={ui.stepperText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>{label}</Text>
                </Pressable>
            ) : (
                <View style={ui.stepperPick}>
                    <Text style={ui.stepperText} accessibilityLiveRegion="polite" numberOfLines={1}>{label}</Text>
                </View>
            )}
            <Pressable
                onPress={onNext}
                disabled={disabled}
                accessibilityRole="button"
                accessibilityLabel={nextLabel}
                hitSlop={4}
                style={({ pressed }) => [ui.stepperButton, pressed ? ui.pressed : null]}
                testID={testID ? `${testID}-next` : undefined}
            >
                <Ionicons name="chevron-forward" size={20} color={colors.text.primary} />
            </Pressable>
            {extra}
            {picker.sheet}
        </View>
    );
}

/** The bar colours of the charts: one meaning, one colour, on every screen. */
export const CHART_COLOR = {
    bookings: colors.tone.accent.fg,
    revenue: colors.tone.success.fg,
    promo: colors.tone.warning.fg,
} as const;

/** A horizontal bar of `share` (0..1) of the width over a track with quarter gridlines. */
export function ShareBar({ share, color = CHART_COLOR.bookings }: { share: number; color?: string }) {
    const value = Math.max(0, Math.min(1, share));
    const width = `${value * 100}%` as const;
    return (
        <View style={ui.barTrack} importantForAccessibility="no-hide-descendants">
            {[25, 50, 75].map((line) => <View key={line} style={[ui.gridline, { left: `${line}%` }]} />)}
            {value > 0 ? <View style={[ui.barFill, { width, backgroundColor: color }]} /> : null}
        </View>
    );
}

export type BarDatum = {
    key: string;
    label: string;
    value: number;
    display: string;
    /** A second number in its own column (promotions next to bookings). */
    secondary?: string;
    accessibilityLabel?: string;
};

/**
 * A bar chart as rows: label, bar, value (and an optional second column). Bars share one scale
 * (the largest value), the track carries quarter gridlines and the axis under it names 0 and the
 * maximum. `columns` names the columns above the rows.
 */
export function BarList({
    data,
    color = CHART_COLOR.bookings,
    axisMax,
    columns,
    labelWidth = 56,
    valueWidth = 72,
    secondaryWidth = 56,
    emptyLabel,
    testID,
}: {
    data: readonly BarDatum[];
    color?: string;
    /** The text of the maximum on the axis (formatted like the values). */
    axisMax?: string;
    columns?: { label: string; value: string; secondary?: string };
    labelWidth?: number;
    valueWidth?: number;
    secondaryWidth?: number;
    /** Shown instead of the bars when every value is zero (a chart of empty tracks says nothing). */
    emptyLabel?: string;
    testID?: string;
}) {
    const max = Math.max(1, ...data.map((item) => item.value));
    const hasSecondary = data.some((item) => item.secondary != null) || !!columns?.secondary;
    const isEmpty = data.every((item) => item.value === 0 && (!item.secondary || item.secondary === '—'));
    if (emptyLabel && isEmpty) {
        return (
            <View style={[ui.chart, ui.chartEmpty]} testID={testID}>
                <Ionicons name="bar-chart-outline" size={20} color={colors.text.tertiary} />
                <Text style={ui.chartEmptyText}>{emptyLabel}</Text>
            </View>
        );
    }
    return (
        <View style={ui.chart} testID={testID}>
            {columns ? (
                <View style={ui.barRow} importantForAccessibility="no-hide-descendants">
                    <Text style={[ui.columnText, { width: labelWidth }]} numberOfLines={1}>{columns.label}</Text>
                    <View style={ui.flex} />
                    <Text style={[ui.columnText, ui.right, { width: valueWidth }]} numberOfLines={1}>{columns.value}</Text>
                    {hasSecondary ? <Text style={[ui.columnText, ui.right, { width: secondaryWidth }]} numberOfLines={1}>{columns.secondary ?? ''}</Text> : null}
                </View>
            ) : null}
            {data.map((item) => (
                <View key={item.key} style={ui.barRow} accessible accessibilityLabel={item.accessibilityLabel ?? `${item.label}: ${item.display}`}>
                    <Text style={[ui.barLabel, { width: labelWidth }]} numberOfLines={1}>{item.label}</Text>
                    <ShareBar share={item.value / max} color={color} />
                    <Text style={[ui.barValue, { width: valueWidth }, item.value === 0 ? ui.barValueZero : null]} numberOfLines={1}>{item.display}</Text>
                    {hasSecondary ? (
                        <Text style={[ui.barValue, { width: secondaryWidth }, !item.secondary || item.secondary === '—' ? ui.barValueZero : null]} numberOfLines={1}>
                            {item.secondary ?? '—'}
                        </Text>
                    ) : null}
                </View>
            ))}
            {axisMax ? (
                <View style={ui.axis} importantForAccessibility="no-hide-descendants">
                    <View style={{ width: labelWidth }} />
                    <View style={ui.axisScale}>
                        <Text style={ui.axisText}>0</Text>
                        <Text style={ui.axisText}>{axisMax}</Text>
                    </View>
                    <View style={{ width: valueWidth }} />
                    {hasSecondary ? <View style={{ width: secondaryWidth }} /> : null}
                </View>
            ) : null}
        </View>
    );
}

/** A failed read with a retry (FE-08: never shown as empty data). */
export function LoadError({ title, onRetry, screen = false, compact = false }: { title: string; onRetry: () => void; screen?: boolean; compact?: boolean }) {
    const { t } = useLanguage();
    const state = <ErrorState title={title} message={t('staff.checkConnection')} onRetry={onRetry} compact={compact} />;
    return screen ? <Screen>{state}</Screen> : state;
}

/** The whole screen while its first read is in flight: a summary card and a list. */
export function ScreenSkeleton({ testID }: { testID?: string }) {
    return (
        <Screen testID={testID}>
            <SkeletonCard lines={2} />
            <SkeletonList rows={4} avatar={false} />
        </Screen>
    );
}

export const ui = StyleSheet.create({
    text: { ...typeScale.body, color: colors.text.primary },
    strong: { ...typeScale.bodyStrong, color: colors.text.primary },
    muted: { ...typeScale.caption, color: colors.text.secondary },
    hint: { ...typeScale.caption, color: colors.text.tertiary },
    overline: { ...typeScale.overline, color: colors.text.tertiary },
    row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
    rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
    wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
    separator: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border.subtle },
    disabled: { opacity: colors.interactive.disabledOpacity },
    pressed: { opacity: colors.interactive.pressedOpacity },
    field: { gap: space.sm },
    stepper: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
    stepperButton: {
        width: MIN_TOUCH_TARGET,
        height: MIN_TOUCH_TARGET,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: radii.md,
        backgroundColor: colors.surface.card,
    },
    stepperPick: {
        flex: 1,
        minHeight: MIN_TOUCH_TARGET,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: space.sm,
        paddingHorizontal: space.md,
        borderRadius: radii.md,
        backgroundColor: colors.surface.card,
    },
    stepperText: { ...typeScale.bodyStrong, flexShrink: 1, color: colors.text.primary, textAlign: 'center' },
    chart: { gap: space.xs },
    chartEmpty: { flexDirection: "row", alignItems: "center", gap: space.sm, paddingVertical: space.md },
    chartEmptyText: { ...typeScale.callout, color: colors.text.secondary, flexShrink: 1 },
    barRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 28 },
    barLabel: { ...typeScale.caption, color: colors.text.secondary },
    barValue: { ...typeScale.callout, color: colors.text.primary, textAlign: 'right', fontVariant: ['tabular-nums'] },
    barValueZero: { color: colors.text.tertiary },
    barTrack: {
        flex: 1,
        height: 12,
        borderRadius: radii.pill,
        backgroundColor: colors.fill.track,
        overflow: 'hidden',
        justifyContent: 'center',
    },
    gridline: { position: 'absolute', top: 0, bottom: 0, width: StyleSheet.hairlineWidth, backgroundColor: colors.border.light },
    barFill: { height: 12, borderRadius: radii.pill, minWidth: 4 },
    axis: { flexDirection: 'row', gap: space.sm, marginTop: space.xxs },
    axisScale: { flex: 1, flexDirection: 'row', justifyContent: 'space-between' },
    axisText: { ...typeScale.caption, color: colors.text.tertiary },
    columnText: { ...typeScale.overline, color: colors.text.tertiary },
    flex: { flex: 1 },
    right: { textAlign: 'right' },
});
