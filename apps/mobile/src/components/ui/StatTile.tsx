import { Children, type ReactNode } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors } from '../../constants/colors';
import { radii, space, typeScale, type Tone } from '../../constants/theme';

type StatTileProps = {
    label: string;
    value: string;
    /** A secondary line under the value ("+12% к прошлой неделе"). */
    hint?: string;
    /** Colors the value (and the icon). Neutral by default. */
    tone?: Tone;
    icon?: keyof typeof Ionicons.glyphMap;
    onPress?: () => void;
    style?: StyleProp<ViewStyle>;
    testID?: string;
};

/** One number with its caption: a KPI of a dashboard or a list summary. */
export default function StatTile({ label, value, hint, tone, icon, onPress, style, testID }: StatTileProps) {
    const valueColor = tone && tone !== 'neutral' ? colors.tone[tone].fg : colors.text.primary;
    const body = (
        <>
            <View style={styles.top}>
                {icon ? <Ionicons name={icon} size={16} color={tone ? colors.tone[tone].fg : colors.text.secondary} /> : null}
                <Text style={styles.label} numberOfLines={1}>{label}</Text>
            </View>
            <Text style={[styles.value, { color: valueColor }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{value}</Text>
            {hint ? <Text style={styles.hint} numberOfLines={2}>{hint}</Text> : null}
        </>
    );
    const a11y = [label, value, hint].filter(Boolean).join(', ');
    if (onPress) {
        return (
            <Pressable
                onPress={onPress}
                accessibilityRole="button"
                accessibilityLabel={a11y}
                style={({ pressed }) => [styles.tile, pressed ? styles.pressed : null, style]}
                testID={testID}
            >
                {body}
            </Pressable>
        );
    }
    return (
        <View style={[styles.tile, style]} accessible accessibilityLabel={a11y} testID={testID}>
            {body}
        </View>
    );
}

/** Tiles in a grid of 2 (default) or 3 columns; an odd last tile takes the full row. */
export function StatGrid({ children, columns = 2, style, testID }: {
    children: ReactNode;
    columns?: 2 | 3;
    style?: StyleProp<ViewStyle>;
    testID?: string;
}) {
    const items = Children.toArray(children);
    const basis = columns === 3 ? '30%' : '46%';
    return (
        <View style={[styles.grid, style]} testID={testID}>
            {items.map((child, index) => (
                <View key={index} style={{ flexGrow: 1, flexBasis: basis }}>{child}</View>
            ))}
        </View>
    );
}

const styles = StyleSheet.create({
    tile: {
        flex: 1,
        minHeight: 84,
        padding: space.md,
        borderRadius: radii.lg,
        backgroundColor: colors.surface.card,
        gap: space.xs,
        justifyContent: 'space-between',
    },
    pressed: { opacity: colors.interactive.pressedOpacity },
    top: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
    label: { ...typeScale.caption, color: colors.text.secondary, flexShrink: 1 },
    value: { ...typeScale.metric },
    hint: { ...typeScale.caption, color: colors.text.tertiary },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
