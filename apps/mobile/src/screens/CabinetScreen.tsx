import { useState } from 'react';
import { Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import Button from '../components/ui/Button';
import EmptyState from '../components/ui/EmptyState';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { signOutSafely } from '../lib/signOut';
import type { CabinetStackParamList, RootStackParamList } from '../navigation/types';
import { CabinetScreenSections } from './cabinet/CabinetScreenSections';
import { useCabinetScreenData } from './cabinet/useCabinetScreenData';

type CabinetScreenNavigationProp = NativeStackNavigationProp<CabinetStackParamList, 'CabinetMain'>;
type RootNavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function CabinetScreen() {
    const navigation = useNavigation<CabinetScreenNavigationProp>();
    const rootNavigation = navigation as unknown as RootNavigationProp;
    const [isSigningOut, setIsSigningOut] = useState(false);

    const {
        user,
        bookings,
        hasBookingsError,
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

    const handleSignOut = () => {
        Alert.alert('Выход из аккаунта', 'Вы уверены, что хотите выйти?', [
            { text: 'Отмена', style: 'cancel' },
            {
                text: 'Выйти',
                style: 'destructive',
                onPress: async () => {
                    setIsSigningOut(true);
                    try {
                        await signOutSafely();
                    } finally {
                        setIsSigningOut(false);
                    }
                },
            },
        ]);
    };

    if (isLoading && !bookings) {
        return <LoadingSpinner message="Загрузка кабинета..." />;
    }

    if (!user) {
        return (
            <EmptyState
                title="Пользователь не найден"
                message="Сессия могла устареть. Выйдите и авторизуйтесь снова."
                action={
                    <Button
                        title={isSigningOut ? 'Выходим...' : 'Выйти и войти снова'}
                        onPress={handleSignOut}
                        variant="danger"
                        loading={isSigningOut}
                        fullWidth
                    />
                }
            />
        );
    }

    return (
        <CabinetScreenSections
            userLabel={user.email || user.phone || 'Пользователь'}
            activeTab={activeTab}
            isOfflineData={isOfflineData}
            hasBookingsError={hasBookingsError}
            lastSyncAt={lastSyncAt}
            upcomingBookings={upcomingBookings}
            pastBookings={pastBookings}
            refreshing={refreshing}
            onTabChange={setActiveTab}
            onRefresh={onRefresh}
            onBookingPress={(bookingId) => rootNavigation.navigate('BookingDetails', { id: bookingId })}
            onProfilePress={() => navigation.navigate('Profile')}
            onSignOut={handleSignOut}
            isSigningOut={isSigningOut}
        />
    );
}

