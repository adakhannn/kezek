import { ScrollView } from 'react-native';

import { BookingDetailsActions } from './bookingDetails/BookingDetailsActions';
import { BookingDetailsInfoCard } from './bookingDetails/BookingDetailsInfoCard';
import { BookingDetailsScreenError, BookingDetailsScreenLoading } from './bookingDetails/BookingDetailsScreenState';
import { styles } from './bookingDetails/styles';
import { useBookingDetailsScreen } from './bookingDetails/useBookingDetailsScreen';

export default function BookingDetailsScreen() {
    const { booking, isLoading, canCancel, isCancelling, hasPrimaryPhone, handleRepeat, handleCancel, handleCall, handleWhatsApp } =
        useBookingDetailsScreen();

    if (isLoading) {
        return <BookingDetailsScreenLoading />;
    }

    if (!booking) {
        return <BookingDetailsScreenError />;
    }

    return (
        <ScrollView style={styles.container} testID="booking-details">
            <BookingDetailsInfoCard booking={booking} />

            <BookingDetailsActions
                canCancel={canCancel}
                isCancelling={isCancelling}
                hasPrimaryPhone={hasPrimaryPhone}
                onRepeat={handleRepeat}
                onCancel={handleCancel}
                onCall={handleCall}
                onWhatsApp={handleWhatsApp}
            />
        </ScrollView>
    );
}
