import type { StyleProp, ViewStyle } from 'react-native';

import { useLanguage } from '../../i18n';
import Button from './Button';
import EmptyState from './EmptyState';

/**
 * A failed read with a retry (FE-08: a failure is never shown as empty data). The defaults say
 * "Couldn't load / Check your connection / Retry" in the app language.
 */
export default function ErrorState({ title, message, onRetry, retryLabel, compact, style, testID }: {
    title?: string;
    message?: string;
    onRetry?: () => void;
    retryLabel?: string;
    compact?: boolean;
    style?: StyleProp<ViewStyle>;
    testID?: string;
}) {
    const { t } = useLanguage();
    return (
        <EmptyState
            icon="cloud-offline-outline"
            tone="danger"
            title={title ?? t('ui.error.title')}
            message={message ?? t('staff.checkConnection')}
            compact={compact}
            style={style}
            action={onRetry ? (
                <Button title={retryLabel ?? t('staff.retry')} onPress={onRetry} variant="outline" fullWidth testID={testID ? `${testID}-retry` : undefined} />
            ) : undefined}
        />
    );
}
