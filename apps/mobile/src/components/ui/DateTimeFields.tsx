import { useCallback, useState, type ReactNode } from 'react';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerAndroid, type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Modal, Platform, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { resolveBusinessTimeZone } from '@shared-client/timezone';

import { MIN_TOUCH_TARGET } from '../../constants/accessibility';
import { colors } from '../../constants/colors';
import { layout, radii, space, typeScale } from '../../constants/theme';
import { useLanguage } from '../../i18n';
import { addDaysYmd, businessTodayYmd } from '../../utils/businessWeek';
import {
    clampYmd,
    formatYmdLabel,
    hmToPickerDate,
    isHm,
    isYmd,
    pickerDateToHm,
    pickerDateToYmd,
    ymdToPickerDate,
} from '../../utils/pickerValues';

type PickerMode = 'date' | 'time';

type OpenOptions = {
    mode: PickerMode;
    value: Date;
    minimumDate?: Date;
    maximumDate?: Date;
    minuteInterval?: 1 | 5 | 10 | 15 | 30;
    onPick: (date: Date) => void;
};

const PICKER_LOCALE = { ru: 'ru-RU', ky: 'ky-KG', en: 'en-US' } as const;

/**
 * Opens the platform's own picker: the Material dialog on Android, a bottom sheet with the
 * inline calendar (date) or the wheel (time) and Cancel / Done on iOS.
 */
export function useNativePicker(): { open: (options: OpenOptions) => void; sheet: ReactNode } {
    const { t, locale } = useLanguage();
    const [request, setRequest] = useState<OpenOptions | null>(null);
    const [draft, setDraft] = useState<Date>(new Date());

    const open = useCallback((options: OpenOptions) => {
        if (Platform.OS === 'android') {
            DateTimePickerAndroid.open({
                value: options.value,
                mode: options.mode,
                is24Hour: true,
                minimumDate: options.minimumDate,
                maximumDate: options.maximumDate,
                onChange: (event: DateTimePickerEvent, date?: Date) => {
                    if (event.type === 'set' && date) options.onPick(date);
                },
            });
            return;
        }
        setDraft(options.value);
        setRequest(options);
    }, []);

    const close = () => setRequest(null);
    const sheet = Platform.OS === 'android' || !request ? null : (
        <Modal visible transparent animationType="slide" onRequestClose={close} statusBarTranslucent>
            <Pressable style={styles.backdrop} onPress={close} accessibilityRole="button" accessibilityLabel={t('ui.picker.cancel')} />
            <View style={styles.sheet}>
                <View style={styles.sheetHeader}>
                    <Pressable onPress={close} accessibilityRole="button" style={styles.sheetButton} hitSlop={8}>
                        <Text style={styles.sheetCancel}>{t('ui.picker.cancel')}</Text>
                    </Pressable>
                    <Pressable
                        onPress={() => {
                            request.onPick(draft);
                            close();
                        }}
                        accessibilityRole="button"
                        style={styles.sheetButton}
                        hitSlop={8}
                        testID="picker-done"
                    >
                        <Text style={styles.sheetDone}>{t('ui.picker.done')}</Text>
                    </Pressable>
                </View>
                <DateTimePicker
                    value={draft}
                    mode={request.mode}
                    display={request.mode === 'date' ? 'inline' : 'spinner'}
                    onChange={(_event: DateTimePickerEvent, date?: Date) => { if (date) setDraft(date); }}
                    minimumDate={request.minimumDate}
                    maximumDate={request.maximumDate}
                    minuteInterval={request.minuteInterval}
                    locale={PICKER_LOCALE[locale]}
                    themeVariant="dark"
                    accentColor={colors.accent.indigo}
                    textColor={colors.text.primary}
                    is24Hour
                />
            </View>
        </Modal>
    );
    return { open, sheet };
}

type FieldShellProps = {
    label?: string;
    /** The spoken name when the label is not shown (compact). */
    a11yLabel?: string;
    required?: boolean;
    hint?: string;
    error?: string;
    icon: keyof typeof Ionicons.glyphMap;
    text: string;
    placeholder: string;
    onPress: () => void;
    onClear?: () => void;
    clearLabel: string;
    disabled?: boolean;
    accessibilityHint: string;
    compact?: boolean;
    style?: StyleProp<ViewStyle>;
    testID?: string;
};

/** The look of Input, but a button: shows the formatted value and opens a picker. */
function FieldShell({
    label, a11yLabel, required, hint, error, icon, text, placeholder, onPress, onClear, clearLabel, disabled, accessibilityHint, compact, style, testID,
}: FieldShellProps) {
    const empty = !text;
    return (
        <View style={[compact ? null : styles.container, style]}>
            {label ? (
                <Text style={styles.label}>
                    {label}{required ? <Text style={styles.required}> *</Text> : null}
                </Text>
            ) : null}
            <View style={[styles.box, compact ? styles.boxCompact : null, error ? styles.boxError : null, disabled ? styles.boxDisabled : null]}>
                <Pressable
                    onPress={onPress}
                    disabled={disabled}
                    accessibilityRole="button"
                    accessibilityLabel={[a11yLabel ?? label, text || placeholder].filter(Boolean).join(': ')}
                    accessibilityHint={error ?? accessibilityHint}
                    accessibilityState={{ disabled: !!disabled }}
                    style={({ pressed }) => [styles.press, compact ? styles.pressCompact : null, pressed ? styles.pressed : null]}
                    testID={testID}
                >
                    {compact ? null : <Ionicons name={icon} size={18} color={empty ? colors.text.tertiary : colors.tone.accent.fg} />}
                    <Text style={[styles.value, compact ? styles.valueCompact : null, empty ? styles.placeholder : null]} numberOfLines={1}>
                        {text || placeholder}
                    </Text>
                </Pressable>
                {onClear && !empty && !disabled ? (
                    <Pressable
                        onPress={onClear}
                        accessibilityRole="button"
                        accessibilityLabel={clearLabel}
                        style={styles.clear}
                        testID={testID ? `${testID}-clear` : undefined}
                    >
                        <Ionicons name="close-circle" size={18} color={colors.text.tertiary} />
                    </Pressable>
                ) : null}
            </View>
            {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}
            {hint && !error ? <Text style={styles.hint}>{hint}</Text> : null}
        </View>
    );
}

type DateFieldProps = {
    label?: string;
    /** `YYYY-MM-DD`, or '' when empty. */
    value: string;
    onChange: (value: string) => void;
    /** Earliest / latest allowed dates (`YYYY-MM-DD`). */
    minDate?: string;
    maxDate?: string;
    /** businesses.tz: "today" (the initial picker day of an empty field) is the business's today. */
    timeZone?: string | null;
    /** Show a clear button (an optional date). */
    clearable?: boolean;
    placeholder?: string;
    required?: boolean;
    hint?: string;
    error?: string;
    disabled?: boolean;
    /** Show the weekday in the label (default true). */
    weekday?: boolean;
    style?: StyleProp<ViewStyle>;
    testID?: string;
};

/** A business date picked from the native calendar, shown as "Ср, 26 ноября 2026". */
export function DateField({
    label, value, onChange, minDate, maxDate, timeZone, clearable, placeholder, required, hint, error, disabled, weekday = true, style, testID,
}: DateFieldProps) {
    const { t, locale } = useLanguage();
    const picker = useNativePicker();
    const today = businessTodayYmd(resolveBusinessTimeZone(timeZone));
    const start = isYmd(value) ? value : clampYmd(today, minDate, maxDate);
    return (
        <>
            <FieldShell
                label={label}
                required={required}
                hint={hint}
                error={error}
                icon="calendar-outline"
                text={isYmd(value) ? formatYmdLabel(value, locale, { weekday }) : ''}
                placeholder={placeholder ?? t('ui.date.placeholder')}
                onPress={() => picker.open({
                    mode: 'date',
                    value: ymdToPickerDate(start),
                    minimumDate: minDate && isYmd(minDate) ? ymdToPickerDate(minDate) : undefined,
                    maximumDate: maxDate && isYmd(maxDate) ? ymdToPickerDate(maxDate) : undefined,
                    onPick: (date) => onChange(clampYmd(pickerDateToYmd(date), minDate, maxDate)),
                })}
                onClear={clearable ? () => onChange('') : undefined}
                clearLabel={t('ui.picker.clear')}
                disabled={disabled}
                accessibilityHint={t('ui.date.openHint')}
                style={style}
                testID={testID}
            />
            {picker.sheet}
        </>
    );
}

type TimeFieldProps = {
    label?: string;
    /** `HH:MM`, or '' when empty. */
    value: string;
    onChange: (value: string) => void;
    minuteInterval?: 1 | 5 | 10 | 15 | 30;
    clearable?: boolean;
    placeholder?: string;
    required?: boolean;
    hint?: string;
    error?: string;
    disabled?: boolean;
    /** A small centered box (schedule rows: "09:00 – 18:00"); the label is then only read aloud. */
    compact?: boolean;
    style?: StyleProp<ViewStyle>;
    testID?: string;
};

/** A time of day (24-hour) picked from the native clock. */
export function TimeField({
    label, value, onChange, minuteInterval, clearable, placeholder, required, hint, error, disabled, compact, style, testID,
}: TimeFieldProps) {
    const { t } = useLanguage();
    const picker = useNativePicker();
    return (
        <>
            <FieldShell
                label={compact ? undefined : label}
                a11yLabel={label}
                required={required}
                hint={compact ? undefined : hint}
                error={error}
                icon="time-outline"
                text={isHm(value) ? value.padStart(5, '0') : ''}
                placeholder={placeholder ?? (compact ? '--:--' : t('ui.time.placeholder'))}
                onPress={() => picker.open({
                    mode: 'time',
                    value: hmToPickerDate(isHm(value) ? value : '09:00'),
                    minuteInterval,
                    onPick: (date) => onChange(pickerDateToHm(date)),
                })}
                onClear={clearable ? () => onChange('') : undefined}
                clearLabel={t('ui.picker.clear')}
                disabled={disabled}
                accessibilityHint={t('ui.time.openHint')}
                compact={compact}
                style={style}
                testID={testID}
            />
            {picker.sheet}
        </>
    );
}

/** A period: two DateFields side by side; the end cannot be before the start. */
export function DateRangeField({
    from, to, onChange, minDate, maxDate, timeZone, fromLabel, toLabel, clearable, disabled, error, testID,
}: {
    from: string;
    to: string;
    onChange: (range: { from: string; to: string }) => void;
    minDate?: string;
    maxDate?: string;
    timeZone?: string | null;
    fromLabel?: string;
    toLabel?: string;
    clearable?: boolean;
    disabled?: boolean;
    error?: string;
    testID?: string;
}) {
    const { t } = useLanguage();
    return (
        <View>
            <View style={styles.range}>
                <DateField
                    label={fromLabel ?? t('ui.dateRange.from')}
                    value={from}
                    onChange={(next) => onChange({ from: next, to: to && next && to < next ? next : to })}
                    minDate={minDate}
                    maxDate={maxDate}
                    timeZone={timeZone}
                    clearable={clearable}
                    disabled={disabled}
                    weekday={false}
                    style={styles.rangeCell}
                    testID={testID ? `${testID}-from` : undefined}
                />
                <DateField
                    label={toLabel ?? t('ui.dateRange.to')}
                    value={to}
                    onChange={(next) => onChange({ from, to: next })}
                    minDate={from && isYmd(from) ? from : minDate}
                    maxDate={maxDate}
                    timeZone={timeZone}
                    clearable={clearable}
                    disabled={disabled}
                    weekday={false}
                    style={styles.rangeCell}
                    testID={testID ? `${testID}-to` : undefined}
                />
            </View>
            {error ? <Text style={[styles.error, styles.rangeError]} accessibilityRole="alert">{error}</Text> : null}
        </View>
    );
}

/**
 * A day navigator: ‹ prev | the date (opens the calendar) | next › and a "Today" shortcut. For
 * screens where the website also steps day by day; elsewhere use DateField.
 */
export function DateNavigator({
    value, onChange, minDate, maxDate, timeZone, step = 1, format, disabled, label, testID,
}: {
    value: string;
    onChange: (value: string) => void;
    minDate?: string;
    maxDate?: string;
    timeZone?: string | null;
    /** Days per arrow step (7 for weeks). */
    step?: number;
    /** A custom label of the value (a month, a week range). */
    format?: (value: string) => string;
    disabled?: boolean;
    label?: string;
    testID?: string;
}) {
    const { t, locale } = useLanguage();
    const picker = useNativePicker();
    const today = businessTodayYmd(resolveBusinessTimeZone(timeZone));
    const previous = addDaysYmd(value, -step);
    const next = addDaysYmd(value, step);
    const canPrev = !disabled && (!minDate || previous >= minDate);
    const canNext = !disabled && (!maxDate || next <= maxDate);
    const text = format ? format(value) : formatYmdLabel(value, locale, { year: value.slice(0, 4) !== today.slice(0, 4) });
    return (
        <View style={styles.navigatorWrap} testID={testID}>
            {label ? <Text style={styles.label}>{label}</Text> : null}
            <View style={styles.navigator}>
                <Pressable
                    onPress={() => onChange(previous)}
                    disabled={!canPrev}
                    accessibilityRole="button"
                    accessibilityLabel={step === 1 ? t('ui.date.previousDay') : t('manageStaff.date.previous')}
                    style={[styles.navButton, !canPrev ? styles.navDisabled : null]}
                    testID={testID ? `${testID}-prev` : undefined}
                >
                    <Ionicons name="chevron-back" size={20} color={colors.text.primary} />
                </Pressable>
                <Pressable
                    onPress={() => picker.open({
                        mode: 'date',
                        value: ymdToPickerDate(isYmd(value) ? value : today),
                        minimumDate: minDate && isYmd(minDate) ? ymdToPickerDate(minDate) : undefined,
                        maximumDate: maxDate && isYmd(maxDate) ? ymdToPickerDate(maxDate) : undefined,
                        onPick: (date) => onChange(clampYmd(pickerDateToYmd(date), minDate, maxDate)),
                    })}
                    disabled={disabled}
                    accessibilityRole="button"
                    accessibilityLabel={text}
                    accessibilityHint={t('ui.date.openHint')}
                    accessibilityLiveRegion="polite"
                    style={({ pressed }) => [styles.navLabel, pressed ? styles.pressed : null]}
                    testID={testID ? `${testID}-open` : undefined}
                >
                    <Ionicons name="calendar-outline" size={16} color={colors.tone.accent.fg} />
                    <Text style={styles.navText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>{text}</Text>
                </Pressable>
                <Pressable
                    onPress={() => onChange(next)}
                    disabled={!canNext}
                    accessibilityRole="button"
                    accessibilityLabel={step === 1 ? t('ui.date.nextDay') : t('manageStaff.date.next')}
                    style={[styles.navButton, !canNext ? styles.navDisabled : null]}
                    testID={testID ? `${testID}-next` : undefined}
                >
                    <Ionicons name="chevron-forward" size={20} color={colors.text.primary} />
                </Pressable>
                {value !== today && (!minDate || today >= minDate) && (!maxDate || today <= maxDate) ? (
                    <Pressable
                        onPress={() => onChange(today)}
                        disabled={disabled}
                        accessibilityRole="button"
                        style={styles.todayChip}
                        testID={testID ? `${testID}-today` : undefined}
                    >
                        <Text style={styles.todayText}>{t('ui.date.today')}</Text>
                    </Pressable>
                ) : null}
            </View>
            {picker.sheet}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { marginBottom: space.lg, width: '100%' },
    label: { fontSize: 14, fontWeight: '500', color: colors.text.secondary, marginBottom: 6 },
    required: { color: colors.status.danger },
    box: {
        flexDirection: 'row',
        alignItems: 'center',
        minHeight: 48,
        borderWidth: 1,
        borderColor: colors.border.light,
        borderRadius: colors.layout.radiusMd,
        backgroundColor: colors.surface.card,
    },
    boxCompact: { minHeight: MIN_TOUCH_TARGET, minWidth: 84, justifyContent: 'center' },
    boxError: { borderColor: colors.status.danger },
    boxDisabled: { opacity: colors.interactive.disabledOpacity },
    press: {
        flex: 1,
        minHeight: 46,
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.sm,
        paddingHorizontal: space.lg,
    },
    pressCompact: { justifyContent: 'center', paddingHorizontal: space.md, minHeight: MIN_TOUCH_TARGET - 2 },
    pressed: { opacity: colors.interactive.pressedOpacity },
    value: { flex: 1, fontSize: 16, color: colors.text.primary },
    valueCompact: { flex: 0, textAlign: 'center', fontVariant: ['tabular-nums'] },
    placeholder: { color: colors.text.tertiary },
    clear: { width: MIN_TOUCH_TARGET, height: MIN_TOUCH_TARGET, alignItems: 'center', justifyContent: 'center' },
    error: { fontSize: 12, color: colors.status.danger, marginTop: 6 },
    hint: { fontSize: 12, color: colors.text.secondary, marginTop: 6 },
    range: { flexDirection: 'row', gap: space.md },
    rangeCell: { flex: 1, marginBottom: 0 },
    rangeError: { marginTop: space.sm },
    navigatorWrap: { gap: space.sm },
    navigator: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
    navButton: {
        width: MIN_TOUCH_TARGET,
        height: MIN_TOUCH_TARGET,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: radii.md,
        backgroundColor: colors.surface.card,
    },
    navDisabled: { opacity: 0.4 },
    navLabel: {
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
    navText: { ...typeScale.bodyStrong, color: colors.text.primary, flexShrink: 1 },
    todayChip: {
        minHeight: MIN_TOUCH_TARGET,
        justifyContent: 'center',
        paddingHorizontal: space.lg,
        borderRadius: radii.pill,
        backgroundColor: colors.tone.accent.bg,
    },
    todayText: { ...typeScale.callout, fontWeight: '600', color: colors.tone.accent.fg },
    sheet: {
        backgroundColor: colors.surface.card,
        borderTopLeftRadius: radii.xl,
        borderTopRightRadius: radii.xl,
        paddingBottom: space.xxxl,
        paddingHorizontal: layout.gutter,
    },
    backdrop: { flex: 1, backgroundColor: colors.surface.overlay },
    sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: space.sm },
    sheetButton: { minHeight: MIN_TOUCH_TARGET, justifyContent: 'center', paddingHorizontal: space.xs },
    sheetCancel: { ...typeScale.body, color: colors.text.secondary },
    sheetDone: { ...typeScale.bodyStrong, color: colors.tone.accent.fg },
});
