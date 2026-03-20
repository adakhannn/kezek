import { Text, View } from 'react-native';

import { styles } from './styles';

export function BookingDetailsScreenLoading() {
    return (
        <View style={styles.container} testID="booking-details">
            <Text style={styles.loading}>Загрузка...</Text>
        </View>
    );
}

export function BookingDetailsScreenError() {
    return (
        <View style={styles.container} testID="booking-details">
            <Text style={styles.error}>Бронирование не найдено</Text>
        </View>
    );
}
