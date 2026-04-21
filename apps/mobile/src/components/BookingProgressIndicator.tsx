import { View, Text, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { colors } from '../constants/colors';
import { useBooking } from '../contexts/BookingContext';
import { RootStackParamList } from '../navigation/types';
import MotionPressable from './ui/MotionPressable';

type StepInfo = {
    number: number;
    title: string;
    screenName: string;
};

const STEPS: StepInfo[] = [
    { number: 1, title: 'Р¤РёР»РёР°Р»', screenName: 'BookingStep1Branch' },
    { number: 2, title: 'РЈСЃР»СѓРіР°', screenName: 'BookingStep2Service' },
    { number: 3, title: 'РњР°СЃС‚РµСЂ', screenName: 'BookingStep3Staff' },
    { number: 4, title: 'Р”Р°С‚Р°', screenName: 'BookingStep4Date' },
    { number: 5, title: 'Р’СЂРµРјСЏ', screenName: 'BookingStep5Time' },
    { number: 6, title: 'Подтверждение', screenName: 'BookingStep6Confirm' },
];

type BookingProgressIndicatorProps = {
    currentStep: number;
};

export default function BookingProgressIndicator({ currentStep }: BookingProgressIndicatorProps) {
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
    const { bookingData } = useBooking();
    const totalSteps = STEPS.length;
    const progress = (currentStep / totalSteps) * 100;

    const handleStepPress = (step: StepInfo) => {
        if (step.number <= currentStep && step.number < currentStep) {
            if (step.number === 1 && bookingData.business?.slug) {
                (
                    navigation as unknown as {
                        navigate: (
                            screen: keyof RootStackParamList,
                            params?: RootStackParamList[keyof RootStackParamList]
                        ) => void;
                    }
                ).navigate(step.screenName as keyof RootStackParamList, { slug: bookingData.business.slug });
            } else if (step.number > 1) {
                (
                    navigation as unknown as {
                        navigate: (
                            screen: keyof RootStackParamList,
                            params?: RootStackParamList[keyof RootStackParamList]
                        ) => void;
                    }
                ).navigate(step.screenName as keyof RootStackParamList);
            }
        }
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.stepText}>
                    РЁР°Рі {currentStep} РёР· {totalSteps}
                </Text>
                <Text style={styles.stepTitle}>{STEPS[currentStep - 1]?.title}</Text>
            </View>

            <View style={styles.progressBarContainer}>
                <View style={styles.progressBarBackground}>
                    <View style={[styles.progressBarFill, { width: `${progress}%` }]} />
                </View>
            </View>

            <View style={styles.stepsContainer}>
                {STEPS.map((step, index) => {
                    const isCompleted = step.number < currentStep;
                    const isCurrent = step.number === currentStep;
                    const isUpcoming = step.number > currentStep;
                    const isClickable = step.number < currentStep;

                    return (
                        <View key={step.number} style={styles.stepItem}>
                            <MotionPressable
                                onPress={() => handleStepPress(step)}
                                disabled={!isClickable}
                                style={styles.stepPressable}
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
                            </MotionPressable>
                            {index < STEPS.length - 1 ? (
                                <View style={[styles.stepLine, isCompleted && styles.stepLineCompleted]} />
                            ) : null}
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
    stepPressable: {
        padding: 2,
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
    stepDotClickable: {},
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
