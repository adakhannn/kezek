import Button from '../../components/ui/Button';
import EmptyState from '../../components/ui/EmptyState';
import { useLanguage } from '../../i18n';

type BookingLoadErrorProps = {
    title: string;
    onRetry: () => void;
    retrying?: boolean;
};

/**
 * A failed load of a booking step (B4): never shown as "not found" or as an empty list, and
 * always with a retry. The ErrorState look (danger icon) with a retry that shows its progress.
 */
export default function BookingLoadError({ title, onRetry, retrying = false }: BookingLoadErrorProps) {
    const { t } = useLanguage();
    return (
        <EmptyState
            icon="cloud-offline-outline"
            tone="danger"
            title={title}
            message={t('booking.checkConnection')}
            compact
            action={
                <Button
                    title={t('booking.retry')}
                    onPress={onRetry}
                    loading={retrying}
                    variant="outline"
                    fullWidth
                />
            }
        />
    );
}
