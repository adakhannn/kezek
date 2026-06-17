import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';

import { useBooking } from '../../contexts/BookingContext';
import { colors } from '../../constants/colors';
import { MIN_TOUCH_TARGET } from '../../constants/accessibility';
import Button from '../../components/ui/Button';
import BookingProgressIndicator from '../../components/BookingProgressIndicator';
import EmptyState from '../../components/ui/EmptyState';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import MotionPressable from '../../components/ui/MotionPressable';
import RatingBadge from '../../components/ui/RatingBadge';
import { RootStackParamList } from '../../navigation/types';
import { trackMobileEvent } from '../../lib/analytics';
import { useBookingStep3Staff } from './useBookingStep3Staff';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function BookingStep3Staff() {
    const navigation = useNavigation<NavigationProp>();
    const { bookingData, setStaff, setStaffId } = useBooking();
    const { staffData, isLoading } = useBookingStep3Staff({
        bookingData,
        setStaff,
        setStaffId,
    });

    const handleSelectStaff = (staffId: string) => {
        setStaffId(staffId);
        if (bookingData.business?.id) {
            trackMobileEvent({
                eventType: 'booking_flow_step',
                bizId: bookingData.business.id,
                branchId: bookingData.branchId ?? undefined,
                metadata: { step: 'staff' },
            });
        }
    };

    const handleNext = () => {
        if (bookingData.staffId) {
            navigation.navigate('BookingStep4Date');
        }
    };

    if (isLoading) {
        return (
            <View style={styles.container}>
                <LoadingSpinner message="Загрузка мастеров..." />
            </View>
        );
    }

    if (!staffData || staffData.length === 0) {
        return (
            <LinearGradient
                colors={[colors.background.gradient.from, colors.background.gradient.via, colors.background.gradient.to]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.gradientContainer}
            >
                <View style={styles.container}>
                    <BookingProgressIndicator currentStep={3} />
                    <View style={styles.header}>
                        <Text style={styles.title}>{bookingData.business?.name}</Text>
                    </View>
                    <EmptyState
                        icon="person-outline"
                        title="Нет доступных мастеров"
                        message="Для выбранной услуги пока нет активных сотрудников."
                        compact
                        style={styles.emptyContainer}
                    />
                </View>
            </LinearGradient>
        );
    }

    return (
        <LinearGradient
            colors={[colors.background.gradient.from, colors.background.gradient.via, colors.background.gradient.to]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.gradientContainer}
        >
            <ScrollView style={styles.container} contentContainerStyle={styles.content}>
                <BookingProgressIndicator currentStep={3} />
                <View style={styles.header}>
                    <Text style={styles.title}>{bookingData.business?.name}</Text>
                </View>

                <View style={styles.section}>
                    <View style={styles.optionsList}>
                        {staffData.map((staff) => {
                            const isSelected = bookingData.staffId === staff.id;
                            return (
                                <MotionPressable
                                    key={staff.id}
                                    style={styles.chipContainer}
                                    onPress={() => handleSelectStaff(staff.id)}
                                >
                                    {isSelected ? (
                                        <LinearGradient
                                            colors={['rgba(79, 70, 229, 0.1)', 'rgba(79, 70, 229, 0.15)']}
                                            start={{ x: 0, y: 0 }}
                                            end={{ x: 1, y: 0 }}
                                            style={styles.chipSelected}
                                        >
                                            <View style={styles.chipContent}>
                                                <Text style={styles.chipTextSelected}>{staff.full_name}</Text>
                                                <RatingBadge rating={staff.rating_score ?? null} size="small" />
                                            </View>
                                        </LinearGradient>
                                    ) : (
                                        <View style={styles.chip}>
                                            <View style={styles.chipContent}>
                                                <Text style={styles.chipText}>{staff.full_name}</Text>
                                                <RatingBadge rating={staff.rating_score ?? null} size="small" />
                                            </View>
                                        </View>
                                    )}
                                </MotionPressable>
                            );
                        })}
                    </View>

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
                            disabled={!bookingData.staffId}
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
    section: {
        padding: 20,
    },
    optionsList: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    chipContainer: {
        marginBottom: 4,
    },
    chip: {
        minHeight: MIN_TOUCH_TARGET,
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: colors.border.light,
        backgroundColor: colors.background.secondary,
    },
    chipSelected: {
        minHeight: MIN_TOUCH_TARGET,
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: colors.primary.from,
    },
    chipText: {
        fontSize: 12,
        fontWeight: '500',
        color: colors.text.primary,
    },
    chipTextSelected: {
        fontSize: 12,
        fontWeight: '500',
        color: colors.primary.from,
    },
    chipContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    emptyContainer: {
        paddingHorizontal: 0,
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

