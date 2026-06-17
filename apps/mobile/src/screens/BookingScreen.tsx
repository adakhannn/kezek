import { useRoute, type RouteProp } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text, View } from 'react-native';

import BookingProgressIndicator from '../components/BookingProgressIndicator';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { colors } from '../constants/colors';
import BookingStep1Branch from './booking/BookingStep1Branch';
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

    if (isLoading) {
        return (
            <LinearGradient
                colors={[
                    colors.background.gradient.from,
                    colors.background.gradient.via,
                    colors.background.gradient.to,
                ]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.container}
            >
                <BookingProgressIndicator currentStep={1} />
                <View style={styles.previewHeader}>
                    <Text style={styles.previewTitle}>{previewName || 'Запись'}</Text>
                    <Text style={styles.previewSubtitle}>Готовим филиалы для выбора</Text>
                </View>
                <LoadingSpinner message="Загружаем филиалы..." />
            </LinearGradient>
        );
    }

    return <BookingStep1Branch initialData={initialData} />;
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    previewHeader: {
        paddingHorizontal: colors.layout.space5,
        paddingTop: colors.layout.space5,
    },
    previewTitle: {
        fontSize: 24,
        fontWeight: '600',
        color: colors.text.primary,
    },
    previewSubtitle: {
        marginTop: colors.layout.space2,
        fontSize: 14,
        color: colors.text.secondary,
    },
});
