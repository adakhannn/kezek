import { useRoute, RouteProp } from '@react-navigation/native';

import BookingStep1Branch from './booking/BookingStep1Branch';
import { useBookingScreenInit } from './booking/useBookingScreenInit';

type BookingRouteParams = {
    slug: string;
};

type BookingScreenRouteProp = RouteProp<{ params: BookingRouteParams }, 'params'>;

export default function BookingScreen() {
    const route = useRoute<BookingScreenRouteProp>();
    const { slug } = route.params || {};

    useBookingScreenInit({ slug });

    return <BookingStep1Branch />;
}
