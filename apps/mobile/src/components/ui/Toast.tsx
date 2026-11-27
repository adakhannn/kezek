import { View, Text, StyleSheet, Animated } from 'react-native';
import { useContext, useEffect, useRef } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';

import { colors } from '../../constants/colors';
import { motion } from '../../constants/motion';
import { elevation, layout, radii, space, typeScale } from '../../constants/theme';

type ToastProps = {
    message: string;
    type?: 'success' | 'error' | 'warning' | 'info';
    visible: boolean;
    onHide: () => void;
    duration?: number;
};

export default function Toast({ message, type = 'info', visible, onHide, duration = 3000 }: ToastProps) {
    const fadeAnim = useRef(new Animated.Value(0)).current;
    // Below the status bar / notch and inside the side cut-outs. Outside a SafeAreaProvider
    // (tests) there is no inset.
    const insets = useContext(SafeAreaInsetsContext) ?? { top: 0, bottom: 0, left: 0, right: 0 };

    useEffect(() => {
        if (visible) {
            fadeAnim.stopAnimation();
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: motion.durations.base,
                easing: motion.easing.emphasized,
                useNativeDriver: true,
            }).start();

            const timer = setTimeout(() => {
                Animated.timing(fadeAnim, {
                    toValue: 0,
                    duration: motion.durations.base,
                    easing: motion.easing.standard,
                    useNativeDriver: true,
                }).start(() => {
                    onHide();
                });
            }, duration);

            return () => clearTimeout(timer);
        }
    }, [visible, message, type, duration, fadeAnim, onHide]);

    if (!visible) return null;

    const config = {
        success: {
            icon: 'checkmark-circle' as const,
            backgroundColor: colors.feedback.successSurface,
            borderColor: colors.status.success,
            iconColor: colors.status.success,
            textColor: colors.text.primary,
        },
        error: {
            icon: 'alert-circle' as const,
            backgroundColor: colors.feedback.dangerSurface,
            borderColor: colors.status.danger,
            iconColor: colors.status.danger,
            textColor: colors.text.primary,
        },
        warning: {
            icon: 'warning' as const,
            backgroundColor: colors.feedback.warningSurface,
            borderColor: colors.status.warning,
            iconColor: colors.status.warning,
            textColor: colors.text.primary,
        },
        info: {
            icon: 'information-circle' as const,
            backgroundColor: colors.feedback.infoSurface,
            borderColor: colors.status.info,
            iconColor: colors.status.info,
            textColor: colors.text.primary,
        },
    }[type];

    return (
        <Animated.View
            accessibilityLiveRegion={type === 'error' ? 'assertive' : 'polite'}
            accessibilityRole={type === 'error' ? 'alert' : 'text'}
            style={[
                styles.container,
                {
                    top: insets.top + space.sm,
                    left: layout.gutter + insets.left,
                    right: layout.gutter + insets.right,
                    opacity: fadeAnim,
                    transform: [
                        {
                            translateY: fadeAnim.interpolate({
                                inputRange: [0, 1],
                                outputRange: [-motion.offsets.toastY, 0],
                            }),
                        },
                    ],
                },
            ]}
        >
            <View
                style={[
                    styles.toast,
                    {
                        backgroundColor: config.backgroundColor,
                        borderColor: config.borderColor,
                    },
                ]}
            >
                <Ionicons name={config.icon} size={20} color={config.iconColor} />
                <Text style={[styles.message, { color: config.textColor }]}>{message}</Text>
            </View>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        zIndex: 9999,
    },
    toast: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        padding: space.lg,
        borderRadius: radii.lg,
        ...elevation.floating,
    },
    message: {
        ...typeScale.callout,
        marginLeft: space.md,
        flex: 1,
    },
});
