import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { colors } from '../../constants/colors';
import Button from './Button';
import FeedbackBanner from './FeedbackBanner';

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
        <FeedbackBanner
            variant="warning"
            title={title}
            message={displayMessage}
            compact={compact}
            style={[styles.banner, style]}
            action={
                onRetry ? (
                    <Button
                        title="Обновить"
                        onPress={onRetry}
                        variant="outline"
                        size="sm"
                        accessibilityHint="Повторяет загрузку данных"
                    />
                ) : undefined
            }
        />
    );
}

const styles = StyleSheet.create({
    banner: {
        marginBottom: colors.layout.space4,
    },
});
