import { Alert, ScrollView } from 'react-native';

import Button from '../components/ui/Button';
import EmptyState from '../components/ui/EmptyState';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { useLanguage } from '../i18n';
import { openWebAsCurrentUser } from '../lib/webLinks';
import { DashboardScreenSections } from './dashboard/DashboardScreenSections';
import { useDashboardScreenData } from './dashboard/useDashboardScreenData';
import { styles } from './dashboard/dashboardScreenStyles';

export default function DashboardScreen() {
    const { t } = useLanguage();
    const { businesses, isOwner, isLoading, loadError, refreshing, onRefresh } =
        useDashboardScreenData();

    if (isLoading) {
        return <LoadingSpinner message={t('common.loading')} />;
    }

    if (loadError) {
        return (
            <ScrollView style={styles.container}>
                <EmptyState
                    icon="alert-circle"
                    title={t('staff.dashboard.loadError')}
                    message={t('staff.checkConnection')}
                    action={
                        <Button
                            title={t('staff.retry')}
                            onPress={() => void onRefresh()}
                            variant="outline"
                            fullWidth
                        />
                    }
                />
            </ScrollView>
        );
    }

    if (!isOwner) {
        return (
            <ScrollView style={styles.container}>
                <EmptyState
                    icon="business"
                    title={t('staff.dashboard.notOwnerTitle')}
                    message={t('staff.dashboard.notOwnerMessage')}
                />
            </ScrollView>
        );
    }

    const openWebDashboard = async () => {
        try {
            await openWebAsCurrentUser('/select-business');
        } catch {
            Alert.alert(
                t('staff.dashboard.webErrorTitle'),
                t('staff.dashboard.webErrorMessage'),
            );
        }
    };

    return (
        <DashboardScreenSections
            businesses={businesses}
            refreshing={refreshing}
            onRefresh={onRefresh}
            onBusinessPress={() => void openWebDashboard()}
        />
    );
}
