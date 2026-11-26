import { Fragment, type ReactNode } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import KitBadge from '../../components/ui/Badge';
import { TimeField as NativeTimeField, useNativePicker } from '../../components/ui/DateTimeFields';
import { RadioRow, SwitchRow } from '../../components/ui/SelectionRow';
import KitStatTile from '../../components/ui/StatTile';
import { MIN_TOUCH_TARGET } from '../../constants/accessibility';
import { colors } from '../../constants/colors';
import { radii, space, typeScale } from '../../constants/theme';
import { useLanguage } from '../../i18n';
import { addDaysYmd } from '../../utils/businessWeek';
import { clampYmd, pickerDateToYmd, ymdToPickerDate } from '../../utils/pickerValues';
import { isTime } from './legacySchedule';

/** dd.mm.yyyy of a business date (YYYY-MM-DD), as the website prints it. */
export const dmy = (ymd: string) => ymd.split('-').reverse().join('.');

/** A selectable pill (slots, services, steps): the look of the kit's ChipGroup chip. */
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
            style={({ pressed }) => [
                ui.chip,
                selected ? ui.chipSelected : null,
                tone === 'danger' ? ui.chipDanger : null,
                pressed ? ui.pressed : null,
                disabled ? ui.disabled : null,
            ]}
        >
            {selected ? <Ionicons name="checkmark" size={16} color={colors.text.light} /> : null}
            <Text style={[ui.chipText, selected ? ui.chipTextSelected : null]} numberOfLines={1}>{label}</Text>
        </Pressable>
    );
}

/**
 * A single choice from a short list (the website's selects): radio rows with hairlines, meant to
 * sit inside one card. `card` draws that card when the list stands on the page by itself.
 */
export function OptionList<T extends string>({ options, value, onChange, disabled, card = false, testID }: {
    options: { value: T; label: string; hint?: string }[];
    value: T | '';
    onChange: (value: T) => void;
    disabled?: boolean;
    card?: boolean;
    testID?: string;
}) {
    return (
        <View style={card ? ui.optionCard : null} accessibilityRole="radiogroup" testID={testID}>
            {options.map((option, index) => (
                <Fragment key={option.value}>
                    {index > 0 ? <View style={ui.hairline} /> : null}
                    <RadioRow
                        label={option.label}
                        hint={option.hint}
                        selected={option.value === value}
                        onSelect={() => onChange(option.value)}
                        disabled={disabled}
                        testID={testID ? `${testID}-${option.value}` : undefined}
                    />
                </Fragment>
            ))}
        </View>
    );
}

/** An on/off setting: the kit's SwitchRow (the whole row toggles). */
export function ToggleRow({ label, hint, value, onChange, disabled, testID }: {
    label: string;
    hint?: string;
    value: boolean;
    onChange: (value: boolean) => void;
    disabled?: boolean;
    testID?: string;
}) {
    return <SwitchRow label={label} hint={hint} value={value} onChange={onChange} disabled={disabled} testID={testID} />;
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
    const picker = useNativePicker();
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
                    style={({ pressed }) => [ui.stepperButton, pressed ? ui.pressed : null, disabled || !canGoBack ? ui.disabled : null]}
                >
                    <Ionicons name="chevron-back" size={20} color={colors.text.primary} />
                </Pressable>
                <Pressable
                    onPress={() => picker.open({
                        mode: 'date',
                        value: ymdToPickerDate(value),
                        minimumDate: min ? ymdToPickerDate(min) : undefined,
                        onPick: (date) => onChange(clampYmd(pickerDateToYmd(date), min)),
                    })}
                    disabled={disabled}
                    accessibilityRole="button"
                    accessibilityLabel={format(value)}
                    accessibilityHint={t('ui.date.openHint')}
                    accessibilityLiveRegion="polite"
                    style={({ pressed }) => [ui.stepperPick, pressed ? ui.pressed : null, disabled ? ui.disabled : null]}
                >
                    <Ionicons name="calendar-outline" size={16} color={colors.tone.accent.fg} />
                    <Text style={ui.stepperValue} numberOfLines={1}>{format(value)}</Text>
                </Pressable>
                <Pressable
                    onPress={() => onChange(addDaysYmd(value, step))}
                    disabled={disabled}
                    accessibilityRole="button"
                    accessibilityLabel={t('manageStaff.date.next')}
                    style={({ pressed }) => [ui.stepperButton, pressed ? ui.pressed : null, disabled ? ui.disabled : null]}
                >
                    <Ionicons name="chevron-forward" size={20} color={colors.text.primary} />
                </Pressable>
                {today && value !== today ? (
                    <Pressable
                        onPress={() => onChange(today)}
                        disabled={disabled}
                        accessibilityRole="button"
                        style={({ pressed }) => [ui.todayButton, pressed ? ui.pressed : null, disabled ? ui.disabled : null]}
                    >
                        <Text style={ui.todayText}>{t('manageStaff.date.today')}</Text>
                    </Pressable>
                ) : null}
            </View>
            {picker.sheet}
        </View>
    );
}

/** A time of day (HH:MM) from the native clock, as a compact box for schedule rows. */
export function TimeField({ value, onChange, label, disabled, testID }: {
    value: string;
    onChange: (value: string) => void;
    label: string;
    disabled?: boolean;
    testID?: string;
}) {
    return (
        <NativeTimeField
            value={isTime(value) ? value : ''}
            onChange={onChange}
            label={label}
            disabled={disabled}
            minuteInterval={5}
            compact
            style={ui.time}
            testID={testID}
        />
    );
}

/** A KPI tile: the kit's StatTile (use it inside the kit's StatGrid). */
export function StatTile({ label, value, hint, tone, style }: {
    label: string;
    value: string;
    hint?: string;
    tone?: 'success' | 'accent' | 'warning' | 'muted';
    style?: StyleProp<ViewStyle>;
}) {
    return (
        <KitStatTile
            label={label.replace(/:\s*$/, '')}
            value={value}
            hint={hint}
            tone={tone === 'muted' ? undefined : tone}
            style={style}
        />
    );
}

/** A section title inside a card (a heading row with an optional right element). */
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

/** A short label: the kit's Badge (`muted` is the kit's neutral tone). */
export function Badge({ label, tone = 'muted' }: { label: string; tone?: 'success' | 'warning' | 'muted' | 'accent' | 'danger' }) {
    return <KitBadge label={label} tone={tone === 'muted' ? 'neutral' : tone} />;
}

export const ui = StyleSheet.create({
    text: { ...typeScale.body, color: colors.text.primary },
    strong: { ...typeScale.bodyStrong, color: colors.text.primary },
    muted: { ...typeScale.caption, color: colors.text.secondary },
    label: { ...typeScale.overline, color: colors.text.tertiary },
    row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
    wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
    gap: { gap: space.md },
    divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border.subtle, marginVertical: space.xs },
    hairline: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border.subtle },
    pressed: { opacity: colors.interactive.pressedOpacity },
    disabled: { opacity: colors.interactive.disabledOpacity },
    /** A card of the page (one level): filled, no border. */
    card: { backgroundColor: colors.surface.card, borderRadius: radii.lg, padding: space.lg, gap: space.md },
    /** A block inside a card: a lighter fill, never a bordered box. */
    inset: { backgroundColor: colors.fill.input, borderRadius: radii.md, padding: space.md, gap: space.xs },
    chip: {
        minHeight: MIN_TOUCH_TARGET,
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.xs,
        paddingHorizontal: space.lg,
        borderRadius: radii.pill,
        borderWidth: 1,
        borderColor: colors.border.subtle,
        backgroundColor: colors.surface.card,
    },
    chipSelected: { backgroundColor: colors.accent.primary, borderColor: colors.accent.primary },
    chipDanger: { borderColor: colors.tone.danger.border },
    chipText: { fontSize: 14, fontWeight: '500', color: colors.text.secondary },
    chipTextSelected: { color: colors.text.light, fontWeight: '600' },
    optionCard: { backgroundColor: colors.surface.card, borderRadius: radii.lg, paddingHorizontal: space.lg, paddingVertical: space.xs },
    stepper: { gap: space.sm },
    stepperRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
    stepperButton: {
        width: MIN_TOUCH_TARGET,
        height: MIN_TOUCH_TARGET,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: radii.md,
        backgroundColor: colors.fill.input,
    },
    stepperPick: {
        flexGrow: 1,
        flexShrink: 1,
        minHeight: MIN_TOUCH_TARGET,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: space.sm,
        paddingHorizontal: space.md,
        borderRadius: radii.md,
        backgroundColor: colors.fill.input,
    },
    stepperValue: { ...typeScale.bodyStrong, color: colors.text.primary, textAlign: 'center' },
    todayButton: {
        minHeight: MIN_TOUCH_TARGET,
        justifyContent: 'center',
        paddingHorizontal: space.md,
        borderRadius: radii.md,
        backgroundColor: colors.tone.accent.bg,
    },
    todayText: { ...typeScale.callout, fontWeight: '600', color: colors.tone.accent.fg },
    time: { flex: 1 },
    sectionHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
    sectionHeaderText: { flex: 1, gap: space.xxs },
    sectionTitle: { ...typeScale.headline, color: colors.text.primary },
});
