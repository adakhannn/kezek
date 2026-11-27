import { StyleSheet, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp as NavigationRouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useBooking } from '../../contexts/BookingContext';
import Badge from '../../components/ui/Badge';
import EmptyState from '../../components/ui/EmptyState';
import { ListGroup } from '../../components/ui/ListRow';
import RatingBadge from '../../components/ui/RatingBadge';
import Section from '../../components/ui/Section';
import { space } from '../../constants/theme';
import { useLanguage } from '../../i18n';
import { RootStackParamList } from '../../navigation/types';
import { trackMobileEvent } from '../../lib/analytics';
import { getPromotionTitle } from '../../utils/i18n';
import BookingLoadError from './BookingLoadError';
import { BookingContextLine, BookingOptionRow, BookingStepScreen, BookingStepSkeleton } from './BookingStepLayout';
import { useBookingStep1Business } from './useBookingStep1Business';
import type { BookingInitialData } from '../bookingFlow/useBookingScreenData';

type RouteParams = {
    slug: string;
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type BookingStep1RouteProp = NavigationRouteProp<{ params: RouteParams }, 'params'>;

type BookingStep1BranchProps = {
    initialData?: BookingInitialData;
};

export default function BookingStep1Branch({ initialData }: BookingStep1BranchProps) {
    const navigation = useNavigation<NavigationProp>();
    const route = useRoute<BookingStep1RouteProp>();
    const { slug } = route.params || {};
    const { bookingData, hydrateInitialData, setBranchId } = useBooking();
    const { t } = useLanguage();
    const preparedData = initialData?.business.slug === slug ? initialData : undefined;
    const {
        businessData: fallbackData,
        isLoading,
        hasError,
        isRetrying,
        retry,
    } = useBookingStep1Business({
        slug: preparedData ? undefined : slug,
        hydrateInitialData,
    });
    const businessData = preparedData ?? fallbackData;

    const handleSelectBranch = (branchId: string) => {
        setBranchId(branchId);
        if (bookingData.business?.id) {
            trackMobileEvent({
                eventType: 'booking_flow_step',
                bizId: bookingData.business.id,
                branchId,
                metadata: { step: 'branch' },
            });
        }
    };

    const handleNext = () => {
        if (bookingData.branchId) {
            navigation.navigate('BookingStep2Service');
        }
    };

    if (isLoading) {
        return (
            <BookingStepScreen step={1}>
                <BookingStepSkeleton label={t('common.loading')} rows={3} />
            </BookingStepScreen>
        );
    }

    if (!businessData && hasError) {
        return (
            <BookingStepScreen step={1}>
                <BookingLoadError title={t('booking.error.loadBusiness')} onRetry={retry} retrying={isRetrying} />
            </BookingStepScreen>
        );
    }

    if (!businessData) {
        return (
            <BookingStepScreen step={1}>
                <EmptyState
                    icon="business-outline"
                    title={t('booking.error.businessNotFound')}
                    message={t('booking.step1.notFoundMessage')}
                />
            </BookingStepScreen>
        );
    }

    const branchPromotions = (bookingData.promotions ?? []).filter((promo) => promo.branch_id === bookingData.branchId);
    const hasBranches = businessData.branches.length > 0;

    return (
        <BookingStepScreen
            step={1}
            next={hasBranches ? {
                title: t('booking.nav.next'),
                onPress: handleNext,
                disabled: !bookingData.branchId,
            } : undefined}
        >
            <BookingContextLine name={businessData.business.name} />

            {hasBranches ? (
                <Section title={t('booking.progress.branch')}>
                    <ListGroup>
                        {businessData.branches.map((branch) => (
                            <BookingOptionRow
                                key={branch.id}
                                title={branch.name}
                                subtitle={branch.address?.trim() || null}
                                selected={bookingData.branchId === branch.id}
                                onPress={() => handleSelectBranch(branch.id)}
                                footer={<RatingBadge rating={branch.rating_score ?? null} size="small" />}
                                testID={`booking-branch-${branch.id}`}
                            />
                        ))}
                    </ListGroup>
                </Section>
            ) : (
                <EmptyState
                    icon="location-outline"
                    title={t('booking.step1.emptyTitle')}
                    message={t('booking.step1.emptyMessage')}
                    compact
                />
            )}

            {branchPromotions.length > 0 ? (
                <Section title={t('booking.step1.promotions')}>
                    <View style={styles.badges}>
                        {branchPromotions.map((promo) => (
                            <Badge
                                key={promo.id}
                                size="md"
                                tone="success"
                                icon="gift-outline"
                                label={getPromotionTitle(promo, t.locale) || t('booking.step1.promotionFallback')}
                            />
                        ))}
                    </View>
                </Section>
            ) : null}
        </BookingStepScreen>
    );
}

const styles = StyleSheet.create({
    badges: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
