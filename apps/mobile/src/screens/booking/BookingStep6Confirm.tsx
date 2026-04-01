import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { formatTimeSlot } from '@shared-client/formatters';
import { colors } from '../../constants/colors';
import Card from '../../components/ui/Card';
import OfflineBanner from '../../components/ui/OfflineBanner';
import Button from '../../components/ui/Button';
import BookingProgressIndicator from '../../components/BookingProgressIndicator';
import RatingBadge from '../../components/ui/RatingBadge';
import { RootStackParamList } from '../../navigation/types';
import { useBookingStep6Confirm } from './useBookingStep6Confirm';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const TZ = 'Asia/Bishkek';

export default function BookingStep6Confirm() {
    const navigation = useNavigation<NavigationProp>();
    const {
        bookingData,
        selectedService,
        selectedStaff,
        dateLabel,
        priceLabel,
        handleCreateBooking,
        isOffline,
        isPending,
    } = useBookingStep6Confirm(navigation);

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
                        <RatingBadge rating={bookingData.business?.rating_score ?? null} />
                    </View>
                </View>

                <View style={styles.section}>
                    {isOffline && (
                        <OfflineBanner message="Создание записи недоступно без сети. Дождитесь восстановления соединения." />
                    )}
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
                                {priceLabel && <Text style={styles.summaryPrice}>{priceLabel}</Text>}
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
                                        {formatTimeSlot(bookingData.selectedSlot.start_at, TZ)}
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
                            loading={isPending}
                            disabled={isPending || !bookingData.selectedSlot || isOffline}
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
