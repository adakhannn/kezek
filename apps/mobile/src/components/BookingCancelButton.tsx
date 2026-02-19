import { TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../constants/colors';
import { useBooking } from '../contexts/BookingContext';
import { RootStackParamList } from '../navigation/types';

/**
 * Кнопка отмены бронирования
 * Возвращает на главную страницу с подтверждением
 */
export default function BookingCancelButton() {
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
    const { reset } = useBooking();

    const handleCancel = () => {
        Alert.alert(
            'Отменить бронирование?',
            'Все выбранные данные будут потеряны',
            [
                {
                    text: 'Продолжить',
                    style: 'cancel',
                },
                {
                    text: 'Отменить',
                    style: 'destructive',
                    onPress: () => {
                        reset(); // Очищаем данные бронирования
                        // Возвращаемся на главную страницу
                        // Используем reset для очистки стека навигации
                        navigation.reset({
                            index: 0,
                            routes: [{ name: 'Main' }],
                        });
                    },
                },
            ]
        );
    };

    return (
        <TouchableOpacity
            style={styles.button}
            onPress={handleCancel}
            activeOpacity={0.7}
        >
            <Ionicons name="close" size={24} color={colors.text.primary} />
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    button: {
        padding: 8,
        marginRight: 8,
    },
});

