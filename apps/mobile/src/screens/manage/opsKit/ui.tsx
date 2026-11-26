import type { ReactNode } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import Button from '../../../components/ui/Button';
import EmptyState from '../../../components/ui/EmptyState';
import { MIN_TOUCH_TARGET } from '../../../constants/accessibility';
import { colors } from '../../../constants/colors';
import { useLanguage } from '../../../i18n';

/* Small building blocks shared by the business management screens (overview, bookings, analytics, finance, packages, applications). */

export type ChipOption<T extends string> = { key: T; label: string };

/** A wrap of selectable chips: a filter or a choice of one value. */
export function ChipGroup<T extends string>({
    options,
    value,
    onChange,
    accessibilityLabel,
    disabled,
    testID,
}: {
    options: readonly ChipOption<T>[];
    value: T | null;
    onChange: (value: T) => void;
    accessibilityLabel?: string;
    disabled?: boolean;
    testID?: string;
}) {
    return (
        <View style={ui.chips} accessibilityLabel={accessibilityLabel} testID={testID}>
            {options.map((option) => {
                const selected = option.key === value;
                return (
                    <Pressable
                        key={option.key}
                        onPress={() => onChange(option.key)}
                        disabled={disabled}
                        accessibilityRole="button"
                        accessibilityState={{ selected, disabled: !!disabled }}
                        style={[ui.chip, selected ? ui.chipSelected : null, disabled ? ui.disabled : null]}
                        testID={testID ? `${testID}-${option.key}` : undefined}
                    >
                        <Text style={[ui.chipText, selected ? ui.chipTextSelected : null]}>{option.label}</Text>
                    </Pressable>
                );
            })}
        </View>
    );
}

/** A labelled field block. */
export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
    return (
        <View style={ui.field}>
            <Text style={ui.fieldLabel}>{label}</Text>
            {children}
            {hint ? <Text style={ui.hint}>{hint}</Text> : null}
        </View>
    );
}

/** Previous / next stepper around a value (a day, a month, a year). */
export function Stepper({
    label,
    onPrev,
    onNext,
    prevLabel,
    nextLabel,
    extra,
    disabled,
    testID,
}: {
    label: string;
    onPrev: () => void;
    onNext: () => void;
    prevLabel: string;
    nextLabel: string;
    extra?: ReactNode;
    disabled?: boolean;
    testID?: string;
}) {
    return (
        <View style={ui.stepper} testID={testID}>
            <Pressable
                onPress={onPrev}
                disabled={disabled}
                accessibilityRole="button"
                accessibilityLabel={prevLabel}
                style={ui.stepperButton}
                testID={testID ? `${testID}-prev` : undefined}
            >
                <Ionicons name="chevron-back" size={20} color={colors.text.primary} />
            </Pressable>
            <Text style={ui.stepperLabel} accessibilityLiveRegion="polite">{label}</Text>
            <Pressable
                onPress={onNext}
                disabled={disabled}
                accessibilityRole="button"
                accessibilityLabel={nextLabel}
                style={ui.stepperButton}
                testID={testID ? `${testID}-next` : undefined}
            >
                <Ionicons name="chevron-forward" size={20} color={colors.text.primary} />
            </Pressable>
            {extra}
        </View>
    );
}

/** A number with its caption. */
export function StatTile({ label, value, hint, style, testID }: { label: string; value: string; hint?: string; style?: StyleProp<ViewStyle>; testID?: string }) {
    return (
        <View style={[ui.tile, style]} accessible accessibilityLabel={[label, value, hint].filter(Boolean).join(', ')} testID={testID}>
            <Text style={ui.tileLabel}>{label}</Text>
            <Text style={ui.tileValue}>{value}</Text>
            {hint ? <Text style={ui.tileHint}>{hint}</Text> : null}
        </View>
    );
}

/** A horizontal bar of `share` (0..1) of the width, for the website's charts as plain views. */
export function ShareBar({ share, color = colors.accent.indigo }: { share: number; color?: string }) {
    const width = `${Math.max(0, Math.min(1, share)) * 100}%` as const;
    return (
        <View style={ui.barTrack} importantForAccessibility="no-hide-descendants">
            <View style={[ui.barFill, { width, backgroundColor: color }]} />
        </View>
    );
}

/** A failed read with a retry (FE-08: never shown as empty data). */
export function LoadError({ title, onRetry }: { title: string; onRetry: () => void }) {
    const { t } = useLanguage();
    return (
        <EmptyState
            icon="alert-circle"
            title={title}
            message={t('staff.checkConnection')}
            action={<Button title={t('staff.retry')} onPress={onRetry} variant="outline" fullWidth />}
        />
    );
}

export function SectionTitle({ children }: { children: ReactNode }) {
    return <Text style={ui.sectionTitle} accessibilityRole="header">{children}</Text>;
}

export const ui = StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background.primary },
    content: { padding: colors.layout.space4, paddingBottom: 120, gap: colors.layout.space3 },
    title: { fontSize: 24, fontWeight: '700', color: colors.text.primary },
    subtitle: { fontSize: 14, color: colors.text.secondary, marginTop: 4 },
    text: { fontSize: 15, color: colors.text.primary },
    muted: { fontSize: 13, color: colors.text.secondary },
    hint: { fontSize: 12, color: colors.text.tertiary, marginTop: 4 },
    sectionTitle: { fontSize: 18, fontWeight: '600', color: colors.text.primary, marginTop: colors.layout.space2 },
    row: { flexDirection: 'row', alignItems: 'center', gap: colors.layout.space2 },
    rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: colors.layout.space2 },
    wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: colors.layout.space2 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: colors.layout.space2 },
    chip: {
        minHeight: MIN_TOUCH_TARGET,
        justifyContent: 'center',
        paddingHorizontal: colors.layout.space3,
        borderRadius: colors.layout.radiusLg,
        borderWidth: 1,
        borderColor: colors.border.light,
        backgroundColor: colors.surface.card,
    },
    chipSelected: { borderColor: colors.accent.primary, backgroundColor: colors.surface.emphasis },
    chipText: { fontSize: 14, color: colors.text.secondary },
    chipTextSelected: { color: colors.text.primary, fontWeight: '600' },
    disabled: { opacity: colors.interactive.disabledOpacity },
    field: { gap: colors.layout.space2 },
    fieldLabel: { fontSize: 14, fontWeight: '600', color: colors.text.secondary },
    stepper: { flexDirection: 'row', alignItems: 'center', gap: colors.layout.space2 },
    stepperButton: {
        width: MIN_TOUCH_TARGET,
        height: MIN_TOUCH_TARGET,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: colors.layout.radiusMd,
        borderWidth: 1,
        borderColor: colors.border.light,
        backgroundColor: colors.surface.card,
    },
    stepperLabel: { flexShrink: 1, fontSize: 16, fontWeight: '600', color: colors.text.primary, textAlign: 'center', minWidth: 120 },
    tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: colors.layout.space2 },
    tile: {
        flexGrow: 1,
        flexBasis: '45%',
        padding: colors.layout.space3,
        borderRadius: colors.layout.radiusMd,
        borderWidth: 1,
        borderColor: colors.border.subtle,
        backgroundColor: colors.surface.elevated,
    },
    tileLabel: { fontSize: 12, fontWeight: '600', color: colors.text.secondary },
    tileValue: { fontSize: 20, fontWeight: '700', color: colors.text.primary, marginTop: 4 },
    tileHint: { fontSize: 12, color: colors.text.tertiary, marginTop: 2 },
    barTrack: { height: 8, borderRadius: 4, backgroundColor: colors.surface.elevated, overflow: 'hidden', flex: 1 },
    barFill: { height: 8, borderRadius: 4 },
    listRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: colors.layout.space2,
        paddingVertical: colors.layout.space2,
        borderBottomWidth: 1,
        borderBottomColor: colors.border.subtle,
    },
    badge: {
        alignSelf: 'flex-start',
        borderRadius: colors.layout.radiusSm,
        paddingHorizontal: colors.layout.space2,
        paddingVertical: 2,
        backgroundColor: colors.surface.elevated,
    },
    badgeText: { fontSize: 12, fontWeight: '600', color: colors.text.secondary },
    successText: { color: colors.status.success },
    warningText: { color: colors.status.warning },
    dangerText: { color: colors.status.danger },
});
