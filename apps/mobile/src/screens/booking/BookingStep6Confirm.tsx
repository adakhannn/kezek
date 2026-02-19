import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { useMutation } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { formatInTimeZone } from 'date-fns-tz';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { apiRequest } from '../../lib/api';
import { useBooking } from '../../contexts/BookingContext';
import { useToast } from '../../contexts/ToastContext';
import { colors } from '../../constants/colors';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import BookingProgressIndicator from '../../components/BookingProgressIndicator';
import RatingBadge from '../../components/ui/RatingBadge';
import { RootStackParamList } from '../../navigation/types';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const TZ = 'Asia/Bishkek';

export default function BookingStep6Confirm() {
    const navigation = useNavigation<NavigationProp>();
    const { bookingData, reset } = useBooking();
    const { showToast } = useToast();

    const formatTimeSlot = (dateString: string) => {
        const date = new Date(dateString);
        return formatInTimeZone(date, TZ, 'HH:mm');
    };

    const formatDateLabel = (dateString: string) => {
        const date = new Date(dateString + 'T00:00:00');
        const day = date.getDate();
        const month = date.toLocaleDateString('ru-RU', { month: 'long' });
        return { day, month };
    };

    const formatPrice = (service: typeof bookingData.services[0] | undefined) => {
        if (!service) return null;
        if (service.price_from && service.price_to) {
            return `${service.price_from} - ${service.price_to} сом`;
        } else if (service.price_from) {
            return `от ${service.price_from} сом`;
        }
        return null;
    };

    const selectedService = bookingData.services.find((s) => s.id === bookingData.serviceId);
    const selectedStaff = bookingData.staff.find((s) => s.id === bookingData.staffId);

    const createBookingMutation = useMutation({
        mutationFn: async () => {
            if (!bookingData.business || !bookingData.selectedSlot) {
                throw new Error('Данные бронирования неполные');
            }

            return apiRequest<{ ok: boolean; booking_id: string }>('/api/quick-hold', {
                method: 'POST',
                body: JSON.stringify({
                    biz_id: bookingData.business.id,
                    branch_id: bookingData.branchId, // Передаем явно выбранный филиал
                    service_id: bookingData.serviceId,
                    staff_id: bookingData.staffId,
                    start_at: bookingData.selectedSlot.start_at,
                }),
            });
        },
        onSuccess: (data) => {
            showToast('Запись создана!', 'success');
            reset();
            setTimeout(() => {
                // Навигация в BookingDetails находится в RootStack
                (navigation as unknown as { navigate: (screen: keyof RootStackParamList, params?: RootStackParamList[keyof RootStackParamList]) => void }).navigate('BookingDetails', { id: data.booking_id });
            }, 500);
        },
        onError: (error: Error) => {
            showToast(error.message || 'Не удалось создать запись', 'error');
        },
    });

    const handleCreateBooking = () => {
        if (!bookingData.selectedSlot) {
            showToast('Выберите время', 'error');
            return;
        }

        Alert.alert('Подтверждение', 'Создать запись?', [
            { text: 'Отмена', style: 'cancel' },
            {
                text: 'Создать',
                onPress: () => createBookingMutation.mutate(),
            },
        ]);
    };

    const dateLabel = bookingData.selectedDate ? formatDateLabel(bookingData.selectedDate) : null;

    return (
        <LinearGradient
            colors={[colors.background.gradient.from, colors.background.gradient.via, colors.background.gradient.to]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.gradientContainer}
        >
            <ScrollView style={styles.container} contentContainerStyle={styles.content}>
                <BookingProgressIndicator currentStep={6} />
                <View style={styles.header}>
                    <View style={styles.headerRow}>
                        <Text style={styles.title}>{bookingData.business?.name}</Text>
                        {bookingData.business?.rating_score !== null && bookingData.business?.rating_score !== undefined && (
                            <RatingBadge rating={bookingData.business.rating_score} />
                        )}
                    </View>
                </View>

            <View style={styles.section}>
                <Card style={styles.summaryCard}>
                    <View style={styles.summaryRow}>
                        <Ionicons name="business-outline" size={24} color="#6366f1" />
                        <View style={styles.summaryContent}>
                            <Text style={styles.summaryLabel}>Бизнес</Text>
                            <Text style={styles.summaryValue}>{bookingData.business?.name}</Text>
                        </View>
                    </View>
                    <View style={styles.summaryDivider} />
                    <View style={styles.summaryRow}>
                        <Ionicons name="cut-outline" size={24} color="#6366f1" />
                        <View style={styles.summaryContent}>
                            <Text style={styles.summaryLabel}>Услуга</Text>
                            <Text style={styles.summaryValue}>{selectedService?.name_ru}</Text>
                            {selectedService?.duration_min && (
                                <Text style={styles.summaryHint}>{selectedService.duration_min} минут</Text>
                            )}
                            {formatPrice(selectedService) && (
                                <Text style={styles.summaryPrice}>{formatPrice(selectedService)}</Text>
                            )}
                        </View>
                    </View>
                    <View style={styles.summaryDivider} />
                    <View style={styles.summaryRow}>
                        <Ionicons name="person-outline" size={24} color="#6366f1" />
                        <View style={styles.summaryContent}>
                            <Text style={styles.summaryLabel}>Мастер</Text>
                            <Text style={styles.summaryValue}>{selectedStaff?.full_name}</Text>
                        </View>
                    </View>
                    <View style={styles.summaryDivider} />
                    <View style={styles.summaryRow}>
                        <Ionicons name="calendar-outline" size={24} color="#6366f1" />
                        <View style={styles.summaryContent}>
                            <Text style={styles.summaryLabel}>Дата и время</Text>
                            {dateLabel && (
                                <Text style={styles.summaryValue}>
                                    {dateLabel.day} {dateLabel.month}
                                </Text>
                            )}
                            {bookingData.selectedSlot && (
                                <Text style={styles.summaryHint}>
                                    {formatTimeSlot(bookingData.selectedSlot.start_at)}
                                </Text>
                            )}
                        </View>
                    </View>
                </Card>

                <View style={styles.buttonContainer}>
                    <Button
                        title="Назад"
                        onPress={() => navigation.goBack()}
                        variant="outline"
                        style={styles.backButton}
                    />
                    <Button
                        title="Записаться"
                        onPress={handleCreateBooking}
                        loading={createBookingMutation.isPending}
                        disabled={createBookingMutation.isPending || !bookingData.selectedSlot}
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
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        flexWrap: 'wrap',
    },
    title: {
        fontSize: 24,
        fontWeight: '600',
        color: colors.text.primary,
        marginBottom: 4,
        flex: 1,
    },
    subtitle: {
        fontSize: 16,
        color: colors.text.secondary,
    },
    section: {
        padding: 20,
    },
    summaryCard: {
        marginBottom: 20,
    },
    summaryRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 16,
        paddingVertical: 16,
    },
    summaryContent: {
        flex: 1,
    },
    summaryLabel: {
        fontSize: 12,
        fontWeight: '500',
        color: colors.text.secondary,
        marginBottom: 6,
        textTransform: 'uppercase',
    },
    summaryValue: {
        fontSize: 18,
        fontWeight: '600',
        color: colors.text.primary,
    },
    summaryHint: {
        fontSize: 14,
        color: colors.text.secondary,
        marginTop: 4,
    },
    summaryPrice: {
        fontSize: 20,
        fontWeight: '700',
        color: '#10b981',
        marginTop: 6,
    },
    summaryDivider: {
        height: 1,
        backgroundColor: colors.border.dark,
        marginVertical: 4,
    },
    buttonContainer: {
        marginTop: 0,
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

