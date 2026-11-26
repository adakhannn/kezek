import { useRoute, type RouteProp } from '@react-navigation/native';

import { useLanguage } from '../i18n';
import BookingStep1Branch from './booking/BookingStep1Branch';
import { BookingContextLine, BookingStepScreen, BookingStepSkeleton } from './booking/BookingStepLayout';
import { useBookingScreenData } from './bookingFlow/useBookingScreenData';

type BookingRouteParams = {
    slug: string;
    previewName?: string;
};

type BookingScreenRouteProp = RouteProp<{ params: BookingRouteParams }, 'params'>;

export default function BookingScreen() {
    const route = useRoute<BookingScreenRouteProp>();
    const { slug, previewName } = route.params || {};
    const { isLoading, initialData } = useBookingScreenData({ slug });
    const { t } = useLanguage();

    if (isLoading) {
        // The first step's frame with the business name the list already showed, while branches load.
        return (
            <BookingStepScreen step={1}>
                <BookingContextLine name={previewName || t('booking.screen.title')} detail={t('booking.screen.preparing')} />
                <BookingStepSkeleton label={t('booking.screen.loadingBranches')} rows={3} />
            </BookingStepScreen>
        );
    }

    return <BookingStep1Branch initialData={initialData} />;
}
