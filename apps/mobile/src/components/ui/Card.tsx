import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View, type StyleProp, type ViewProps, type ViewStyle } from 'react-native';

import { colors } from '../../constants/colors';
import { radii, space } from '../../constants/theme';

type CardProps = Omit<ViewProps, 'style'> & {
    children: React.ReactNode;
    style?: StyleProp<ViewStyle>;
    /**
     * plain: a filled surface without border (default for new screens, lists, groups);
     * elevated: the legacy bordered card with a shadow; outlined: a border on the page;
     * accent: the one highlighted block of a screen (brand gradient tint); muted: legacy raised fill.
     */
    variant?: 'plain' | 'elevated' | 'outlined' | 'accent' | 'muted';
    /** none 0, sm 12, md 16, lg 24 (legacy default). New screens use `md`. */
    padding?: 'none' | 'sm' | 'md' | 'lg';
};

/** One level of grouping only: never put a Card inside a Card (use ListRow/Section inside). */
export default function Card({
    children,
    style,
    variant = 'elevated',
    padding = 'lg',
    ...props
}: CardProps) {
    const paddingStyle = padding === 'none' ? styles.paddingNone
        : padding === 'sm' ? styles.paddingSm
            : padding === 'md' ? styles.paddingMd
                : null;
    if (variant === 'accent') {
        return (
            <View {...props} style={[styles.card, styles.cardAccent, paddingStyle, style]}>
                <LinearGradient
                    colors={colors.gradient.accentSoft}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={StyleSheet.absoluteFill}
                    pointerEvents="none"
                />
                {children}
            </View>
        );
    }
    return (
        <View
            {...props}
            style={[
                styles.card,
                variant === 'plain' && styles.cardPlain,
                variant === 'muted' && styles.cardMuted,
                variant === 'outlined' && styles.cardOutlined,
                paddingStyle,
                style,
            ]}
        >
            {children}
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        backgroundColor: colors.surface.card,
        borderRadius: colors.layout.radiusLg,
        padding: colors.layout.space6,
        borderWidth: 1,
        borderColor: colors.border.subtle,
        ...colors.shadow.lg,
    },
    cardPlain: {
        borderWidth: 0,
        borderRadius: radii.lg,
        shadowOpacity: 0,
        elevation: 0,
    },
    cardMuted: {
        backgroundColor: colors.surface.elevated,
        borderColor: colors.border.light,
        ...colors.shadow.sm,
    },
    cardOutlined: {
        backgroundColor: 'transparent',
        borderColor: colors.border.light,
        ...colors.shadow.sm,
    },
    cardAccent: {
        overflow: 'hidden',
        borderColor: colors.tone.accent.border,
        shadowOpacity: 0,
        elevation: 0,
    },
    paddingNone: {
        padding: 0,
    },
    paddingSm: {
        padding: space.md,
    },
    paddingMd: {
        padding: space.lg,
    },
});
