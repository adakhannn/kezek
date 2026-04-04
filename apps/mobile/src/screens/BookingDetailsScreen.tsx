import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import EmptyState from '../components/ui/EmptyState';
import { useConfirm } from '../contexts/ConfirmContext';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { useToast } from '../contexts/ToastContext';
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
            setTimeout(() => navigation.goBack(), 500);
        },
    });

    const handleRepeat = () => {
        const slug = booking?.business?.slug;
        if (!slug) {
            showToast('РќРµ СѓРґР°Р»РѕСЃСЊ РѕС‚РєСЂС‹С‚СЊ Р·Р°РїРёСЃСЊ, Р±РёР·РЅРµСЃ РЅРµ РЅР°Р№РґРµРЅ', 'error');
            return;
        }

        navigation.navigate('Booking', { slug });
    };

    const handleCancel = async () => {
        const shouldCancel = await confirm({
            title: 'РћС‚РјРµРЅРёС‚СЊ Р±СЂРѕРЅРёСЂРѕРІР°РЅРёРµ?',
            message: 'Р’С‹ СѓРІРµСЂРµРЅС‹, С‡С‚Рѕ С…РѕС‚РёС‚Рµ РѕС‚РјРµРЅРёС‚СЊ СЌС‚Сѓ Р·Р°РїРёСЃСЊ?',
            confirmLabel: 'Р”Р°, РѕС‚РјРµРЅРёС‚СЊ',
            cancelLabel: 'РќРµС‚',
            variant: 'danger',
        });

        if (!shouldCancel) {
            return;
        }

        cancelBooking();
    };

    if (isLoading) {
        return <LoadingSpinner message="Р—Р°РіСЂСѓР·РєР° Р±СЂРѕРЅРёСЂРѕРІР°РЅРёСЏ..." />;
    }

    if (!booking) {
        return <EmptyState title="Р‘СЂРѕРЅРёСЂРѕРІР°РЅРёРµ РЅРµ РЅР°Р№РґРµРЅРѕ" />;
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
