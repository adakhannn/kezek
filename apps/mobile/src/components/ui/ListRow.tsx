import { Children, Fragment, isValidElement, type ReactNode } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Switch, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { MIN_TOUCH_TARGET } from '../../constants/accessibility';
import { colors } from '../../constants/colors';
import { radii, space, typeScale, type Tone } from '../../constants/theme';

type IconName = keyof typeof Ionicons.glyphMap;

type ListRowProps = {
    title: string;
    subtitle?: string;
    /** A leading Ionicons glyph in a tinted square, or any element (an Avatar). */
    icon?: IconName;
    iconTone?: Tone;
    leading?: ReactNode;
    /** Short text on the right ("12", "1 500 сом", "Вкл."). */
    value?: string;
    /** Any element on the right (a Badge). */
    trailing?: ReactNode;
    /** Show a chevron: the row opens another screen. Defaults to true when `onPress` is set and no switch. */
    chevron?: boolean;
    /** Turns the row into a switch row: the whole row toggles. */
    switchValue?: boolean;
    onSwitchChange?: (value: boolean) => void;
    onPress?: () => void;
    disabled?: boolean;
    destructive?: boolean;
    accessibilityHint?: string;
    numberOfLines?: number;
    style?: StyleProp<ViewStyle>;
    testID?: string;
};

/**
 * One line of a list or a settings group: icon, title, subtitle, and a value, badge, chevron or
 * switch on the right. Put rows in a ListGroup (one card with separators), never each in a card.
 */
export default function ListRow({
    title,
    subtitle,
    icon,
    iconTone = 'accent',
    leading,
    value,
    trailing,
    chevron,
    switchValue,
    onSwitchChange,
    onPress,
    disabled,
    destructive,
    accessibilityHint,
    numberOfLines = 1,
    style,
    testID,
}: ListRowProps) {
    const isSwitch = typeof switchValue === 'boolean' && !!onSwitchChange;
    const press = isSwitch ? () => onSwitchChange!(!switchValue) : onPress;
    const showChevron = chevron ?? (!!onPress && !isSwitch);
    const tone = colors.tone[destructive ? 'danger' : iconTone];

    const content = (
        <>
            {leading ?? (icon ? (
                <View style={[styles.icon, { backgroundColor: tone.bg }]}>
                    <Ionicons name={icon} size={18} color={tone.fg} />
                </View>
            ) : null)}
            <View style={styles.body}>
                <Text style={[styles.title, destructive ? styles.titleDanger : null]} numberOfLines={numberOfLines}>{title}</Text>
                {subtitle ? <Text style={styles.subtitle} numberOfLines={2}>{subtitle}</Text> : null}
            </View>
            {value ? <Text style={styles.value} numberOfLines={1}>{value}</Text> : null}
            {trailing}
            {isSwitch ? (
                <Switch
                    value={switchValue}
                    onValueChange={onSwitchChange}
                    disabled={disabled}
                    trackColor={{ true: colors.accent.primary, false: colors.fill.track }}
                    thumbColor={colors.text.light}
                    accessibilityElementsHidden
                    importantForAccessibility="no"
                />
            ) : null}
            {showChevron ? <Ionicons name="chevron-forward" size={18} color={colors.text.tertiary} /> : null}
        </>
    );

    if (!press) {
        return (
            <View
                style={[styles.row, style]}
                accessible
                accessibilityLabel={[title, subtitle, value].filter(Boolean).join(', ')}
                testID={testID}
            >
                {content}
            </View>
        );
    }
    return (
        <Pressable
            onPress={press}
            disabled={disabled}
            accessibilityRole={isSwitch ? 'switch' : 'button'}
            accessibilityState={isSwitch ? { checked: switchValue, disabled: !!disabled } : { disabled: !!disabled }}
            accessibilityLabel={[title, subtitle, value].filter(Boolean).join(', ')}
            accessibilityHint={accessibilityHint}
            style={({ pressed }) => [styles.row, pressed ? styles.pressed : null, disabled ? styles.disabled : null, style]}
            testID={testID}
        >
            {content}
        </Pressable>
    );
}

/**
 * A card of rows with hairline separators between them: settings, menus, short lists.
 * `inset` indents the separators past the row icon.
 */
export function ListGroup({ children, inset = false, style, testID }: {
    children: ReactNode;
    inset?: boolean;
    style?: StyleProp<ViewStyle>;
    testID?: string;
}) {
    const items = Children.toArray(children).filter(isValidElement);
    return (
        <View style={[styles.group, style]} testID={testID}>
            {items.map((child, index) => (
                <Fragment key={child.key ?? index}>
                    {index > 0 ? <View style={[styles.separator, inset ? styles.separatorInset : null]} /> : null}
                    {child}
                </Fragment>
            ))}
        </View>
    );
}

/** A label and its value on one line (details of a booking, a payout, a card). */
export function KeyValueRow({ label, value, emphasis, tone, testID }: {
    label: string;
    value: string;
    /** Bold value (a total). */
    emphasis?: boolean;
    tone?: Tone;
    testID?: string;
}) {
    return (
        <View style={styles.kv} accessible accessibilityLabel={`${label}: ${value}`} testID={testID}>
            <Text style={styles.kvLabel} numberOfLines={2}>{label}</Text>
            <Text
                style={[styles.kvValue, emphasis ? styles.kvValueStrong : null, tone ? { color: colors.tone[tone].fg } : null]}
                numberOfLines={2}
            >
                {value}
            </Text>
        </View>
    );
}

const styles = StyleSheet.create({
    group: {
        backgroundColor: colors.surface.card,
        borderRadius: radii.lg,
        paddingHorizontal: space.lg,
        overflow: 'hidden',
    },
    row: {
        minHeight: 56,
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.md,
        paddingVertical: space.md,
    },
    pressed: { opacity: colors.interactive.pressedOpacity },
    disabled: { opacity: colors.interactive.disabledOpacity },
    icon: {
        width: 36,
        height: 36,
        borderRadius: radii.md,
        alignItems: 'center',
        justifyContent: 'center',
    },
    body: { flex: 1, minWidth: 0, gap: space.xxs },
    title: { ...typeScale.bodyStrong, color: colors.text.primary },
    titleDanger: { color: colors.tone.danger.fg },
    subtitle: { ...typeScale.caption, color: colors.text.secondary },
    value: { ...typeScale.callout, color: colors.text.secondary, maxWidth: '45%' },
    separator: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border.subtle },
    separatorInset: { marginLeft: 48 },
    kv: {
        minHeight: MIN_TOUCH_TARGET - 8,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: space.lg,
        paddingVertical: space.sm,
    },
    kvLabel: { ...typeScale.body, color: colors.text.secondary, flexShrink: 1 },
    kvValue: { ...typeScale.body, color: colors.text.primary, textAlign: 'right', flexShrink: 1 },
    kvValueStrong: { fontWeight: '700' },
});
