import { useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import Button from '../components/ui/Button';
import EmptyState from '../components/ui/EmptyState';
import Screen from '../components/ui/Screen';
import { SkeletonBlock, SkeletonCard, SkeletonList } from '../components/ui/Skeleton';
import { useConfirm } from '../contexts/ConfirmContext';
import { useLanguage } from '../i18n';
import { countPendingShiftOperations, signOutConfirmationText, signOutSafely } from '../lib/signOut';
import type { CabinetStackParamList, RootStackParamList } from '../navigation/types';
import { CabinetScreenSections } from './cabinet/CabinetScreenSections';
import { ReviewSheet } from './cabinet/ReviewSheet';
import type { Booking } from './cabinet/types';
import { useCabinetScreenData } from './cabinet/useCabinetScreenData';

type CabinetScreenNavigationProp = NativeStackNavigationProp<CabinetStackParamList, 'CabinetMain'>;
type RootNavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function CabinetScreen() {
    const navigation = useNavigation<CabinetScreenNavigationProp>();
    const rootNavigation = navigation as unknown as RootNavigationProp;
    const [isSigningOut, setIsSigningOut] = useState(false);
    const [reviewBooking, setReviewBooking] = useState<Booking | null>(null);
    const { t } = useLanguage();
    const { confirm } = useConfirm();

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
        hasMoreBookings,
        isFetchingMore,
        loadMoreFailed,
        loadMore,
    } = useCabinetScreenData();

    // The same confirmation as in Profile (ConfirmContext), with the pending-shift warning.
    const handleSignOut = async () => {
        const pending = await countPendingShiftOperations();
        const text = signOutConfirmationText(pending, t);
        const shouldSignOut = await confirm({
            title: pending === 0 ? t('cabinet.signOutTitle') : text.title,
            message: text.message,
            confirmLabel: text.confirmLabel,
            cancelLabel: t('cabinet.ui.cancel'),
            variant: 'danger',
        });
        if (!shouldSignOut) return;

        setIsSigningOut(true);
        try {
            await signOutSafely();
        } finally {
            setIsSigningOut(false);
        }
    };

    if (isLoading && !bookings) {
        return (
            <Screen tabBar testID="cabinet-loading">
                <SkeletonBlock width="60%" height={20} />
                <SkeletonCard lines={2} />
                <SkeletonList rows={3} avatar={false} />
            </Screen>
        );
    }

    if (!user) {
        return (
            <Screen tabBar>
                <EmptyState
                    icon="person-circle-outline"
                    title={t('cabinet.noUser.title')}
                    message={t('cabinet.noUser.message')}
                    action={
                        <Button
                            title={isSigningOut ? t('cabinet.ui.signingOut') : t('cabinet.noUser.signOut')}
                            onPress={() => void handleSignOut()}
                            variant="danger"
                            loading={isSigningOut}
                            fullWidth
                        />
                    }
                />
            </Screen>
        );
    }

    return (
        <>
            <CabinetScreenSections
                userId={user.id}
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
                onSignOut={() => void handleSignOut()}
                isSigningOut={isSigningOut}
                hasMoreBookings={hasMoreBookings}
                isFetchingMore={isFetchingMore}
                loadMoreFailed={loadMoreFailed}
                onLoadMore={loadMore}
                onReview={setReviewBooking}
            />
            {reviewBooking ? (
                <ReviewSheet
                    visible
                    bookingId={reviewBooking.id}
                    existingReview={reviewBooking.review ?? null}
                    onClose={() => setReviewBooking(null)}
                />
            ) : null}
        </>
    );
}
