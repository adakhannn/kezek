import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { colors } from '../../constants/colors';
import { useLanguage, type MobileI18nKey } from '../../i18n';
import Button from './Button';
import FeedbackBanner from './FeedbackBanner';

/** Dictionary keys of the default texts; translated with `t()` at render. */
export const OFFLINE_BANNER_DEFAULT_KEYS = {
    title: 'cabinet.ui.offline.title',
    messageGeneric: 'cabinet.ui.offline.messageGeneric',
    messageWithRetry: 'cabinet.ui.offline.messageWithRetry',
} as const satisfies Record<string, MobileI18nKey>;

type OfflineBannerProps = {
    title?: string;
    message?: string;
    onRetry?: () => void;
    style?: StyleProp<ViewStyle>;
    compact?: boolean;
};

export default function OfflineBanner({
    title,
    message,
    onRetry,
    style,
    compact = false,
}: OfflineBannerProps) {
    const { t } = useLanguage();
    const displayMessage =
        message ??
        t(onRetry != null ? OFFLINE_BANNER_DEFAULT_KEYS.messageWithRetry : OFFLINE_BANNER_DEFAULT_KEYS.messageGeneric);

    return (
        <FeedbackBanner
            variant="warning"
            title={title ?? t(OFFLINE_BANNER_DEFAULT_KEYS.title)}
            message={displayMessage}
            compact={compact}
            style={[styles.banner, style]}
            action={
                onRetry ? (
                    <Button
                        title={t('cabinet.ui.offline.refresh')}
                        onPress={onRetry}
                        variant="outline"
                        size="sm"
                        accessibilityHint={t('cabinet.ui.offline.refreshHint')}
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
