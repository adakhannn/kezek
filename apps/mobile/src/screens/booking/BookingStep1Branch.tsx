import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { supabase } from '../../lib/supabase';
import { useBooking } from '../../contexts/BookingContext';
import { colors } from '../../constants/colors';
import Button from '../../components/ui/Button';
import BookingProgressIndicator from '../../components/BookingProgressIndicator';
import RatingBadge from '../../components/ui/RatingBadge';

type RouteParams = {
    slug: string;
};

type NavigationProp = NativeStackNavigationProp<any>;
type RouteProp = RouteProp<{ params: RouteParams }, 'params'>;

export default function BookingStep1Branch() {
    const navigation = useNavigation<NavigationProp>();
    const route = useRoute<RouteProp>();
    const { slug } = route.params || {};
    const { bookingData, setBusiness, setBranches, setBranchId } = useBooking();

    const { data: businessData, isLoading } = useQuery({
        queryKey: ['business', slug],
        queryFn: async () => {
            const { data: biz, error } = await supabase
                .from('businesses')
                .select('id, name, slug, rating_score')
                .eq('slug', slug)
                .eq('is_approved', true)
                .single();

            if (error) throw error;
            if (!biz) throw new Error('Бизнес не найден');

            const { data: branches, error: branchesError } = await supabase
                .from('branches')
                .select('id, name, rating_score')
                .eq('biz_id', biz.id)
                .eq('is_active', true)
                .order('rating_score', { ascending: false, nullsFirst: false })
                .order('name');

            if (branchesError) throw branchesError;

            return {
                business: biz,
                branches: branches || [],
            };
        },
        enabled: !!slug,
    });

    useEffect(() => {
        if (businessData) {
            setBusiness(businessData.business);
            setBranches(businessData.branches);
            if (businessData.branches.length === 1) {
                // Если филиал один, автоматически выбираем его
                setBranchId(businessData.branches[0].id);
            }
        }
    }, [businessData, setBusiness, setBranches, setBranchId]);

    const handleSelectBranch = (branchId: string) => {
        setBranchId(branchId);
    };

    const handleNext = () => {
        if (bookingData.branchId) {
            // @ts-ignore
            navigation.navigate('BookingStep2Service');
        }
    };

    if (isLoading) {
        return (
            <View style={styles.container}>
                <Text style={styles.loadingText}>Загрузка...</Text>
            </View>
        );
    }

    if (!businessData) {
        return (
            <View style={styles.container}>
                <Text style={styles.error}>Бизнес не найден</Text>
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
                            {businessData.business.rating_score !== null && businessData.business.rating_score !== undefined && (
                                <RatingBadge rating={businessData.business.rating_score} />
                            )}
                        </View>
                    </View>

                    {/* Промоакции для выбранного филиала */}
                    {bookingData.promotions && bookingData.promotions.length > 0 && bookingData.branchId && (
                        <View style={styles.promotionsSection}>
                            <Text style={styles.promotionsTitle}>Акции</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.promotionsScroll}>
                                {bookingData.promotions
                                    .filter((promo) => promo.branch_id === bookingData.branchId)
                                    .map((promo) => (
                                        <View key={promo.id} style={styles.promotionCard}>
                                            <Ionicons name="gift-outline" size={20} color="#10b981" />
                                            <Text style={styles.promotionText} numberOfLines={2}>
                                                {promo.title_ru || 'Акция'}
                                            </Text>
                                        </View>
                                    ))}
                            </ScrollView>
                        </View>
                    )}

                    <View style={styles.section}>
                        {businessData.branches.length > 0 ? (
                            <View style={styles.optionsList}>
                                {businessData.branches.map((branch) => {
                                    const isSelected = bookingData.branchId === branch.id;
                                    return (
                                        <TouchableOpacity
                                            key={branch.id}
                                            style={styles.chipContainer}
                                            onPress={() => handleSelectBranch(branch.id)}
                                            activeOpacity={0.7}
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
                                                {branch.rating_score !== null && branch.rating_score !== undefined && (
                                                    <RatingBadge rating={branch.rating_score} size="small" />
                                                )}
                                            </View>
                                        </LinearGradient>
                                    ) : (
                                        <View style={styles.chip}>
                                            <View style={styles.chipContent}>
                                                <Text style={styles.chipText}>{branch.name}</Text>
                                                {branch.rating_score !== null && branch.rating_score !== undefined && (
                                                    <RatingBadge rating={branch.rating_score} size="small" />
                                                )}
                                            </View>
                                        </View>
                                    )}
                                        </TouchableOpacity>
                                    );
                        })}
                    </View>
                ) : (
                    <View style={styles.emptyContainer}>
                        <Ionicons name="location-outline" size={48} color={colors.text.tertiary} />
                        <Text style={styles.emptyText}>Нет доступных филиалов</Text>
                    </View>
                )}

                {businessData.branches.length > 0 && (
                    <View style={styles.buttonContainer}>
                        <Button
                            title="Дальше"
                            onPress={handleNext}
                            disabled={!bookingData.branchId}
                            variant="primary"
                        />
                    </View>
                )}
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
    loadingText: {
        textAlign: 'center',
        padding: 40,
        color: colors.text.secondary,
    },
    error: {
        textAlign: 'center',
        padding: 40,
        color: colors.status.cancelled,
        fontSize: 16,
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
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: colors.border.light,
        backgroundColor: colors.background.secondary,
    },
    chipSelected: {
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
        padding: 40,
        alignItems: 'center',
        gap: 12,
    },
    emptyText: {
        fontSize: 16,
        color: colors.text.secondary,
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
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
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
        color: '#059669',
        flex: 1,
    },
});

