import { Ionicons } from '@expo/vector-icons';
import { Pressable, ScrollView, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { MIN_TOUCH_TARGET } from '../../constants/accessibility';
import { colors } from '../../constants/colors';
import { layout, radii, space } from '../../constants/theme';

export type ChipItem<T extends string> = { key: T; label: string; count?: number };

type CommonProps<T extends string> = {
    options: readonly ChipItem<T>[];
    accessibilityLabel?: string;
    disabled?: boolean;
    /** wrap: rows under each other (a short fixed set in a form); scroll (default): one line. */
    layout?: 'scroll' | 'wrap';
    style?: StyleProp<ViewStyle>;
    testID?: string;
};

type SingleProps<T extends string> = CommonProps<T> & {
    multiple?: false;
    value: T | null;
    onChange: (value: T) => void;
};

type MultiProps<T extends string> = CommonProps<T> & {
    multiple: true;
    value: readonly T[];
    onChange: (value: T[]) => void;
};

/**
 * Filters and small choices as chips. One line that scrolls sideways (bleeding to the screen
 * edges) so chips never wrap into ragged rows; the selected chip is filled with the accent and
 * carries a check mark.
 */
export default function ChipGroup<T extends string>(props: SingleProps<T> | MultiProps<T>) {
    const { options, accessibilityLabel, disabled, style, testID } = props;
    const isSelected = (key: T) => props.multiple ? props.value.includes(key) : props.value === key;
    const toggle = (key: T) => {
        if (props.multiple) {
            const next = props.value.includes(key) ? props.value.filter((v) => v !== key) : [...props.value, key];
            props.onChange(next);
        } else {
            props.onChange(key);
        }
    };

    const chips = options.map((option) => {
        const selected = isSelected(option.key);
        return (
            <Pressable
                key={option.key}
                onPress={() => toggle(option.key)}
                disabled={disabled}
                accessibilityRole={props.multiple ? 'checkbox' : 'radio'}
                accessibilityState={props.multiple ? { checked: selected, disabled: !!disabled } : { selected, checked: selected, disabled: !!disabled }}
                accessibilityLabel={option.count != null ? `${option.label}, ${option.count}` : option.label}
                style={({ pressed }) => [
                    styles.chip,
                    selected ? styles.chipSelected : null,
                    pressed ? styles.pressed : null,
                    disabled ? styles.disabled : null,
                ]}
                testID={testID ? `${testID}-${option.key}` : undefined}
            >
                {selected ? <Ionicons name="checkmark" size={16} color={colors.text.light} /> : null}
                <Text style={[styles.text, selected ? styles.textSelected : null]} numberOfLines={1}>{option.label}</Text>
                {option.count != null ? (
                    <View style={[styles.count, selected ? styles.countSelected : null]}>
                        <Text style={[styles.countText, selected ? styles.textSelected : null]}>{option.count}</Text>
                    </View>
                ) : null}
            </Pressable>
        );
    });

    if (props.layout === 'wrap') {
        return (
            <View style={[styles.wrap, style]} accessibilityRole={props.multiple ? undefined : 'radiogroup'} accessibilityLabel={accessibilityLabel} testID={testID}>
                {chips}
            </View>
        );
    }
    return (
        <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={[styles.bleed, style]}
            contentContainerStyle={styles.row}
            accessibilityRole={props.multiple ? undefined : 'radiogroup'}
            accessibilityLabel={accessibilityLabel}
            testID={testID}
        >
            {chips}
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    bleed: { marginHorizontal: -layout.gutter, flexGrow: 0 },
    row: { paddingHorizontal: layout.gutter, gap: space.sm },
    wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
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
    pressed: { opacity: colors.interactive.pressedOpacity },
    disabled: { opacity: colors.interactive.disabledOpacity },
    text: { fontSize: 14, fontWeight: '500', color: colors.text.secondary },
    textSelected: { color: colors.text.light, fontWeight: '600' },
    count: { minWidth: 20, paddingHorizontal: 6, borderRadius: radii.pill, backgroundColor: colors.fill.track, alignItems: 'center' },
    countSelected: { backgroundColor: 'rgba(255,255,255,0.22)' },
    countText: { fontSize: 12, lineHeight: 18, fontWeight: '600', color: colors.text.secondary },
});
