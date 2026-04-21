import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors } from '../../constants/colors';
import Button from './Button';

export const OFFLINE_BANNER_DEFAULT = {
    title: 'Нет подключения к интернету',
    messageGeneric:
        'Список обновится автоматически, когда сеть появится. Попробуйте потянуть вниз для обновления.',
    messageWithRetry:
        'Мы не можем загрузить данные. Проверьте сеть и нажмите «Обновить», когда соединение восстановится.',
} as const;

type OfflineBannerProps = {
    title?: string;
    message?: string;
    onRetry?: () => void;
    style?: StyleProp<ViewStyle>;
    compact?: boolean;
};

export default function OfflineBanner({
    title = OFFLINE_BANNER_DEFAULT.title,
    message,
    onRetry,
    style,
    compact = false,
}: OfflineBannerProps) {
    const displayMessage =
        message ??
        (onRetry != null ? OFFLINE_BANNER_DEFAULT.messageWithRetry : OFFLINE_BANNER_DEFAULT.messageGeneric);

    return (
        <View style={[styles.banner, compact && styles.bannerCompact, style]}>
            <View style={styles.iconWrap}>
                <Ionicons name="cloud-offline-outline" size={18} color={colors.status.warning} />
            </View>
            <View style={styles.content}>
                <Text style={styles.title}>{title}</Text>
                <Text style={styles.message}>{displayMessage}</Text>
                {onRetry ? (
                    <View style={styles.actions}>
                        <Button title="Обновить" onPress={onRetry} variant="outline" size="sm" />
                    </View>
                ) : null}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    banner: {
        marginBottom: colors.layout.space4,
        paddingHorizontal: colors.layout.space4,
        paddingVertical: colors.layout.space3,
        borderRadius: colors.layout.radiusLg,
        backgroundColor: colors.feedback.warningSurface,
        borderWidth: 1,
        borderColor: colors.status.warning,
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: colors.layout.space3,
    },
    bannerCompact: {
        paddingVertical: colors.layout.space2,
    },
    iconWrap: {
        width: 28,
        height: 28,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(245, 158, 11, 0.12)',
        marginTop: 1,
    },
    content: {
        flex: 1,
    },
    title: {
        fontSize: 13,
        fontWeight: '700',
        color: colors.text.primary,
        marginBottom: 2,
    },
    message: {
        fontSize: 12,
        lineHeight: 18,
        color: colors.text.secondary,
    },
    actions: {
        marginTop: colors.layout.space3,
        flexDirection: 'row',
    },
});
