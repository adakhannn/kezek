import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { formatInTimeZone } from 'date-fns-tz';
import { addDays } from 'date-fns';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import { useBooking } from '../../contexts/BookingContext';

type NavigationProp = NativeStackNavigationProp<any>;

const TZ = 'Asia/Bishkek';

export default function BookingStep4Date() {
    const navigation = useNavigation<NavigationProp>();
    const { bookingData, setSelectedDate } = useBooking();

    const formatDateLabel = (dateString: string) => {
        const date = new Date(dateString + 'T00:00:00');
        const day = date.getDate();
        const month = date.toLocaleDateString('ru-RU', { month: 'long' });
        const weekday = date.toLocaleDateString('ru-RU', { weekday: 'short' });
        return { day, month, weekday: weekday.charAt(0).toUpperCase() + weekday.slice(1) };
    };

    const getAvailableDates = () => {
        const dates: string[] = [];
        const today = new Date();
        for (let i = 0; i < 30; i++) {
            const date = addDays(today, i);
            dates.push(formatInTimeZone(date, TZ, 'yyyy-MM-dd'));
        }
        return dates;
    };

    const handleSelectDate = (date: string) => {
        setSelectedDate(date);
        // @ts-ignore
        navigation.navigate('BookingStep5Time');
    };

    const dates = getAvailableDates();

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
            <View style={styles.header}>
                <Text style={styles.title}>{bookingData.business?.name}</Text>
                <Text style={styles.subtitle}>Шаг 4 из 5: Выберите дату</Text>
            </View>

            <View style={styles.section}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScroll}>
                    {dates.map((date) => {
                        const dateLabel = formatDateLabel(date);
                        const isToday = date === formatInTimeZone(new Date(), TZ, 'yyyy-MM-dd');
                        return (
                            <TouchableOpacity
                                key={date}
                                style={[
                                    styles.dateCard,
                                    bookingData.selectedDate === date && styles.dateCardSelected,
                                    isToday && styles.dateCardToday,
                                ]}
                                onPress={() => handleSelectDate(date)}
                            >
                                {isToday && (
                                    <Text style={[
                                        styles.todayLabel,
                                        bookingData.selectedDate === date && styles.todayLabelSelected
                                    ]}>
                                        Сегодня
                                    </Text>
                                )}
                                <Text
                                    style={[
                                        styles.dateDay,
                                        bookingData.selectedDate === date && styles.dateDaySelected,
                                    ]}
                                >
                                    {dateLabel.day}
                                </Text>
                                <Text
                                    style={[
                                        styles.dateMonth,
                                        bookingData.selectedDate === date && styles.dateMonthSelected,
                                    ]}
                                >
                                    {dateLabel.month}
                                </Text>
                                <Text
                                    style={[
                                        styles.dateWeekday,
                                        bookingData.selectedDate === date && styles.dateWeekdaySelected,
                                    ]}
                                >
                                    {dateLabel.weekday}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f9fafb',
    },
    content: {
        paddingBottom: 40,
    },
    header: {
        padding: 20,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#e5e7eb',
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#111827',
        marginBottom: 4,
    },
    subtitle: {
        fontSize: 16,
        color: '#6b7280',
    },
    section: {
        padding: 20,
    },
    horizontalScroll: {
        marginHorizontal: -4,
    },
    dateCard: {
        padding: 16,
        borderRadius: 12,
        backgroundColor: '#fff',
        borderWidth: 2,
        borderColor: '#e5e7eb',
        marginRight: 12,
        marginBottom: 12,
        minWidth: 90,
        alignItems: 'center',
    },
    dateCardSelected: {
        backgroundColor: '#6366f1',
        borderColor: '#6366f1',
    },
    dateCardToday: {
        borderColor: '#10b981',
    },
    todayLabel: {
        fontSize: 10,
        fontWeight: '600',
        color: '#10b981',
        marginBottom: 4,
        textTransform: 'uppercase',
    },
    todayLabelSelected: {
        color: '#fff',
    },
    dateDay: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#111827',
    },
    dateDaySelected: {
        color: '#fff',
    },
    dateMonth: {
        fontSize: 13,
        color: '#6b7280',
        marginTop: 4,
    },
    dateMonthSelected: {
        color: '#fff',
    },
    dateWeekday: {
        fontSize: 11,
        color: '#9ca3af',
        marginTop: 6,
        textTransform: 'uppercase',
    },
    dateWeekdaySelected: {
        color: '#fff',
    },
});

