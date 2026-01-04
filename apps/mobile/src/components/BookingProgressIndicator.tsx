import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors } from '../constants/colors';
import { useBooking } from '../contexts/BookingContext';

type StepInfo = {
    number: number;
    title: string;
    screenName: string;
};

const STEPS: StepInfo[] = [
    { number: 1, title: 'Филиал', screenName: 'BookingStep1Branch' },
    { number: 2, title: 'Услуга', screenName: 'BookingStep2Service' },
    { number: 3, title: 'Мастер', screenName: 'BookingStep3Staff' },
    { number: 4, title: 'Дата', screenName: 'BookingStep4Date' },
    { number: 5, title: 'Время', screenName: 'BookingStep5Time' },
    { number: 6, title: 'Подтверждение', screenName: 'BookingStep6Confirm' },
];

type BookingProgressIndicatorProps = {
    currentStep: number;
};

export default function BookingProgressIndicator({ currentStep }: BookingProgressIndicatorProps) {
    const navigation = useNavigation<NativeStackNavigationProp<any>>();
    const route = useRoute();
    const { bookingData } = useBooking();
    const totalSteps = STEPS.length;
    const progress = (currentStep / totalSteps) * 100;

    const handleStepPress = (step: StepInfo) => {
        // Можно переходить только на завершенные шаги или текущий
        if (step.number <= currentStep && step.number < currentStep) {
            // Для первого шага нужен slug
            if (step.number === 1 && bookingData.business?.slug) {
                // @ts-ignore
                navigation.navigate(step.screenName, { slug: bookingData.business.slug });
            } else if (step.number > 1) {
                // Для остальных шагов параметры не нужны
                // @ts-ignore
                navigation.navigate(step.screenName);
            }
        }
    };

    return (
        <View style={styles.container}>
            {/* Текст с текущим шагом */}
            <View style={styles.header}>
                <Text style={styles.stepText}>
                    Шаг {currentStep} из {totalSteps}
                </Text>
                <Text style={styles.stepTitle}>{STEPS[currentStep - 1]?.title}</Text>
            </View>

            {/* Полоса прогресса */}
            <View style={styles.progressBarContainer}>
                <View style={styles.progressBarBackground}>
                    <View style={[styles.progressBarFill, { width: `${progress}%` }]} />
                </View>
            </View>

            {/* Точки для каждого шага */}
            <View style={styles.stepsContainer}>
                {STEPS.map((step, index) => {
                    const isCompleted = step.number < currentStep;
                    const isCurrent = step.number === currentStep;
                    const isUpcoming = step.number > currentStep;
                    const isClickable = step.number <= currentStep;

                    return (
                        <View key={step.number} style={styles.stepItem}>
                            <TouchableOpacity
                                onPress={() => handleStepPress(step)}
                                disabled={!isClickable}
                                activeOpacity={isClickable ? 0.7 : 1}
                            >
                                <View
                                    style={[
                                        styles.stepDot,
                                        isCompleted && styles.stepDotCompleted,
                                        isCurrent && styles.stepDotCurrent,
                                        isUpcoming && styles.stepDotUpcoming,
                                        isClickable && styles.stepDotClickable,
                                    ]}
                                />
                            </TouchableOpacity>
                            {index < STEPS.length - 1 && (
                                <View
                                    style={[
                                        styles.stepLine,
                                        isCompleted && styles.stepLineCompleted,
                                    ]}
                                />
                            )}
                        </View>
                    );
                })}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        padding: 20,
        backgroundColor: colors.background.secondary,
        borderBottomWidth: 1,
        borderBottomColor: colors.border.dark,
    },
    header: {
        marginBottom: 16,
        alignItems: 'center',
    },
    stepText: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.text.secondary,
        marginBottom: 4,
    },
    stepTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: colors.text.primary,
    },
    progressBarContainer: {
        marginBottom: 16,
    },
    progressBarBackground: {
        height: 4,
        backgroundColor: colors.border.light,
        borderRadius: 2,
        overflow: 'hidden',
    },
    progressBarFill: {
        height: '100%',
        backgroundColor: colors.primary.from,
        borderRadius: 2,
    },
    stepsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 8,
    },
    stepItem: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    stepDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: colors.border.light,
        borderWidth: 2,
        borderColor: colors.border.light,
    },
    stepDotCompleted: {
        backgroundColor: colors.primary.from,
        borderColor: colors.primary.from,
    },
    stepDotCurrent: {
        backgroundColor: colors.primary.from,
        borderColor: colors.primary.from,
        width: 16,
        height: 16,
        borderRadius: 8,
        ...colors.shadow.md,
    },
    stepDotUpcoming: {
        backgroundColor: colors.background.secondary,
        borderColor: colors.border.light,
    },
    stepDotClickable: {
        // Добавляем визуальную подсказку, что можно кликнуть
    },
    stepLine: {
        flex: 1,
        height: 2,
        backgroundColor: colors.border.light,
        marginHorizontal: 4,
    },
    stepLineCompleted: {
        backgroundColor: colors.primary.from,
    },
});

