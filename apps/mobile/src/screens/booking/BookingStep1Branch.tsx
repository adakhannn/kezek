import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useNavigation, useRoute, type RouteProp as NavigationRouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
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
    const preparedData = initialData?.business.slug === slug ? initialData : undefined;
    const { businessData: fallbackData, isLoading } = useBookingStep1Business({
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
            <View style={styles.container}>
                <LoadingSpinner message="Загрузка..." />
            </View>
        );
    }

    if (!businessData) {
        return (
            <View style={styles.container}>
                <EmptyState
                    icon="business-outline"
                    title="Бизнес не найден"
                    message="Попробуйте вернуться к списку и выбрать другой бизнес."
                />
            </View>
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
                <BookingProgressIndicator currentStep={1} />
                <View style={styles.header}>
                    <View style={styles.headerRow}>
                        <Text style={styles.title}>{businessData.business.name}</Text>
                        <RatingBadge rating={businessData.business.rating_score ?? null} />
                    </View>
                </View>

                {bookingData.promotions && bookingData.promotions.length > 0 && bookingData.branchId ? (
                    <View style={styles.promotionsSection}>
                        <Text style={styles.promotionsTitle}>Акции</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.promotionsScroll}>
                            {bookingData.promotions
                                .filter((promo) => promo.branch_id === bookingData.branchId)
                                .map((promo) => (
                                    <View key={promo.id} style={styles.promotionCard}>
                                        <Ionicons name="gift-outline" size={20} color={colors.status.success} />
                                        <Text style={styles.promotionText} numberOfLines={2}>
                                            {promo.title_ru || 'Акция'}
                                        </Text>
                                    </View>
                                ))}
                        </ScrollView>
                    </View>
                ) : null}

                <View style={styles.section}>
                    {businessData.branches.length > 0 ? (
                        <View style={styles.optionsList}>
                            {businessData.branches.map((branch) => {
                                const isSelected = bookingData.branchId === branch.id;
                                return (
                                    <MotionPressable
                                        key={branch.id}
                                        style={styles.chipContainer}
                                        onPress={() => handleSelectBranch(branch.id)}
                                    >
                                        {isSelected ? (
                                            <LinearGradient
                                                colors={['rgba(79, 70, 229, 0.1)', 'rgba(79, 70, 229, 0.15)']}
                                                start={{ x: 0, y: 0 }}
                                                end={{ x: 1, y: 0 }}
                                                style={styles.chipSelected}
                                            >
                                                <View style={styles.chipContent}>
                                                    <Text style={styles.chipTextSelected}>{branch.name}</Text>
                                                    <RatingBadge rating={branch.rating_score ?? null} size="small" />
                                                </View>
                                            </LinearGradient>
                                        ) : (
                                            <View style={styles.chip}>
                                                <View style={styles.chipContent}>
                                                    <Text style={styles.chipText}>{branch.name}</Text>
                                                    <RatingBadge rating={branch.rating_score ?? null} size="small" />
                                                </View>
                                            </View>
                                        )}
                                    </MotionPressable>
                                );
                            })}
                        </View>
                    ) : (
                        <EmptyState
                            icon="location-outline"
                            title="Нет доступных филиалов"
                            message="После выбора бизнеса здесь появятся филиалы для записи."
                            compact
                            style={styles.emptyContainer}
                        />
                    )}

                    {businessData.branches.length > 0 ? (
                        <View style={styles.buttonContainer}>
                            <Button
                                title="Дальше"
                                onPress={handleNext}
                                disabled={!bookingData.branchId}
                                variant="primary"
                            />
                        </View>
                    ) : null}
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
    },
    promotionsSection: {
        paddingHorizontal: 20,
        paddingBottom: 16,
    },
    promotionsTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.text.primary,
        marginBottom: 12,
    },
    promotionsScroll: {
        flexDirection: 'row',
    },
    promotionCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: colors.feedback.successSurface,
        borderWidth: 1,
        borderColor: 'rgba(16, 185, 129, 0.3)',
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 8,
        marginRight: 8,
        minWidth: 120,
    },
    promotionText: {
        fontSize: 12,
        fontWeight: '500',
        color: colors.status.success,
        flex: 1,
    },
});

