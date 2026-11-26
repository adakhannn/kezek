import { useEffect, useRef } from 'react';
import { AccessibilityInfo, Animated, StyleSheet, View, type DimensionValue, type StyleProp, type ViewStyle } from 'react-native';

import { colors } from '../../constants/colors';
import { radii, space } from '../../constants/theme';

/** One pulsing placeholder block. Respects "reduce motion" (no pulse). */
export function SkeletonBlock({ width = '100%', height = 14, radius = radii.sm, style }: {
    width?: DimensionValue;
    height?: number;
    radius?: number;
    style?: StyleProp<ViewStyle>;
}) {
    const opacity = useRef(new Animated.Value(0.55)).current;
    useEffect(() => {
        let loop: Animated.CompositeAnimation | null = null;
        let cancelled = false;
        void AccessibilityInfo.isReduceMotionEnabled?.().then((reduce) => {
            if (cancelled || reduce) return;
            loop = Animated.loop(Animated.sequence([
                Animated.timing(opacity, { toValue: 1, duration: 650, useNativeDriver: true }),
                Animated.timing(opacity, { toValue: 0.55, duration: 650, useNativeDriver: true }),
            ]));
            loop.start();
        }).catch(() => undefined);
        return () => {
            cancelled = true;
            loop?.stop();
        };
    }, [opacity]);
    return <Animated.View style={[{ width, height, borderRadius: radius, backgroundColor: colors.fill.skeleton, opacity }, style]} />;
}

/** Placeholder of a list while it loads: `rows` lines with an avatar and two text lines. */
export function SkeletonList({ rows = 4, avatar = true, testID }: { rows?: number; avatar?: boolean; testID?: string }) {
    return (
        <View style={styles.group} accessibilityRole="progressbar" accessibilityLabel="…" testID={testID}>
            {Array.from({ length: rows }, (_, index) => (
                <View key={index} style={styles.row}>
                    {avatar ? <SkeletonBlock width={40} height={40} radius={20} /> : null}
                    <View style={styles.lines}>
                        <SkeletonBlock width="62%" height={14} />
                        <SkeletonBlock width="38%" height={12} />
                    </View>
                </View>
            ))}
        </View>
    );
}

/** Placeholder of a card (a summary block or a form section). */
export function SkeletonCard({ lines = 3, testID }: { lines?: number; testID?: string }) {
    return (
        <View style={[styles.group, styles.card]} accessibilityRole="progressbar" accessibilityLabel="…" testID={testID}>
            <SkeletonBlock width="45%" height={16} />
            {Array.from({ length: lines }, (_, index) => (
                <SkeletonBlock key={index} width={index === lines - 1 ? '70%' : '100%'} height={12} />
            ))}
        </View>
    );
}

const styles = StyleSheet.create({
    group: { backgroundColor: colors.surface.card, borderRadius: radii.lg, paddingHorizontal: space.lg },
    card: { paddingVertical: space.lg, gap: space.md },
    row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md },
    lines: { flex: 1, gap: space.sm },
});
