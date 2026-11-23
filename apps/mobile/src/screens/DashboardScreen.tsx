import { Alert, Linking, ScrollView } from 'react-native';

import Button from '../components/ui/Button';
import EmptyState from '../components/ui/EmptyState';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { useLanguage } from '../i18n';
import { apiRequest } from '../lib/api';
import { DashboardScreenSections } from './dashboard/DashboardScreenSections';
import { useDashboardScreenData } from './dashboard/useDashboardScreenData';
import { styles } from './dashboard/dashboardScreenStyles';

type WebHandoffResponse = { ok: true; url: string };

/** Only the web app's handoff page may be opened, whatever the response says. */
function isWebHandoffUrl(value: unknown): value is string {
    if (typeof value !== 'string') return false;
    try {
        const url = new URL(value);
        return (url.protocol === 'https:' || (__DEV__ && url.protocol === 'http:')) && url.pathname === '/auth/handoff';
    } catch {
        return false;
    }
}

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
            // A one-time code instead of the app's own tokens: nothing long-lived
            // lands in browser history, and the browser gets an independent session
            // rather than sharing (and rotating away) the app's refresh token.
            const response = await apiRequest<WebHandoffResponse>('/auth/web-handoff', {
                method: 'POST',
                body: JSON.stringify({ next: '/select-business' }),
            });
            if (!isWebHandoffUrl(response?.url)) {
                throw new Error('Invalid web handoff URL');
            }

            await Linking.openURL(response.url);
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
