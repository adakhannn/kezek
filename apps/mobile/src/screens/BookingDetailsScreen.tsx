import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import EmptyState from '../components/ui/EmptyState';
import { useConfirm } from '../contexts/ConfirmContext';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { useToast } from '../contexts/ToastContext';
import { useLanguage } from '../i18n';
import { RootStackParamList } from '../navigation/types';
import { BookingDetailsSections } from './bookingDetails/BookingDetailsSections';
import { useBookingDetailsData } from './bookingDetails/useBookingDetailsData';

type BookingDetailsRouteParams = {
    id: string;
};

type BookingDetailsScreenRouteProp = RouteProp<{ params: BookingDetailsRouteParams }, 'params'>;
type BookingDetailsScreenNavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function BookingDetailsScreen() {
    const route = useRoute<BookingDetailsScreenRouteProp>();
    const navigation = useNavigation<BookingDetailsScreenNavigationProp>();
    const { showToast } = useToast();
    const { confirm } = useConfirm();
    const { t } = useLanguage();
    const bookingId = route.params?.id;
    const {
        booking,
        isLoading,
        cancelBooking,
        isCancelling,
        primaryPhone,
        canCancel,
        timelineSteps,
        openCall,
        openWhatsApp,
    } = useBookingDetailsData({
        bookingId,
        onCancelled: () => {
            navigation.reset({
                index: 0,
                routes: [
                    {
                        name: 'Main',
                        params: {
                            screen: 'Cabinet',
                            params: { screen: 'CabinetMain' },
                        },
                    },
                ],
            });
        },
    });

    const handleRepeat = () => {
        const slug = booking?.business?.slug;
        if (!slug) {
            showToast(t('cabinet.details.repeatError'), 'error');
            return;
        }

        navigation.navigate('Booking', { slug });
    };

    const handleCancel = async () => {
        const shouldCancel = await confirm({
            title: t('cabinet.details.cancelTitle'),
            message: t('cabinet.details.cancelMessage'),
            confirmLabel: t('cabinet.details.cancelConfirm'),
            cancelLabel: t('cabinet.details.cancelKeep'),
            variant: 'danger',
        });

        if (!shouldCancel) {
            return;
        }

        cancelBooking();
    };

    if (isLoading) {
        return <LoadingSpinner message={t('cabinet.details.loading')} />;
    }

    if (!booking) {
        return <EmptyState title={t('cabinet.details.notFound')} />;
    }

    return (
        <BookingDetailsSections
            booking={booking}
            timelineSteps={timelineSteps}
            canCancel={canCancel}
            isCancelling={isCancelling}
            primaryPhone={primaryPhone}
            onRepeat={handleRepeat}
            onCancel={handleCancel}
            onCall={openCall}
            onWhatsApp={openWhatsApp}
        />
    );
}

