import type { ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, Text, View, type TextStyle, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { colors } from '../../constants/colors';
import MotionPressable from './MotionPressable';

type ButtonProps = {
    title: string;
    onPress: () => void;
    variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
    size?: 'sm' | 'md' | 'lg';
    loading?: boolean;
    disabled?: boolean;
    fullWidth?: boolean;
    leadingIcon?: ReactNode;
    trailingIcon?: ReactNode;
    style?: ViewStyle;
    textStyle?: TextStyle;
};

export default function Button({
    title,
    onPress,
    variant = 'primary',
    size = 'md',
    loading = false,
    disabled = false,
    fullWidth = false,
    leadingIcon,
    trailingIcon,
    style,
    textStyle,
}: ButtonProps) {
    const isDisabled = disabled || loading;
    const sizeStyle = size === 'sm' ? styles.buttonSm : size === 'lg' ? styles.buttonLg : styles.buttonMd;
    const textSizeStyle = size === 'sm' ? styles.textSm : size === 'lg' ? styles.textLg : styles.textMd;

    const textStyles = [
        styles.text,
        textSizeStyle,
        variant === 'primary' && styles.primaryText,
        variant === 'secondary' && styles.secondaryText,
        variant === 'outline' && styles.outlineText,
        variant === 'ghost' && styles.ghostText,
        variant === 'danger' && styles.dangerText,
        textStyle,
    ];

    const content = (
        <View style={styles.content}>
            {loading ? (
                <ActivityIndicator color={variant === 'primary' || variant === 'danger' ? colors.text.light : colors.accent.primary} />
            ) : leadingIcon ? (
                <View style={styles.iconWrap}>{leadingIcon}</View>
            ) : null}
            <Text style={textStyles}>{title}</Text>
            {!loading && trailingIcon ? <View style={styles.iconWrap}>{trailingIcon}</View> : null}
        </View>
    );

    if (variant === 'primary') {
        return (
            <MotionPressable
                onPress={onPress}
                disabled={isDisabled}
                style={[
                    styles.primaryContainer,
                    sizeStyle,
                    fullWidth && styles.fullWidth,
                    isDisabled && styles.disabled,
                    style,
                ]}
            >
                <LinearGradient
                    colors={[colors.brand.primaryFrom, colors.brand.primaryTo]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={[styles.gradient, sizeStyle]}
                >
                    {content}
                </LinearGradient>
            </MotionPressable>
        );
    }

    const buttonStyle = [
        styles.button,
        sizeStyle,
        fullWidth && styles.fullWidth,
        variant === 'secondary' && styles.secondary,
        variant === 'outline' && styles.outline,
        variant === 'ghost' && styles.ghost,
        variant === 'danger' && styles.danger,
        isDisabled && styles.disabled,
        style,
    ];

    return (
        <MotionPressable style={buttonStyle} onPress={onPress} disabled={isDisabled}>
            {content}
        </MotionPressable>
    );
}

const styles = StyleSheet.create({
    button: {
        borderRadius: colors.layout.radiusMd,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: colors.layout.space6,
    },
    buttonSm: {
        minHeight: 40,
        paddingVertical: 10,
    },
    buttonMd: {
        minHeight: 48,
        paddingVertical: 14,
    },
    buttonLg: {
        minHeight: 54,
        paddingVertical: 16,
    },
    fullWidth: {
        width: '100%',
    },
    primaryContainer: {
        borderRadius: colors.layout.radiusMd,
        overflow: 'hidden',
        ...colors.shadow.md,
    },
    gradient: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: colors.layout.space6,
    },
    secondary: {
        backgroundColor: colors.surface.emphasis,
        borderWidth: 1,
        borderColor: colors.border.subtle,
    },
    outline: {
        backgroundColor: 'transparent',
        borderWidth: 1,
        borderColor: colors.border.light,
    },
    ghost: {
        backgroundColor: 'transparent',
    },
    danger: {
        backgroundColor: colors.status.danger,
        ...colors.shadow.sm,
    },
    disabled: {
        opacity: colors.interactive.disabledOpacity,
    },
    content: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: colors.layout.space2,
    },
    iconWrap: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    text: {
        fontWeight: '600',
    },
    textSm: {
        fontSize: 14,
    },
    textMd: {
        fontSize: 16,
    },
    textLg: {
        fontSize: 17,
    },
    primaryText: {
        color: colors.text.light,
    },
    secondaryText: {
        color: colors.text.primary,
    },
    outlineText: {
        color: colors.text.primary,
    },
    ghostText: {
        color: colors.text.secondary,
    },
    dangerText: {
        color: colors.text.light,
    },
});
