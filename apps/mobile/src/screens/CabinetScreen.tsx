import { useState } from 'react';
import { Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import Button from '../components/ui/Button';
import EmptyState from '../components/ui/EmptyState';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { useLanguage } from '../i18n';
import { countPendingShiftOperations, signOutConfirmationText, signOutSafely } from '../lib/signOut';
import type { CabinetStackParamList, RootStackParamList } from '../navigation/types';
import { CabinetScreenSections } from './cabinet/CabinetScreenSections';
import { useCabinetScreenData } from './cabinet/useCabinetScreenData';

type CabinetScreenNavigationProp = NativeStackNavigationProp<CabinetStackParamList, 'CabinetMain'>;
type RootNavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function CabinetScreen() {
    const navigation = useNavigation<CabinetScreenNavigationProp>();
    const rootNavigation = navigation as unknown as RootNavigationProp;
    const [isSigningOut, setIsSigningOut] = useState(false);
    const { t } = useLanguage();

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

    const handleSignOut = async () => {
        const pending = await countPendingShiftOperations();
        const text = signOutConfirmationText(pending, t);
        Alert.alert(pending === 0 ? t('cabinet.signOutTitle') : text.title, text.message, [
            { text: t('cabinet.ui.cancel'), style: 'cancel' },
            {
                text: text.confirmLabel,
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
        return <LoadingSpinner message={t('cabinet.loading')} />;
    }

    if (!user) {
        return (
            <EmptyState
                title={t('cabinet.noUser.title')}
                message={t('cabinet.noUser.message')}
                action={
                    <Button
                        title={isSigningOut ? t('cabinet.ui.signingOut') : t('cabinet.noUser.signOut')}
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
            userLabel={user.email || user.phone || t('cabinet.userFallback')}
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

