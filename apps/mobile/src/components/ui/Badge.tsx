import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors } from '../../constants/colors';
import { radii, space, type Tone } from '../../constants/theme';

type BadgeProps = {
    label: string;
    tone?: Tone;
    /** A small leading icon (Ionicons name). */
    icon?: keyof typeof Ionicons.glyphMap;
    size?: 'sm' | 'md';
    style?: StyleProp<ViewStyle>;
    testID?: string;
};

/** A short label on a tinted pill: a count, a role, a state ("Владелец", "3", "Новая"). */
export default function Badge({ label, tone = 'neutral', icon, size = 'sm', style, testID }: BadgeProps) {
    const palette = colors.tone[tone];
    return (
        <View style={[styles.badge, size === 'md' ? styles.badgeMd : null, { backgroundColor: palette.bg }, style]} testID={testID}>
            {icon ? <Ionicons name={icon} size={size === 'md' ? 14 : 12} color={palette.fg} /> : null}
            <Text style={[styles.text, size === 'md' ? styles.textMd : null, { color: palette.fg }]} numberOfLines={1}>{label}</Text>
        </View>
    );
}

/** The state of a record with a colored dot: active / inactive, confirmed / cancelled. */
export function StatusPill({ label, tone = 'neutral', style, testID }: Omit<BadgeProps, 'icon' | 'size'>) {
    const palette = colors.tone[tone];
    return (
        <View
            style={[styles.badge, styles.pill, { backgroundColor: palette.bg, borderColor: palette.border }, style]}
            accessible
            accessibilityLabel={label}
            testID={testID}
        >
            <View style={[styles.dot, { backgroundColor: palette.fg }]} />
            <Text style={[styles.text, { color: palette.fg }]} numberOfLines={1}>{label}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    badge: {
        alignSelf: 'flex-start',
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.xs,
        paddingHorizontal: space.sm,
        paddingVertical: 3,
        borderRadius: radii.pill,
    },
    badgeMd: { paddingHorizontal: space.md, paddingVertical: 5 },
    pill: { borderWidth: 1, paddingVertical: 2 },
    dot: { width: 6, height: 6, borderRadius: 3 },
    text: { fontSize: 12, lineHeight: 16, fontWeight: '600' },
    textMd: { fontSize: 13, lineHeight: 17 },
});
