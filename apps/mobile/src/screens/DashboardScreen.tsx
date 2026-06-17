import { Alert, Linking, ScrollView } from 'react-native';

import Button from '../components/ui/Button';
import EmptyState from '../components/ui/EmptyState';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { getMobileApiUrl } from '../lib/apiUrl';
import { supabase } from '../lib/supabase';
import { DashboardScreenSections } from './dashboard/DashboardScreenSections';
import { useDashboardScreenData } from './dashboard/useDashboardScreenData';
import { styles } from './dashboard/dashboardScreenStyles';

export default function DashboardScreen() {
    const { businesses, isOwner, isLoading, loadError, refreshing, onRefresh } =
        useDashboardScreenData();

    if (isLoading) {
        return <LoadingSpinner message="Загрузка..." />;
    }

    if (loadError) {
        return (
            <ScrollView style={styles.container}>
                <EmptyState
                    icon="alert-circle"
                    title="Не удалось загрузить кабинет бизнеса"
                    message="Проверьте соединение и попробуйте снова."
                    action={
                        <Button
                            title="Повторить"
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
                    title="Вы не являетесь владельцем бизнеса"
                    message="Здесь будут отображаться ваши бизнесы после регистрации"
                />
            </ScrollView>
        );
    }

    const openWebDashboard = async () => {
        try {
            const {
                data: { session },
                error,
            } = await supabase.auth.getSession();

            if (error || !session?.access_token || !session.refresh_token) {
                throw error ?? new Error('No active session');
            }

            const callbackUrl =
                `${getMobileApiUrl()}/auth/callback?next=${encodeURIComponent('/select-business')}` +
                `#access_token=${encodeURIComponent(session.access_token)}` +
                `&refresh_token=${encodeURIComponent(session.refresh_token)}`;

            await Linking.openURL(callbackUrl);
        } catch {
            Alert.alert(
                'Не удалось открыть веб-кабинет',
                'Откройте kezek.kg в браузере и перейдите в раздел бизнеса.',
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
