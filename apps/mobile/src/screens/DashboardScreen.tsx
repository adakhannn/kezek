import { ScrollView, RefreshControl } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { MainTabParamList } from '../navigation/types';
import { DashboardBusinessListSection } from './dashboard/DashboardBusinessListSection';
import { DashboardHeader } from './dashboard/DashboardHeader';
import { DashboardScreenState } from './dashboard/DashboardScreenState';
import { styles } from './dashboard/styles';
import type { Business } from './dashboard/types';
import { useDashboardScreen } from './dashboard/useDashboardScreen';

type DashboardScreenNavigationProp = NativeStackNavigationProp<MainTabParamList, 'Dashboard'>;

export default function DashboardScreen() {
    const navigation = useNavigation<DashboardScreenNavigationProp>();
    const { refreshing, businesses, isLoading, isOwner, handleRefresh } = useDashboardScreen();

    const handleBusinessPress = (_business: Business) => {
        // В будущем: navigation.navigate('BusinessDetails', { id: business.id });
        void navigation;
    };

    if (isLoading && !refreshing) {
        return <DashboardScreenState type="loading" />;
    }

    if (!isOwner) {
        return (
            <ScrollView style={styles.container}>
                <DashboardScreenState type="not-owner" />
            </ScrollView>
        );
    }

    return (
        <ScrollView
            style={styles.container}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        >
            <DashboardHeader businessCount={businesses.length} />

            {businesses.length > 0 ? (
                <DashboardBusinessListSection
                    businesses={businesses}
                    onBusinessPress={handleBusinessPress}
                />
            ) : (
                <DashboardScreenState type="empty" />
            )}
        </ScrollView>
    );
}
