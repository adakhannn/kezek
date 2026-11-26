import type { ReactNode } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Switch, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { MIN_TOUCH_TARGET } from '../../constants/accessibility';
import { colors } from '../../constants/colors';
import { radii, space, typeScale } from '../../constants/theme';

type BaseProps = {
    label: string;
    /** One muted line under the label. */
    hint?: string;
    disabled?: boolean;
    style?: StyleProp<ViewStyle>;
    testID?: string;
};

/** A checkbox with its label: the whole row toggles. Several in a list = multi-select. */
export function CheckboxRow({ label, hint, checked, onChange, disabled, leading, style, testID }: BaseProps & {
    checked: boolean;
    onChange: (checked: boolean) => void;
    /** An element between the box and the label (an Avatar of a master). */
    leading?: ReactNode;
}) {
    return (
        <Pressable
            onPress={() => onChange(!checked)}
            disabled={disabled}
            accessibilityRole="checkbox"
            accessibilityLabel={label}
            accessibilityHint={hint}
            accessibilityState={{ checked, disabled: !!disabled }}
            style={({ pressed }) => [styles.row, pressed ? styles.pressed : null, disabled ? styles.disabled : null, style]}
            testID={testID}
        >
            <View style={[styles.box, checked ? styles.boxChecked : null]}>
                {checked ? <Ionicons name="checkmark" size={16} color={colors.text.light} /> : null}
            </View>
            {leading}
            <View style={styles.text}>
                <Text style={styles.label}>{label}</Text>
                {hint ? <Text style={styles.hint}>{hint}</Text> : null}
            </View>
        </Pressable>
    );
}

/** One option of a single choice: a radio with its label. */
export function RadioRow({ label, hint, selected, onSelect, disabled, style, testID }: BaseProps & {
    selected: boolean;
    onSelect: () => void;
}) {
    return (
        <Pressable
            onPress={onSelect}
            disabled={disabled}
            accessibilityRole="radio"
            accessibilityLabel={label}
            accessibilityHint={hint}
            accessibilityState={{ checked: selected, selected, disabled: !!disabled }}
            style={({ pressed }) => [styles.row, pressed ? styles.pressed : null, disabled ? styles.disabled : null, style]}
            testID={testID}
        >
            <View style={[styles.radio, selected ? styles.radioSelected : null]}>
                {selected ? <View style={styles.radioDot} /> : null}
            </View>
            <View style={styles.text}>
                <Text style={styles.label}>{label}</Text>
                {hint ? <Text style={styles.hint}>{hint}</Text> : null}
            </View>
        </Pressable>
    );
}

/** A setting that is on or off, with its label: the whole row toggles. */
export function SwitchRow({ label, hint, value, onChange, disabled, style, testID }: BaseProps & {
    value: boolean;
    onChange: (value: boolean) => void;
}) {
    return (
        <Pressable
            onPress={() => onChange(!value)}
            disabled={disabled}
            accessibilityRole="switch"
            accessibilityLabel={label}
            accessibilityHint={hint}
            accessibilityState={{ checked: value, disabled: !!disabled }}
            style={({ pressed }) => [styles.row, pressed ? styles.pressed : null, disabled ? styles.disabled : null, style]}
            testID={testID}
        >
            <View style={styles.text}>
                <Text style={styles.label}>{label}</Text>
                {hint ? <Text style={styles.hint}>{hint}</Text> : null}
            </View>
            <Switch
                value={value}
                onValueChange={onChange}
                disabled={disabled}
                trackColor={{ true: colors.accent.primary, false: colors.fill.track }}
                thumbColor={colors.text.light}
                accessibilityElementsHidden
                importantForAccessibility="no"
            />
        </Pressable>
    );
}

const styles = StyleSheet.create({
    row: {
        minHeight: MIN_TOUCH_TARGET + 4,
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.md,
        paddingVertical: space.sm,
    },
    pressed: { opacity: colors.interactive.pressedOpacity },
    disabled: { opacity: colors.interactive.disabledOpacity },
    text: { flex: 1, gap: space.xxs },
    label: { ...typeScale.body, color: colors.text.primary },
    hint: { ...typeScale.caption, color: colors.text.secondary },
    box: {
        width: 22,
        height: 22,
        borderRadius: radii.xs,
        borderWidth: 2,
        borderColor: colors.border.strong,
        alignItems: 'center',
        justifyContent: 'center',
    },
    boxChecked: { backgroundColor: colors.accent.primary, borderColor: colors.accent.primary },
    radio: {
        width: 22,
        height: 22,
        borderRadius: 11,
        borderWidth: 2,
        borderColor: colors.border.strong,
        alignItems: 'center',
        justifyContent: 'center',
    },
    radioSelected: { borderColor: colors.accent.indigo },
    radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.accent.indigo },
});
