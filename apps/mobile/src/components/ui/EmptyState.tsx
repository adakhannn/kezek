import type { ReactNode } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors } from '../../constants/colors';

type EmptyStateProps = {
    icon?: keyof typeof Ionicons.glyphMap;
    title: string;
    message?: string;
    action?: ReactNode;
    compact?: boolean;
    style?: StyleProp<ViewStyle>;
};

export default function EmptyState({
    icon = 'document-text',
    title,
    message,
    action,
    compact = false,
    style,
}: EmptyStateProps) {
    return (
        <View style={[styles.container, compact && styles.containerCompact, style]}>
            <View
                accessible
                accessibilityRole="text"
                accessibilityLabel={[title, message].filter(Boolean).join('. ')}
                style={styles.summary}
            >
                <View
                    importantForAccessibility="no"
                    style={[styles.iconWrap, compact && styles.iconWrapCompact]}
                >
                    <Ionicons name={icon} size={compact ? 28 : 32} color={colors.text.secondary} />
                </View>
                <Text importantForAccessibility="no" style={[styles.title, compact && styles.titleCompact]}>
                    {title}
                </Text>
                {message ? <Text importantForAccessibility="no" style={styles.message}>{message}</Text> : null}
            </View>
            {action ? <View style={styles.action}>{action}</View> : null}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        justifyContent: 'center',
        alignItems: 'center',
        padding: colors.layout.space8,
    },
    containerCompact: {
        paddingVertical: colors.layout.space6,
        paddingHorizontal: colors.layout.space5,
    },
    summary: {
        alignItems: 'center',
    },
    iconWrap: {
        width: 72,
        height: 72,
        borderRadius: 36,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.surface.elevated,
        borderWidth: 1,
        borderColor: colors.border.subtle,
    },
    iconWrapCompact: {
        width: 64,
        height: 64,
        borderRadius: 32,
    },
    title: {
        marginTop: colors.layout.space4,
        fontSize: 18,
        fontWeight: '600',
        color: colors.text.primary,
        textAlign: 'center',
    },
    titleCompact: {
        fontSize: 16,
    },
    message: {
        marginTop: colors.layout.space2,
        fontSize: 14,
        lineHeight: 20,
        color: colors.text.secondary,
        textAlign: 'center',
    },
    action: {
        marginTop: colors.layout.space4,
        width: '100%',
    },
});
