import type { ReactNode } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors } from '../../constants/colors';
import { MIN_TOUCH_TARGET } from '../../constants/accessibility';
import MotionPressable from './MotionPressable';

export type FeedbackBannerVariant = 'info' | 'success' | 'warning' | 'danger';

type FeedbackBannerProps = {
    variant?: FeedbackBannerVariant;
    title?: string;
    message: string;
    icon?: ReactNode;
    action?: ReactNode;
    onClose?: () => void;
    compact?: boolean;
    style?: StyleProp<ViewStyle>;
};

const variantConfig: Record<
    FeedbackBannerVariant,
    {
        icon: keyof typeof Ionicons.glyphMap;
        backgroundColor: string;
        borderColor: string;
        iconColor: string;
    }
> = {
    info: {
        icon: 'information-circle-outline',
        backgroundColor: colors.feedback.infoSurface,
        borderColor: colors.status.info,
        iconColor: colors.status.info,
    },
    success: {
        icon: 'checkmark-circle-outline',
        backgroundColor: colors.feedback.successSurface,
        borderColor: colors.status.success,
        iconColor: colors.status.success,
    },
    warning: {
        icon: 'alert-circle-outline',
        backgroundColor: colors.feedback.warningSurface,
        borderColor: colors.status.warning,
        iconColor: colors.status.warning,
    },
    danger: {
        icon: 'close-circle-outline',
        backgroundColor: colors.feedback.dangerSurface,
        borderColor: colors.status.danger,
        iconColor: colors.status.danger,
    },
};

export default function FeedbackBanner({
    variant = 'info',
    title,
    message,
    icon,
    action,
    onClose,
    compact = false,
    style,
}: FeedbackBannerProps) {
    const config = variantConfig[variant];

    return (
        <View
            accessibilityLiveRegion={variant === 'danger' ? 'assertive' : 'polite'}
            style={[
                styles.banner,
                compact && styles.bannerCompact,
                {
                    backgroundColor: config.backgroundColor,
                    borderColor: config.borderColor,
                },
                style,
            ]}
        >
            <View style={styles.row}>
                <View style={[styles.iconWrap, { backgroundColor: config.backgroundColor }]}>
                    {icon ?? <Ionicons name={config.icon} size={18} color={config.iconColor} />}
                </View>
                <View style={styles.content}>
                    {title ? <Text style={styles.title}>{title}</Text> : null}
                    <Text style={[styles.message, title ? styles.messageWithTitle : null]}>{message}</Text>
                    {action ? <View style={styles.action}>{action}</View> : null}
                </View>
                {onClose ? (
                    <MotionPressable
                        onPress={onClose}
                        style={styles.closeButton}
                        accessibilityLabel="Закрыть уведомление"
                        accessibilityHint="Скрывает это сообщение"
                    >
                        <Ionicons name="close" size={16} color={colors.text.secondary} />
                    </MotionPressable>
                ) : null}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    banner: {
        borderWidth: 1,
        borderRadius: colors.layout.radiusLg,
        paddingHorizontal: colors.layout.space4,
        paddingVertical: colors.layout.space3,
    },
    bannerCompact: {
        paddingVertical: colors.layout.space2,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: colors.layout.space3,
    },
    iconWrap: {
        width: 28,
        height: 28,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 1,
    },
    content: {
        flex: 1,
    },
    title: {
        fontSize: 13,
        fontWeight: '700',
        color: colors.text.primary,
    },
    message: {
        fontSize: 13,
        lineHeight: 18,
        color: colors.text.secondary,
    },
    messageWithTitle: {
        marginTop: 2,
    },
    action: {
        marginTop: colors.layout.space3,
    },
    closeButton: {
        width: MIN_TOUCH_TARGET,
        height: MIN_TOUCH_TARGET,
        borderRadius: colors.layout.radiusSm,
        alignItems: 'center',
        justifyContent: 'center',
    },
});
