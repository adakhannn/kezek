import { ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { MainTabParamList } from '../navigation/types';
import EmptyState from '../components/ui/EmptyState';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { DashboardScreenSections } from './dashboard/DashboardScreenSections';
import { useDashboardScreenData } from './dashboard/useDashboardScreenData';
import { styles } from './dashboard/dashboardScreenStyles';

type DashboardScreenNavigationProp = NativeStackNavigationProp<MainTabParamList, 'Dashboard'>;

export default function DashboardScreen() {
    const navigation = useNavigation<DashboardScreenNavigationProp>();
    const { businesses, isOwner, isLoading, refreshing, onRefresh } = useDashboardScreenData();

    if (isLoading) {
        return <LoadingSpinner message="????????..." />;
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

    return (
        <DashboardScreenSections
            businesses={businesses}
            refreshing={refreshing}
            onRefresh={onRefresh}
            onBusinessPress={() => {
                void navigation;
            }}
        />
    );
}
