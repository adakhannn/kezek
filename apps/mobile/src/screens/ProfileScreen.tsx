import ErrorState from '../components/ui/ErrorState';
import Screen from '../components/ui/Screen';
import { SkeletonBlock, SkeletonCard, SkeletonList } from '../components/ui/Skeleton';
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

    // The shape of the profile while it loads: the person, the data card, the settings rows.
    if (data.isLoading) {
        return (
            <Screen tabBar testID="profile-loading">
                <SkeletonBlock width="50%" height={20} />
                <SkeletonCard lines={3} />
                <SkeletonList rows={4} avatar={false} />
            </Screen>
        );
    }

    if (data.loadError) {
        return (
            <Screen tabBar>
                <ErrorState
                    title={t('cabinet.profile.loadError.title')}
                    message={t('cabinet.profile.loadError.message')}
                    retryLabel={t('cabinet.ui.retry')}
                    onRetry={() => void data.retryLoad()}
                />
            </Screen>
        );
    }

    return <ProfileScreenSections data={data} />;
}
