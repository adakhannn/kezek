import { Pressable, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { colors } from '../constants/colors';
import { MIN_TOUCH_TARGET } from '../constants/accessibility';
import { layout, radii, space } from '../constants/theme';
import { useBooking } from '../contexts/BookingContext';
import { useLanguage, type MobileI18nKey } from '../i18n';
import { RootStackParamList } from '../navigation/types';

type StepInfo = {
    number: number;
    titleKey: MobileI18nKey;
    screenName: string;
};

const STEPS: StepInfo[] = [
    { number: 1, titleKey: 'booking.progress.branch', screenName: 'BookingStep1Branch' },
    { number: 2, titleKey: 'booking.progress.service', screenName: 'BookingStep2Service' },
    { number: 3, titleKey: 'booking.progress.staff', screenName: 'BookingStep3Staff' },
    { number: 4, titleKey: 'booking.progress.date', screenName: 'BookingStep4Date' },
    { number: 5, titleKey: 'booking.progress.time', screenName: 'BookingStep5Time' },
    { number: 6, titleKey: 'booking.progress.confirm', screenName: 'BookingStep6Confirm' },
];

const SEGMENT_HEIGHT = 4;
/** The visible bar is thin; each segment still takes a 44dp touch target. */
const SEGMENT_HIT = (MIN_TOUCH_TARGET - SEGMENT_HEIGHT) / 2;

type BookingProgressIndicatorProps = {
    currentStep: number;
};

/**
 * The one progress element of the booking flow: six thin segments under the header (which already
 * says "2 / 6 · Услуга"). Done steps are filled and tappable to go back to them.
 */
export default function BookingProgressIndicator({ currentStep }: BookingProgressIndicatorProps) {
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
    const { bookingData } = useBooking();
    const { t } = useLanguage();
    const totalSteps = STEPS.length;
    const current = STEPS[currentStep - 1];
    const label = [
        t('booking.progress.stepOf', { current: currentStep, total: totalSteps }),
        current ? t(current.titleKey) : null,
    ].filter(Boolean).join(', ');

    const handleStepPress = (step: StepInfo) => {
        if (step.number < currentStep) {
            const nav = navigation as unknown as {
                navigate: (
                    screen: keyof RootStackParamList,
                    params?: RootStackParamList[keyof RootStackParamList]
                ) => void;
            };
            if (step.number === 1 && bookingData.business?.slug) {
                nav.navigate(step.screenName as keyof RootStackParamList, { slug: bookingData.business.slug });
            } else if (step.number > 1) {
                nav.navigate(step.screenName as keyof RootStackParamList);
            }
        }
    };

    return (
        <View
            style={styles.container}
            accessible={false}
            accessibilityRole="progressbar"
            accessibilityLabel={label}
            accessibilityValue={{ min: 1, max: totalSteps, now: currentStep }}
            testID="booking-progress"
        >
            {STEPS.map((step) => {
                const isDone = step.number < currentStep;
                const isCurrent = step.number === currentStep;
                return (
                    <Pressable
                        key={step.number}
                        onPress={() => handleStepPress(step)}
                        disabled={!isDone}
                        hitSlop={{ top: SEGMENT_HIT, bottom: SEGMENT_HIT }}
                        style={styles.segmentPressable}
                        accessibilityRole="button"
                        accessibilityLabel={`${step.number}. ${t(step.titleKey)}`}
                        accessibilityState={{ disabled: !isDone, selected: isCurrent }}
                        accessibilityHint={isDone ? t('booking.progress.stepHint') : undefined}
                    >
                        <View
                            style={[
                                styles.segment,
                                isDone ? styles.segmentDone : null,
                                isCurrent ? styles.segmentCurrent : null,
                            ]}
                        />
                    </Pressable>
                );
            })}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        gap: space.xs,
        paddingHorizontal: layout.gutter,
        paddingTop: space.xs,
        paddingBottom: space.md,
        backgroundColor: colors.surface.card,
    },
    segmentPressable: {
        flex: 1,
        justifyContent: 'center',
    },
    segment: {
        height: SEGMENT_HEIGHT,
        borderRadius: radii.pill,
        backgroundColor: colors.fill.track,
    },
    segmentDone: {
        backgroundColor: colors.accent.primary,
    },
    segmentCurrent: {
        backgroundColor: colors.tone.accent.fg,
    },
});
