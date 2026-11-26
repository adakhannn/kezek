import { useEffect, useState, type ReactNode } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Switch, Text, TextInput, View, type StyleProp, type ViewStyle } from 'react-native';

import { MIN_TOUCH_TARGET } from '../../constants/accessibility';
import { colors } from '../../constants/colors';
import { useLanguage } from '../../i18n';
import { addDaysYmd } from '../../utils/businessWeek';
import { isTime } from './legacySchedule';

/** dd.mm.yyyy of a business date (YYYY-MM-DD), as the website prints it. */
export const dmy = (ymd: string) => ymd.split('-').reverse().join('.');

/** A selectable pill: filters, branches, services, periods. */
export function Chip({ label, selected, onPress, disabled, testID, tone }: {
    label: string;
    selected: boolean;
    onPress: () => void;
    disabled?: boolean;
    testID?: string;
    tone?: 'default' | 'danger';
}) {
    return (
        <Pressable
            onPress={onPress}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityState={{ selected, disabled: !!disabled }}
            accessibilityLabel={label}
            testID={testID}
            style={[ui.chip, selected ? ui.chipSelected : null, tone === 'danger' ? ui.chipDanger : null, disabled ? ui.disabled : null]}
        >
            <Text style={[ui.chipText, selected ? ui.chipTextSelected : null]}>{label}</Text>
        </Pressable>
    );
}

/** A vertical list of single-choice options (a native replacement for the website's selects). */
export function OptionList<T extends string>({ options, value, onChange, disabled, testID }: {
    options: { value: T; label: string; hint?: string }[];
    value: T | '';
    onChange: (value: T) => void;
    disabled?: boolean;
    testID?: string;
}) {
    return (
        <View style={ui.optionList} accessibilityRole="radiogroup" testID={testID}>
            {options.map((option) => {
                const selected = option.value === value;
                return (
                    <Pressable
                        key={option.value}
                        onPress={() => onChange(option.value)}
                        disabled={disabled}
                        accessibilityRole="radio"
                        accessibilityState={{ checked: selected, disabled: !!disabled }}
                        accessibilityLabel={option.hint ? `${option.label}, ${option.hint}` : option.label}
                        style={[ui.option, selected ? ui.optionSelected : null, disabled ? ui.disabled : null]}
                        testID={testID ? `${testID}-${option.value}` : undefined}
                    >
                        <Ionicons
                            name={selected ? 'radio-button-on' : 'radio-button-off'}
                            size={20}
                            color={selected ? colors.accent.indigo : colors.text.secondary}
                        />
                        <View style={ui.optionBody}>
                            <Text style={ui.optionLabel}>{option.label}</Text>
                            {option.hint ? <Text style={ui.optionHint}>{option.hint}</Text> : null}
                        </View>
                    </Pressable>
                );
            })}
        </View>
    );
}

export function ToggleRow({ label, value, onChange, disabled, testID }: {
    label: string;
    value: boolean;
    onChange: (value: boolean) => void;
    disabled?: boolean;
    testID?: string;
}) {
    return (
        <View style={[ui.toggleRow, disabled ? ui.disabled : null]}>
            <Text style={ui.toggleLabel}>{label}</Text>
            <Switch
                value={value}
                onValueChange={onChange}
                disabled={disabled}
                accessibilityLabel={label}
                testID={testID}
                trackColor={{ true: colors.accent.primary, false: colors.border.light }}
            />
        </View>
    );
}

/** A business date with day (or other) steps and a "today" shortcut; dates before `min` are refused. */
export function DateStepper({ value, onChange, min, today, disabled, label, step = 1, format = dmy }: {
    value: string;
    onChange: (value: string) => void;
    min?: string;
    today?: string;
    disabled?: boolean;
    label?: string;
    step?: number;
    format?: (value: string) => string;
}) {
    const { t } = useLanguage();
    const previous = addDaysYmd(value, -step);
    const canGoBack = !min || previous >= min;
    return (
        <View style={ui.stepper}>
            {label ? <Text style={ui.label}>{label}</Text> : null}
            <View style={ui.stepperRow}>
                <Pressable
                    onPress={() => onChange(previous)}
                    disabled={disabled || !canGoBack}
                    accessibilityRole="button"
                    accessibilityLabel={t('manageStaff.date.previous')}
                    style={[ui.stepperButton, disabled || !canGoBack ? ui.disabled : null]}
                >
                    <Ionicons name="chevron-back" size={20} color={colors.text.primary} />
                </Pressable>
                <Text style={ui.stepperValue} accessibilityLiveRegion="polite">{format(value)}</Text>
                <Pressable
                    onPress={() => onChange(addDaysYmd(value, step))}
                    disabled={disabled}
                    accessibilityRole="button"
                    accessibilityLabel={t('manageStaff.date.next')}
                    style={[ui.stepperButton, disabled ? ui.disabled : null]}
                >
                    <Ionicons name="chevron-forward" size={20} color={colors.text.primary} />
                </Pressable>
                {today && value !== today ? (
                    <Pressable
                        onPress={() => onChange(today)}
                        disabled={disabled}
                        accessibilityRole="button"
                        style={[ui.todayButton, disabled ? ui.disabled : null]}
                    >
                        <Text style={ui.todayText}>{t('manageStaff.date.today')}</Text>
                    </Pressable>
                ) : null}
            </View>
        </View>
    );
}

/**
 * A time of day (HH:MM). The typed text is kept until it is a valid time, then reported; a
 * shorter entry like "930" is read as 09:30 when the field loses focus.
 */
export function TimeField({ value, onChange, label, disabled, testID }: {
    value: string;
    onChange: (value: string) => void;
    label: string;
    disabled?: boolean;
    testID?: string;
}) {
    const [text, setText] = useState(value);
    useEffect(() => setText(value), [value]);
    const commit = (raw: string) => {
        const digits = raw.replace(/\D/g, '');
        const candidate = raw.includes(':') ? raw.padStart(5, '0') : digits.length >= 3 ? `${digits.slice(0, -2).padStart(2, '0')}:${digits.slice(-2)}` : raw;
        if (isTime(candidate)) {
            setText(candidate);
            if (candidate !== value) onChange(candidate);
        } else {
            setText(value);
        }
    };
    return (
        <TextInput
            value={text}
            onChangeText={(next) => {
                setText(next);
                if (isTime(next) && next !== value) onChange(next);
            }}
            onBlur={() => commit(text)}
            editable={!disabled}
            keyboardType="numbers-and-punctuation"
            maxLength={5}
            placeholder="09:00"
            placeholderTextColor={colors.text.muted}
            accessibilityLabel={label}
            testID={testID}
            style={[ui.timeInput, disabled ? ui.disabled : null]}
        />
    );
}

export function StatTile({ label, value, hint, tone, style }: {
    label: string;
    value: string;
    hint?: string;
    tone?: 'success' | 'accent' | 'warning' | 'muted';
    style?: StyleProp<ViewStyle>;
}) {
    const color = tone === 'success' ? colors.status.success : tone === 'accent' ? colors.accent.indigo
        : tone === 'warning' ? colors.status.warning : colors.text.primary;
    return (
        <View style={[ui.tile, style]} accessible accessibilityLabel={`${label}: ${value}${hint ? `, ${hint}` : ''}`}>
            <Text style={ui.tileLabel}>{label}</Text>
            <Text style={[ui.tileValue, { color }]}>{value}</Text>
            {hint ? <Text style={ui.tileHint}>{hint}</Text> : null}
        </View>
    );
}

export function SectionTitle({ title, description, right }: { title: string; description?: string; right?: ReactNode }) {
    return (
        <View style={ui.sectionHeader}>
            <View style={ui.sectionHeaderText}>
                <Text style={ui.sectionTitle} accessibilityRole="header">{title}</Text>
                {description ? <Text style={ui.muted}>{description}</Text> : null}
            </View>
            {right}
        </View>
    );
}

export function Badge({ label, tone = 'muted' }: { label: string; tone?: 'success' | 'warning' | 'muted' | 'accent' | 'danger' }) {
    const palette = {
        success: { bg: colors.feedback.successSurface, fg: colors.status.success },
        warning: { bg: colors.feedback.warningSurface, fg: colors.status.warning },
        danger: { bg: colors.feedback.dangerSurface, fg: colors.status.danger },
        accent: { bg: colors.surface.emphasis, fg: colors.accent.indigo },
        muted: { bg: colors.surface.elevated, fg: colors.text.secondary },
    }[tone];
    return (
        <View style={[ui.badge, { backgroundColor: palette.bg }]}>
            <Text style={[ui.badgeText, { color: palette.fg }]}>{label}</Text>
        </View>
    );
}

export const ui = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background.primary },
    content: { padding: colors.layout.space4, paddingBottom: 120, gap: colors.layout.space4 },
    title: { fontSize: 24, fontWeight: '700', color: colors.text.primary },
    subtitle: { fontSize: 15, color: colors.text.secondary, marginTop: 2 },
    text: { fontSize: 15, color: colors.text.primary },
    muted: { fontSize: 13, color: colors.text.secondary, marginTop: 2 },
    label: { fontSize: 14, fontWeight: '600', color: colors.text.secondary, marginBottom: colors.layout.space2 },
    row: { flexDirection: 'row', alignItems: 'center', gap: colors.layout.space2 },
    wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: colors.layout.space2 },
    gap: { gap: colors.layout.space3 },
    divider: { height: 1, backgroundColor: colors.border.subtle, marginVertical: colors.layout.space3 },
    disabled: { opacity: 0.5 },
    chip: {
        minHeight: MIN_TOUCH_TARGET,
        justifyContent: 'center',
        paddingHorizontal: colors.layout.space4,
        borderRadius: colors.layout.radiusLg,
        borderWidth: 1,
        borderColor: colors.border.light,
        backgroundColor: colors.surface.card,
    },
    chipSelected: { borderColor: colors.accent.primary, backgroundColor: colors.surface.emphasis },
    chipDanger: { borderColor: colors.status.danger },
    chipText: { fontSize: 14, fontWeight: '600', color: colors.text.secondary },
    chipTextSelected: { color: colors.text.primary },
    optionList: { gap: colors.layout.space2 },
    option: {
        minHeight: MIN_TOUCH_TARGET,
        flexDirection: 'row',
        alignItems: 'center',
        gap: colors.layout.space3,
        paddingHorizontal: colors.layout.space3,
        paddingVertical: colors.layout.space2,
        borderRadius: colors.layout.radiusMd,
        borderWidth: 1,
        borderColor: colors.border.subtle,
        backgroundColor: colors.surface.card,
    },
    optionSelected: { borderColor: colors.accent.primary, backgroundColor: colors.surface.emphasis },
    optionBody: { flex: 1 },
    optionLabel: { fontSize: 15, color: colors.text.primary },
    optionHint: { fontSize: 13, color: colors.text.secondary, marginTop: 2 },
    toggleRow: {
        minHeight: MIN_TOUCH_TARGET,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: colors.layout.space3,
    },
    toggleLabel: { flex: 1, fontSize: 15, color: colors.text.primary },
    stepper: { gap: colors.layout.space1 },
    stepperRow: { flexDirection: 'row', alignItems: 'center', gap: colors.layout.space2 },
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
    stepperValue: { minWidth: 110, textAlign: 'center', fontSize: 16, fontWeight: '600', color: colors.text.primary },
    todayButton: {
        minHeight: MIN_TOUCH_TARGET,
        justifyContent: 'center',
        paddingHorizontal: colors.layout.space3,
        borderRadius: colors.layout.radiusMd,
        backgroundColor: colors.surface.emphasis,
    },
    todayText: { fontSize: 14, fontWeight: '600', color: colors.accent.indigo },
    timeInput: {
        minHeight: MIN_TOUCH_TARGET,
        minWidth: 84,
        paddingHorizontal: colors.layout.space3,
        borderRadius: colors.layout.radiusMd,
        borderWidth: 1,
        borderColor: colors.border.light,
        backgroundColor: colors.surface.card,
        color: colors.text.primary,
        fontSize: 16,
        textAlign: 'center',
    },
    tile: {
        flexGrow: 1,
        flexBasis: '45%',
        padding: colors.layout.space3,
        borderRadius: colors.layout.radiusMd,
        borderWidth: 1,
        borderColor: colors.border.subtle,
        backgroundColor: colors.surface.card,
    },
    tileLabel: { fontSize: 13, color: colors.text.secondary },
    tileValue: { fontSize: 20, fontWeight: '700', marginTop: 4 },
    tileHint: { fontSize: 12, color: colors.text.muted, marginTop: 2 },
    sectionHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: colors.layout.space3, marginBottom: colors.layout.space3 },
    sectionHeaderText: { flex: 1 },
    sectionTitle: { fontSize: 18, fontWeight: '700', color: colors.text.primary },
    badge: { alignSelf: 'flex-start', paddingHorizontal: colors.layout.space2, paddingVertical: 3, borderRadius: 999 },
    badgeText: { fontSize: 12, fontWeight: '600' },
});
