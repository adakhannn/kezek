import { useRoute, type RouteProp } from '@react-navigation/native';

import LoadingSpinner from '../components/ui/LoadingSpinner';
import BookingStep1Branch from './booking/BookingStep1Branch';
import { useBookingScreenData } from './bookingFlow/useBookingScreenData';

type BookingRouteParams = {
    slug: string;
};

type BookingScreenRouteProp = RouteProp<{ params: BookingRouteParams }, 'params'>;

export default function BookingScreen() {
    const route = useRoute<BookingScreenRouteProp>();
    const { slug } = route.params || {};
    const { isLoading } = useBookingScreenData({ slug });

    if (isLoading) {
        return <LoadingSpinner message="Загрузка бизнеса..." />;
    }

    return <BookingStep1Branch />;
}
