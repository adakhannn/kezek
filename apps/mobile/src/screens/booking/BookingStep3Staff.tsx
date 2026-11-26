import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useBooking } from '../../contexts/BookingContext';
import { colors } from '../../constants/colors';
import Avatar from '../../components/ui/Avatar';
import Button from '../../components/ui/Button';
import EmptyState from '../../components/ui/EmptyState';
import { ListGroup } from '../../components/ui/ListRow';
import RatingBadge from '../../components/ui/RatingBadge';
import Section from '../../components/ui/Section';
import { useLanguage } from '../../i18n';
import { RootStackParamList } from '../../navigation/types';
import { trackMobileEvent } from '../../lib/analytics';
import BookingLoadError from './BookingLoadError';
import { ANY_STAFF } from './bookingSelection';
import { BookingContextLine, BookingOptionRow, BookingStepScreen, BookingStepSkeleton } from './BookingStepLayout';
import { useBookingStep3Staff } from './useBookingStep3Staff';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function BookingStep3Staff() {
    const navigation = useNavigation<NavigationProp>();
    const { bookingData, setStaff, setStaffId } = useBooking();
    const { t } = useLanguage();
    const { staffData, isLoading, hasError, isRetrying, retry } = useBookingStep3Staff({
        bookingData,
        setStaff,
        setStaffId,
    });
    const goBack = () => navigation.goBack();

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

    const context = <BookingContextLine name={bookingData.business?.name} />;

    if (isLoading) {
        return (
            <BookingStepScreen step={3}>
                {context}
                <BookingStepSkeleton label={t('booking.step3.loading')} rows={4} avatar />
            </BookingStepScreen>
        );
    }

    if (hasError) {
        return (
            <BookingStepScreen step={3}>
                {context}
                <BookingLoadError title={t('booking.error.loadStaff')} onRetry={retry} retrying={isRetrying} />
            </BookingStepScreen>
        );
    }

    if (!staffData || staffData.length === 0) {
        return (
            <BookingStepScreen step={3}>
                {context}
                <EmptyState
                    icon="person-outline"
                    title={t('booking.step3.emptyTitle')}
                    message={t('booking.step3.emptyMessage')}
                    compact
                    action={<Button title={t('booking.nav.back')} onPress={goBack} variant="outline" fullWidth />}
                />
            </BookingStepScreen>
        );
    }

    return (
        <BookingStepScreen
            step={3}
            back={goBack}
            next={{ title: t('booking.nav.next'), onPress: handleNext, disabled: !bookingData.staffId }}
        >
            {context}
            <Section title={t('booking.progress.staff')}>
                <ListGroup inset>
                    {/* "Any master" (C4): the times of every master; the chosen time names the master. */}
                    <BookingOptionRow
                        key={ANY_STAFF}
                        title={t('booking.step3.anyMaster')}
                        subtitle={t('booking.step3.anyMasterHint')}
                        leading={(
                            <View style={styles.anyIcon}>
                                <Ionicons name="people-outline" size={20} color={colors.tone.accent.fg} />
                            </View>
                        )}
                        selected={bookingData.staffId === ANY_STAFF}
                        onPress={() => handleSelectStaff(ANY_STAFF)}
                        accessibilityHint={t('booking.step3.anyMasterHint')}
                    />
                    {staffData.map((staff) => {
                        const isSelected = bookingData.staffId === staff.id;
                        return (
                            <BookingOptionRow
                                key={staff.id}
                                title={staff.full_name}
                                leading={<Avatar name={staff.full_name} uri={staff.avatar_url} size={40} ring={isSelected} />}
                                footer={<RatingBadge rating={staff.rating_score ?? null} size="small" />}
                                selected={isSelected}
                                onPress={() => handleSelectStaff(staff.id)}
                            />
                        );
                    })}
                </ListGroup>
            </Section>
        </BookingStepScreen>
    );
}

const styles = StyleSheet.create({
    anyIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.tone.accent.bg,
    },
});
