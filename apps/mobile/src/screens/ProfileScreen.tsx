import Button from '../components/ui/Button';
import EmptyState from '../components/ui/EmptyState';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { useLanguage } from '../i18n';
import { ProfileScreenSections } from './profile/ProfileScreenSections';
import { useProfileScreenData } from './profile/useProfileScreenData';

/**
 * The website's /cabinet/profile: personal data, sign-in methods (Google, Yandex, Telegram,
 * WhatsApp), notification channels and addresses, language, legal pages and account deletion.
 */
export default function ProfileScreen() {
    const { t } = useLanguage();
    const data = useProfileScreenData();

    if (data.isLoading) {
        return <LoadingSpinner message={t('cabinet.profile.loading')} />;
    }

    if (data.loadError) {
        return (
            <EmptyState
                icon="alert-circle"
                title={t('cabinet.profile.loadError.title')}
                message={t('cabinet.profile.loadError.message')}
                action={<Button title={t('cabinet.ui.retry')} onPress={() => void data.retryLoad()} variant="outline" fullWidth />}
            />
        );
    }

    return <ProfileScreenSections data={data} />;
}
