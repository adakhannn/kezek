import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import EmptyState from '../components/ui/EmptyState';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { CabinetScreenSections } from './cabinet/CabinetScreenSections';
import { useCabinetScreenData } from './cabinet/useCabinetScreenData';
import type { CabinetStackParamList, RootStackParamList } from '../navigation/types';

type CabinetScreenNavigationProp = NativeStackNavigationProp<CabinetStackParamList, 'CabinetMain'>;
type RootNavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function CabinetScreen() {
    const navigation = useNavigation<CabinetScreenNavigationProp>();
    const rootNavigation = navigation as unknown as RootNavigationProp;
    const {
        user,
        bookings,
        isLoading,
        refreshing,
        activeTab,
        setActiveTab,
        isOfflineData,
        lastSyncAt,
        upcomingBookings,
        pastBookings,
        onRefresh,
    } = useCabinetScreenData();

    if (isLoading && !bookings) {
        return <LoadingSpinner message="Загрузка кабинета..." />;
    }

    if (!user) {
        return (
            <EmptyState
                title="Пользователь не найден"
                message="Попробуйте обновить экран или войти снова."
            />
        );
    }

    return (
        <CabinetScreenSections
            userLabel={user.email || user.phone || 'Пользователь'}
            activeTab={activeTab}
            isOfflineData={isOfflineData}
            lastSyncAt={lastSyncAt}
            upcomingBookings={upcomingBookings}
            pastBookings={pastBookings}
            refreshing={refreshing}
            onTabChange={setActiveTab}
            onRefresh={onRefresh}
            onBookingPress={(bookingId) => rootNavigation.navigate('BookingDetails', { id: bookingId })}
            onProfilePress={() => navigation.navigate('Profile')}
        />
    );
}
