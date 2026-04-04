import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors } from '../../constants/colors';

type CardProps = {
    children: React.ReactNode;
    style?: StyleProp<ViewStyle>;
    variant?: 'elevated' | 'muted' | 'outlined';
    padding?: 'none' | 'sm' | 'md' | 'lg';
};

export default function Card({
    children,
    style,
    variant = 'elevated',
    padding = 'lg',
}: CardProps) {
    return (
        <View
            style={[
                styles.card,
                variant === 'muted' && styles.cardMuted,
                variant === 'outlined' && styles.cardOutlined,
                padding === 'none' && styles.paddingNone,
                padding === 'sm' && styles.paddingSm,
                padding === 'md' && styles.paddingMd,
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
    paddingNone: {
        padding: 0,
    },
    paddingSm: {
        padding: colors.layout.space4,
    },
    paddingMd: {
        padding: colors.layout.space5,
    },
});
