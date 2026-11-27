import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useBooking } from '../../contexts/BookingContext';
import { colors } from '../../constants/colors';
import { layout, radii, space, typeScale } from '../../constants/theme';
import Section from '../../components/ui/Section';
import { useLanguage } from '../../i18n';
import { RootStackParamList } from '../../navigation/types';
import { trackMobileEvent } from '../../lib/analytics';
import { BookingContextLine, BookingStepScreen } from './BookingStepLayout';
import { useBookingStep4Dates } from './useBookingStep4Dates';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

/** The booking window as one line of day tiles that scrolls sideways (as the web step). */
export default function BookingStep4Date() {
    const navigation = useNavigation<NavigationProp>();
    const { bookingData, setSelectedDate } = useBooking();
    const { dates, todayInTz, formatDateLabel } = useBookingStep4Dates(bookingData.business?.tz);
    const { t } = useLanguage();

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
            navigation.navigate('BookingStep5Time');
        }
    };

    return (
        <BookingStepScreen
            step={4}
            back={() => navigation.goBack()}
            next={{ title: t('booking.nav.next'), onPress: handleNext, disabled: !bookingData.selectedDate }}
        >
            <BookingContextLine name={bookingData.business?.name} />
            <Section title={t('booking.progress.date')}>
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.bleed}
                    contentContainerStyle={styles.strip}
                >
                    {dates.map((date) => {
                        const dateLabel = formatDateLabel(date);
                        const isToday = date === todayInTz;
                        const selected = bookingData.selectedDate === date;

                        return (
                            <Pressable
                                key={date}
                                style={({ pressed }) => [
                                    styles.day,
                                    isToday ? styles.dayToday : null,
                                    selected ? styles.daySelected : null,
                                    pressed ? styles.pressed : null,
                                ]}
                                onPress={() => handleSelectDate(date)}
                                accessibilityRole="radio"
                                accessibilityState={{ selected, checked: selected }}
                                accessibilityLabel={[
                                    isToday ? t('booking.step4.today') : null,
                                    dateLabel.weekday,
                                    dateLabel.dayMonth,
                                ].filter(Boolean).join(', ')}
                            >
                                <Text style={[styles.weekday, selected ? styles.textSelected : null]}>
                                    {isToday ? t('booking.step4.today') : dateLabel.weekday}
                                </Text>
                                <Text style={[styles.dayNumber, selected ? styles.textSelected : null]}>
                                    {dateLabel.day}
                                </Text>
                                <Text style={[styles.month, selected ? styles.textSelected : null]}>
                                    {dateLabel.month}
                                </Text>
                            </Pressable>
                        );
                    })}
                </ScrollView>
            </Section>
        </BookingStepScreen>
    );
}

const styles = StyleSheet.create({
    bleed: { marginHorizontal: -layout.gutter, flexGrow: 0 },
    strip: { paddingHorizontal: layout.gutter, gap: space.sm },
    day: {
        width: 72,
        minHeight: 88,
        paddingVertical: space.md,
        paddingHorizontal: space.xs,
        borderRadius: radii.lg,
        backgroundColor: colors.surface.card,
        borderWidth: 1,
        borderColor: colors.surface.card,
        alignItems: 'center',
        justifyContent: 'center',
        gap: space.xxs,
    },
    dayToday: { borderColor: colors.tone.accent.border },
    daySelected: { backgroundColor: colors.accent.primary, borderColor: colors.accent.primary },
    pressed: { opacity: colors.interactive.pressedOpacity },
    weekday: { ...typeScale.caption, color: colors.text.secondary, textAlign: 'center' },
    dayNumber: { ...typeScale.metric, color: colors.text.primary },
    month: { ...typeScale.caption, color: colors.text.secondary },
    textSelected: { color: colors.text.light },
});
