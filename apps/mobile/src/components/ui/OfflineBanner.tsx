import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../constants/colors';
import Button from './Button';

/** Тексты по умолчанию для единообразного отображения офлайна */
export const OFFLINE_BANNER_DEFAULT = {
    title: 'Нет подключения к интернету',
    messageGeneric:
        'Список обновится автоматически, когда сеть появится. Попробуйте потянуть вниз для обновления.',
    messageWithRetry:
        'Мы не можем загрузить данные. Проверьте сеть и нажмите «Обновить», когда соединение восстановится.',
} as const;

type OfflineBannerProps = {
    /** Заголовок баннера (по умолчанию — общий) */
    title?: string;
    /** Текст под заголовком. Если передан onRetry, по умолчанию используется messageWithRetry */
    message?: string;
    /** При нажатии показывается кнопка «Обновить» */
    onRetry?: () => void;
    /** Дополнительные стили контейнера */
    style?: object;
};

/**
 * Единый баннер «нет сети» для экранов.
 * Используется с useNetworkStatus().isOffline или комбинацией isOffline + hasNetworkError.
 */
export default function OfflineBanner({
    title = OFFLINE_BANNER_DEFAULT.title,
    message,
    onRetry,
    style,
}: OfflineBannerProps) {
    const displayMessage =
        message ??
        (onRetry != null
            ? OFFLINE_BANNER_DEFAULT.messageWithRetry
            : OFFLINE_BANNER_DEFAULT.messageGeneric);
    return (
        <View style={[styles.offlineBanner, style]}>
            <Ionicons name="cloud-offline-outline" size={18} color={colors.text.secondary} />
            <View style={styles.content}>
                <Text style={styles.offlineTitle}>{title}</Text>
                <Text style={styles.offlineText}>{displayMessage}</Text>
                {onRetry != null && (
                    <View style={styles.offlineActions}>
                        <Button
                            title="Обновить"
                            onPress={onRetry}
                            variant="outline"
                            style={styles.offlineRetryButton}
                        />
                    </View>
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    offlineBanner: {
        marginBottom: 16,
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderRadius: 12,
        backgroundColor: colors.background.secondary,
        borderWidth: 1,
        borderColor: colors.border.light,
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 10,
    },
    content: {
        flex: 1,
    },
    offlineTitle: {
        fontSize: 13,
        fontWeight: '600',
        color: colors.text.primary,
        marginBottom: 2,
    },
    offlineText: {
        fontSize: 12,
        color: colors.text.secondary,
    },
    offlineActions: {
        marginTop: 8,
        flexDirection: 'row',
        gap: 8,
    },
    offlineRetryButton: {
        flex: 0,
    },
});
