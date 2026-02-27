import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { formatInTimeZone } from 'date-fns-tz';
import { addDays } from 'date-fns';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { useBooking } from '../../contexts/BookingContext';
import { colors } from '../../constants/colors';
import Button from '../../components/ui/Button';
import BookingProgressIndicator from '../../components/BookingProgressIndicator';
import { RootStackParamList } from '../../navigation/types';
import { trackMobileEvent } from '../../lib/analytics';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

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
        if (bookingData.business?.id) {
            trackMobileEvent({
                eventType: 'booking_flow_step',
                bizId: bookingData.business.id,
                branchId: bookingData.branchId ?? undefined,
                metadata: { step: 'date' },
            });
        }
    };

    const handleNext = () => {
        if (bookingData.selectedDate) {
            // Навигация в BookingStep5Time находится в RootStack
            (navigation as unknown as { navigate: (screen: keyof RootStackParamList, params?: RootStackParamList[keyof RootStackParamList]) => void }).navigate('BookingStep5Time');
        }
    };

    const dates = getAvailableDates();

    return (
        <LinearGradient
            colors={[colors.background.gradient.from, colors.background.gradient.via, colors.background.gradient.to]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.gradientContainer}
        >
            <ScrollView style={styles.container} contentContainerStyle={styles.content}>
                <BookingProgressIndicator currentStep={4} />
                <View style={styles.header}>
                    <Text style={styles.title}>{bookingData.business?.name}</Text>
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

                <View style={styles.buttonContainer}>
                    <Button
                        title="Назад"
                        onPress={() => navigation.goBack()}
                        variant="outline"
                        style={styles.backButton}
                    />
                    <Button
                        title="Дальше"
                        onPress={handleNext}
                        disabled={!bookingData.selectedDate}
                        variant="primary"
                        style={styles.nextButton}
                    />
                </View>
            </View>
            </ScrollView>
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    gradientContainer: {
        flex: 1,
    },
    container: {
        flex: 1,
    },
    content: {
        paddingBottom: 40,
    },
    header: {
        padding: 20,
        paddingTop: 24,
    },
    title: {
        fontSize: 24,
        fontWeight: '600',
        color: colors.text.primary,
        marginBottom: 4,
    },
    subtitle: {
        fontSize: 16,
        color: colors.text.secondary,
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
        backgroundColor: colors.background.secondary,
        borderWidth: 1,
        borderColor: colors.border.light,
        marginRight: 12,
        marginBottom: 12,
        minWidth: 90,
        alignItems: 'center',
    },
    dateCardSelected: {
        borderColor: colors.primary.from,
        backgroundColor: colors.background.secondary,
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
        color: colors.text.primary,
    },
    dateDay: {
        fontSize: 28,
        fontWeight: 'bold',
        color: colors.text.primary,
    },
    dateDaySelected: {
        color: colors.text.primary,
    },
    dateMonth: {
        fontSize: 13,
        color: colors.text.secondary,
        marginTop: 4,
    },
    dateMonthSelected: {
        color: colors.text.secondary,
    },
    dateWeekday: {
        fontSize: 11,
        color: colors.text.tertiary,
        marginTop: 6,
        textTransform: 'uppercase',
    },
    dateWeekdaySelected: {
        color: colors.text.tertiary,
    },
    buttonContainer: {
        marginTop: 24,
        paddingHorizontal: 0,
        flexDirection: 'row',
        gap: 12,
    },
    backButton: {
        flex: 1,
    },
    nextButton: {
        flex: 1,
    },
});

